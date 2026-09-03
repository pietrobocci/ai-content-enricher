import { productDraftSchema, geminiResponseSchema, type ProductDraft } from "@/lib/schema";
import { buildPrompt, buildRetryPrompt } from "@/lib/prompt";
import { type LlmProvider } from "@/lib/provider";
import { type Result, ok, err } from "@/lib/result";

export type EnrichInput = {
  imageBase64: string;
  mimeType: string;
  hint?: string;
};

export type EnrichOptions = {
  /** Quante volte richiedere una correzione dopo una risposta fuori contratto. */
  maxSchemaRetries?: number;
};

/**
 * Questa funzione non sa nulla di HTTP ne' di database: riceve un'immagine
 * gia' codificata e un provider, restituisce una bozza validata. E' per
 * questo che i test girano offline.
 */
export async function enrichImage(
  input: EnrichInput,
  provider: LlmProvider,
  opts: EnrichOptions = {}
): Promise<Result<ProductDraft>> {
  const maxSchemaRetries = opts.maxSchemaRetries ?? 1;
  const promptBase = buildPrompt({ hint: input.hint });
  const jsonSchema = geminiResponseSchema();

  let prompt = promptBase;
  let ultimoProblema = "nessuna risposta valida";

  for (let tentativo = 0; tentativo <= maxSchemaRetries; tentativo++) {
    const risposta = await provider.generate({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      prompt,
      jsonSchema,
    });

    // Un errore del provider (chiave, rete, quota) non si risolve
    // riformulando il prompt: lo restituiamo cosi' com'e'.
    if (!risposta.ok) return risposta;

    const analisi = analizza(risposta.data);
    if (analisi.ok) return analisi;

    ultimoProblema = analisi.error.message;
    prompt = buildRetryPrompt(promptBase, ultimoProblema);
  }

  return err({
    type: "bad_response",
    message: `il modello non ha rispettato il formato richiesto: ${ultimoProblema}`,
    retryable: false,
  });
}

/** Prima il JSON deve essere leggibile, poi deve rispettare il contratto. */
function analizza(testo: string): Result<ProductDraft> {
  let grezzo: unknown;
  try {
    grezzo = JSON.parse(testo);
  } catch {
    return err({ type: "bad_response", message: "la risposta non e' JSON valido", retryable: false });
  }

  const esito = productDraftSchema.safeParse(grezzo);
  if (!esito.success) {
    const dettagli = esito.error.issues
      .map((problema) => `${problema.path.join(".")}: ${problema.message}`)
      .join("; ");
    return err({ type: "bad_response", message: dettagli, retryable: false });
  }

  return ok(esito.data);
}
