import { describe, it, expect, vi } from "vitest";
import { enrichImage } from "@/lib/enrich";
import { type LlmProvider } from "@/lib/provider";
import { ok, err } from "@/lib/result";

const bozzaValida = {
  title: "Scarpe da running leggere",
  description: "Scarpe da corsa con tomaia in mesh traspirante e suola ammortizzata, adatte all'uso quotidiano.",
  tags: ["running", "sport", "scarpe"],
  category: "calzature",
  confidence: "alta",
};

const input = { imageBase64: "AAAA", mimeType: "image/jpeg" };

/** Provider finto: risponde quello che gli diciamo noi, senza toccare la rete. */
function providerFinto(risposte: string[]): LlmProvider & { chiamate: number } {
  let indice = 0;
  const finto = {
    name: "finto",
    chiamate: 0,
    async generate() {
      finto.chiamate += 1;
      const risposta = risposte[Math.min(indice, risposte.length - 1)];
      indice += 1;
      return ok(risposta);
    },
  };
  return finto;
}

describe("enrichImage", () => {
  it("restituisce la bozza quando il modello risponde correttamente", async () => {
    const provider = providerFinto([JSON.stringify(bozzaValida)]);

    const esito = await enrichImage(input, provider);

    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.data.title).toBe(bozzaValida.title);
    expect(provider.chiamate).toBe(1);
  });

  it("ritenta una volta sola se il modello non risponde in JSON", async () => {
    const provider = providerFinto(["ecco la tua scheda prodotto!", "ancora testo libero"]);

    const esito = await enrichImage(input, provider);

    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.type).toBe("bad_response");
    expect(provider.chiamate).toBe(2);
  });

  it("si corregge al secondo tentativo se inventa una categoria", async () => {
    const provider = providerFinto([
      JSON.stringify({ ...bozzaValida, category: "scarpe da ginnastica" }),
      JSON.stringify(bozzaValida),
    ]);

    const esito = await enrichImage(input, provider);

    expect(esito.ok).toBe(true);
    expect(provider.chiamate).toBe(2);
  });

  it("rifiuta una bozza con 8 tag dopo il tentativo di correzione", async () => {
    const troppiTag = { ...bozzaValida, tags: ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"] };
    const provider = providerFinto([JSON.stringify(troppiTag), JSON.stringify(troppiTag)]);

    const esito = await enrichImage(input, provider);

    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.type).toBe("bad_response");
  });

  it("propaga l'errore del provider senza ritentare", async () => {
    const provider: LlmProvider = {
      name: "finto-in-errore",
      generate: vi.fn().mockResolvedValue(
        err({ type: "auth", message: "chiave rifiutata", retryable: false })
      ),
    };

    const esito = await enrichImage(input, provider);

    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.type).toBe("auth");
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it("passa al modello il suggerimento dell'utente", async () => {
    const generate = vi.fn().mockResolvedValue(ok(JSON.stringify(bozzaValida)));
    const provider: LlmProvider = { name: "finto", generate };

    await enrichImage({ ...input, hint: "borsa in pelle vintage" }, provider);

    expect(generate.mock.calls[0][0].prompt).toContain("borsa in pelle vintage");
  });

  it("non moltiplica i ritentativi: un errore di trasporto ferma subito l'arricchimento", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue(err({ type: "network", message: "timeout", retryable: true }));
    const provider: LlmProvider = { name: "finto-in-rete", generate };

    const esito = await enrichImage(input, provider, { maxSchemaRetries: 1 });

    expect(esito.ok).toBe(false);
    // Il tetto composto: enrichImage puo' chiamare il provider al massimo
    // maxSchemaRetries + 1 = 2 volte, e ogni chiamata vale al massimo
    // maxRetries + 1 = 2 richieste HTTP, cioe' 4 chiamate fatturate nel
    // caso peggiore. Su un errore di trasporto si ferma alla prima:
    // riformulare il prompt non ripara la rete.
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
