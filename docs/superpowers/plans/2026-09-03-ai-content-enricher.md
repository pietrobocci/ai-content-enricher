# AI Content Enricher — Piano di implementazione

> **Per esecutori agentici:** SUB-SKILL RICHIESTA: usare `superpowers:subagent-driven-development` (consigliata) oppure `superpowers:executing-plans` per implementare questo piano task per task. Gli step usano checkbox (`- [ ]`) per il tracciamento.

**Goal:** Costruire un'app Next.js dove si carica la foto di un prodotto, un LLM propone titolo/descrizione/tag/categoria in formato strutturato e validato, la persona rivede la bozza e la salva su SQLite.

**Architecture:** Monolite Next.js (App Router) con la logica di dominio isolata in `src/lib`, indipendente da HTTP e dal database. Il provider LLM sta dietro un'interfaccia, quindi i test girano offline con un provider finto. L'AI propone, la persona approva: arricchimento e salvataggio sono due chiamate distinte.

**Tech Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Zod 4 · Prisma + SQLite · Google Gemini via REST (`fetch`) · Vitest

**Spec:** `docs/superpowers/specs/2026-09-03-ai-content-enricher-design.md`

## Global Constraints

- **Studiabilità prima dell'eleganza.** File piccoli, una responsabilità ciascuno, nessuna astrazione non necessaria. Commenti in italiano dove il *perché* non è ovvio.
- **Spesa zero.** Provider = Google Gemini free tier. Nessun servizio a pagamento, nessun account cloud in fase 1.
- **I test non chiamano mai la rete.** Unica eccezione: il test di contratto della Task 12, escluso dalla suite di default.
- **Tutto in locale.** Database = file SQLite. Immagini = cartella `public/uploads/`. Nessun deploy.
- **Fuori scope:** autenticazione, batch, code di lavoro, CMS headless, i18n, ricerca full-text.
- **Lingua dell'interfaccia e dei contenuti generati:** italiano.
- **Limite upload:** 5 MB. Formati ammessi: JPEG, PNG, WebP.
- **Categorie ammesse (lista chiusa):** `abbigliamento` `calzature` `accessori` `casa` `elettronica` `altro`
- **Valori di confidence:** `alta` `media` `bassa`
- **Node:** v22 (già installato).
- **Working directory:** `C:\Users\p.bocci\Desktop\New folder (2)\ai-content-enricher`

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `src/lib/result.ts` | Il tipo `Result` e il tipo dell'errore applicativo |
| `src/lib/schema.ts` | Schema Zod della bozza + derivazione dello schema JSON per il modello |
| `src/lib/prompt.ts` | Costruzione del testo del prompt |
| `src/lib/provider.ts` | Interfaccia `LlmProvider` + implementazione Gemini via `fetch` |
| `src/lib/enrich.ts` | Orchestrazione: immagine → bozza, con retry sullo schema |
| `src/lib/image.ts` | Validazione del file caricato (tipo reale, dimensione) |
| `src/lib/db.ts` | Istanza Prisma condivisa |
| `src/lib/products.ts` | Lettura e scrittura dei prodotti |
| `src/app/api/enrich/route.ts` | Endpoint: foto → bozza |
| `src/app/api/products/route.ts` | Endpoint: salva e leggi prodotti |
| `src/app/new/page.tsx` | Pagina di caricamento e revisione |
| `src/app/page.tsx` | Lista dei prodotti salvati |
| `tests/*.test.ts` | Test, uno per modulo |

---

### Task 1: Scaffolding del progetto e test runner

**Files:**
- Create: l'intera struttura Next.js, `vitest.config.ts`, `tests/smoke.test.ts`, `.gitignore` (integrazione), `.env.example`

**Interfaces:**
- Consuma: niente
- Produce: comando `npm test` funzionante, alias `@/` che punta a `src/`

- [ ] **Step 1: Generare il progetto Next.js**

Dalla cartella del progetto (contiene già `docs/` e `.git`, non sono in conflitto):

```bash
npx create-next-app@latest . --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --use-npm
```

Se pone altre domande interattive, accettare i default proposti.

- [ ] **Step 2: Installare le dipendenze del progetto**

```bash
npm install zod
npm install -D vitest
```

Verificare che Zod sia la versione 4 e che esponga `toJSONSchema`:

```bash
node -e "const {z}=require('zod'); console.log(require('zod/package.json').version, typeof z.toJSONSchema)"
```

Atteso: una versione `4.x` e `function`. Se stampa `undefined`, aggiornare con `npm install zod@^4`.

- [ ] **Step 3: Configurare Vitest**

Creare `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // I test di contratto chiamano la rete: esclusi dalla suite normale.
    exclude: ["tests/**/*.contract.test.ts", "node_modules/**"],
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
```

