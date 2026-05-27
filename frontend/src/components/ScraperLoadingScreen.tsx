"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Search,
  TrendingDown,
  Zap,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { StoreState } from "@/services/searchApi";

interface ScraperLoadingScreenProps {
  storeStates: StoreState[];
  elapsed: number;
  progress: number;
  items: string[];
}

const STEPS = [
  { icon: Globe, label: "Conectando às lojas", sublabel: "Abrindo sessões seguras" },
  { icon: Search, label: "Coletando preços", sublabel: "Navegando nos catálogos" },
  { icon: TrendingDown, label: "Comparando resultados", sublabel: "Encontrando o melhor preço" },
];

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 overflow-hidden relative">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 rounded-lg bg-muted animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-2 w-1/3 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="h-8 w-full rounded-lg bg-muted animate-pulse" />
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
        <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function BrowserAnimation({ storeName }: { storeName: string }) {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Browser window */}
      <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Browser chrome */}
        <div className="bg-muted/80 px-4 py-2.5 flex items-center gap-2 border-b border-border">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          </div>
          {/* URL bar */}
          <div className="flex-1 rounded-md bg-background/80 border border-border px-3 py-1 flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full bg-[rgb(var(--primary-500))] flex-shrink-0 animate-pulse" />
            <AnimatePresence mode="wait">
              <motion.span
                key={storeName}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-[11px] text-muted-foreground truncate font-mono"
              >
                {storeName.toLowerCase().replace(/\s+/g, "")}.com.br
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Page content being scraped */}
        <div className="p-4 space-y-2.5 bg-background/40">
          {/* Animated "scanning" rows */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12, duration: 0.3 }}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-md flex-shrink-0",
                  i % 2 === 0 ? "bg-muted animate-pulse" : "bg-muted/60 animate-pulse",
                )}
                style={{ animationDelay: `${i * 200}ms` }}
              />
              <div className="flex-1 space-y-1.5">
                <motion.div
                  className="h-2 rounded bg-muted"
                  animate={{ width: ["60%", "85%", "70%"] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                />
                <div className="flex gap-2 items-center">
                  <div className="h-2 w-12 rounded bg-muted animate-pulse" />
                  {/* Price highlight effect */}
                  <motion.div
                    className="h-4 w-16 rounded bg-[rgb(var(--primary-500))]/20 border border-[rgb(var(--primary-500))]/30 flex items-center justify-center"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                  >
                    <motion.span
                      className="text-[9px] font-bold text-[rgb(var(--primary-500))]"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                    >
                      R$ ---
                    </motion.span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Scanning beam */}
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[rgb(var(--primary-500))] to-transparent opacity-60 pointer-events-none"
        style={{ top: 42 }}
        animate={{ top: [42, 180, 42] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function ScraperLoadingScreen({
  storeStates,
  elapsed,
  progress,
  items,
}: ScraperLoadingScreenProps) {
  const [activeStoreName, setActiveStoreName] = useState("Loja");
  const [stepIndex, setStepIndex] = useState(0);

  const searchingStores = storeStates.filter((s) => s.status === "searching");
  const doneCount = storeStates.filter((s) => s.status === "done" || s.status === "error").length;

  useEffect(() => {
    if (searchingStores.length > 0) {
      setActiveStoreName(searchingStores[0].name);
    }
  }, [searchingStores.map((s) => s.name).join(",")]);

  useEffect(() => {
    if (progress < 20) setStepIndex(0);
    else if (progress < 70) setStepIndex(1);
    else setStepIndex(2);
  }, [progress]);

  const currentStep = STEPS[stepIndex];
  const StepIcon = currentStep.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-2xl mx-auto py-6 space-y-8"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <motion.div
          className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/20 px-4 py-1.5"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Zap className="h-3.5 w-3.5 text-[rgb(var(--primary-500))]" />
          <span className="text-xs font-semibold text-[rgb(var(--primary-500))]">
            Scraper em ação
          </span>
        </motion.div>

        <h2 className="text-xl font-bold text-foreground">
          {items.length === 1 ? `Buscando "${items[0]}"` : `Buscando ${items.length} produtos`}
        </h2>

        {/* Step indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-center gap-2"
          >
            <StepIcon className="h-4 w-4 text-muted-foreground animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {currentStep.label}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Steps track */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-500",
                    isDone && "border-[rgb(var(--primary-500))] bg-[rgb(var(--primary-500))]",
                    isActive && "border-[rgb(var(--primary-500))] bg-[rgb(var(--primary-500))]/10",
                    !isDone && !isActive && "border-border bg-muted",
                  )}
                  animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-[rgb(var(--primary-500))] animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </motion.div>
                <span className={cn(
                  "text-[10px] font-medium text-center max-w-[70px] leading-tight",
                  isActive && "text-[rgb(var(--primary-500))]",
                  isDone && "text-foreground",
                  !isDone && !isActive && "text-muted-foreground/50",
                )}>
                  {step.label.split(" ").slice(0, 2).join(" ")}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-16 h-0.5 mx-1 mb-5 rounded-full overflow-hidden bg-border">
                  <motion.div
                    className="h-full bg-[rgb(var(--primary-500))] rounded-full"
                    animate={{ width: isDone ? "100%" : isActive ? "50%" : "0%" }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Browser animation */}
      <BrowserAnimation storeName={activeStoreName} />

      {/* Store pills */}
      {storeStates.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {storeStates.map((s) => {
            const isDone = s.status === "done";
            const isError = s.status === "error" || s.status === "login_error";
            const isSearching = s.status === "searching";
            return (
              <motion.span
                key={s.name}
                layout
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-300",
                  isDone && "bg-[rgb(var(--primary-500))]/10 text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))] border border-[rgb(var(--primary-500))]/20",
                  isSearching && "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-200/50 dark:border-amber-700/30",
                  isError && "bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-200/50 dark:border-red-700/30",
                  !isDone && !isSearching && !isError && "bg-muted text-muted-foreground border border-border",
                )}
              >
                {isSearching && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {isDone && <CheckCircle2 className="h-2.5 w-2.5" />}
                {isError && <AlertCircle className="h-2.5 w-2.5" />}
                {!isDone && !isSearching && !isError && (
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                )}
                {s.name}
              </motion.span>
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {doneCount} / {storeStates.length || "?"} lojas consultadas
          </span>
          <span className="tabular-nums font-medium">{elapsed}s · {progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[rgb(var(--primary-500))] to-[rgb(var(--primary-400))]"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Skeleton cards preview */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground text-center font-medium">
          Resultados aparecem aqui conforme chegam...
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <SkeletonCard />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
