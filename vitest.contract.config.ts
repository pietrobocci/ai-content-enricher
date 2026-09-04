// Carica .env dentro process.env prima che Vitest parta. Sembra ridondante,
// ma non lo e': il `loadEnv` di Vite legge .env in un oggetto a parte e
// restituisce solo le chiavi con prefisso VITE_, quindi senza questa riga
// GEMINI_API_KEY resterebbe undefined e il test di contratto fallirebbe
// anche con la chiave giusta nel file. prisma7.config.ts fa lo stesso.
import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Configurazione separata da vitest.config.ts, usata solo da
// `npm run test:contract`. La suite di default esclude i test di
// contratto (vedi vitest.config.ts): passare `--exclude` da riga di
// comando non basta a farli rientrare, perché Vitest unisce l'opzione
// con l'`exclude` della configurazione invece di sostituirlo. Con una
// configurazione dedicata, invece, il file viene incluso davvero.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.contract.test.ts"],
    exclude: ["node_modules/**"],
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
