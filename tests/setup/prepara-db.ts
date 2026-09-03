import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Gira una volta prima di tutti i test: ricrea da zero un database
 * separato, cosi' i test non toccano mai i dati di sviluppo.
 *
 * Nota su Prisma 7: il percorso del file SQLite in DATABASE_URL e'
 * risolto rispetto alla radice del progetto (dove sta prisma7.config.ts),
 * non rispetto a prisma/schema.prisma come in Prisma 6. Per questo qui
 * il file finisce dentro prisma/ solo perche' lo indichiamo esplicitamente
 * ("./prisma/test.db"), coerente con DATABASE_URL in vitest.config.ts.
 * Anche il flag --skip-generate non esiste piu' in `prisma db push`: il
 * client va comunque generato a parte con `npx prisma generate`.
 */
export default function setup() {
  const fileDb = path.join(process.cwd(), "prisma", "test.db");
  if (fs.existsSync(fileDb)) fs.rmSync(fileDb);

  execSync("npx prisma db push", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  });
}
