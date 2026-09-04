"use client";

/**
 * Rete di sicurezza dell'app: Next.js mostra questo componente quando un
 * componente server lancia un'eccezione che nessuno ha intercettato. Deve
 * essere un client component perche' il bottone "Riprova" gira nel browser.
 */
export default function Errore({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Qualcosa è andato storto</h1>
      <p className="mb-4 text-gray-700">
        Si è verificato un errore imprevisto. Puoi riprovare: se il problema resta, controlla i log
        del server.
      </p>
      <button onClick={reset} className="rounded bg-black px-4 py-2 text-white">
        Riprova
      </button>
    </main>
  );
}
