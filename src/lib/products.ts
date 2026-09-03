import { prisma } from "@/lib/db";

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

export async function createProduct(input: NewProduct) {
  return prisma.product.create({
    // I tag diventano una stringa JSON: e' il compromesso di SQLite.
    data: { ...input, tags: JSON.stringify(input.tags) },
  });
}

export async function listProducts(): Promise<ProductView[]> {
  const righe = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return righe.map((riga) => ({ ...riga, tags: leggiTag(riga.tags) }));
}

function leggiTag(grezzo: string): string[] {
  try {
    const valore = JSON.parse(grezzo);
    return Array.isArray(valore) ? valore.map(String) : [];
  } catch {
    return [];
  }
}
