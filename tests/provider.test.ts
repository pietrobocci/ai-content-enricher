import { describe, it, expect, vi } from "vitest";
import { createGeminiProvider } from "@/lib/provider";

function rispostaGemini(testo: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: testo }] } }],
    }),
    text: async () => "",
  } as unknown as Response;
}

function rispostaErrore(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => `errore ${status}`,
  } as unknown as Response;
}

const richiesta = {
  imageBase64: "AAAA",
  mimeType: "image/jpeg",
  prompt: "prompt di prova",
  jsonSchema: { type: "object" },
};

describe("createGeminiProvider", () => {
  it("restituisce il testo generato quando la chiamata riesce", async () => {
    const fetchFinto = vi.fn().mockResolvedValue(rispostaGemini('{"title":"ok"}'));
    const provider = createGeminiProvider({ apiKey: "k", fetchImpl: fetchFinto, sleep: async () => {} });

    const esito = await provider.generate(richiesta);

    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.data).toBe('{"title":"ok"}');
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it("fallisce subito, senza ritentare, se la chiave e' rifiutata", async () => {
    const fetchFinto = vi.fn().mockResolvedValue(rispostaErrore(401));
    const provider = createGeminiProvider({ apiKey: "k", fetchImpl: fetchFinto, sleep: async () => {} });

    const esito = await provider.generate(richiesta);

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.type).toBe("auth");
      expect(esito.error.retryable).toBe(false);
    }
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it("ritenta sul rate limit e riesce al secondo tentativo", async () => {
    const fetchFinto = vi
      .fn()
      .mockResolvedValueOnce(rispostaErrore(429))
      .mockResolvedValueOnce(rispostaGemini('{"title":"ok"}'));
    const provider = createGeminiProvider({ apiKey: "k", fetchImpl: fetchFinto, sleep: async () => {} });

    const esito = await provider.generate(richiesta);

    expect(esito.ok).toBe(true);
    expect(fetchFinto).toHaveBeenCalledTimes(2);
  });

  it("ritenta sugli errori di rete e poi si arrende, marcando l'errore ritentabile", async () => {
    const fetchFinto = vi.fn().mockRejectedValue(new Error("connessione interrotta"));
    const provider = createGeminiProvider({
      apiKey: "k",
      fetchImpl: fetchFinto,
      sleep: async () => {},
      maxRetries: 2,
    });

    const esito = await provider.generate(richiesta);

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.type).toBe("network");
      expect(esito.error.retryable).toBe(true);
    }
    // 1 tentativo iniziale + 2 ritentativi
    expect(fetchFinto).toHaveBeenCalledTimes(3);
  });

  it("non ritenta piu' del limite sul rate limit", async () => {
    const fetchFinto = vi.fn().mockResolvedValue(rispostaErrore(429));
    const provider = createGeminiProvider({
      apiKey: "k",
      fetchImpl: fetchFinto,
      sleep: async () => {},
      maxRetries: 1,
    });

    const esito = await provider.generate(richiesta);

    expect(esito.ok).toBe(false);
    expect(fetchFinto).toHaveBeenCalledTimes(2);
  });

  it("segnala una risposta senza testo come risposta malformata", async () => {
    const senzaTesto = {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
      text: async () => "",
    } as unknown as Response;
    const provider = createGeminiProvider({
      apiKey: "k",
      fetchImpl: vi.fn().mockResolvedValue(senzaTesto),
      sleep: async () => {},
    });

    const esito = await provider.generate(richiesta);

    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.type).toBe("bad_response");
  });

  it("segnala come malformata una risposta 200 con corpo non JSON", async () => {
    const corpoRotto = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
      text: async () => "",
    } as unknown as Response;
    const fetchFinto = vi.fn().mockResolvedValue(corpoRotto);
    const provider = createGeminiProvider({ apiKey: "k", fetchImpl: fetchFinto, sleep: async () => {} });

    const esito = await provider.generate(richiesta);

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.type).toBe("bad_response");
      expect(esito.error.retryable).toBe(false);
    }
    // Non ritentabile: una sola chiamata, nessun retry.
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });
});
