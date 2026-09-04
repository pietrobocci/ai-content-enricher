import { describe, it, expect } from "vitest";
import { createGeminiProvider } from "@/lib/provider";
import { geminiResponseSchema, productDraftSchema } from "@/lib/schema";
import { buildPrompt } from "@/lib/prompt";

// Un PNG 1x1 rosso: basta per verificare che la risposta abbia la forma
// attesa, senza dipendere da un file esterno.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("contratto con Gemini (chiama la rete)", () => {
  it("risponde in JSON che rispetta lo schema", async () => {
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

    const analisi = productDraftSchema.safeParse(JSON.parse(esito.data));
    expect(analisi.success, JSON.stringify(analisi.error?.issues)).toBe(true);
  }, 60_000);
});
