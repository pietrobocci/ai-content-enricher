import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const CARTELLA = path.join(process.cwd(), "public", "uploads");

const ESTENSIONI: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Il nome del file lo decidiamo noi: usare quello inviato dal client
 * permetterebbe di scrivere fuori dalla cartella prevista.
 */
export async function saveUpload(bytes: Uint8Array, mimeType: string): Promise<string> {
  await fs.mkdir(CARTELLA, { recursive: true });

  const nome = `${crypto.randomUUID()}${ESTENSIONI[mimeType] ?? ".bin"}`;
  await fs.writeFile(path.join(CARTELLA, nome), bytes);

  return `/uploads/${nome}`;
}
