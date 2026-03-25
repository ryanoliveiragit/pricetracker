import type { Metadata } from "next";
import Providers from "./providers";
import "../index.css";

export const metadata: Metadata = {
  title: "ConstruPrice",
  description: "Comparador de preços de materiais de construção"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="light" data-theme-color="green">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
