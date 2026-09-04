import { z } from "zod";

/**
 * Lista chiusa di categorie. E' il motivo per cui la validazione ha senso:
 * se il modello inventa una categoria, ce ne accorgiamo. Su un campo di
 * testo libero non sarebbe possibile.
 */
export const CATEGORIES = [
  "abbigliamento",
  "calzature",
  "accessori",
  "casa",
  "elettronica",
  "altro",
] as const;

export const CONFIDENCE_LEVELS = ["alta", "media", "bassa"] as const;

/**
 * La forma esatta che la risposta del modello deve rispettare.
 *
 * Ogni regola porta il proprio messaggio in italiano: i messaggi di Zod
 * finiscono nell'interfaccia e nel prompt di correzione, e di default
 * sarebbero in inglese.
 */
export const productDraftSchema = z.object({
  title: z
    .string()
    .min(3, "il titolo deve avere almeno 3 caratteri")
    .max(60, "il titolo non puo' superare 60 caratteri"),
  description: z
    .string()
    .min(20, "la descrizione deve avere almeno 20 caratteri")
    .max(400, "la descrizione non puo' superare 400 caratteri"),
  tags: z
    .array(
      z
        .string()
        .min(2, "ogni tag deve avere almeno 2 caratteri")
        .max(20, "ogni tag non puo' superare 20 caratteri")
        .regex(/^[a-z0-9à-öø-ÿ -]+$/, "solo minuscole (accentate ammesse), cifre, spazi e trattini")
    )
    .min(3, "servono almeno 3 tag")
    .max(6, "i tag non possono essere piu' di 6"),
  category: z.enum(CATEGORIES, "categoria non ammessa: usare una di quelle previste"),
  confidence: z.enum(CONFIDENCE_LEVELS, "confidenza non ammessa: usare alta, media o bassa"),
});

export type ProductDraft = z.infer<typeof productDraftSchema>;

/**
 * Gemini accetta solo un sottoinsieme di JSON Schema: type, properties,
 * items, enum, required. Qui partiamo dallo schema Zod (fonte unica di
 * verita') e togliamo tutto il resto, cosi' aggiungendo un campo in Zod
 * non c'e' nulla da aggiornare a mano.
 */
export function geminiResponseSchema(): unknown {
  return semplifica(z.toJSONSchema(productDraftSchema));
}

const CHIAVI_AMMESSE = ["type", "properties", "items", "enum", "required"] as const;

function semplifica(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(semplifica);
  if (nodo === null || typeof nodo !== "object") return nodo;

  const risultato: Record<string, unknown> = {};
  for (const [chiave, valore] of Object.entries(nodo as Record<string, unknown>)) {
    if (!CHIAVI_AMMESSE.includes(chiave as (typeof CHIAVI_AMMESSE)[number])) continue;
    risultato[chiave] = chiave === "properties" ? mappaProprieta(valore) : semplifica(valore);
  }
  return risultato;
}

function mappaProprieta(valore: unknown): unknown {
  if (valore === null || typeof valore !== "object") return valore;
  const risultato: Record<string, unknown> = {};
  for (const [nome, sotto] of Object.entries(valore as Record<string, unknown>)) {
    risultato[nome] = semplifica(sotto);
  }
  return risultato;
}
