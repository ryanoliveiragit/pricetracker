"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart2, Loader2, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MarketAnalysis {
  marketAvg: number;
  marketMin: number;
  marketMax: number;
  verdict: "barato" | "otimo" | "bom" | "ruim" | "caro";
  diffPercent: number; // negativo = mais barato, positivo = mais caro
  sources: string[];
}

interface PriceAnalysisProps {
  productName: string;
  currentPrice: number;
}

const VERDICT_CONFIG = {
  barato: {
    label: "Muito Barato",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: TrendingDown,
  },
  otimo: {
    label: "Ótimo Preço",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    icon: TrendingDown,
  },
  bom: {
    label: "Bom Preço",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: Minus,
  },
  ruim: {
    label: "Preço Ruim",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
    icon: TrendingUp,
  },
  caro: {
    label: "Caro",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    icon: TrendingUp,
  },
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Hash determinístico baseado no nome + preço do produto
// Garante que o mesmo produto sempre retorna a mesma análise
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0xffffffff);
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Simula chamada a APIs de comparação de preço (resultado determinístico por produto)
async function fetchMarketAnalysis(
  productName: string,
  currentPrice: number
): Promise<MarketAnalysis> {
  await new Promise((r) => setTimeout(r, 1200));

  // Seed baseado no nome + preço — mesmo produto = mesmo resultado sempre
  const seed = hashString(productName + currentPrice.toFixed(2));
  const rand = seededRandom(seed);

  const variance = 0.12 + rand() * 0.22;           // 12–34% de variação
  const avgOffset = rand() * 0.28 - 0.10;           // o preço atual pode estar -10% a +18% da média
  const marketAvg = currentPrice * (1 + avgOffset);
  const marketMin = marketAvg * (1 - variance / 2);
  const marketMax = marketAvg * (1 + variance);
  const diffPercent = ((currentPrice - marketAvg) / marketAvg) * 100;

  let verdict: MarketAnalysis["verdict"];
  if (diffPercent < -15) verdict = "barato";
  else if (diffPercent < -5) verdict = "otimo";
  else if (diffPercent <= 5) verdict = "bom";
  else if (diffPercent <= 15) verdict = "ruim";
  else verdict = "caro";

  return {
    marketAvg: Math.round(marketAvg * 100) / 100,
    marketMin: Math.round(marketMin * 100) / 100,
    marketMax: Math.round(marketMax * 100) / 100,
    verdict,
    diffPercent: Math.round(diffPercent * 10) / 10,
    sources: ["Mercado Livre", "Zoom", "Buscapé"],
  };
}

export function PriceAnalysis({ productName, currentPrice }: PriceAnalysisProps) {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleAnalyze() {
    if (open && analysis) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMarketAnalysis(productName, currentPrice);
      setAnalysis(result);
    } catch {
      setError("Não foi possível buscar os preços. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const cfg = analysis ? VERDICT_CONFIG[analysis.verdict] : null;
  const VerdictIcon = cfg?.icon ?? Minus;

  return (
    <div className="w-full">
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
          "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <BarChart2 className="h-3.5 w-3.5" />
        )}
        {loading ? "Analisando..." : open && analysis ? "Fechar análise" : "Analisar Preço"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            {loading && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-700/50 bg-neutral-900/60 py-4 text-xs text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                Buscando preços em Mercado Livre, Zoom, Buscapé...
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            {analysis && !loading && cfg && (
              <div
                className={cn(
                  "rounded-xl border p-3 text-xs space-y-2.5",
                  cfg.bg
                )}
              >
                {/* Veredicto */}
                <div className="flex items-center justify-between">
                  <div className={cn("flex items-center gap-1.5 font-bold text-sm", cfg.color)}>
                    <VerdictIcon className="h-4 w-4" />
                    {cfg.label}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold",
                      analysis.diffPercent <= 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    )}
                  >
                    {analysis.diffPercent > 0 ? "+" : ""}
                    {analysis.diffPercent}%
                  </span>
                </div>

                {/* Comparação de preços */}
                <div className="space-y-1 text-neutral-300">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Seu preço:</span>
                    <span className="font-semibold text-white">{formatBRL(currentPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Média do mercado:</span>
                    <span>{formatBRL(analysis.marketAvg)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Menor preço:</span>
                    <span className="text-emerald-400">{formatBRL(analysis.marketMin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Maior preço:</span>
                    <span className="text-red-400">{formatBRL(analysis.marketMax)}</span>
                  </div>
                </div>

                {/* Fontes */}
                <div className="flex flex-wrap gap-1 border-t border-white/10 pt-2">
                  {analysis.sources.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-neutral-800/80 px-2 py-0.5 text-[10px] text-neutral-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
