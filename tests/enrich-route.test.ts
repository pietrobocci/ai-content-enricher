import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { POST } from "@/app/api/enrich/route";

const fetchOriginale = globalThis.fetch;

/** File scritti in public/uploads dai test riusciti: vanno rimossi dopo. */
const creati: string[] = [];

beforeEach(() => {
  process.env.GEMINI_API_KEY = "chiave-di-prova";
});

afterEach(() => {
  globalThis.fetch = fetchOriginale;
  vi.restoreAllMocks();
  for (const percorso of creati.splice(0)) {
    const assoluto = path.join(process.cwd(), "public", percorso);
    if (fs.existsSync(assoluto)) fs.rmSync(assoluto);
  }
});

function richiestaCon(bytes: Uint8Array, nomeFile: string, tipoDichiarato: string) {
  const form = new FormData();
  // Buffer.from (anziche' i bytes grezzi): con TypeScript 5.7+ e i tipi di
  // Node 20, Uint8Array e' generico e File richiede un buffer non condiviso.
  form.append("image", new File([Buffer.from(bytes)], nomeFile, { type: tipoDichiarato }));
  return new Request("http://localhost/api/enrich", { method: "POST", body: form });
}

describe("POST /api/enrich", () => {
  it("rifiuta un PDF travestito da jpg senza chiamare il provider", async () => {
    const fetchSpia = vi.fn();
    globalThis.fetch = fetchSpia as unknown as typeof fetch;

    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // "%PDF-1"
    const risposta = await POST(richiestaCon(pdf, "prodotto.jpg", "image/jpeg"));

    expect(risposta.status).toBe(400);
    // Il punto del test: nessuna richiesta di rete e' partita.
    expect(fetchSpia).not.toHaveBeenCalled();
  });

  it("rifiuta una richiesta senza immagine", async () => {
    const fetchSpia = vi.fn();
    globalThis.fetch = fetchSpia as unknown as typeof fetch;

    const risposta = await POST(
      new Request("http://localhost/api/enrich", { method: "POST", body: new FormData() })
    );

    expect(risposta.status).toBe(400);
    expect(fetchSpia).not.toHaveBeenCalled();
  });

  it("segnala chiaramente la chiave mancante", async () => {
    delete process.env.GEMINI_API_KEY;

    const fetchSpia = vi.fn();
    globalThis.fetch = fetchSpia as unknown as typeof fetch;

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const risposta = await POST(richiestaCon(jpeg, "prodotto.jpg", "image/jpeg"));
    const corpo = await risposta.json();

    expect(risposta.status).toBe(500);
    expect(corpo.error).toContain("GEMINI_API_KEY");
    // Nessuna chiamata di rete deve partire quando la chiave manca.
    expect(fetchSpia).not.toHaveBeenCalled();
  });

  it("restituisce bozza, percorso immagine e modello quando la chiamata riesce", async () => {
    const bozza = {
      title: "Scarpe da running leggere",
      description:
        "Scarpe da corsa con tomaia in mesh traspirante e suola ammortizzata, adatte all'uso quotidiano.",
      tags: ["running", "sport", "scarpe"],
      category: "calzature",
      confidence: "alta",
    };
    // La busta esatta che Gemini restituisce: il provider legge il testo
    // da candidates[0].content.parts[0].text.
    const busta = { candidates: [{ content: { parts: [{ text: JSON.stringify(bozza) }] } }] };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(busta), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      ) as unknown as typeof fetch;

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const risposta = await POST(richiestaCon(jpeg, "prodotto.jpg", "image/jpeg"));
    const corpo = await risposta.json();
    if (typeof corpo.imagePath === "string") creati.push(corpo.imagePath);

    expect(risposta.status).toBe(200);
    // La forma esatta che src/app/new/page.tsx si aspetta di ricevere.
    expect(corpo.draft).toEqual(bozza);
    expect(corpo.imagePath).toMatch(/^\/uploads\/[A-Za-z0-9-]+\.jpg$/);
    expect(corpo.model).toContain("gemini");
    // Il file e' davvero finito su disco.
    expect(fs.existsSync(path.join(process.cwd(), "public", corpo.imagePath))).toBe(true);
  });
});
