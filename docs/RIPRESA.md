# Come riprendere questo progetto

Documento di ripresa: serve a ricominciare da dove si era rimasti, anche a
distanza di tempo o da una sessione completamente nuova. Aggiornato al
**3 settembre 2026**.

---

## Dove siamo

Branch di lavoro: **`feat/mvp`** (non `master`). Nessun push, nessun remote.

| Task | Stato |
|---|---|
| 1 — Scaffolding Next.js + Vitest | ✅ completo, review pulita |
| 2 — Schema Zod della bozza | ✅ completo, review pulita |
| 3 — Costruttore del prompt | ✅ completo, dopo 1 giro di correzioni |
| 4 — Tipo `Result` + provider Gemini | ✅ completo, dopo 1 giro di correzioni |
| 5 — Orchestrazione dell'arricchimento | ✅ completo, review pulita |
| 6 — Validazione del file caricato | implementato, review in corso |
| 7 — Database (Prisma + SQLite) | da fare |
| 8 — Endpoint di arricchimento | da fare |
| 9 — Endpoint dei prodotti | da fare |
| 10 — Pagina di caricamento e revisione | da fare |
| 11 — Pagina catalogo | da fare |
| 12 — Prova reale, test di contratto, README | da fare |

Suite di test: **35/35 verdi**. `npx tsc --noEmit` pulito. `npm run build` verificata al Task 1.

---

## I documenti, e a cosa serve ciascuno

| File | Cosa contiene |
|---|---|
| `docs/superpowers/specs/2026-09-03-ai-content-enricher-design.md` | **La specifica.** L'autorità: in caso di conflitto, decide questo documento |
| `docs/superpowers/plans/2026-09-03-ai-content-enricher.md` | **Il piano.** 12 task con test e codice già scritti per esteso |
| `docs/Guida-Studio-AI-Content-Enricher.docx` | Guida allo studio. **Si aggiorna solo su richiesta esplicita** |
| `docs/Diario-di-bordo.md` | Problemi incontrati e lezioni. Si aggiorna a ogni intoppo |
| `.superpowers/sdd/2026-09-03-ai-content-enricher/progress.md` | **Il registro di avanzamento.** Non versionato: vive solo su questa macchina |

Il registro di avanzamento contiene, per ogni task: cosa è stato fatto, i
risultati delle revisioni, i problemi rimandati e **tutte le decisioni prese**
(cercare le righe che iniziano con `Ruling`). Se quel file va perso, la storia
di git resta comunque la fonte di verità: `git log --oneline` racconta la stessa
sequenza.

---

## Riprendere il lavoro

1. Leggere la specifica e il piano.
2. Leggere il registro di avanzamento: l'ultima riga `Task <N>: complete` dice
   dove si era arrivati. I task senza quella riga non sono chiusi.
3. Riprendere dal primo task non completato, seguendo il suo testo nel piano.

Il piano contiene, per ogni task, il file di test completo e il file di
implementazione completo: non serve reinventare nulla. L'ordine dei passi è il
processo — prima il test che fallisce, poi l'implementazione.

### Comandi

```bash
npm install          # se node_modules manca
npm test             # suite completa, offline, senza chiave API
npx tsc --noEmit     # controllo dei tipi
npm run dev          # avvia l'app in locale
```

---

## Cosa serve ancora dall'esterno

Una **chiave API gratuita di Google Gemini**, da <https://aistudio.google.com/apikey>.
Serve solo dal Task 12 in poi (la prova reale e il test di contratto): i task da
1 a 11 girano e si testano senza.

Quando la si ha: copiare `.env.example` in `.env` e riempire `GEMINI_API_KEY`.

---

## Decisioni già prese, da non rimettere in discussione

- **Spesa zero.** Provider = Gemini free tier, non Anthropic né OpenAI. Il
  provider sta dietro un'interfaccia: cambiarlo significa scrivere una nuova
  implementazione di `LlmProvider`, senza toccare il resto.
- **Fase 1 tutta in locale.** SQLite come file, immagini in `public/uploads/`.
  Niente deploy, niente Strapi, niente elaborazione a lotti, niente
  autenticazione.
- **Il codice deve essere studiabile riga per riga.** File piccoli, nessuna
  astrazione furba, commenti in italiano dove il perché non è ovvio. Questo
  vincolo viene prima dell'eleganza.
- **Identità git personale**, mai quella aziendale: `pietroboccimeetin@gmail.com`,
  impostata a livello di repository.
- **L'AI propone, la persona approva.** Arricchimento e salvataggio restano due
  passi separati. Non unirli.

---

## Problemi noti, non ancora affrontati

Sono tutti registrati anche nel registro di avanzamento come *minor (deferred)*,
e vanno ripresi nella revisione finale:

- Il filtro che adatta lo schema Zod al formato di Gemini non gestisce le chiavi
  di composizione (`anyOf`) che comparirebbero se un campo diventasse
  `.optional()` o `.nullable()`. Oggi nessun campo le usa. Vedi la voce 7 del
  diario di bordo.
- `"type": "module"` nel `package.json` rende ESM ogni file `.js`: un futuro
  script scritto con `require()` andrà rinominato `.cjs`.
- Manca `"engines": { "node": ">=22" }` nel `package.json`.
- La regex dei tag assume caratteri accentati precomposti (NFC); una forma
  decomposta (NFD) verrebbe rifiutata.
- Due test del provider (429 persistente, risposta senza testo) non asseriscono
  `error.type` e `retryable` con la stessa completezza degli altri.
