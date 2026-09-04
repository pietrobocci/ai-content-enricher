import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Content Enricher",
  description: "Schede prodotto generate dall'AI e approvate da una persona",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b p-4">
          <Link href="/" className="mr-4 font-semibold">Catalogo</Link>
          <Link href="/new" className="text-blue-700">Nuovo prodotto</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
