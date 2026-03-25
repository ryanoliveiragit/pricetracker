"use client";

import { ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

interface CartIconProps {
  onClick: () => void;
  className?: string;
}

export function CartIcon({ onClick, className }: CartIconProps) {
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const count = getTotalItems();

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-xl",
        "border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400",
        "transition hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400",
        className
      )}
    >
      <ShoppingCart className="h-4.5 w-4.5" />

      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-md"
          >
            {count > 99 ? "99+" : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
