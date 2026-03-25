"use client";

import { Button } from "@nextui-org/react";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import Link from "next/link";

const topNavItems = [
  { href: "/", name: "dashboard" },
  { href: "/search", name: "buscar" },
  { href: "/results", name: "resultados" }
];

export default function AppLayout({ children }: { children?: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#2e2250] bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 md:px-5">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              className="text-violet-100 lg:hidden"
              onPress={() => setMobileSidebarOpen((current) => !current)}
            >
              {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
            <h1 className="text-sm font-bold tracking-[0.22em] text-violet-100">
              CONSTRUPRICE
            </h1>
          </div>
          <nav className="hidden lg:flex gap-6">
            {topNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-violet-100 hover:text-violet-300 transition-colors capitalize"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-3 pt-20 md:p-5 md:pt-20">
        <section className="rounded-2xl border border-[#2e2250] bg-[#120c20]/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md md:p-6">
          {children}
        </section>
      </div>
    </div>
  );
}