Aggiungere lo script in `package.json`, dentro `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Scrivere il test di smoke**

Creare `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("setup del progetto", () => {
  it("esegue i test", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Eseguire i test**

Run: `npm test`
Atteso: 1 test passato.

- [ ] **Step 6: Preparare le variabili d'ambiente**

Creare `.env.example`:

```
# Chiave gratuita da https://aistudio.google.com/apikey
GEMINI_API_KEY=

# Percorso del database SQLite (relativo alla cartella prisma/)
DATABASE_URL="file:./dev.db"
```

Aggiungere in fondo a `.gitignore`:

```
# file caricati dagli utenti
/public/uploads
# database locali
/prisma/*.db
/prisma/*.db-journal
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffolding Next.js, Vitest e variabili d'ambiente"
```

---

### Task 2: Lo schema della bozza

**Files:**
- Create: `src/lib/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consuma: niente
- Produce:
  - `CATEGORIES: readonly string[]`, `CONFIDENCE_LEVELS: readonly string[]`
  - `productDraftSchema` (schema Zod)
  - `type ProductDraft`
  - `geminiResponseSchema(): unknown` — schema JSON semplificato per il modello

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `tests/schema.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/schema` non trovato.

- [ ] **Step 3: Implementare lo schema**

Creare `src/lib/schema.ts`:

```ts
import { z } from "zod";

/**
 * Lista chiusa di categorie. E' il motivo per cui la validazione ha senso:
 * se il modello inventa una categoria, ce ne accorgiamo. Su un campo di
 * testo libero non sarebbe possibile.
 */
export const CATEGORIES = [
  "abbigliamento",
  "calzature",
  "accessori",
  "casa",
  "elettronica",
  "altro",
] as const;

export const CONFIDENCE_LEVELS = ["alta", "media", "bassa"] as const;

/** La forma esatta che la risposta del modello deve rispettare. */
export const productDraftSchema = z.object({
  title: z.string().min(3).max(60),
  description: z.string().min(20).max(400),
  tags: z
    .array(z.string().min(2).max(20).regex(/^[a-z0-9 -]+$/, "solo minuscole, cifre, spazi e trattini"))
    .min(3)
    .max(6),
  category: z.enum(CATEGORIES),
  confidence: z.enum(CONFIDENCE_LEVELS),
});

export type ProductDraft = z.infer<typeof productDraftSchema>;

/**
 * Gemini accetta solo un sottoinsieme di JSON Schema: type, properties,
 * items, enum, required. Qui partiamo dallo schema Zod (fonte unica di
 * verita') e togliamo tutto il resto, cosi' aggiungendo un campo in Zod
 * non c'e' nulla da aggiornare a mano.
 */
export function geminiResponseSchema(): unknown {
  return semplifica(z.toJSONSchema(productDraftSchema));
}

const CHIAVI_AMMESSE = ["type", "properties", "items", "enum", "required"] as const;

function semplifica(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(semplifica);
  if (nodo === null || typeof nodo !== "object") return nodo;

  const risultato: Record<string, unknown> = {};
  for (const [chiave, valore] of Object.entries(nodo as Record<string, unknown>)) {
    if (!CHIAVI_AMMESSE.includes(chiave as (typeof CHIAVI_AMMESSE)[number])) continue;
    risultato[chiave] = chiave === "properties" ? mappaProprieta(valore) : semplifica(valore);
  }
  return risultato;
}

function mappaProprieta(valore: unknown): unknown {
  if (valore === null || typeof valore !== "object") return valore;
  const risultato: Record<string, unknown> = {};
  for (const [nome, sotto] of Object.entries(valore as Record<string, unknown>)) {
    risultato[nome] = semplifica(sotto);
  }
  return risultato;
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Atteso: PASS su tutti i test di `tests/schema.test.ts`.

Se il test "non contiene chiavi che Gemini non supporta" fallisce, eseguire solo quel file con output esteso per vedere quale chiave sfugge al filtro, e aggiungerla alla logica di `semplifica`:

```bash
npx vitest run tests/schema.test.ts --reporter verbose
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts tests/schema.test.ts
git commit -m "feat: schema Zod della bozza prodotto e derivazione schema Gemini"
```

---

### Task 3: Il costruttore del prompt

**Files:**
- Create: `src/lib/prompt.ts`
- Test: `tests/prompt.test.ts`

**Interfaces:**
- Consuma: `CATEGORIES` da `@/lib/schema`
- Produce:
  - `buildPrompt(opts?: { hint?: string }): string`
  - `buildRetryPrompt(promptOriginale: string, erroreDiValidazione: string): string`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `tests/prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPrompt, buildRetryPrompt } from "@/lib/prompt";
import { CATEGORIES } from "@/lib/schema";

describe("buildPrompt", () => {
  it("elenca tutte le categorie ammesse", () => {
    const prompt = buildPrompt();
    for (const categoria of CATEGORIES) {
      expect(prompt).toContain(categoria);
    }
  });

  it("chiede esplicitamente contenuti in italiano", () => {
    expect(buildPrompt().toLowerCase()).toContain("italiano");
  });

  it("include il suggerimento dell'utente quando fornito", () => {
    const prompt = buildPrompt({ hint: "borsa in pelle vintage" });
    expect(prompt).toContain("borsa in pelle vintage");
  });

  it("non aggiunge sezioni vuote quando il suggerimento manca", () => {
    expect(buildPrompt()).not.toContain("Suggerimento");
  });
});

describe("buildRetryPrompt", () => {
  it("contiene il prompt originale e l'errore da correggere", () => {
    const retry = buildRetryPrompt("PROMPT-ORIGINALE", "category: valore non ammesso");
    expect(retry).toContain("PROMPT-ORIGINALE");
    expect(retry).toContain("category: valore non ammesso");
  });
});
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/prompt` non trovato.

- [ ] **Step 3: Implementare il costruttore del prompt**

Creare `src/lib/prompt.ts`:

```ts
import { CATEGORIES } from "@/lib/schema";

/**
 * Il prompt e' la linea di difesa piu' debole: sono solo parole, il modello
 * puo' ignorarle. Serve comunque, perche' guida la qualita' del contenuto,
 * non solo la forma.
 */
export function buildPrompt(opts: { hint?: string } = {}): string {
  const righe = [
    "Sei un copywriter per un catalogo e-commerce italiano.",
    "Guarda la foto del prodotto e produci una scheda prodotto.",
    "",
    "Regole:",
    "- Scrivi tutti i testi in italiano.",
    "- Il titolo e' breve e concreto, da 3 a 60 caratteri.",
    "- La descrizione va da 20 a 400 caratteri, senza promesse inventate.",
    "- Genera da 3 a 6 tag, tutti in minuscolo, senza cancelletto.",
    `- La categoria deve essere ESATTAMENTE uno di questi valori: ${CATEGORIES.join(", ")}.`,
    "- Il campo confidence indica quanto sei sicuro: alta, media oppure bassa.",
    "- Se la foto e' poco chiara o il prodotto non e' riconoscibile, usa confidence bassa.",
    "- Non inventare materiali, misure o marchi che non si vedono nella foto.",
  ];

  if (opts.hint && opts.hint.trim().length > 0) {
    righe.push("", `Suggerimento fornito dall'utente: ${opts.hint.trim()}`);
  }

  return righe.join("\n");
}

/**
 * Non ripetiamo la stessa domanda sperando che vada meglio: rimandiamo al
 * modello l'errore preciso. Nella maggior parte dei casi si corregge al
 * secondo tentativo.
 */
export function buildRetryPrompt(promptOriginale: string, erroreDiValidazione: string): string {
  return [
    promptOriginale,
    "",
    "La tua risposta precedente non era valida.",
    `Errore: ${erroreDiValidazione}`,
    "Rispondi di nuovo rispettando esattamente il formato richiesto.",
  ].join("\n");
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Atteso: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompt.ts tests/prompt.test.ts
git commit -m "feat: costruzione del prompt e del prompt di correzione"
```

---

### Task 4: Il tipo Result e l'interfaccia del provider

**Files:**
- Create: `src/lib/result.ts`, `src/lib/provider.ts`
- Test: `tests/provider.test.ts`

**Interfaces:**
- Consuma: niente
- Produce:
  - `type AppError = { type: ErrorType; message: string; retryable: boolean }`
  - `type ErrorType = "invalid_input" | "auth" | "rate_limit" | "network" | "bad_response" | "unknown"`
  - `type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }`
  - `ok<T>(data: T): Result<T>` e `err<T>(error: AppError): Result<T>`
  - `type LlmRequest = { imageBase64: string; mimeType: string; prompt: string; jsonSchema: unknown }`
  - `type LlmProvider = { name: string; generate(req: LlmRequest): Promise<Result<string>> }`
  - `createGeminiProvider(opts): LlmProvider`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `tests/provider.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/provider` non trovato.

- [ ] **Step 3: Implementare il tipo Result**

Creare `src/lib/result.ts`:

```ts
export type ErrorType =
  | "invalid_input" // colpa di chi ha caricato: file sbagliato, troppo grande
  | "auth" // chiave mancante o rifiutata: ritentare non serve
  | "rate_limit" // quota superata: ha senso riprovare piu' tardi
  | "network" // rete o server del provider: ha senso riprovare
  | "bad_response" // il modello ha risposto fuori contratto
  | "unknown";

export type AppError = {
  type: ErrorType;
  message: string;
  /** Se false, ritentare la stessa identica richiesta e' inutile. */
  retryable: boolean;
};

/**
 * Un risultato e' sempre uno dei due casi. TypeScript obbliga a controllare
 * `ok` prima di poter leggere `data`, quindi il caso di errore non si puo'
 * dimenticare.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T>(error: AppError): Result<T> {
  return { ok: false, error };
}
```

- [ ] **Step 4: Implementare l'interfaccia e il provider Gemini**

Creare `src/lib/provider.ts`:

```ts
import { type Result, ok, err } from "@/lib/result";

export type LlmRequest = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  jsonSchema: unknown;
};

/**
 * Tutto il resto del progetto conosce solo questa interfaccia. Cambiare
 * provider (Claude, OpenAI, un modello locale) significa scrivere una nuova
 * implementazione di `generate`, senza toccare enrich.ts ne' i test.
 */
export type LlmProvider = {
  name: string;
  generate(req: LlmRequest): Promise<Result<string>>;
};

export type GeminiOptions = {
  apiKey: string;
  model?: string;
  /** Iniettabile per i test: di default il fetch globale. */
  fetchImpl?: typeof fetch;
  /** Iniettabile per i test: di default un'attesa reale. */
  sleep?: (ms: number) => Promise<void>;
  /** Numero massimo di ritentativi sugli errori temporanei. */
  maxRetries?: number;
};

const MODELLO_DEFAULT = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function createGeminiProvider(opts: GeminiOptions): LlmProvider {
  const model = opts.model ?? MODELLO_DEFAULT;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = opts.maxRetries ?? 2;

  async function generate(req: LlmRequest): Promise<Result<string>> {
    const url = `${BASE_URL}/${model}:generateContent?key=${opts.apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: req.mimeType, data: req.imageBase64 } },
            { text: req.prompt },
          ],
        },
      ],
      generationConfig: {
        // Vincola il modello a rispondere JSON con questa forma: la seconda
        // linea di difesa. La terza (Zod) resta comunque necessaria.
        response_mime_type: "application/json",
        response_schema: req.jsonSchema,
      },
    };

    let ultimoErrore = erroreSconosciuto("nessun tentativo eseguito");

    for (let tentativo = 0; tentativo <= maxRetries; tentativo++) {
      if (tentativo > 0) await sleep(500 * 2 ** (tentativo - 1));

      let risposta: Response;
      try {
        risposta = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        ultimoErrore = {
          type: "network",
          message: e instanceof Error ? e.message : "errore di rete",
          retryable: true,
        };
        continue; // la rete puo' migliorare: ritentiamo
      }

      if (!risposta.ok) {
        const errore = mappaStato(risposta.status, await leggiTesto(risposta));
        if (!errore.retryable) return err(errore); // ritentare non servirebbe
        ultimoErrore = errore;
        continue;
      }

      const testo = estraiTesto(await risposta.json());
      if (testo === null) {
        return err({
          type: "bad_response",
          message: "la risposta del modello non contiene testo",
          retryable: false,
        });
      }
      return ok(testo);
    }

    return err(ultimoErrore);
  }

  return { name: `gemini:${model}`, generate };
}

function mappaStato(status: number, dettaglio: string) {
  if (status === 401 || status === 403) {
    return { type: "auth" as const, message: `chiave API rifiutata (${status})`, retryable: false };
  }
  if (status === 429) {
    return { type: "rate_limit" as const, message: "quota esaurita, riprova piu' tardi", retryable: true };
  }
  if (status >= 500) {
    return { type: "network" as const, message: `errore del provider (${status})`, retryable: true };
  }
  return {
    type: "unknown" as const,
    message: `risposta inattesa (${status}): ${dettaglio.slice(0, 200)}`,
    retryable: false,
  };
}

function erroreSconosciuto(message: string) {
  return { type: "unknown" as const, message, retryable: false };
}

async function leggiTesto(risposta: Response): Promise<string> {
  try {
    return await risposta.text();
  } catch {
    return "";
  }
}

function estraiTesto(payload: unknown): string | null {
  const parti = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  const testo = parti?.[0]?.text;
  return typeof testo === "string" ? testo : null;
}
```

- [ ] **Step 5: Eseguire i test**

Run: `npm test`
Atteso: PASS su tutti i test di `tests/provider.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/result.ts src/lib/provider.ts tests/provider.test.ts
git commit -m "feat: tipo Result e provider Gemini con retry sugli errori temporanei"
```

---

### Task 5: L'orchestrazione dell'arricchimento

**Files:**
- Create: `src/lib/enrich.ts`
- Test: `tests/enrich.test.ts`

**Interfaces:**
- Consuma: `productDraftSchema`, `geminiResponseSchema` da `@/lib/schema`; `buildPrompt`, `buildRetryPrompt` da `@/lib/prompt`; `LlmProvider` da `@/lib/provider`; `Result` da `@/lib/result`
- Produce: `enrichImage(input, provider, opts?): Promise<Result<ProductDraft>>` dove `input = { imageBase64: string; mimeType: string; hint?: string }` e `opts = { maxSchemaRetries?: number }`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `tests/enrich.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/enrich` non trovato.

- [ ] **Step 3: Implementare l'orchestrazione**

Creare `src/lib/enrich.ts`:

```ts
import { productDraftSchema, geminiResponseSchema, type ProductDraft } from "@/lib/schema";
import { buildPrompt, buildRetryPrompt } from "@/lib/prompt";
import { type LlmProvider } from "@/lib/provider";
import { type Result, ok, err } from "@/lib/result";

export type EnrichInput = {
  imageBase64: string;
  mimeType: string;
  hint?: string;
};

export type EnrichOptions = {
  /** Quante volte richiedere una correzione dopo una risposta fuori contratto. */
  maxSchemaRetries?: number;
};

/**
 * Questa funzione non sa nulla di HTTP ne' di database: riceve un'immagine
 * gia' codificata e un provider, restituisce una bozza validata. E' per
 * questo che i test girano offline.
 */
export async function enrichImage(
  input: EnrichInput,
  provider: LlmProvider,
  opts: EnrichOptions = {}
): Promise<Result<ProductDraft>> {
  const maxSchemaRetries = opts.maxSchemaRetries ?? 1;
  const promptBase = buildPrompt({ hint: input.hint });
  const jsonSchema = geminiResponseSchema();

  let prompt = promptBase;
  let ultimoProblema = "nessuna risposta valida";

  for (let tentativo = 0; tentativo <= maxSchemaRetries; tentativo++) {
    const risposta = await provider.generate({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      prompt,
      jsonSchema,
    });

    // Un errore del provider (chiave, rete, quota) non si risolve
    // riformulando il prompt: lo restituiamo cosi' com'e'.
    if (!risposta.ok) return risposta;

    const analisi = analizza(risposta.data);
    if (analisi.ok) return analisi;

    ultimoProblema = analisi.error.message;
    prompt = buildRetryPrompt(promptBase, ultimoProblema);
  }

  return err({
    type: "bad_response",
    message: `il modello non ha rispettato il formato richiesto: ${ultimoProblema}`,
    retryable: false,
  });
}

/** Prima il JSON deve essere leggibile, poi deve rispettare il contratto. */
function analizza(testo: string): Result<ProductDraft> {
  let grezzo: unknown;
  try {
    grezzo = JSON.parse(testo);
  } catch {
    return err({ type: "bad_response", message: "la risposta non e' JSON valido", retryable: false });
  }

  const esito = productDraftSchema.safeParse(grezzo);
  if (!esito.success) {
    const dettagli = esito.error.issues
      .map((problema) => `${problema.path.join(".")}: ${problema.message}`)
      .join("; ");
    return err({ type: "bad_response", message: dettagli, retryable: false });
  }

  return ok(esito.data);
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Atteso: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrich.ts tests/enrich.test.ts
git commit -m "feat: orchestrazione dell'arricchimento con retry sullo schema"
```

---

### Task 6: La validazione del file caricato

**Files:**
- Create: `src/lib/image.ts`
- Test: `tests/image.test.ts`

**Interfaces:**
- Consuma: `Result` da `@/lib/result`
- Produce:
  - `MAX_IMAGE_BYTES: number`
  - `validateImage(bytes: Uint8Array): Result<{ mimeType: string }>`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `tests/image.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateImage, MAX_IMAGE_BYTES } from "@/lib/image";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // "%PDF-1"

describe("validateImage", () => {
  it("riconosce un JPEG", () => {
    const esito = validateImage(jpeg);
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.data.mimeType).toBe("image/jpeg");
  });

  it("riconosce un PNG", () => {
    const esito = validateImage(png);
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.data.mimeType).toBe("image/png");
  });

  it("rifiuta un PDF anche se ha estensione .jpg", () => {
    const esito = validateImage(pdf);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.type).toBe("invalid_input");
  });

  it("rifiuta un file vuoto", () => {
    expect(validateImage(new Uint8Array([])).ok).toBe(false);
  });

  it("rifiuta un file oltre il limite di dimensione", () => {
    const enorme = new Uint8Array(MAX_IMAGE_BYTES + 1);
    enorme.set(jpeg, 0);
    const esito = validateImage(enorme);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.message).toContain("5");
  });
});
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/image` non trovato.

- [ ] **Step 3: Implementare la validazione**

Creare `src/lib/image.ts`:

```ts
import { type Result, ok, err } from "@/lib/result";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Non ci fidiamo dell'estensione ne' del content-type dichiarato dal
 * browser: guardiamo i primi byte del file, che dicono cosa e' davvero.
 */
export function validateImage(bytes: Uint8Array): Result<{ mimeType: string }> {
  if (bytes.length === 0) {
    return err({ type: "invalid_input", message: "il file e' vuoto", retryable: false });
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    return err({
      type: "invalid_input",
      message: "immagine troppo grande: il limite e' 5 MB",
      retryable: false,
    });
  }

  const mimeType = riconosciFormato(bytes);
  if (mimeType === null) {
    return err({
      type: "invalid_input",
      message: "formato non supportato: sono ammessi JPEG, PNG e WebP",
      retryable: false,
    });
  }

  return ok({ mimeType });
}

function riconosciFormato(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";

  const firmaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && firmaPng.every((valore, i) => b[i] === valore)) return "image/png";

  // WebP: "RIFF" nei primi 4 byte e "WEBP" dal byte 8
  const testo = (inizio: number, fine: number) =>
    String.fromCharCode(...Array.from(b.slice(inizio, fine)));
  if (b.length >= 12 && testo(0, 4) === "RIFF" && testo(8, 12) === "WEBP") return "image/webp";

  return null;
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Atteso: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image.ts tests/image.test.ts
git commit -m "feat: validazione del file caricato dai byte reali"
```

---

### Task 7: Database e accesso ai prodotti

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/products.ts`, `tests/setup/prepara-db.ts`
- Modify: `vitest.config.ts`
- Test: `tests/products.test.ts`

**Interfaces:**
- Consuma: niente
- Produce:
  - `prisma` (istanza condivisa) da `@/lib/db`
  - `createProduct(input: NewProduct): Promise<Product>` dove `NewProduct = { title: string; description: string; category: string; tags: string[]; imagePath: string; aiDraftJson: string; model: string }`
  - `listProducts(): Promise<ProductView[]>` dove `ProductView` ha `tags: string[]` già deserializzati

- [ ] **Step 1: Installare Prisma e inizializzarlo**

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider sqlite
```

Creare `.env` (non versionato) partendo da `.env.example`, con almeno:

```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 2: Definire il modello**

Sostituire il contenuto di `prisma/schema.prisma` con:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Product {
  id          String   @id @default(cuid())
  title       String
  description String
  category    String
  // SQLite non ha un tipo array: i tag sono salvati come stringa JSON.
  // Su PostgreSQL si userebbe un array nativo.
  tags        String
  imagePath   String
  // La proposta originale dell'AI, prima delle correzioni umane.
  aiDraftJson String
  model       String
  createdAt   DateTime @default(now())
}
```

Applicare lo schema e generare il client:

```bash
npx prisma db push
```

- [ ] **Step 3: Configurare il database dei test**

Creare `tests/setup/prepara-db.ts`:

```ts
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Gira una volta prima di tutti i test: ricrea da zero un database
 * separato, cosi' i test non toccano mai i dati di sviluppo.
 */
export default function setup() {
  const fileDb = path.join(process.cwd(), "prisma", "test.db");
  if (fs.existsSync(fileDb)) fs.rmSync(fileDb);

  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
```

Aggiornare `vitest.config.ts` aggiungendo `env` e `globalSetup` dentro `test`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.contract.test.ts", "node_modules/**"],
    env: { DATABASE_URL: "file:./test.db" },
    globalSetup: ["tests/setup/prepara-db.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
```

- [ ] **Step 4: Scrivere i test che falliscono**

Creare `tests/products.test.ts`:

```ts
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
```

- [ ] **Step 5: Eseguire i test per verificare che falliscano**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/products` non trovato.

- [ ] **Step 6: Implementare l'accesso al database**

Creare `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

/**
 * In sviluppo Next.js ricarica i moduli a ogni modifica: senza questa cache
 * si aprirebbero decine di connessioni al database.
 */
const globalePerPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalePerPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalePerPrisma.prisma = prisma;
```

Creare `src/lib/products.ts`:

```ts
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
```

- [ ] **Step 7: Eseguire i test**

Run: `npm test`
Atteso: PASS.

Se il test "elenca prima i prodotti piu' recenti" risulta instabile perché i due record condividono lo stesso istante, ordinare per `createdAt` decrescente e poi `id` decrescente in `listProducts`:

```ts
const righe = await prisma.product.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
```

- [ ] **Step 8: Commit**

```bash
git add prisma src/lib/db.ts src/lib/products.ts tests/products.test.ts tests/setup vitest.config.ts package.json package-lock.json
git commit -m "feat: modello Product su SQLite con Prisma e funzioni di accesso"
```

---

### Task 8: Endpoint di arricchimento

**Files:**
- Create: `src/app/api/enrich/route.ts`, `src/lib/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consuma: `validateImage` da `@/lib/image`; `enrichImage` da `@/lib/enrich`; `createGeminiProvider` da `@/lib/provider`
- Produce:
  - `saveUpload(bytes: Uint8Array, mimeType: string): Promise<string>` — salva in `public/uploads`, restituisce il percorso pubblico
  - `POST /api/enrich` — riceve `multipart/form-data` con i campi `image` e `hint` opzionale; risponde `{ draft, imagePath, model }` oppure `{ error }`

- [ ] **Step 1: Scrivere il test del salvataggio file**

Creare `tests/storage.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { saveUpload } from "@/lib/storage";

const creati: string[] = [];

afterEach(() => {
  for (const percorso of creati.splice(0)) {
    const assoluto = path.join(process.cwd(), "public", percorso);
    if (fs.existsSync(assoluto)) fs.rmSync(assoluto);
  }
});

describe("saveUpload", () => {
  it("salva il file e restituisce un percorso pubblico", async () => {
    const percorso = await saveUpload(new Uint8Array([1, 2, 3]), "image/jpeg");
    creati.push(percorso);

    expect(percorso.startsWith("/uploads/")).toBe(true);
    expect(percorso.endsWith(".jpg")).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public", percorso))).toBe(true);
  });

  it("non usa mai due volte lo stesso nome", async () => {
    const primo = await saveUpload(new Uint8Array([1]), "image/png");
    const secondo = await saveUpload(new Uint8Array([2]), "image/png");
    creati.push(primo, secondo);

    expect(primo).not.toBe(secondo);
  });
});
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/storage` non trovato.

- [ ] **Step 3: Implementare il salvataggio**

Creare `src/lib/storage.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const CARTELLA = path.join(process.cwd(), "public", "uploads");

const ESTENSIONI: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Il nome del file lo decidiamo noi: usare quello inviato dal client
 * permetterebbe di scrivere fuori dalla cartella prevista.
 */
export async function saveUpload(bytes: Uint8Array, mimeType: string): Promise<string> {
  await fs.mkdir(CARTELLA, { recursive: true });

  const nome = `${crypto.randomUUID()}${ESTENSIONI[mimeType] ?? ".bin"}`;
  await fs.writeFile(path.join(CARTELLA, nome), bytes);

  return `/uploads/${nome}`;
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Atteso: PASS.

- [ ] **Step 5: Implementare l'endpoint**

Creare `src/app/api/enrich/route.ts`:

```ts
import { NextResponse } from "next/server";
import { validateImage } from "@/lib/image";
import { saveUpload } from "@/lib/storage";
import { enrichImage } from "@/lib/enrich";
import { createGeminiProvider } from "@/lib/provider";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurata: copia .env.example in .env e inserisci la chiave" },
      { status: 500 }
    );
  }

  const form = await request.formData();
  const file = form.get("image");
  const hint = form.get("hint");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "nessuna immagine ricevuta" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Prima la validazione, poi la chiamata all'AI: un file sbagliato non
  // deve costare una richiesta al provider.
  const controllo = validateImage(bytes);
  if (!controllo.ok) {
    return NextResponse.json({ error: controllo.error.message }, { status: 400 });
  }

  const provider = createGeminiProvider({ apiKey });
  const esito = await enrichImage(
    {
      imageBase64: Buffer.from(bytes).toString("base64"),
      mimeType: controllo.data.mimeType,
      hint: typeof hint === "string" ? hint : undefined,
    },
    provider
  );

  if (!esito.ok) {
    return NextResponse.json(
      { error: esito.error.message, retryable: esito.error.retryable },
      { status: esito.error.type === "rate_limit" ? 429 : 502 }
    );
  }

  // Salviamo il file solo dopo un arricchimento riuscito.
  const imagePath = await saveUpload(bytes, controllo.data.mimeType);

  return NextResponse.json({ draft: esito.data, imagePath, model: provider.name });
}
```

- [ ] **Step 6: Scrivere il test che verifica il risparmio della chiamata**

Questo è il test più importante della task: un file già invalido non deve
costare una richiesta al provider. Creare `tests/enrich-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/enrich/route";

const fetchOriginale = globalThis.fetch;

beforeEach(() => {
  process.env.GEMINI_API_KEY = "chiave-di-prova";
});

afterEach(() => {
  globalThis.fetch = fetchOriginale;
  vi.restoreAllMocks();
});

function richiestaCon(bytes: Uint8Array, nomeFile: string, tipoDichiarato: string) {
  const form = new FormData();
  form.append("image", new File([bytes], nomeFile, { type: tipoDichiarato }));
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

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const risposta = await POST(richiestaCon(jpeg, "prodotto.jpg", "image/jpeg"));
    const corpo = await risposta.json();

    expect(risposta.status).toBe(500);
    expect(corpo.error).toContain("GEMINI_API_KEY");
  });
});
```

- [ ] **Step 7: Eseguire i test**

Run: `npm test`
Atteso: PASS.

Se l'import di `@/app/api/enrich/route` fallisce perché `next/server` non si
risolve in ambiente Node, aggiungere l'alias in `vitest.config.ts` dentro
`resolve.alias`, accanto a quello esistente:

```ts
"@/app": path.resolve(process.cwd(), "src/app"),
```

- [ ] **Step 8: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Step 9: Commit**

```bash
git add src/lib/storage.ts src/app/api/enrich tests/storage.test.ts tests/enrich-route.test.ts
git commit -m "feat: endpoint di arricchimento e salvataggio delle immagini"
```

---

### Task 9: Endpoint dei prodotti

**Files:**
- Create: `src/app/api/products/route.ts`
- Test: `tests/product-input.test.ts`
- Create: `src/lib/product-input.ts`

**Interfaces:**
- Consuma: `CATEGORIES` da `@/lib/schema`; `createProduct`, `listProducts` da `@/lib/products`
- Produce:
  - `newProductSchema` (schema Zod del corpo della richiesta)
  - `POST /api/products` → `{ id }`; `GET /api/products` → `{ products }`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `tests/product-input.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm test`
Atteso: FAIL, modulo `@/lib/product-input` non trovato.

- [ ] **Step 3: Implementare la validazione dell'input**

Creare `src/lib/product-input.ts`:

```ts
import { z } from "zod";
import { CATEGORIES } from "@/lib/schema";

