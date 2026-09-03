import { type Result, type AppError, ok, err } from "@/lib/result";

export type LlmRequest = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  jsonSchema: unknown;
};

/**
 * Tutto il resto del progetto conosce solo questa interfaccia. Cambiare
 * provider (Claude, OpenAI, un modello locale) significa scrivere una nuova
 * implementazione di `generate`, senza toccare enrich.ts ne' i test.
 */
export type LlmProvider = {
  name: string;
  generate(req: LlmRequest): Promise<Result<string>>;
};

export type GeminiOptions = {
  apiKey: string;
  model?: string;
  /** Iniettabile per i test: di default il fetch globale. */
  fetchImpl?: typeof fetch;
  /** Iniettabile per i test: di default un'attesa reale. */
  sleep?: (ms: number) => Promise<void>;
  /** Numero massimo di ritentativi sugli errori temporanei. */
  maxRetries?: number;
};

const MODELLO_DEFAULT = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function createGeminiProvider(opts: GeminiOptions): LlmProvider {
  const model = opts.model ?? MODELLO_DEFAULT;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = opts.maxRetries ?? 2;

  async function generate(req: LlmRequest): Promise<Result<string>> {
    const url = `${BASE_URL}/${model}:generateContent?key=${opts.apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: req.mimeType, data: req.imageBase64 } },
            { text: req.prompt },
          ],
        },
      ],
      generationConfig: {
        // Vincola il modello a rispondere JSON con questa forma: la seconda
        // linea di difesa. La terza (Zod) resta comunque necessaria.
        response_mime_type: "application/json",
        response_schema: req.jsonSchema,
      },
    };

    let ultimoErrore = erroreSconosciuto("nessun tentativo eseguito");

    for (let tentativo = 0; tentativo <= maxRetries; tentativo++) {
      if (tentativo > 0) await sleep(500 * 2 ** (tentativo - 1));

      let risposta: Response;
      try {
        risposta = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        ultimoErrore = {
          type: "network",
          message: e instanceof Error ? e.message : "errore di rete",
          retryable: true,
        };
        continue; // la rete puo' migliorare: ritentiamo
      }

      if (!risposta.ok) {
        const errore = mappaStato(risposta.status, await leggiTesto(risposta));
        if (!errore.retryable) return err(errore); // ritentare non servirebbe
        ultimoErrore = errore;
        continue;
      }

      const testo = estraiTesto(await risposta.json());
      if (testo === null) {
        return err({
          type: "bad_response",
          message: "la risposta del modello non contiene testo",
          retryable: false,
        });
      }
      return ok(testo);
    }

    return err(ultimoErrore);
  }

  return { name: `gemini:${model}`, generate };
}

function mappaStato(status: number, dettaglio: string): AppError {
  if (status === 401 || status === 403) {
    return { type: "auth" as const, message: `chiave API rifiutata (${status})`, retryable: false };
  }
  if (status === 429) {
    return { type: "rate_limit" as const, message: "quota esaurita, riprova piu' tardi", retryable: true };
  }
  if (status >= 500) {
    return { type: "network" as const, message: `errore del provider (${status})`, retryable: true };
  }
  return {
    type: "unknown" as const,
    message: `risposta inattesa (${status}): ${dettaglio.slice(0, 200)}`,
    retryable: false,
  };
}

function erroreSconosciuto(message: string): AppError {
  return { type: "unknown" as const, message, retryable: false };
}

async function leggiTesto(risposta: Response): Promise<string> {
  try {
    return await risposta.text();
  } catch {
    return "";
  }
}

function estraiTesto(payload: unknown): string | null {
  const parti = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  const testo = parti?.[0]?.text;
  return typeof testo === "string" ? testo : null;
}
