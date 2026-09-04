"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/schema";

type Draft = {
  title: string;
  description: string;
  tags: string[];
  category: string;
  confidence: string;
};

export default function NuovoProdotto() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [imagePath, setImagePath] = useState("");
  const [model, setModel] = useState("");
  const [aiDraftJson, setAiDraftJson] = useState("");
  const [tagsTesto, setTagsTesto] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function genera() {
    if (!file) return;
    setInCorso(true);
    setErrore("");

    const form = new FormData();
    form.append("image", file);
    if (hint.trim()) form.append("hint", hint.trim());

    try {
      const risposta = await fetch("/api/enrich", { method: "POST", body: form });
      const dati = await risposta.json();

      if (!risposta.ok) {
        setErrore(dati.error ?? "errore sconosciuto");
        return;
      }

      setDraft(dati.draft);
      setImagePath(dati.imagePath);
      setModel(dati.model);
      // Conserviamo la proposta originale prima di qualunque correzione.
      setAiDraftJson(JSON.stringify(dati.draft));
      setTagsTesto(dati.draft.tags.join(", "));
    } catch {
      // Rete caduta o risposta non JSON: senza questo ramo la pagina
      // resterebbe bloccata sul bottone disabilitato, senza dire niente.
      setErrore("errore di rete: controlla la connessione e riprova");
    } finally {
      setInCorso(false);
    }
  }

  async function salva() {
    if (!draft) return;
    setInCorso(true);
    setErrore("");

    const tags = tagsTesto
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const risposta = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          category: draft.category,
          tags,
          imagePath,
          aiDraftJson,
          model,
        }),
      });

      if (!risposta.ok) {
        const dati = await risposta.json();
        setErrore(dati.error ?? "salvataggio fallito");
        return;
      }

      router.push("/");
    } catch {
      // Rete caduta o risposta non JSON: senza questo ramo la pagina
      // resterebbe bloccata sul bottone disabilitato, senza dire niente.
      setErrore("errore di rete: controlla la connessione e riprova");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Nuovo prodotto</h1>

      <section className="mb-6 space-y-3 rounded border p-4">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full"
        />
        <input
          type="text"
          placeholder="Suggerimento (facoltativo): es. borsa in pelle vintage"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className="w-full rounded border p-2"
        />
        <button
          onClick={genera}
          disabled={!file || inCorso}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {inCorso ? "Genero…" : "Genera con l'AI"}
        </button>
      </section>

      {errore && (
        <p className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-red-700">{errore}</p>
      )}

      {draft && (
        <section className="space-y-3 rounded border p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Bozza generata</h2>
            <span
              className={`rounded px-2 py-1 text-xs ${
                draft.confidence === "bassa" ? "bg-yellow-200" : "bg-gray-200"
              }`}
            >
              confidenza {draft.confidence}
            </span>
          </div>

          {draft.confidence === "bassa" && (
            <p className="text-sm text-yellow-800">
              Il modello non è sicuro di questa scheda: controllala bene prima di salvare.
            </p>
          )}

          {imagePath && <img src={imagePath} alt="" className="max-h-56 rounded" />}

          <label className="block text-sm font-medium">Titolo</label>
          <input
            className="w-full rounded border p-2"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />

          <label className="block text-sm font-medium">Descrizione</label>
          <textarea
            className="h-28 w-full rounded border p-2"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />

          <label className="block text-sm font-medium">Categoria</label>
          <select
            className="w-full rounded border p-2"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            {CATEGORIES.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium">Tag (separati da virgola)</label>
          <input
            className="w-full rounded border p-2"
            value={tagsTesto}
            onChange={(e) => setTagsTesto(e.target.value)}
          />

          <button
            onClick={salva}
            disabled={inCorso}
            className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-40"
          >
            {inCorso ? "Salvo…" : "Salva prodotto"}
          </button>
        </section>
      )}
    </main>
  );
}
