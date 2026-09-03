import { NextResponse } from "next/server";
import { validateImage } from "@/lib/image";
import { saveUpload } from "@/lib/storage";
import { enrichImage } from "@/lib/enrich";
import { createGeminiProvider } from "@/lib/provider";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurata: copia .env.example in .env e inserisci la chiave" },
      { status: 500 }
    );
  }

  const form = await request.formData();
  const file = form.get("image");
  const hint = form.get("hint");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "nessuna immagine ricevuta" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Prima la validazione, poi la chiamata all'AI: un file sbagliato non
  // deve costare una richiesta al provider.
  const controllo = validateImage(bytes);
  if (!controllo.ok) {
    return NextResponse.json({ error: controllo.error.message }, { status: 400 });
  }

  const provider = createGeminiProvider({ apiKey });
  const esito = await enrichImage(
    {
      imageBase64: Buffer.from(bytes).toString("base64"),
      mimeType: controllo.data.mimeType,
      hint: typeof hint === "string" ? hint : undefined,
    },
    provider
  );

  if (!esito.ok) {
    return NextResponse.json(
      { error: esito.error.message, retryable: esito.error.retryable },
      { status: esito.error.type === "rate_limit" ? 429 : 502 }
    );
  }

  // Salviamo il file solo dopo un arricchimento riuscito.
  let imagePath: string;
  try {
    imagePath = await saveUpload(bytes, controllo.data.mimeType);
  } catch {
    // Il disco può essere pieno o non scrivibile: anche qui l'utente
    // deve vedere un messaggio, non un errore grezzo di Next.
    return NextResponse.json(
      { error: "non è stato possibile salvare l'immagine sul server" },
      { status: 500 }
    );
  }

  return NextResponse.json({ draft: esito.data, imagePath, model: provider.name });
}
