import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Providers from "./providers";
import "../index.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ConstruPrice",
  description: "Comparador de preços de materiais de construção"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`light ${jetbrainsMono.variable}`} data-theme-color="orange">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
