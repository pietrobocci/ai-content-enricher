import { type Result, ok, err } from "@/lib/result";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Non ci fidiamo dell'estensione ne' del content-type dichiarato dal
 * browser: guardiamo i primi byte del file, che dicono cosa e' davvero.
 */
export function validateImage(bytes: Uint8Array): Result<{ mimeType: string }> {
  if (bytes.length === 0) {
    return err({ type: "invalid_input", message: "il file e' vuoto", retryable: false });
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    return err({
      type: "invalid_input",
      // Il limite si legge dalla costante: scritto a mano, il messaggio
      // resterebbe "5 MB" anche cambiando MAX_IMAGE_BYTES.
      message: `immagine troppo grande: il limite e' ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`,
      retryable: false,
    });
  }

  const mimeType = riconosciFormato(bytes);
  if (mimeType === null) {
    return err({
      type: "invalid_input",
      message: "formato non supportato: sono ammessi JPEG, PNG e WebP",
      retryable: false,
    });
  }

  return ok({ mimeType });
}

function riconosciFormato(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";

  const firmaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && firmaPng.every((valore, i) => b[i] === valore)) return "image/png";

  // WebP: "RIFF" nei primi 4 byte e "WEBP" dal byte 8
  const testo = (inizio: number, fine: number) =>
    String.fromCharCode(...Array.from(b.slice(inizio, fine)));
  if (b.length >= 12 && testo(0, 4) === "RIFF" && testo(8, 12) === "WEBP") return "image/webp";

  return null;
}