/**
 * L'utente puo' aver corretto i testi, quindi non riusiamo lo schema della
 * bozza: qui i vincoli sono piu' larghi sui contenuti, ma restano stretti
 * sui campi che il client non deve poter scegliere liberamente.
 */
export const newProductSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string().min(1).max(30)).max(10),
  imagePath: z.string().regex(/^\/uploads\/[A-Za-z0-9-]+\.(jpg|png|webp)$/),
  aiDraftJson: z.string(),
  model: z.string().min(1).max(100),
});

export type NewProductInput = z.infer<typeof newProductSchema>;
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Atteso: PASS.

- [ ] **Step 5: Implementare l'endpoint**

Creare `src/app/api/products/route.ts`:

```ts
import { NextResponse } from "next/server";
import { newProductSchema } from "@/lib/product-input";
import { createProduct, listProducts } from "@/lib/products";

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);

  const controllo = newProductSchema.safeParse(corpo);
  if (!controllo.success) {
    const dettagli = controllo.error.issues
      .map((problema) => `${problema.path.join(".")}: ${problema.message}`)
      .join("; ");
    return NextResponse.json({ error: `dati non validi — ${dettagli}` }, { status: 400 });
  }

  const prodotto = await createProduct(controllo.data);
  return NextResponse.json({ id: prodotto.id }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ products: await listProducts() });
}
```

