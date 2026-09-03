import { describe, it, expect } from "vitest";
import { validateImage, MAX_IMAGE_BYTES } from "@/lib/image";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // "%PDF-1"

describe("validateImage", () => {
  it("riconosce un JPEG", () => {
    const esito = validateImage(jpeg);
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.data.mimeType).toBe("image/jpeg");
  });

  it("riconosce un PNG", () => {
    const esito = validateImage(png);
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.data.mimeType).toBe("image/png");
  });

  it("rifiuta un PDF anche se ha estensione .jpg", () => {
    const esito = validateImage(pdf);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.type).toBe("invalid_input");
  });

  it("rifiuta un file vuoto", () => {
    expect(validateImage(new Uint8Array([])).ok).toBe(false);
  });

  it("rifiuta un file oltre il limite di dimensione", () => {
    const enorme = new Uint8Array(MAX_IMAGE_BYTES + 1);
    enorme.set(jpeg, 0);
    const esito = validateImage(enorme);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.message).toContain("5");
  });
});
