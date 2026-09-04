import { prisma } from "@/lib/db";
import { type Result, ok, err } from "@/lib/result";

export type NewProduct = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  imagePath: string;
  aiDraftJson: string;
  model: string;
};

export type ProductView = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  imagePath: string;
  aiDraftJson: string;
  model: string;
  createdAt: Date;
};

export async function createProduct(input: NewProduct): Promise<Result<{ id: string }>> {
  try {
    const riga = await prisma.product.create({
      // I tag diventano una stringa JSON: e' il compromesso di SQLite.
      data: { ...input, tags: JSON.stringify(input.tags) },
    });
    return ok({ id: riga.id });
  } catch (e) {
    // Il messaggio del database puo' contenere dettagli interni (percorsi,
    // nomi di colonne): resta nei log del server, all'utente arriva una
    // frase generica.
    console.error("createProduct:", e);
    return err({
      type: "unknown",
      message: "non e' stato possibile salvare il prodotto",
      retryable: false,
    });
  }
}

export async function listProducts(): Promise<Result<ProductView[]>> {
  try {
    const righe = await prisma.product.findMany({
      // Secondo criterio a parita' di istante: SQLite salva i timestamp al
      // millisecondo, due prodotti creati nello stesso millisecondo
      // avrebbero altrimenti un ordine deciso dal motore, non da noi.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return ok(righe.map((riga) => ({ ...riga, tags: leggiTag(riga.tags) })));
  } catch (e) {
    console.error("listProducts:", e);
    return err({
      type: "unknown",
      message: "non e' stato possibile leggere i prodotti",
      retryable: false,
    });
  }
}

function leggiTag(grezzo: string): string[] {
  try {
    const valore = JSON.parse(grezzo);
    return Array.isArray(valore) ? valore.map(String) : [];
  } catch {
    return [];
  }
}
