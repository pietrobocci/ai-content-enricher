import { describe, it, expect } from "vitest";
import { productDraftSchema, geminiResponseSchema, CATEGORIES } from "@/lib/schema";

const bozzaValida = {
  title: "Scarpe da running leggere",
  description: "Scarpe da corsa con tomaia in mesh traspirante e suola ammortizzata, adatte all'uso quotidiano.",
  tags: ["running", "sport", "scarpe"],
  category: "calzature",
  confidence: "alta",
};

describe("productDraftSchema", () => {
  it("accetta una bozza valida", () => {
    const esito = productDraftSchema.safeParse(bozzaValida);
    expect(esito.success).toBe(true);
  });

  it("rifiuta una categoria inventata", () => {
    const esito = productDraftSchema.safeParse({
      ...bozzaValida,
      category: "scarpe da ginnastica",
    });
    expect(esito.success).toBe(false);
  });

  it("rifiuta piu' di 6 tag", () => {
    const esito = productDraftSchema.safeParse({
      ...bozzaValida,
      tags: ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"],
    });
    expect(esito.success).toBe(false);
  });

  it("rifiuta meno di 3 tag", () => {
    const esito = productDraftSchema.safeParse({ ...bozzaValida, tags: ["uno", "due"] });
    expect(esito.success).toBe(false);
  });

  it("rifiuta tag con maiuscole", () => {
    const esito = productDraftSchema.safeParse({
      ...bozzaValida,
      tags: ["Running", "sport", "scarpe"],
    });
    expect(esito.success).toBe(false);
  });

  it("accetta tag con lettere accentate", () => {
    const esito = productDraftSchema.safeParse({
      ...bozzaValida,
      tags: ["città", "perché", "però"],
    });
    expect(esito.success).toBe(true);
  });

  it("rifiuta una descrizione troppo corta", () => {
    const esito = productDraftSchema.safeParse({ ...bozzaValida, description: "corta" });
    expect(esito.success).toBe(false);
  });
});

describe("geminiResponseSchema", () => {
  it("elenca tutte le categorie ammesse", () => {
    const schema = JSON.stringify(geminiResponseSchema());
    for (const categoria of CATEGORIES) {
      expect(schema).toContain(categoria);
    }
  });

  it("non contiene chiavi che Gemini non supporta", () => {
    const schema = JSON.stringify(geminiResponseSchema());
    expect(schema).not.toContain("$schema");
    expect(schema).not.toContain("pattern");
    expect(schema).not.toContain("additionalProperties");
  });
});