- [ ] **Step 6: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add src/lib/product-input.ts src/app/api/products tests/product-input.test.ts
git commit -m "feat: endpoint di salvataggio e lettura dei prodotti"
```

---

### Task 10: Pagina di caricamento e revisione

**Files:**
- Create: `src/app/new/page.tsx`
- Modify: `src/app/layout.tsx` (titolo e navigazione)

**Interfaces:**
- Consuma: `POST /api/enrich`, `POST /api/products`, `CATEGORIES` da `@/lib/schema`
- Produce: la pagina `/new`

- [ ] **Step 1: Creare la pagina**

Creare `src/app/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/schema";

type Draft = {
  title: string;
  description: string;
  tags: string[];
  category: string;
  confidence: string;
};

export default function NuovoProdotto() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [imagePath, setImagePath] = useState("");
  const [model, setModel] = useState("");
  const [aiDraftJson, setAiDraftJson] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function genera() {
    if (!file) return;
    setInCorso(true);
    setErrore("");

    const form = new FormData();
    form.append("image", file);
    if (hint.trim()) form.append("hint", hint);

    const risposta = await fetch("/api/enrich", { method: "POST", body: form });
    const dati = await risposta.json();
    setInCorso(false);

    if (!risposta.ok) {
      setErrore(dati.error ?? "errore sconosciuto");
      return;
    }

    setDraft(dati.draft);
    setImagePath(dati.imagePath);
    setModel(dati.model);
    // Conserviamo la proposta originale prima di qualunque correzione.
    setAiDraftJson(JSON.stringify(dati.draft));
  }

  async function salva() {
    if (!draft) return;
    setInCorso(true);
    setErrore("");

    const risposta = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        tags: draft.tags,
        imagePath,
        aiDraftJson,
        model,
      }),
    });

    setInCorso(false);
    if (!risposta.ok) {
      const dati = await risposta.json();
      setErrore(dati.error ?? "salvataggio fallito");
      return;
    }

    router.push("/");
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Nuovo prodotto</h1>

      <section className="mb-6 space-y-3 rounded border p-4">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full"
        />
        <input
          type="text"
          placeholder="Suggerimento (facoltativo): es. borsa in pelle vintage"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className="w-full rounded border p-2"
        />
        <button
          onClick={genera}
          disabled={!file || inCorso}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {inCorso ? "Genero…" : "Genera con l'AI"}
        </button>
      </section>

      {errore && (
        <p className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-red-700">{errore}</p>
      )}

      {draft && (
        <section className="space-y-3 rounded border p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Bozza generata</h2>
            <span
              className={`rounded px-2 py-1 text-xs ${
                draft.confidence === "bassa" ? "bg-yellow-200" : "bg-gray-200"
              }`}
            >
              confidenza {draft.confidence}
            </span>
          </div>

          {draft.confidence === "bassa" && (
            <p className="text-sm text-yellow-800">
              Il modello non è sicuro di questa scheda: controllala bene prima di salvare.
            </p>
          )}

          {imagePath && <img src={imagePath} alt="" className="max-h-56 rounded" />}

          <label className="block text-sm font-medium">Titolo</label>
          <input
            className="w-full rounded border p-2"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />

          <label className="block text-sm font-medium">Descrizione</label>
          <textarea
            className="h-28 w-full rounded border p-2"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />

          <label className="block text-sm font-medium">Categoria</label>
          <select
            className="w-full rounded border p-2"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            {CATEGORIES.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium">Tag (separati da virgola)</label>
          <input
            className="w-full rounded border p-2"
            value={draft.tags.join(", ")}
            onChange={(e) =>
              setDraft({
                ...draft,
                tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
              })
            }
          />

          <button
            onClick={salva}
            disabled={inCorso}
            className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-40"
          >
            {inCorso ? "Salvo…" : "Salva prodotto"}
          </button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Aggiungere la navigazione nel layout**

In `src/app/layout.tsx`, dentro `<body>`, prima di `{children}`:

```tsx
<nav className="border-b p-4">
  <a href="/" className="mr-4 font-semibold">Catalogo</a>
  <a href="/new" className="text-blue-700">Nuovo prodotto</a>
</nav>
```

Aggiornare anche l'oggetto `metadata` nello stesso file:

```tsx
export const metadata = {
  title: "AI Content Enricher",
  description: "Schede prodotto generate dall'AI e approvate da una persona",
};
```

- [ ] **Step 3: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Step 4: Eseguire i test**

Run: `npm test`
Atteso: PASS (invariati).

- [ ] **Step 5: Commit**

```bash
git add src/app/new src/app/layout.tsx
git commit -m "feat: pagina di caricamento, revisione e salvataggio della bozza"
```

---

### Task 11: Pagina del catalogo

**Files:**
- Create/Modify: `src/app/page.tsx`

**Interfaces:**
- Consuma: `listProducts` da `@/lib/products`
- Produce: la pagina `/`

- [ ] **Step 1: Sostituire la pagina iniziale**

Sostituire il contenuto di `src/app/page.tsx` con:

```tsx
import { listProducts } from "@/lib/products";

// Legge il database a ogni richiesta: senza questa riga Next.js
// servirebbe una versione statica generata al momento della build.
export const dynamic = "force-dynamic";

export default async function Catalogo() {
  const prodotti = await listProducts();

  if (prodotti.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Catalogo</h1>
        <p className="text-gray-600">
          Nessun prodotto salvato. Vai su <a className="text-blue-700" href="/new">Nuovo prodotto</a> per
          crearne uno.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Catalogo ({prodotti.length})</h1>

      <ul className="space-y-4">
        {prodotti.map((prodotto) => (
          <li key={prodotto.id} className="flex gap-4 rounded border p-4">
            <img src={prodotto.imagePath} alt="" className="h-24 w-24 rounded object-cover" />

            <div className="min-w-0">
              <h2 className="font-semibold">{prodotto.title}</h2>
              <p className="mb-2 text-sm text-gray-700">{prodotto.description}</p>
              <p className="text-xs text-gray-500">
                {prodotto.category} · {prodotto.tags.join(", ")} · {prodotto.model}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: pagina catalogo con i prodotti salvati"
```

---

### Task 12: Prova end-to-end reale, test di contratto e README

**Files:**
- Create: `tests/gemini.contract.test.ts`, `README.md`

**Interfaces:**
- Consuma: tutto il resto
- Produce: documentazione e verifica manuale del flusso completo

- [ ] **Step 1: Ottenere una chiave e configurarla**

Creare una chiave gratuita su `https://aistudio.google.com/apikey`, inserirla in `.env`:

```
GEMINI_API_KEY=la-tua-chiave
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 2: Verificare che il modello configurato esista**

I nomi dei modelli cambiano nel tempo: controllare che `gemini-2.5-flash` sia ancora disponibile sul piano gratuito.

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | grep -o '"name": "[^"]*"' | head -20
```

Se non compare, scegliere un modello `flash` disponibile dall'elenco e aggiornare `MODELLO_DEFAULT` in `src/lib/provider.ts`.

- [ ] **Step 3: Scrivere il test di contratto**

Creare `tests/gemini.contract.test.ts` (escluso dalla suite normale dalla configurazione della Task 1):

```ts
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
```

Aggiungere lo script in `package.json`, dentro `"scripts"`:

```json
"test:contract": "vitest run tests/gemini.contract.test.ts --exclude ''"
```

- [ ] **Step 4: Eseguire il test di contratto**

Run: `npm run test:contract`
Atteso: PASS. Se fallisce per il modello non trovato, tornare allo Step 2.

- [ ] **Step 5: Prova manuale del flusso completo**

```bash
npm run dev
```

Aprire `http://localhost:3000/new`, caricare la foto di un oggetto reale, premere "Genera con l'AI", correggere un campo, premere "Salva prodotto". Verificare che il prodotto compaia in `http://localhost:3000/`.

Controllare anche i casi negativi: caricare un PDF rinominato in `.jpg` (deve essere rifiutato con un messaggio chiaro, senza chiamare l'AI) e rimuovere temporaneamente `GEMINI_API_KEY` dal `.env` (deve comparire il messaggio sulla chiave mancante).

- [ ] **Step 6: Scrivere il README**

Creare `README.md`:

````markdown
# AI Content Enricher

Carichi la foto di un prodotto, un modello AI propone titolo, descrizione, tag e
categoria, tu rivedi la bozza e la salvi. **L'AI propone, la persona approva:** il
modello non scrive mai direttamente a database.

## Avvio

```bash
npm install
cp .env.example .env      # inserire GEMINI_API_KEY (chiave gratuita da Google AI Studio)
npx prisma db push
npm run dev
```

## Test

```bash
npm test              # suite completa, offline, senza chiave API
npm run test:contract # chiama davvero Gemini: verifica che il contratto regga
```

## Come è fatto

| Cartella | Contenuto |
|---|---|
| `src/lib` | Logica di dominio: non conosce HTTP né il database |
| `src/app/api` | Endpoint HTTP: traducono richieste in chiamate alla logica |
| `src/app` | Pagine |
| `tests` | Test, uno per modulo |

## Le tre linee di difesa sull'output del modello

1. **Il prompt** — istruzioni esplicite. La linea più debole: sono solo parole.
2. **Lo schema JSON inviato al modello** — vincola la generazione lato provider.
3. **La validazione con Zod** — l'ultima parola, dalla nostra parte.

Il livello 3 non è ridondante: il provider può cambiare comportamento senza
preavviso, uno schema JSON non esprime bene regole come "i tag devono essere
minuscoli", e cambiando modello il livello 2 sparisce mentre il 3 resta.
La regola generale è **non fidarsi mai di un dato che arriva da fuori**.

## Scelte e compromessi

- **Provider dietro un'interfaccia.** Si usa Gemini perché ha un piano gratuito.
  Passare a Claude o OpenAI significa scrivere una nuova implementazione di
  `LlmProvider`, senza toccare `enrich.ts` né i test.
- **I test non chiamano la rete.** Un provider finto rende la suite veloce,
  gratuita e deterministica. Il test di contratto, separato, copre il caso reale.
- **Retry mirati.** Si ritenta solo ciò che può migliorare ritentando: rete, 5xx,
  rate limit. Una chiave rifiutata fallisce subito. Ogni retry ha un tetto.
- **Tag come stringa JSON.** SQLite non ha un tipo array. Su PostgreSQL si
  userebbe un array nativo.
- **Validazione dell'upload dai byte reali**, non dall'estensione, prima di
  chiamare l'AI: un file sbagliato non deve costare una richiesta al provider.

## Cosa manca di proposito

Autenticazione, elaborazione a lotti, code di lavoro, deploy in cloud, CMS
headless. Sono estensioni naturali, non requisiti di questa versione.
````

- [ ] **Step 7: Eseguire la suite completa un'ultima volta**

Run: `npm test`
Atteso: tutti i test passati.

- [ ] **Step 8: Commit**

```bash
git add README.md tests/gemini.contract.test.ts package.json
git commit -m "docs: README del progetto e test di contratto con Gemini"
```

---

## Riepilogo dei task

| # | Task | Deliverable |
|---|---|---|
| 1 | Scaffolding | `npm test` funziona |
| 2 | Schema della bozza | Contratto dati validato |
| 3 | Prompt | Istruzioni e correzione |
| 4 | Result + provider Gemini | Chiamata HTTP con retry |
| 5 | Orchestrazione | Immagine → bozza validata |
| 6 | Validazione immagine | File sbagliati rifiutati |
| 7 | Database | Prodotti salvati e riletti |
| 8 | Endpoint arricchimento | `POST /api/enrich` |
| 9 | Endpoint prodotti | `POST` e `GET /api/products` |
| 10 | Pagina di revisione | `/new` |
| 11 | Pagina catalogo | `/` |
| 12 | Prova reale e README | Progetto documentato e verificato |
