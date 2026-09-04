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
  // L'insieme dei formati ammessi e' scritto in piu' punti: le firme in
  // image.ts, questa mappa, la regex di product-input.ts e l'attributo
  // accept della pagina. Se uno dei quattro si disallinea, questo controllo
  // fa fallire subito la richiesta invece di scrivere un file .bin che
  // passerebbe l'arricchimento (gia' pagato) e fallirebbe solo al
  // salvataggio, con un messaggio incomprensibile.
  const estensione = ESTENSIONI[mimeType];
  if (estensione === undefined) {
    throw new Error(`tipo di immagine non gestito dal salvataggio: ${mimeType}`);
  }

  await fs.mkdir(CARTELLA, { recursive: true });

  const nome = `${crypto.randomUUID()}${estensione}`;
  await fs.writeFile(path.join(CARTELLA, nome), bytes);

  return `/uploads/${nome}`;
}
