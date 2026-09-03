import { describe, it, expect } from "vitest";
import { buildPrompt, buildRetryPrompt } from "@/lib/prompt";
import { CATEGORIES, CONFIDENCE_LEVELS } from "@/lib/schema";

describe("buildPrompt", () => {
  it("elenca tutte le categorie ammesse", () => {
    const prompt = buildPrompt();
    for (const categoria of CATEGORIES) {
      expect(prompt).toContain(categoria);
    }
  });

  it("chiede esplicitamente contenuti in italiano", () => {
    expect(buildPrompt().toLowerCase()).toContain("italiano");
  });

  it("include il suggerimento dell'utente quando fornito", () => {
    const prompt = buildPrompt({ hint: "borsa in pelle vintage" });
    expect(prompt).toContain("borsa in pelle vintage");
  });

  it("non aggiunge sezioni vuote quando il suggerimento manca", () => {
    expect(buildPrompt()).not.toContain("Suggerimento");
  });

  it("dichiara i limiti di lunghezza dei tag", () => {
    const prompt = buildPrompt();
    expect(prompt).toContain("2 a 20 caratteri");
  });

  it("elenca i valori di confidence ammessi", () => {
    const prompt = buildPrompt();
    for (const valore of CONFIDENCE_LEVELS) {
      expect(prompt).toContain(valore);
    }
  });
});

describe("buildRetryPrompt", () => {
  it("contiene il prompt originale e l'errore da correggere", () => {
    const retry = buildRetryPrompt("PROMPT-ORIGINALE", "category: valore non ammesso");
    expect(retry).toContain("PROMPT-ORIGINALE");
    expect(retry).toContain("category: valore non ammesso");
  });
});
