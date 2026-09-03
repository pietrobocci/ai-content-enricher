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

/** La forma esatta che la risposta del modello deve rispettare. */
export const productDraftSchema = z.object({
  title: z.string().min(3).max(60),
  description: z.string().min(20).max(400),
  tags: z
    .array(z.string().min(2).max(20).regex(/^[a-z0-9à-öø-ÿ -]+$/, "solo minuscole (accentate ammesse), cifre, spazi e trattini"))
    .min(3)
    .max(6),
  category: z.enum(CATEGORIES),
  confidence: z.enum(CONFIDENCE_LEVELS),
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
