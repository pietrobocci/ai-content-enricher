import { NextResponse } from "next/server";
import { newProductSchema } from "@/lib/product-input";
import { createProduct, listProducts } from "@/lib/products";

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);

  const controllo = newProductSchema.safeParse(corpo);
  if (!controllo.success) {
    const dettagli = controllo.error.issues
      .map((problema) => `${problema.path.join(".")}: ${problema.message}`)
      .join("; ");
    return NextResponse.json({ error: `dati non validi — ${dettagli}` }, { status: 400 });
  }

  const salvato = await createProduct(controllo.data);
  if (!salvato.ok) {
    return NextResponse.json({ error: salvato.error.message }, { status: 500 });
  }

  return NextResponse.json({ id: salvato.data.id }, { status: 201 });
}

export async function GET() {
  const elenco = await listProducts();
  if (!elenco.ok) {
    return NextResponse.json({ error: elenco.error.message }, { status: 500 });
  }

  return NextResponse.json({ products: elenco.data });
}
