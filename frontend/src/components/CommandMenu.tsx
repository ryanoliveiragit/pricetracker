"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, ArrowRight, Command } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function CommandMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const router = useRouter();

  // Listen for Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);

    // Custom event to open from fake button
    const openMenu = () => setIsOpen(true);
    window.addEventListener("open-command-menu", openMenu);

    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-command-menu", openMenu);
    };
  }, []);

  // Set focus when opened
  useEffect(() => {
    if (isOpen) {
      setInput("");
      setVariants([]);
      document.getElementById("command-menu-input")?.focus();
    }
  }, [isOpen]);

  function addVariant(val: string) {
    const trim = val.trim();
    if (!trim) return;
    if (!variants.includes(trim)) {
      setVariants((prev) => [...prev, trim]);
    }
    setInput("");
    document.getElementById("command-menu-input")?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) {
        addVariant(input);
      } else if (variants.length > 0) {
        handleSearch();
      }
    } else if (e.key === "Backspace" && input === "" && variants.length > 0) {
      setVariants((prev) => prev.slice(0, -1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  function handleSearch() {
    let finalSearch = [...variants];
    if (input.trim() && !finalSearch.includes(input.trim())) {
      finalSearch.push(input.trim());
    }
    if (finalSearch.length === 0) return;

    localStorage.setItem(
      "construprice-last-search-items",
      JSON.stringify(finalSearch),
    );
    localStorage.removeItem("construprice-last-search-suppliers");
    window.dispatchEvent(
      new CustomEvent("construprice-header-search", { detail: finalSearch }),
    );
    setIsOpen(false);
    setVariants([]);
    setInput("");
    router.push("/results");
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-neutral-800"
          >
            {/* Top decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[rgb(var(--primary-500))] to-transparent opacity-50" />

            {/* Input area */}
            <div className="flex items-center px-4 py-4 border-b border-slate-100 dark:border-neutral-800 relative z-10 bg-white dark:bg-neutral-900">
              <Search className="h-5 w-5 text-[rgb(var(--primary-500))] mr-3 hidden sm:block" />
              <div className="flex-1 flex flex-wrap gap-2 items-center min-w-0">
                {variants.map((v) => (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={v}
                    className="flex items-center gap-1.5 rounded-md bg-[rgb(var(--primary-500))/0.12] dark:bg-[rgb(var(--primary-500))/0.10] px-2 py-1 text-xs font-semibold text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))] border border-[rgb(var(--primary-500))/0.20] dark:border-[rgb(var(--primary-500))/0.20] shadow-sm"
                  >
                    {v}
                    <button
                      onClick={() =>
                        setVariants(variants.filter((item) => item !== v))
                      }
                      className="hover:bg-[rgb(var(--primary-500))/0.20] dark:hover:bg-[rgb(var(--primary-500))/0.30] rounded-full p-0.5 transition-colors"
                    >
                      xx
                    </button>
                  </motion.span>
                ))}
                <input
                  id="command-menu-input"
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    variants.length === 0
                      ? "Buscar produto ex: 'cola', 'tijolo'..."
                      : "Adicionar outra variante..."
                  }
                  className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 text-base py-1 min-w-[200px]"
                />
              </div>
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Suggestions / Actions area */}
            <div className="p-2 max-h-[60vh] overflow-y-auto bg-slate-50/50 dark:bg-neutral-900/50">
              {input.trim() && (
                <button
                  onClick={() => addVariant(input)}
                  className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-white dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-neutral-700"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--primary-500))/0.12] dark:bg-[rgb(var(--primary-500))/0.10] text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">
                      Adicionar{" "}
                      <span className="text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))] font-bold">
                        "{input.trim()}"
                      </span>{" "}
                      como variante
                    </p>
                    <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                      Pressione Enter para adicionar rapidamente
                    </p>
                  </div>
                  <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-[10px] font-medium text-slate-500">
                    Enter
                  </kbd>
                </button>
              )}

              {!input.trim() && variants.length === 0 && (
                <div className="py-12 text-center">
                  <Command className="mx-auto h-10 w-10 text-slate-300 dark:text-neutral-600 mb-4 opacity-50" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                    Digite para buscar materiais
                  </p>
                  <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1 max-w-[280px] mx-auto">
                    Digite o nome de um produto e adicione quantas{" "}
                    <b>variantes</b> ou <b>sinônimos</b> precisar para buscar
                    tudo de uma vez.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950 px-4 py-3">
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-slate-200 dark:border-neutral-700 px-1.5 py-0.5 bg-white dark:bg-neutral-800 shadow-sm">
                    →
                  </kbd>{" "}
                  adicionar variante
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-slate-200 dark:border-neutral-700 px-1.5 py-0.5 bg-white dark:bg-neutral-800 shadow-sm">
                    Esc
                  </kbd>{" "}
                  fechar
                </span>
              </div>

              <button
                onClick={handleSearch}
                disabled={variants.length === 0 && !input.trim()}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-[rgb(var(--primary-500))] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[rgb(var(--primary-600))] focus:ring-2 focus:ring-[rgb(var(--primary-500))/0.05]0 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-[rgb(var(--primary-600))/0.20]"
              >
                Buscar{" "}
                {variants.length > 0
                  ? `${variants.length + (input.trim() ? 1 : 0)} itens`
                  : ""}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
