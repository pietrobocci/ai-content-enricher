import { describe, it, expect } from "vitest";
import { createGeminiProvider } from "@/lib/provider";
import { geminiResponseSchema } from "@/lib/schema";
import { buildPrompt } from "@/lib/prompt";

// Un PNG 1x1 rosso: basta per verificare che la risposta abbia la forma
// attesa, senza dipendere da un file esterno.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("contratto con Gemini (chiama la rete)", () => {
  it("risponde in JSON con i cinque campi previsti", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, "GEMINI_API_KEY non impostata").toBeTruthy();

    const provider = createGeminiProvider({ apiKey: apiKey! });
    const esito = await provider.generate({
      imageBase64: PNG_1x1,
      mimeType: "image/png",
      prompt: buildPrompt(),
      jsonSchema: geminiResponseSchema(),
    });

    expect(esito.ok, esito.ok ? "" : esito.error.message).toBe(true);
    if (!esito.ok) return;

    const dati = JSON.parse(esito.data) as Record<string, unknown>;

    // Qui si verifica solo il contratto del provider: JSON valido, i cinque
    // campi previsti, con i tipi giusti. Le regole di contenuto (lunghezza
    // della descrizione, numero di tag, categoria nella lista) NON si
    // asseriscono di proposito: dipendono dal giudizio del modello su un
    // pixel rosso e cambierebbero a ogni esecuzione, facendo passare per
    // "provider rotto" una normale variabilita'. Quelle regole sono
    // coperte, offline e in modo stabile, da tests/schema.test.ts.
    expect(typeof dati.title).toBe("string");
    expect(typeof dati.description).toBe("string");
    expect(Array.isArray(dati.tags)).toBe(true);
    expect((dati.tags as unknown[]).every((tag) => typeof tag === "string")).toBe(true);
    expect(typeof dati.category).toBe("string");
    expect(typeof dati.confidence).toBe("string");
  }, 60_000);
});
