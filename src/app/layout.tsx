import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIM Gudang Percetakan v2.0 — Operasional Gudang & Purchase Order",
  description:
    "Sistem Informasi Operasional Gudang Percetakan: Konversi Rim/Lembar, Pemotongan Kertas Plano & Sisa, Purchase Order, Non-Blocking Stock Opname, dan Kartu Stok Mutasi.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-radius="sharp" data-buttons="solid" data-motion="on">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#f6f6f4] text-[#232323] font-sans antialiased selection:bg-[#a1ffcb] selection:text-[#113823]">
        {children}
      </body>
    </html>
  );
}
