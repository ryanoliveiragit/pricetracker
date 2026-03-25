"use client";

import { Home, Search, Package, BarChart3, Store, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", icon: Home },
  { href: "/search", icon: Search },
  { href: "/products", icon: Package },
  { href: "/suppliers", icon: Store },
  { href: "/results", icon: BarChart3 },
  { href: "/settings", icon: Settings }
];

export default function MinimalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(path: string): boolean {
    if (!pathname) return false;
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/80 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/80 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-around px-4 md:justify-center md:gap-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                  active
                    ? "bg-purple-600 text-white shadow-lg dark:bg-purple-500"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 pb-16 md:pb-0 md:pt-16">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
