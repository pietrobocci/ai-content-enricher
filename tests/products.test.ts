import { describe, it, expect, beforeEach } from "vitest";
import { createProduct, listProducts } from "@/lib/products";
import { prisma } from "@/lib/db";

const nuovoProdotto = {
  title: "Scarpe da running leggere",
  description: "Scarpe da corsa con tomaia in mesh traspirante e suola ammortizzata.",
  category: "calzature",
  tags: ["running", "sport", "scarpe"],
  imagePath: "/uploads/esempio.jpg",
  aiDraftJson: '{"title":"Scarpe running"}',
  model: "gemini:test",
};

describe("prodotti", () => {
  beforeEach(async () => {
    await prisma.product.deleteMany();
  });

  it("salva un prodotto e lo rilegge", async () => {
    await createProduct(nuovoProdotto);

    const elenco = await listProducts();

    expect(elenco).toHaveLength(1);
    expect(elenco[0].title).toBe(nuovoProdotto.title);
  });

  it("restituisce i tag come array, non come stringa", async () => {
    await createProduct(nuovoProdotto);

    const elenco = await listProducts();

    expect(Array.isArray(elenco[0].tags)).toBe(true);
    expect(elenco[0].tags).toEqual(["running", "sport", "scarpe"]);
  });

  it("conserva la bozza originale dell'AI", async () => {
    await createProduct(nuovoProdotto);

    const elenco = await listProducts();

    expect(elenco[0].aiDraftJson).toBe(nuovoProdotto.aiDraftJson);
  });

  it("elenca prima i prodotti piu' recenti", async () => {
    await createProduct({ ...nuovoProdotto, title: "Primo prodotto" });
    await createProduct({ ...nuovoProdotto, title: "Secondo prodotto" });

    const elenco = await listProducts();

    expect(elenco[0].title).toBe("Secondo prodotto");
  });
});
