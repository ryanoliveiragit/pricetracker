"use client";

import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun, Laptop } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export function DarkModeToggle() {
  const { mode, setMode, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const modes = [
    { value: "light" as const, label: "Claro", icon: Sun },
    { value: "dark" as const, label: "Escuro", icon: Moon },
    { value: "system" as const, label: "Sistema", icon: Laptop },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const CurrentIcon = isDark ? Moon : mode === "system" ? Laptop : Sun;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        title="Alternar tema"
        className="
          flex items-center justify-center
          h-9 w-9 rounded-xl
          border border-slate-200 dark:border-neutral-700
          bg-white dark:bg-neutral-800
          text-slate-600 dark:text-neutral-400
          hover:bg-slate-100 dark:hover:bg-neutral-700
          hover:text-slate-900 dark:hover:text-neutral-200
          transition-colors cursor-pointer shadow-sm
        "
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? "dark" : mode}
            initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-center"
          >
            <CurrentIcon size={17} />
          </motion.div>
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.13 }}
            className="
              absolute top-11 right-0
              w-44
              rounded-xl overflow-hidden
              border border-slate-200 dark:border-neutral-700
              bg-white dark:bg-neutral-900
              shadow-xl dark:shadow-2xl
              z-[9999]
            "
          >
            <div className="p-1.5 space-y-0.5">
              {modes.map((m) => {
                const Icon = m.icon;
                const isActive = mode === m.value;

                return (
                  <button
                    key={m.value}
                    onClick={() => {
                      setMode(m.value);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2
                      rounded-lg transition-colors text-left
                      text-[13px] font-medium
                      ${
                        isActive
                          ? "bg-slate-100 dark:bg-neutral-800 text-[rgb(var(--primary-500))] font-semibold"
                          : "text-slate-700 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-neutral-200"
                      }
                    `}
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1">{m.label}</span>
                    {isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-500))]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
