import { CATEGORIES } from "@/lib/schema";

/**
 * Il prompt e' la linea di difesa piu' debole: sono solo parole, il modello
 * puo' ignorarle. Serve comunque, perche' guida la qualita' del contenuto,
 * non solo la forma.
 */
export function buildPrompt(opts: { hint?: string } = {}): string {
  const righe = [
    "Sei un copywriter per un catalogo e-commerce italiano.",
    "Guarda la foto del prodotto e produci una scheda prodotto.",
    "",
    "Regole:",
    "- Scrivi tutti i testi in italiano.",
    "- Il titolo e' breve e concreto, da 3 a 60 caratteri.",
    "- La descrizione va da 20 a 400 caratteri, senza promesse inventate.",
    "- Genera da 3 a 6 tag, tutti in minuscolo, senza cancelletto.",
    `- La categoria deve essere ESATTAMENTE uno di questi valori: ${CATEGORIES.join(", ")}.`,
    "- Il campo confidence indica quanto sei sicuro: alta, media oppure bassa.",
    "- Se la foto e' poco chiara o il prodotto non e' riconoscibile, usa confidence bassa.",
    "- Non inventare materiali, misure o marchi che non si vedono nella foto.",
  ];

  if (opts.hint && opts.hint.trim().length > 0) {
    righe.push("", `Suggerimento fornito dall'utente: ${opts.hint.trim()}`);
  }

  return righe.join("\n");
}

/**
 * Non ripetiamo la stessa domanda sperando che vada meglio: rimandiamo al
 * modello l'errore preciso. Nella maggior parte dei casi si corregge al
 * secondo tentativo.
 */
export function buildRetryPrompt(promptOriginale: string, erroreDiValidazione: string): string {
  return [
    promptOriginale,
    "",
    "La tua risposta precedente non era valida.",
    `Errore: ${erroreDiValidazione}`,
    "Rispondi di nuovo rispettando esattamente il formato richiesto.",
  ].join("\n");
}
