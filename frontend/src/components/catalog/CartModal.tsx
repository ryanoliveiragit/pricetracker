"use client";

import { useEffect } from "react";
import {
  X, Trash2, Plus, Minus, ShoppingCart, Copy, CheckCircle2,
  PackageX, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

interface CartModalProps {
  open: boolean;
  onClose: () => void;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CartModal({ open, onClose }: CartModalProps) {
  const { items, updateQuantity, removeItem, clearCart, getTotal } = useCartStore();
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);

  // Fechar com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Bloquear scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleCopyList() {
    const lines = items.map(
      (i) => `• ${i.name} (${i.store}) — Qtd: ${i.quantity} × ${formatBRL(i.price)} = ${formatBRL(i.price * i.quantity)}`
    );
    const text = [
      "🛒 Lista de Compras — PriceTracker",
      "",
      ...lines,
      "",
      `TOTAL: ${formatBRL(getTotal())}`,
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleClear() {
    setCleared(true);
    setTimeout(() => {
      clearCart();
      setCleared(false);
    }, 400);
  }

  const total = getTotal();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Painel lateral */}
          <motion.div
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white dark:bg-neutral-950 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-5 w-5 text-emerald-500" />
                <h2 className="text-base font-semibold text-slate-800 dark:text-neutral-100">Carrinho</h2>
                {items.length > 0 && (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-600/30 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                    {items.length} {items.length === 1 ? "item" : "itens"}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Lista de itens */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <PackageX className="h-12 w-12 text-slate-300 dark:text-neutral-700" />
                  <p className="text-sm text-slate-500 dark:text-neutral-500">Seu carrinho está vazio.</p>
                  <button
                    onClick={onClose}
                    className="mt-1 text-xs text-emerald-500 underline-offset-4 hover:underline"
                  >
                    Continuar buscando
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  <ul className="space-y-3">
                    {items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: cleared ? 0 : 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex gap-3 rounded-xl border border-slate-200 dark:border-neutral-800/60 bg-slate-50 dark:bg-neutral-900/60 p-3"
                      >
                        {/* Imagem */}
                        <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-14 w-14 rounded-lg object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://placehold.co/56x56/1a1a2e/9b8fcf?text=?";
                            }}
                          />
                        </a>

                        {/* Info */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-neutral-200 leading-tight">
                            {item.name}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-500">
                            <span className="rounded bg-slate-200 dark:bg-neutral-800 px-1.5 py-0.5">{item.store}</span>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </p>

                          <div className="flex items-center justify-between">
                            {/* Quantidade */}
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-800/60">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="flex h-6 w-6 items-center justify-center rounded-l-lg text-slate-400 dark:text-neutral-400 transition hover:bg-slate-100 dark:hover:bg-neutral-700 hover:text-slate-700 dark:hover:text-neutral-200"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[24px] text-center text-xs font-semibold text-slate-800 dark:text-neutral-200">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="flex h-6 w-6 items-center justify-center rounded-r-lg text-slate-400 dark:text-neutral-400 transition hover:bg-slate-100 dark:hover:bg-neutral-700 hover:text-slate-700 dark:hover:text-neutral-200"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Subtotal + remover */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                                {formatBRL(item.price * item.quantity)}
                              </span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 dark:text-neutral-600 transition hover:bg-red-500/20 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </AnimatePresence>
              )}
            </div>

            {/* Footer — total + ações */}
            {items.length > 0 && (
              <div className="space-y-3 border-t border-slate-200 dark:border-neutral-800/60 px-5 py-4">
                {/* Resumo */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-neutral-400">Total ({items.reduce((s, i) => s + i.quantity, 0)} produtos)</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-white">{formatBRL(total)}</span>
                </div>

                {/* Ações */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopyList}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
                      copied
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-200 dark:border-neutral-700/60 bg-slate-50 dark:bg-neutral-800/60 text-slate-600 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-100 dark:hover:bg-neutral-700/60"
                    )}
                  >
                    {copied ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> Copiado!</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copiar Lista</>
                    )}
                  </button>

                  <button
                    onClick={handleClear}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpar Tudo
                  </button>
                </div>

                <button
                  onClick={() => { handleCopyList(); onClose(); }}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 active:scale-[0.98]"
                >
                  Finalizar Pedido
                </button>

                <p className="text-center text-[10px] text-slate-400 dark:text-neutral-600">
                  Lista copiada automaticamente ao finalizar
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
