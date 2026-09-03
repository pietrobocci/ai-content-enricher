// Prisma 7 con provider "prisma-client" non pubblica un `index.ts`: il file
// da importare direttamente e' `client.ts`, come indicato nei suoi commenti
// generati ("You can import this file directly").
import { PrismaClient } from "@/generated/prisma/client";
// Da Prisma 7 il client non si connette piu' da solo leggendo l'URL dallo
// schema: serve un driver adapter esplicito. prisma7.config.ts configura
// solo la CLI (db push, generate), non il client a runtime.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });

/**
 * In sviluppo Next.js ricarica i moduli a ogni modifica: senza questa cache
 * si aprirebbero decine di connessioni al database.
 */
const globalePerPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalePerPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalePerPrisma.prisma = prisma;
