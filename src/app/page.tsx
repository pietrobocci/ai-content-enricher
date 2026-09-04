import Link from "next/link";
import { listProducts } from "@/lib/products";

// Legge il database a ogni richiesta: senza questa riga Next.js
// servirebbe una versione statica generata al momento della build.
export const dynamic = "force-dynamic";

export default async function Catalogo() {
  const esito = await listProducts();

  // Il database puo' mancare o essere illeggibile: si mostra un messaggio,
  // non una schermata di errore di Next.
  if (!esito.ok) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Catalogo</h1>
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {esito.error.message}
        </p>
      </main>
    );
  }

  const prodotti = esito.data;

  if (prodotti.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Catalogo</h1>
        <p className="text-gray-600">
          Nessun prodotto salvato. Vai su <Link className="text-blue-700" href="/new">Nuovo prodotto</Link> per
          crearne uno.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Catalogo ({prodotti.length})</h1>

      <ul className="space-y-4">
        {prodotti.map((prodotto) => (
          <li key={prodotto.id} className="flex gap-4 rounded border p-4">
            <img src={prodotto.imagePath} alt="" className="h-24 w-24 rounded object-cover" />

            <div className="min-w-0">
              <h2 className="font-semibold">{prodotto.title}</h2>
              <p className="mb-2 text-sm text-gray-700">{prodotto.description}</p>
              <p className="text-xs text-gray-500">
                {prodotto.category} · {prodotto.tags.join(", ")} · {prodotto.model}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
