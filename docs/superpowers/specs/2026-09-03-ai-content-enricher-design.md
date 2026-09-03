# AI Content Enricher — Documento di design

**Data:** 2026-09-03
**Autore:** Pietro Bocci
**Stato:** approvato, pronto per il piano di implementazione

---

## 1. Obiettivo

Costruire un'applicazione web dove si carica la foto di un prodotto e un modello di intelligenza artificiale propone titolo, descrizione, tag e categoria. La persona rivede la bozza, la corregge e solo allora la salva a database.

Il progetto ha due obiettivi paralleli, entrambi vincolanti:

1. **Portfolio.** Dimostrare la capacità di integrare un LLM *dentro* un prodotto software — con contratto, validazione e gestione degli errori — e non di "usare ChatGPT". È il segnale richiesto per una candidatura come fullstack developer.
2. **Studio.** Il codice deve essere comprensibile riga per riga dall'autore. Questo vincolo ha precedenza sull'eleganza: file piccoli con una sola responsabilità, nessuna astrazione non necessaria, nessuna libreria che nasconda il meccanismo.

### Criteri di successo

- Il flusso completo funziona in locale: foto → bozza AI → revisione → salvataggio → lista.
- La suite di test gira offline, senza chiave API e senza rete.
- Il README spiega *perché* ogni scelta è stata fatta, non solo cosa fa il codice.
- L'autore sa spiegare a voce ogni decisione architetturale del progetto.

### Non obiettivi (esclusi deliberatamente)

Autenticazione, elaborazione a lotti, code di lavoro, CMS headless, deploy in cloud (rimandato a una fase 2), internazionalizzazione, ricerca full-text.

Ognuno di questi è una risposta valida alla domanda "come lo estenderesti?" senza doverlo costruire.

---

## 2. Principio guida

**L'AI propone, la persona approva.**

L'arricchimento e il salvataggio sono due passi distinti. Il modello non scrive mai direttamente a database. Questo evita il pattern ingenuo "AI → DB" e rispecchia il modo in cui uno strumento del genere verrebbe realmente usato in un'agenzia.

---

## 3. Architettura

### Flusso

```
[1] /new — l'utente sceglie una foto (+ categoria suggerita, opzionale)
        |  POST multipart/form-data
        v
[2] /api/enrich — valida il file, lo converte in base64
        |
        v
[3] lib/enrich.ts — costruisce il prompt -> chiama il provider -> riceve JSON
        |            -> valida con Zod -> se invalido, 1 retry con il messaggio d'errore
        v
[4] risposta: bozza { title, description, tags[], category, confidence }
        |            (NON salvata)
        v
[5] form precompilato, l'utente corregge -> POST /api/products -> Prisma -> SQLite
        |
        v
[6] / — lista dei prodotti salvati
```

### Moduli

| File | Responsabilità | Non sa nulla di |
|---|---|---|
| `src/lib/schema.ts` | Schema Zod della bozza; fonte unica di verità | HTTP, database, provider |
| `src/lib/prompt.ts` | Costruzione del testo del prompt | HTTP, database |
| `src/lib/provider.ts` | Interfaccia LLM + implementazione Gemini | Prodotti, database |
| `src/lib/enrich.ts` | Orchestrazione: immagine → bozza, con retry | HTTP, database |
| `src/lib/db.ts` | Client Prisma | AI |
| `src/app/api/enrich/route.ts` | Endpoint di arricchimento | Dettagli del provider |
| `src/app/api/products/route.ts` | Endpoint di salvataggio e lettura | AI |
| `src/app/page.tsx` | Lista prodotti | — |
| `src/app/new/page.tsx` | Upload e revisione | — |

L'isolamento non è un vezzo: è ciò che permette ai test di girare senza rete e al provider di essere sostituito senza toccare il resto.

---

## 4. Il contratto con l'AI

### La bozza (`ProductDraft`)

| Campo | Tipo | Regole |
|---|---|---|
| `title` | stringa | 3–60 caratteri |
| `description` | stringa | 20–400 caratteri |
| `tags` | array di stringhe | 3–6 elementi, minuscoli, 2–20 caratteri ciascuno |
| `category` | enum | `abbigliamento` `calzature` `accessori` `casa` `elettronica` `altro` |
| `confidence` | enum | `alta` `media` `bassa` |

`category` a lista chiusa rende la validazione significativa: una categoria inventata viene intercettata, cosa impossibile su un campo di testo libero.

`confidence` è l'autovalutazione del modello. L'interfaccia evidenzia le bozze marcate `bassa`, rendendo esplicito che il modello può sbagliare.

### Tre linee di difesa

1. **Il prompt** — istruzioni esplicite. La linea più debole: sono solo parole.
2. **Lo schema JSON passato al modello** — vincola la generazione lato provider.
3. **Zod, lato applicazione** — l'ultima parola. Qui non si chiede, si verifica.

Il livello 3 non è ridondante rispetto al 2: il provider può cambiare comportamento senza preavviso, uno schema JSON non esprime bene regole come "i tag devono essere minuscoli", e cambiando modello il livello 2 sparisce mentre il 3 resta.

**Regola generale: non fidarsi mai di un dato che arriva da fuori.** Vale per l'output di un LLM esattamente come per l'input di un utente.

### Fonte unica di verità

