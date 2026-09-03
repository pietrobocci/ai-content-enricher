import { z } from "zod";
import { CATEGORIES } from "@/lib/schema";

/**
 * L'utente puo' aver corretto i testi, quindi non riusiamo lo schema della
 * bozza: qui i vincoli sono piu' larghi sui contenuti, ma restano stretti
 * sui campi che il client non deve poter scegliere liberamente.
 */
export const newProductSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string().min(1).max(30)).max(10),
  imagePath: z.string().regex(/^\/uploads\/[A-Za-z0-9-]+\.(jpg|png|webp)$/),
  aiDraftJson: z.string(),
  model: z.string().min(1).max(100),
});

export type NewProductInput = z.infer<typeof newProductSchema>;
