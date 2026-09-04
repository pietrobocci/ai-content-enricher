# AI Content Enricher

Carichi la foto di un prodotto, un modello AI propone titolo, descrizione, tag e
categoria, tu rivedi la bozza e la salvi. **L'AI propone, la persona approva:** il
modello non scrive mai direttamente a database.

## Avvio

```bash
npm install
npx prisma generate         # genera il client Prisma in src/generated/prisma
                             # (cartella ignorata da git: senza questo passo
                             # il progetto non compila né tipizza)
cp .env.example .env        # inserire GEMINI_API_KEY (chiave gratuita da Google AI Studio)
npx prisma db push
npm run dev
```

Il progetto usa **Prisma 7**: la configurazione vive in `prisma7.config.ts`,
nella radice del repository, invece che nello schema, e il client generato si
importa dalla cartella `src/generated/prisma` invece che da `@prisma/client`.

## Test

```bash
npm test              # suite completa, offline, senza chiave API
npm run test:contract # chiama davvero Gemini: verifica che il contratto regga
```

Tutti i test tranne uno usano un provider finto: la suite resta veloce,
gratuita e deterministica, ma non si accorgerebbe mai del giorno in cui Google
cambia il formato della risposta. Il test di contratto (`tests/gemini.contract.test.ts`)
è quello che se ne accorge: fa una vera chiamata di rete a Gemini e verifica che
la risposta rispetti ancora lo schema atteso. Proprio perché chiama la rete è
escluso dalla suite di default — un test che tocca la rete non è qualcosa che
una suite dovrebbe fare a ogni esecuzione — e va lanciato a parte con
`npm run test:contract`, con `GEMINI_API_KEY` impostata in `.env`.

Lo stesso test è anche ciò che conferma che la chiave viaggia nell'header
`x-goog-api-key` e non nella query string: una chiave nell'URL finisce nei log
dei proxy e può ricomparire dentro i messaggi d'errore che l'app inoltra al
browser.

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
