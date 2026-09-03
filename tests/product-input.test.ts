import { describe, it, expect } from "vitest";
import { newProductSchema } from "@/lib/product-input";

const corpoValido = {
  title: "Scarpe da running leggere",
  description: "Scarpe da corsa con tomaia in mesh traspirante e suola ammortizzata.",
  category: "calzature",
  tags: ["running", "sport", "scarpe"],
  imagePath: "/uploads/esempio.jpg",
  aiDraftJson: '{"title":"Scarpe running"}',
  model: "gemini:test",
};

describe("newProductSchema", () => {
  it("accetta un corpo valido", () => {
    expect(newProductSchema.safeParse(corpoValido).success).toBe(true);
  });

  it("rifiuta una categoria fuori dalla lista", () => {
    const esito = newProductSchema.safeParse({ ...corpoValido, category: "inventata" });
    expect(esito.success).toBe(false);
  });

  it("rifiuta un percorso immagine fuori dalla cartella uploads", () => {
    const esito = newProductSchema.safeParse({ ...corpoValido, imagePath: "/etc/passwd" });
    expect(esito.success).toBe(false);
  });

  it("rifiuta un titolo vuoto", () => {
    expect(newProductSchema.safeParse({ ...corpoValido, title: "" }).success).toBe(false);
  });
});
