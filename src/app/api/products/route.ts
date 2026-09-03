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

  const prodotto = await createProduct(controllo.data);
  return NextResponse.json({ id: prodotto.id }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ products: await listProducts() });
}
