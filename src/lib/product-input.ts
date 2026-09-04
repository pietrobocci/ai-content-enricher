import { z } from "zod";
import { CATEGORIES } from "@/lib/schema";

/**
 * L'utente puo' aver corretto i testi, quindi non riusiamo lo schema della
 * bozza: qui i vincoli sono piu' larghi sui contenuti, ma restano stretti
 * sui campi che il client non deve poter scegliere liberamente.
 *
 * Ogni regola porta il proprio messaggio in italiano: senza, Zod
 * risponderebbe in inglese e quel testo finirebbe dritto nell'interfaccia.
 */
export const newProductSchema = z.object({
  title: z
    .string()
    .min(1, "il titolo non puo' essere vuoto")
    .max(120, "il titolo non puo' superare 120 caratteri"),
  description: z
    .string()
    .min(1, "la descrizione non puo' essere vuota")
    .max(1000, "la descrizione non puo' superare 1000 caratteri"),
  category: z.enum(CATEGORIES, "categoria non ammessa"),
  tags: z
    .array(
      z
        .string()
        .min(1, "un tag non puo' essere vuoto")
        .max(30, "un tag non puo' superare 30 caratteri")
    )
    .max(10, "i tag non possono essere piu' di 10"),
  imagePath: z
    .string()
    .regex(
      /^\/uploads\/[A-Za-z0-9-]+\.(jpg|png|webp)$/,
      "percorso dell'immagine non valido: deve stare in /uploads"
    ),
  aiDraftJson: z.string(),
  model: z
    .string()
    .min(1, "il modello non puo' essere vuoto")
    .max(100, "il modello non puo' superare 100 caratteri"),
});

export type NewProductInput = z.infer<typeof newProductSchema>;
