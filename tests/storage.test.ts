import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { saveUpload } from "@/lib/storage";

const creati: string[] = [];

afterEach(() => {
  for (const percorso of creati.splice(0)) {
    const assoluto = path.join(process.cwd(), "public", percorso);
    if (fs.existsSync(assoluto)) fs.rmSync(assoluto);
  }
});

describe("saveUpload", () => {
  it("salva il file e restituisce un percorso pubblico", async () => {
    const percorso = await saveUpload(new Uint8Array([1, 2, 3]), "image/jpeg");
    creati.push(percorso);

    expect(percorso.startsWith("/uploads/")).toBe(true);
    expect(percorso.endsWith(".jpg")).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public", percorso))).toBe(true);
  });

  it("non usa mai due volte lo stesso nome", async () => {
    const primo = await saveUpload(new Uint8Array([1]), "image/png");
    const secondo = await saveUpload(new Uint8Array([2]), "image/png");
    creati.push(primo, secondo);

    expect(primo).not.toBe(secondo);
  });
});
