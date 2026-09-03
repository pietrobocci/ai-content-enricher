export type ErrorType =
  | "invalid_input" // colpa di chi ha caricato: file sbagliato, troppo grande
  | "auth" // chiave mancante o rifiutata: ritentare non serve
  | "rate_limit" // quota superata: ha senso riprovare piu' tardi
  | "network" // rete o server del provider: ha senso riprovare
  | "bad_response" // il modello ha risposto fuori contratto
  | "unknown";

export type AppError = {
  type: ErrorType;
  message: string;
  /** Se false, ritentare la stessa identica richiesta e' inutile. */
  retryable: boolean;
};

/**
 * Un risultato e' sempre uno dei due casi. TypeScript obbliga a controllare
 * `ok` prima di poter leggere `data`, quindi il caso di errore non si puo'
 * dimenticare.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T>(error: AppError): Result<T> {
  return { ok: false, error };
}
