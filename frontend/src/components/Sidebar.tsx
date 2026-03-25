"use client";

import { Button } from "@nextui-org/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const linkBase = "rounded-xl px-3 py-2 text-sm font-medium transition border border-transparent";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  function isActive(path: string): boolean {
    if (!pathname) {
      return false;
    }

    if (path === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(path);
  }

  function handleLogout(): void {
    logout();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-full flex-col rounded-2xl border border-[#2e2250] bg-[#120c20] p-4 shadow-2xl shadow-black/20">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">ConstruPrice</p>
        <h2 className="mt-1 text-lg font-bold text-white">Painel Operacional</h2>
        <p className="mt-2 text-xs text-violet-200/80">Logado como {user?.displayName}</p>
      </div>

      <nav className="mt-6 flex flex-col gap-2">
        <Link
          href="/"
          className={`${linkBase} ${isActive("/") ? "border-brand-500/50 bg-brand-500/20 text-white" : "text-violet-100 hover:border-brand-500/30 hover:bg-brand-500/10"}`}
        >
          Dashboard
        </Link>
        <Link
          href="/search"
          className={`${linkBase} ${isActive("/search") ? "border-brand-500/50 bg-brand-500/20 text-white" : "text-violet-100 hover:border-brand-500/30 hover:bg-brand-500/10"}`}
        >
          Buscar Produtos
        </Link>
        <Link
          href="/products"
          className={`${linkBase} ${isActive("/products") ? "border-brand-500/50 bg-brand-500/20 text-white" : "text-violet-100 hover:border-brand-500/30 hover:bg-brand-500/10"}`}
        >
          Catálogo de Produtos
        </Link>
        <Link
          href="/results"
          className={`${linkBase} ${isActive("/results") ? "border-brand-500/50 bg-brand-500/20 text-white" : "text-violet-100 hover:border-brand-500/30 hover:bg-brand-500/10"}`}
        >
          Últimos Resultados
        </Link>
      </nav>

      <div className="mt-auto pt-6">
        <Button onPress={handleLogout} variant="bordered" className="w-full border-violet-400/40 text-violet-100">
          Sair
        </Button>
      </div>
    </aside>
  );
}
