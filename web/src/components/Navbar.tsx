"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { label: "Funcionalidades", href: "#features" },
  { label: "Como funciona",   href: "#how-it-works" },
  { label: "Planos",          href: "#pricing" },
  { label: "FAQ",             href: "#faq" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 inset-x-0 z-50 transition-all duration-500",
      scrolled
        ? "bg-[#080808]/90 border-b border-white/[0.06] backdrop-blur-xl"
        : "bg-transparent"
    )}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between gap-8">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-black"
              style={{ background: "linear-gradient(135deg, #fa5d19, #d44c14)" }}>
              C
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight">ConstruPrice</span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {links.map(l => (
              <a key={l.href} href={l.href}
                className="px-3.5 py-2 text-[13px] font-medium text-white/60 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all">
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a href="/login"
              className="text-[13px] font-medium text-white/60 hover:text-white transition-colors px-3 py-2">
              Entrar
            </a>
            <a href="#pricing"
              className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors shadow-lg shadow-white/10">
              Começar grátis
            </a>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setOpen(o => !o)} aria-label="Menu"
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#080808]/98 backdrop-blur-xl px-5 py-5 space-y-1">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-[14px] font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors">
              {l.label}
            </a>
          ))}
          <div className="pt-4 flex flex-col gap-2">
            <a href="/login"
              className="block text-center rounded-full border border-white/10 px-4 py-3 text-[14px] font-medium text-white/70">
              Entrar
            </a>
            <a href="#pricing"
              className="block text-center rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-black">
              Começar grátis
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
