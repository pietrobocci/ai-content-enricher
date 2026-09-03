import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // I test di contratto chiamano la rete: esclusi dalla suite normale.
    exclude: ["tests/**/*.contract.test.ts", "node_modules/**"],
    // Database separato da quello di sviluppo (vedi tests/setup/prepara-db.ts):
    // con Prisma 7 il percorso e' relativo alla radice del progetto, non a prisma/.
    env: { DATABASE_URL: "file:./prisma/test.db" },
    globalSetup: ["tests/setup/prepara-db.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
