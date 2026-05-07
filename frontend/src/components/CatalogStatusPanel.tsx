"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, RefreshCw, CheckCircle2, Loader2,
  AlertCircle, Clock, ChevronDown, ChevronUp, Store as StoreIcon,
} from "lucide-react";
import { getCatalogStatus, triggerCatalogScrape, type CatalogStatus } from "../services/searchApi";
import { cn } from "@/lib/utils";

function formatAge(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "Nunca";
  if (minutes === 0) return "Agora";
  if (minutes < 60) return `${minutes}min atrás`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}min atrás` : `${h}h atrás`;
}

export function CatalogStatusPanel() {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getCatalogStatus();
      setStatus(data);
      setError(null);
    } catch {
      setError("Falha ao buscar status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Poll while scraping is running
  useEffect(() => {
    if (!status?.isScraping) return;
    const interval = setInterval(() => void fetchStatus(), 5000);
    return () => clearInterval(interval);
  }, [status?.isScraping, fetchStatus]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerCatalogScrape();
      // Wait a moment then refresh status
      setTimeout(() => void fetchStatus(), 2000);
    } catch {
      setError("Falha ao iniciar scraping");
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E8E8E4] dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-[#A0A09A] dark:text-neutral-500" />
          <span className="text-xs text-[#6B6B63] dark:text-neutral-400">Carregando status do catálogo...</span>
        </div>
      </div>
    );
  }

  const isEmpty = !status || status.totalProducts === 0;
  const isScraping = status?.isScraping ?? false;
  const storeEntries = status ? Object.entries(status.stores) : [];

  return (
    <div className="rounded-xl border border-[#E8E8E4] dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0",
            isEmpty
              ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700"
              : isScraping
                ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                : "bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/20"
          )}>
            {isScraping ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin text-blue-500" />
            ) : isEmpty ? (
              <AlertCircle className="h-[18px] w-[18px] text-amber-500" />
            ) : (
              <Database className="h-[18px] w-[18px] text-[rgb(var(--primary-500))]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#1A1A18] dark:text-neutral-100">
                Catálogo Local
              </p>
              {isScraping && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Atualizando
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6B6B63] dark:text-neutral-400">
              {isEmpty
                ? "Nenhum produto no catálogo — inicie o scraping para habilitar busca instantânea"
                : `${status!.totalProducts.toLocaleString("pt-BR")} produtos · ${storeEntries.length} loja${storeEntries.length !== 1 ? "s" : ""} · Atualizado ${formatAge(status!.catalogAgeMinutes)}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Expand/collapse */}
          {!isEmpty && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A0A09A] dark:text-neutral-500 hover:bg-[#F7F7F5] dark:hover:bg-neutral-800 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}

          {/* Trigger button */}
          <button
            onClick={() => void handleTrigger()}
            disabled={isScraping || triggering}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              isEmpty
                ? "bg-[rgb(var(--primary-500))] text-white hover:bg-[rgb(var(--primary-600))]"
                : "border border-[#E8E8E4] dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[#6B6B63] dark:text-neutral-400 hover:bg-[#F7F7F5] dark:hover:bg-neutral-700 hover:text-[#1A1A18] dark:hover:text-neutral-100",
              (isScraping || triggering) && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (isScraping || triggering) && "animate-spin")} />
            {isEmpty ? "Iniciar Scraping" : isScraping ? "Atualizando..." : "Atualizar Catálogo"}
          </button>
        </div>
      </div>

      {/* Expanded: store details */}
      <AnimatePresence>
        {expanded && storeEntries.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#E8E8E4] dark:border-neutral-700 px-4 py-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] dark:text-neutral-500 mb-2">
                Detalhes por loja
              </p>
              {storeEntries.map(([storeName, info]) => (
                <div
                  key={storeName}
                  className="flex items-center justify-between rounded-lg bg-[#F7F7F5] dark:bg-neutral-800 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StoreIcon className="h-3.5 w-3.5 text-[#A0A09A] dark:text-neutral-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-[#1A1A18] dark:text-neutral-100 truncate">{storeName}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[11px] text-[#6B6B63] dark:text-neutral-400">
                      {info.product_count.toLocaleString("pt-BR")} produtos
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-[#A0A09A] dark:text-neutral-500">
                      <Clock className="h-3 w-3" />
                      {formatAge(info.age_minutes)}
                    </div>
                    {info.age_minutes !== null && info.age_minutes < 10 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[rgb(var(--primary-500))]" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="border-t border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-2">
          <p className="text-xs text-red-600 dark:text-red-400">Não foi possível conectar ao servidor. Verifique se o backend está ativo.</p>
        </div>
      )}
    </div>
  );
}
