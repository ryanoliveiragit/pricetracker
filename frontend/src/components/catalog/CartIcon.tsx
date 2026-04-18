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
        "transition hover:border-[rgb(var(--primary-500))/0.35] dark:hover:border-[rgb(var(--primary-500))/0.05]0 hover:bg-[rgb(var(--primary-500))/0.07] dark:hover:bg-[rgb(var(--primary-500))/0.10] hover:text-[rgb(var(--primary-600))] dark:hover:text-[rgb(var(--primary-500))]",
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
            className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[rgb(var(--primary-500))] text-[10px] font-bold text-white shadow-md"
          >
            {count > 99 ? "99+" : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
