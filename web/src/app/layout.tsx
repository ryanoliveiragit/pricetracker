import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConstruPrice — Cotação de materiais em segundos",
  description:
    "Compare preços de materiais de construção em múltiplos fornecedores atacadistas com um clique. Economize tempo e dinheiro em cada compra.",
  openGraph: {
    title: "ConstruPrice — Cotação de materiais em segundos",
    description:
      "Compare preços em múltiplos atacadistas automaticamente. A plataforma de cotação mais rápida do setor.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
