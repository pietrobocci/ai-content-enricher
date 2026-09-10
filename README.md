# AI Content Enricher

Upload a product photo, an AI model proposes a title, description, tags and
category, you review the draft and save it. **The AI proposes, a person
approves:** the model never writes to the database directly.

> The interface, the code comments and the generated content are in Italian —
> the project was built as a learning exercise and its author reads it in that
> language. This README is in English so the design decisions are readable by
> anyone.

## Getting started

```bash
npm install
npx prisma generate         # generates the Prisma client in src/generated/prisma
                            # (git-ignored: without this step the project
                            # neither compiles nor type-checks)
cp .env.example .env        # set GEMINI_API_KEY (free key from Google AI Studio)
npx prisma db push
npm run dev
```

The project uses **Prisma 7**: its configuration lives in `prisma7.config.ts` at
the repository root rather than in the schema, and the generated client is
imported from `src/generated/prisma` instead of `@prisma/client`.

## Tests

```bash
npm test              # full suite, offline, no API key needed
npm run test:contract # really calls Gemini: checks the contract still holds
```

Every test but one uses a fake provider: the suite stays fast, free and
deterministic — and would never notice the day Google changes the response
format. The contract test (`tests/gemini.contract.test.ts`) is the one that
would: it makes a real network call to Gemini and checks the response still
matches the expected shape. Precisely because it hits the network it is excluded
from the default suite — a suite should not make network calls on every run — and
is run separately with `npm run test:contract`, with `GEMINI_API_KEY` set in
`.env`.

That same test is also what confirms the key travels in the `x-goog-api-key`
header rather than the URL query string: a key in a URL ends up in proxy logs and
can resurface inside error messages the app forwards to the browser.

It has already earned its keep once. The model the project originally pinned,
`gemini-2.5-flash`, still appears in the API's model listing but returns **404**
to new accounts — *"no longer available to new users"*. All 54 offline tests were
green and would have stayed green forever, because none of them touch the
network. The contract test is what caught it.

## How it is put together

| Directory | Contents |
|---|---|
| `src/lib` | Domain logic: knows nothing about HTTP or the database |
| `src/app/api` | HTTP endpoints: translate requests into calls to the logic |
| `src/app` | Pages |
| `tests` | Tests, one file per module |

## Three lines of defence on the model's output

1. **The prompt** — explicit instructions. The weakest line: it is only words.
2. **The JSON schema sent to the model** — constrains generation provider-side.
3. **Validation with Zod** — the last word, on our side.

Layer 3 is not redundant: the provider can change behaviour without notice, a
JSON schema does not express rules like "tags must be lowercase" well, and
switching models makes layer 2 disappear while layer 3 remains. The general rule
is **never trust data that comes from outside**.

## Decisions and tradeoffs

- **The provider sits behind an interface.** Gemini is used because it has a free
  tier. Switching to Claude or OpenAI means writing a new implementation of
  `LlmProvider`, without touching `enrich.ts` or the tests.
- **Tests never call the network.** A fake provider keeps the suite fast, free and
  deterministic. The separate contract test covers the real case.
- **Targeted retries.** Only what can improve by retrying is retried: network
  errors, 5xx, rate limits. A rejected key fails immediately. Every retry has a
  ceiling — the free tier has a daily quota, and unbounded retries would burn it
  in seconds.
- **Two retry layers, deliberately separated.** Transport retries live in the
  provider; schema retries live in the enrichment step. They must not compound.
- **Tags stored as a JSON string.** SQLite has no array type. On PostgreSQL this
  would be a native array.
- **Uploads validated from the real bytes**, not from the file extension, before
  calling the AI: an already-invalid file must not cost a request against the
  quota.
- **The original AI draft is kept.** `aiDraftJson` stores what the model proposed
  before any human edit, which makes "proposed vs. saved" comparable later.

## Deliberately missing

Authentication, batch processing, job queues, cloud deployment, a headless CMS.
These are natural extensions, not requirements of this version.
