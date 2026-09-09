# Come riprendere questo progetto

Documento di ripresa: serve a ricominciare da dove si era rimasti, anche a
distanza di tempo o da una sessione completamente nuova. Aggiornato al
**4 settembre 2026**.

---

## Dove siamo

Branch: **`main`**.

| Task | Stato |
|---|---|
| 1 — Scaffolding Next.js + Vitest | ✅ completo, review pulita |
| 2 — Schema Zod della bozza | ✅ completo, review pulita |
| 3 — Costruttore del prompt | ✅ completo, dopo 1 giro di correzioni |
| 4 — Tipo `Result` + provider Gemini | ✅ completo, dopo 1 giro di correzioni |
| 5 — Orchestrazione dell'arricchimento | ✅ completo, review pulita |
| 6 — Validazione del file caricato | ✅ completo, review pulita |
| 7 — Database (Prisma 7 + SQLite) | ✅ completo |
| 8 — Endpoint di arricchimento | ✅ completo |
| 9 — Endpoint dei prodotti | ✅ completo |
| 10 — Pagina di caricamento e revisione | ✅ completo |
| 11 — Pagina catalogo | ✅ completo |
| 12 — Test di contratto e README | ✅ completo; resta la **prova reale**, che richiede una chiave API |

**Tutti e dodici i task sono implementati e revisionati**, più un giro finale di
correzioni sull'intero branch: attesa rispettata sul 429 (`Retry-After`),
`Result` anche nel livello database, messaggi di Zod in italiano, tetto ai
ritentativi combinati, test dei due endpoint.

Suite di test: **54/54 verdi** (i test di contratto sono esclusi: chiamano la
rete). `npx tsc --noEmit` pulito, `npm run build` riuscita, `npm run lint` senza
errori — restano 2 warning `no-img-element`, accettati: `next/image` non serve
per immagini locali già ridimensionate.

---

## Prisma 7, non Prisma 6 — differenze rispetto al piano

Il piano è stato scritto per Prisma 6, il progetto usa Prisma 7.10.0. Le
differenze restano utili a chi legge il piano:

| Il piano dice | Prisma 7 fa |
|---|---|
| `generator client { provider = "prisma-client-js" }` | `provider = "prisma-client"` con `output` **obbligatorio** |
| Client importato da `@prisma/client` | Client generato in `src/generated/prisma`, si importa da lì |
| `url = env("DATABASE_URL")` dentro il `datasource` | Nessun `url` nello schema: sta in `prisma7.config.ts` |
| Nessun file di configurazione separato | `prisma7.config.ts` alla radice, che importa `dotenv/config` |

`src/generated/prisma` è ignorato da git: **chi clona il repo deve eseguire
`npx prisma generate` prima che il progetto compili.**

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

## Cosa resta da fare

Il codice è finito: quello che manca richiede una chiave API e una persona
davanti allo schermo.

1. **Ottenere una chiave API gratuita di Google Gemini** da
   <https://aistudio.google.com/apikey>, poi copiare `.env.example` in `.env` e
   riempire `GEMINI_API_KEY`.
2. **Verificare che il modello sia ancora disponibile sul piano gratuito.** Il
   provider usa `gemini-2.5-flash` (costante `MODELLO_DEFAULT` in
   `src/lib/provider.ts`): i nomi dei modelli gratuiti cambiano nel tempo, se
   quello non esiste più va aggiornata quella costante.
3. **Eseguire il test di contratto:** `npm run test:contract`. Chiama la rete
   davvero e consuma una richiesta di quota. Verifica solo che la risposta sia
   JSON con i cinque campi previsti; le regole di contenuto restano coperte
   offline da `tests/schema.test.ts`.
4. **Fare la prova manuale da capo a fondo:** `npm run dev`, caricare una foto
   vera su `/new`, controllare la bozza proposta, correggerla, salvarla e
   ritrovarla nel catalogo su `/`. È il passo che chiude il Task 12.
5. Annotare in `docs/Diario-di-bordo.md` qualunque intoppo emerga dalla prova.

Già verificato **senza** chiave, dal browser sull app avviata: le due pagine si
renderizzano, `/api/products` rifiuta con 400 in italiano un percorso immagine
fuori da `/uploads` e una categoria inventata senza creare righe, accetta un
corpo valido con 201 e lo rilegge con i tag come array. Nessun errore nei log
del server.

### Comandi

```powershell
npm install           # se node_modules manca
npx prisma generate   # se src/generated/prisma manca
npm test              # suite completa, offline, senza chiave API
npx tsc --noEmit      # controllo dei tipi
npm run lint          # ESLint
npm run build         # build di produzione
npm run dev           # avvia l'app in locale
npm run test:contract # chiama Gemini davvero: serve GEMINI_API_KEY in .env
```

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

Sono tutti registrati anche nel registro di avanzamento come *minor (deferred)*.
La revisione finale li ha valutati e lasciati aperti di proposito: nessuno si
manifesta con il codice di oggi, e vanno ripresi solo se il progetto cresce.

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
