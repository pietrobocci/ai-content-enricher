import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/products/route";
import { listProducts } from "@/lib/products";
import { prisma } from "@/lib/db";

const corpoValido = {
  title: "Scarpe da running leggere",
  description: "Scarpe da corsa con tomaia in mesh traspirante e suola ammortizzata.",
  category: "calzature",
  tags: ["running", "sport", "scarpe"],
  imagePath: "/uploads/esempio.jpg",
  aiDraftJson: '{"title":"Scarpe running"}',
  model: "gemini:test",
};

function richiestaCon(corpo: unknown) {
  return new Request("http://localhost/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

async function elencoOppureFallisci() {
  const esito = await listProducts();
  if (!esito.ok) throw new Error(`listProducts ha fallito: ${esito.error.message}`);
  return esito.data;
}

describe("POST /api/products", () => {
  beforeEach(async () => {
    await prisma.product.deleteMany();
  });

  it("salva un corpo valido e lo rende rileggibile dal catalogo", async () => {
    const risposta = await POST(richiestaCon(corpoValido));
    const dati = await risposta.json();

    expect(risposta.status).toBe(201);
    expect(typeof dati.id).toBe("string");

    const elenco = await elencoOppureFallisci();
    expect(elenco).toHaveLength(1);
    expect(elenco[0].id).toBe(dati.id);
    expect(elenco[0].title).toBe(corpoValido.title);
  });

  it("rifiuta un percorso immagine fuori da /uploads e non scrive nulla", async () => {
    const risposta = await POST(richiestaCon({ ...corpoValido, imagePath: "/etc/passwd" }));

    expect(risposta.status).toBe(400);
    // Il punto del test: una richiesta non valida non lascia righe a
    // database. E' la forma eseguibile della regola "l'AI propone, la
    // persona approva": si salva solo cio' che ha superato la validazione.
    expect(await elencoOppureFallisci()).toHaveLength(0);
  });
});
