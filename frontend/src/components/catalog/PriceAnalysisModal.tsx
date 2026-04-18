"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* Types */

interface MLResult {
  id: string;
  title: string;
  price: number;
  thumbnail: string;
  permalink: string;
  condition: "new" | "used";
  available_quantity: number;
  seller: { nickname: string };
}

interface MarketSummary {
  items: MLResult[];
  avg: number;
  min: number;
  max: number;
  median: number;
  total: number;
  diffPercent: number;
}

interface PriceAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  currentPrice: number;
  store: string;
  imageUrl?: string;
}

/* Helpers */

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildQuery(name: string): string {
  return name.replace(/^✓\s*/, "").replace(/\s{2,}/g, " ").trim().slice(0, 120);
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function fetchML(productName: string): Promise<MarketSummary> {
  const q = encodeURIComponent(buildQuery(productName));
  const res = await fetch(`${API_BASE}/api/market-price?q=${q}&limit=12`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Produto nao encontrado.");
    throw new Error(`Erro ao consultar (${res.status}). Servidor rodando?`);
  }
  const data: { results?: MLResult[]; paging?: { total: number } } = await res.json();
  const items: MLResult[] = (data.results ?? []).filter((r) => r.price > 0);
  if (items.length === 0) throw new Error("Nenhum resultado encontrado.");

  const prices = items.map((r) => r.price).sort((a, b) => a - b);
  const avg = prices.reduce((s, v) => s + v, 0) / prices.length;

  return {
    items,
    avg,
    min: prices[0],
    max: prices[prices.length - 1],
    median: calcMedian(prices),
    total: data.paging?.total ?? 0,
    diffPercent: 0,
  };
}

/* Price Bar */

function PriceBar({ min, max, current }: { min: number; max: number; current: number; avg: number }) {
  const range = max - min || 1;
  const pct = Math.min(92, Math.max(8, ((current - min) / range) * 100));

  return (
    <div className="mx-auto w-4/5 space-y-2">
      <div className="relative h-1.5 w-full rounded-full bg-slate-200 dark:bg-neutral-700">
        <motion.div
          className="absolute top-1/2 h-3 w-3 rounded-full bg-[rgb(var(--primary-500))] shadow-md border-2 border-white dark:border-neutral-900"
          style={{ marginTop: "-6px", marginLeft: "-6px" }}
          initial={{ left: "50%" }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-neutral-500">
        <span>{formatBRL(min)}</span>
        <span>{formatBRL(max)}</span>
      </div>
    </div>
  );
}

/* Modal */

export function PriceAnalysisModal({
  open, onClose, productName, currentPrice, store, imageUrl,
}: PriceAnalysisModalProps) {
  const [data, setData] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const summary = await fetchML(productName);
      const diff = ((currentPrice - summary.avg) / summary.avg) * 100;
      setData({ ...summary, diffPercent: Math.round(diff * 10) / 10 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar precos.");
    } finally {
      setLoading(false);
    }
  }, [productName, currentPrice]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const diff = data?.diffPercent ?? 0;
  const isGood = diff <= 0;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative flex w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sm:w-[540px] sm:max-h-[85vh] sm:rounded-2xl shadow-xl"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3.5 px-5 pt-4 pb-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-lg bg-slate-100 dark:bg-neutral-800 object-contain p-1 border border-slate-200 dark:border-neutral-700"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                  Mercado Livre
                </p>
                <h2 className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-neutral-100">
                  {buildQuery(productName)}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">{store} · <span className="font-semibold text-slate-700 dark:text-neutral-200">{formatBRL(currentPrice)}</span></p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {!loading && data && (
                  <button onClick={load} className="p-1.5 text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-200 transition">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-200 transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-neutral-800" />

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-neutral-500" />
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Buscando precos...</p>
                </div>
              )}

              {error && !loading && (
                <div className="mx-5 my-6 flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                    <button
                      onClick={load}
                      className="mt-2 text-[11px] font-semibold text-red-500 hover:text-red-700 transition"
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              )}

              {data && !loading && (
                <div className="p-5 space-y-5">
                  {/* Summary */}
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "shrink-0 rounded-xl px-3 py-2 text-center",
                      isGood ? "bg-[rgb(var(--primary-500))/0.07] dark:bg-[rgb(var(--primary-500))/0.10]" : "bg-red-50 dark:bg-red-500/10"
                    )}>
                      <p className={cn("text-xl font-black", isGood ? "text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]" : "text-red-600 dark:text-red-400")}>
                        {diff > 0 ? "+" : ""}{diff}%
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        {isGood ? "abaixo" : "acima"}
                      </p>
                    </div>

                    <div className="flex-1 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-neutral-400">Seu preco ({store})</span>
                        <span className="font-bold text-slate-800 dark:text-neutral-100">{formatBRL(currentPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-neutral-400">Media ML</span>
                        <span className="font-semibold text-slate-700 dark:text-neutral-200">{formatBRL(data.avg)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-neutral-400">Menor</span>
                        <span className="font-semibold text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]">{formatBRL(data.min)}</span>
                      </div>
                    </div>
                  </div>

                  <PriceBar min={data.min} max={data.max} current={currentPrice} avg={data.avg} />

                  {/* Product list */}
                  <div>
                    <p className="mb-2.5 text-[11px] font-medium text-slate-500">
                      {data.total} anuncios encontrados
                    </p>

                    <div className="space-y-1">
                      {data.items.slice(0, 8).map((item) => {
                        const pDiff = Math.round(((item.price - currentPrice) / currentPrice) * 100);
                        const cheaper = item.price < currentPrice;
                        return (
                          <a
                            key={item.id}
                            href={item.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center gap-3 rounded-xl p-2 -mx-2 transition hover:bg-slate-50 dark:hover:bg-neutral-800"
                          >
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 dark:bg-neutral-800 object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 text-xs text-slate-600 dark:text-neutral-300 group-hover:text-slate-800 dark:group-hover:text-neutral-100 transition">
                                {item.title}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={cn("text-xs font-bold", cheaper ? "text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]" : "text-slate-700 dark:text-neutral-200")}>
                                {formatBRL(item.price)}
                              </p>
                              <p className={cn(
                                "text-[10px]",
                                cheaper ? "text-[rgb(var(--primary-500))]" : "text-red-500"
                              )}>
                                {pDiff > 0 ? "+" : ""}{pDiff}%
                              </p>
                            </div>
                            <ExternalLink className="h-3 w-3 shrink-0 text-slate-300 group-hover:text-slate-500 transition" />
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-center text-[10px] text-slate-400 dark:text-neutral-500 pt-1">
                    Dados em tempo real · Mercado Livre
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
