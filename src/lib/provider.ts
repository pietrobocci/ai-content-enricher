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

/**
 * Errore interno al provider: come AppError, ma con l'attesa che il server
 * ha chiesto di rispettare (header Retry-After su un 429). Serve solo al
 * ciclo di ritentativi qui sotto, chi sta fuori vede un normale AppError.
 */
type ErroreConAttesa = AppError & { attesaMs?: number };

const MODELLO_DEFAULT = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Ritentativi di trasporto (rete, 429, 5xx). Attenzione: questo numero si
 * MOLTIPLICA con i ritentativi di schema di enrich.ts, perche' ogni
 * ritentativo di schema riparte con un budget di trasporto nuovo. Il caso
 * peggiore e' (1 + questo) x (1 + maxSchemaRetries) = 4 chiamate fatturate
 * per un solo arricchimento: su un piano gratuito e' il prodotto dei due
 * budget a consumare la quota, non il singolo.
 */
const RITENTATIVI_DEFAULT = 1;

/** Tetto all'attesa richiesta dal server: un Retry-After di ore bloccherebbe la richiesta dell'utente. */
const ATTESA_MASSIMA_MS = 60_000;

export function createGeminiProvider(opts: GeminiOptions): LlmProvider {
  const model = opts.model ?? MODELLO_DEFAULT;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = opts.maxRetries ?? RITENTATIVI_DEFAULT;

  async function generate(req: LlmRequest): Promise<Result<string>> {
    const url = `${BASE_URL}/${model}:generateContent`;
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

    let ultimoErrore: ErroreConAttesa = erroreSconosciuto("nessun tentativo eseguito");

    for (let tentativo = 0; tentativo <= maxRetries; tentativo++) {
      // Se il server ha detto quanto aspettare (Retry-After su un 429) si
      // rispetta quello: ritentare prima consumerebbe quota senza speranza.
      // Altrimenti si sale a gradini: 500 ms, 1 s, 2 s...
      if (tentativo > 0) await sleep(ultimoErrore.attesaMs ?? 500 * 2 ** (tentativo - 1));

      let risposta: Response;
      try {
        risposta = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // La chiave va in un header, non nella query string: una URL
            // finisce nei log dei proxy e dentro i messaggi d'errore.
            "x-goog-api-key": opts.apiKey,
          },
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
        const errore = mappaStato(
          risposta.status,
          await leggiTesto(risposta),
          leggiAttesaRichiesta(risposta)
        );
        if (!errore.retryable) return err(errore); // ritentare non servirebbe
        ultimoErrore = errore;
        continue;
      }

      let payload: unknown;
      try {
        payload = await risposta.json();
      } catch {
        // Un 200 con un corpo illeggibile non è un problema di trasporto
        // che si risolve ritentando: è una risposta fuori contratto.
        return err({
          type: "bad_response",
          message: "il corpo della risposta non è JSON valido",
          retryable: false,
        });
      }

      const testo = estraiTesto(payload);
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

function mappaStato(status: number, dettaglio: string, attesaMs?: number): ErroreConAttesa {
  if (status === 401 || status === 403) {
    return { type: "auth" as const, message: `chiave API rifiutata (${status})`, retryable: false };
  }
  // Google risponde 400 con API_KEY_INVALID quando la chiave e' malformata,
  // non 401: senza questo caso finirebbe fra gli errori sconosciuti e
  // l'utente non saprebbe che il problema e' la sua configurazione.
  if (status === 400 && dettaglio.includes("API_KEY_INVALID")) {
    return {
      type: "auth" as const,
      message: "chiave API non valida: controlla GEMINI_API_KEY nel file .env",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      type: "rate_limit" as const,
      message: "quota esaurita, riprova piu' tardi",
      retryable: true,
      attesaMs,
    };
  }
  if (status >= 500) {
    return { type: "network" as const, message: `errore del provider (${status})`, retryable: true };
  }
  // Il corpo grezzo del provider puo' contenere dettagli tecnici o pezzi
  // della richiesta: resta nei log del server, all'utente arriva un
  // messaggio generico.
  console.error(`Gemini: risposta inattesa (${status}):`, dettaglio.slice(0, 500));
  return {
    type: "unknown" as const,
    message: `il provider ha risposto in modo inatteso (${status})`,
    retryable: false,
  };
}

/**
 * Retry-After puo' contenere dei secondi oppure una data HTTP. Se non e' un
 * numero preferiamo ignorarlo, invece di indovinare una data: si ricade
 * sull'attesa a gradini.
 */
function leggiAttesaRichiesta(risposta: Response): number | undefined {
  const grezzo = risposta.headers?.get("retry-after");
  if (!grezzo) return undefined;

  const secondi = Number(grezzo.trim());
  if (!Number.isFinite(secondi) || secondi < 0) return undefined;

  return Math.min(secondi * 1000, ATTESA_MASSIMA_MS);
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
