<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AI Content Enricher — istruzioni di progetto

## Cos'è

Si carica la foto di un prodotto, un LLM propone titolo, descrizione, tag e
categoria come dati strutturati e validati, una persona rivede la bozza e solo
allora la salva. **L'AI propone, la persona approva:** il modello non scrive mai
direttamente a database, e i due passi restano separati.

Il progetto è un portfolio per una candidatura come fullstack developer, e ha un
secondo obiettivo altrettanto vincolante: **il codice deve essere comprensibile
riga per riga da chi lo ha commissionato.**

## Prima di lavorare, leggere in quest'ordine

1. `docs/RIPRESA.md` — stato attuale dei 12 task, comandi, problemi noti
2. `docs/superpowers/specs/2026-09-03-ai-content-enricher-design.md` — **la
   specifica: è l'autorità.** In caso di conflitto decide questo documento
3. `docs/superpowers/plans/2026-09-03-ai-content-enricher.md` — il piano: 12
   task con test e codice già scritti per esteso
4. `.superpowers/sdd/2026-09-03-ai-content-enricher/progress.md` — registro di
   avanzamento e decisioni prese (righe `Ruling`). Non versionato: se manca, la
   storia di git racconta la stessa sequenza

## Vincoli non negoziabili

- **Studiabilità prima dell'eleganza.** File piccoli, una responsabilità
  ciascuno, nessuna astrazione non necessaria, nessuna libreria che nasconda il
  meccanismo. Commenti in italiano dove il *perché* non è ovvio.
- **Spesa zero.** Il provider LLM è Google Gemini free tier, chiamato via REST
  con `fetch`. Non introdurre servizi a pagamento né SDK non necessari.
- **Il provider sta dietro l'interfaccia `LlmProvider`.** Cambiare fornitore
  deve significare scrivere una nuova implementazione, senza toccare
  `enrich.ts` né i test.
- **I test non chiamano mai la rete.** Unica eccezione: `tests/*.contract.test.ts`,
  esclusi dalla suite di default. Un test che fa una chiamata reale è un difetto.
- **Ogni operazione fallibile restituisce `Result`**, mai un'eccezione:
  `{ ok: true, data }` oppure `{ ok: false, error: { type, message, retryable } }`.
- **Mai ritentare un errore che non può migliorare ritentando**, e ogni retry ha
  un tetto: il piano gratuito ha una quota giornaliera.
- **Tutto in locale in fase 1.** SQLite come file, immagini in `public/uploads/`.
  Niente deploy, autenticazione, elaborazione a lotti o CMS headless.
- **Lingua: italiano** — interfaccia, commenti, messaggi, contenuti generati.
  **Eccezione: il `README.md` e la descrizione del repository su GitHub sono
  in inglese**, perché sono la vetrina del progetto e chi seleziona spesso non
  è italiano. Non tradurli in italiano "per coerenza".

## Convenzioni

- Branch principale: `main`.
- Identità git **personale** (`pietroboccimeetin@gmail.com`), impostata a livello
  di repository. Non usare mai l'indirizzo aziendale.
- Commit: conventional commits in italiano, con trailer
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Elencare i file esplicitamente in `git add`. Non usare `git add -A`: raccoglie
  anche modifiche pendenti che non c'entrano.
- Ogni intoppo va annotato in `docs/Diario-di-bordo.md` nel formato *cosa è
  successo → perché → come è stato risolto → lezione*. Serve come materiale di
  studio e di colloquio.
- `docs/Guida-Studio-AI-Content-Enricher.docx` si aggiorna **solo su richiesta
  esplicita**, mai di iniziativa.

## Comandi

```bash
npm test             # suite completa, offline, senza chiave API
npx tsc --noEmit     # controllo dei tipi
npm run dev          # avvia l'app in locale
```