Lo schema si scrive una sola volta in Zod; lo schema JSON per il modello viene derivato da lì (Zod 4 espone questa conversione nativamente — da verificare in fase di setup). Aggiungere un campo significa modificare un solo file.

---

## 5. Modello dati

```
Product
  id            String    identificativo
  title         String    testo finale (dopo revisione umana)
  description   String    testo finale
  category      String    categoria finale
  tags          String    tag finali, serializzati in JSON (vedi nota)
  imagePath     String    percorso del file salvato
  aiDraftJson   String    la proposta ORIGINALE dell'AI, intatta
  model         String    identificativo del modello che l'ha generata
  createdAt     DateTime  timestamp
```

`aiDraftJson` conserva la proposta del modello prima delle correzioni umane. Costa una colonna e abilita una schermata di confronto "proposta vs salvato", oltre a essere il primo mattone per misurare la qualità del modello nel tempo.

**Compromesso noto:** SQLite non ha un tipo array, quindi i tag sono serializzati come stringa JSON. Su PostgreSQL si userebbe un array nativo. Da documentare nel README.

---

## 6. Gestione degli errori

| Situazione | Risposta |
|---|---|
| Timeout o errore di rete | Retry, max 2, con attesa crescente |
| Rate limit (429) | Retry rispettando l'attesa indicata dal server |
| Errore server del provider (5xx) | Retry |
| Risposta non JSON | 1 solo retry, rimandando l'errore al modello |
| JSON fuori contratto | 1 solo retry, comunicando l'errore di validazione |
| Chiave API mancante o invalida | Fallimento immediato, messaggio chiaro. Nessun retry |
| File non immagine o troppo grande | Rifiuto **prima** di chiamare l'AI |
| Immagine senza un prodotto | Non è un errore tecnico: intercettato in revisione umana |

Due regole non negoziabili:

- **Mai ritentare un errore che non può migliorare ritentando.** Una chiave sbagliata resta sbagliata.
- **Ogni retry ha un tetto.** Il retry illimitato su un tier gratuito esaurisce la quota giornaliera in pochi secondi.

Il retry sullo schema non ripete la stessa domanda: rimanda al modello il messaggio di errore specifico, che nella maggior parte dei casi si corregge al secondo tentativo.

### Forma del risultato

La funzione di arricchimento restituisce sempre una delle due forme:

```
{ ok: true,  data: ProductDraft }
{ ok: false, error: { type, message, retryable } }
```

TypeScript obbliga così a gestire il fallimento prima di poter leggere i dati.

### Sicurezza dell'upload

Verifica del tipo reale del file (non dell'estensione), tetto di 5 MB, nome del file generato lato server e mai preso da quello inviato dal client.

---

## 7. Strategia di test

Il provider AI sta dietro un'interfaccia, quindi i test usano un'implementazione finta. I test girano offline, in tempi brevi, senza chiave e con esito deterministico.

Casi da coprire:

1. Bozza valida → passa, campi corretti
2. Risposta non-JSON → 1 retry → errore chiaro
3. Categoria inventata → 1 retry → successo al secondo tentativo
4. 8 tag invece di massimo 6 → rifiutata
5. Timeout → retry, poi errore marcato ritentabile
6. Rate limit → attesa rispettata, nessun martellamento
7. PDF spacciato per immagine → rifiutato **senza chiamare il provider**
8. Il prompt costruito contiene la lista delle categorie ammesse

Il caso 7 verifica esplicitamente che il provider finto non venga invocato: dimostra attenzione a non sprecare chiamate a pagamento su input già invalidi.

**Test di contratto:** un test separato, disattivato di default, che chiama realmente Gemini e verifica che la forma della risposta sia ancora quella attesa. Va lanciato manualmente. Serve a rilevare cambi di comportamento del provider, invisibili ai test con provider finto.

---

## 8. Stack tecnologico

| Tecnologia | Ruolo | Perché questa |
|---|---|---|
| Next.js (App Router) | Frontend + API nello stesso progetto | Stack core dell'azienda target; un solo progetto da gestire |
| TypeScript | Tipizzazione | Stack core dell'azienda target; rende esplicito il contratto dei dati |
| Tailwind CSS | Stili | Veloce, nessun file CSS separato da mantenere |
| Prisma | ORM | Concettualmente vicino a Entity Framework, già noto all'autore. Rende lo switch SQLite → PostgreSQL una modifica minima |
| SQLite | Database (fase 1) | Un file, zero server da installare, zero account da creare |
| Zod | Validazione | Fonte unica di verità per lo schema; genera lo schema JSON per il modello |
| Google Gemini (free tier) | Modello AI | Gratuito, supporta vision e schema JSON, nessuna carta richiesta |
| Vitest | Test | Standard nell'ecosistema, veloce, integrazione naturale con TypeScript |

### Nota sul provider

Il vincolo di budget è zero spesa, da cui Gemini. Il provider è però dietro un'interfaccia: passare a Claude o OpenAI significa scrivere una nuova implementazione di quell'interfaccia, senza toccare né la logica di arricchimento né i test.

---

## 9. Fase 2 (fuori scope, da citare in colloquio)

- Deploy: SQLite → PostgreSQL gestito, file locali → object storage, hosting su Vercel
- Elaborazione a lotti con coda di lavoro e avanzamento in tempo reale
- Sostituzione del layer dati con un CMS headless (Strapi) in ottica agenzia
- Metriche sulla qualità del modello a partire dai dati in `aiDraftJson`
