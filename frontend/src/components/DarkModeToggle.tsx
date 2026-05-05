"use client";

import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun, Laptop } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export function DarkModeToggle() {
  const { mode, setMode, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const modes = [
    { value: "light"  as const, label: "Claro",   icon: Sun    },
    { value: "dark"   as const, label: "Escuro",  icon: Moon   },
    { value: "system" as const, label: "Sistema", icon: Laptop },
  ];

  function handleToggle() {
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen(prev => !prev);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        dropRef.current && !dropRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  const CurrentIcon = isDark ? Moon : mode === "system" ? Laptop : Sun;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Alternar tema"
        className="
          flex items-center justify-center
          h-8 w-8 rounded-lg
          border border-slate-200/80 dark:border-neutral-700/60
          bg-white/80 dark:bg-neutral-900/80
          text-slate-500 dark:text-neutral-400
          hover:border-slate-300 dark:hover:border-neutral-600
          hover:text-slate-700 dark:hover:text-neutral-200
          hover:shadow-sm
          transition-all cursor-pointer
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
            <CurrentIcon size={15} />
          </motion.div>
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.13 }}
            style={{
              position: "fixed",
              top: dropPos.top,
              right: dropPos.right,
              zIndex: 99999,
            }}
            className="
              w-44
              rounded-xl overflow-hidden
              border border-slate-200 dark:border-neutral-700
              bg-white dark:bg-neutral-900
              shadow-xl dark:shadow-black/40
            "
          >
            <div className="p-1.5 space-y-0.5">
              {modes.map(m => {
                const Icon = m.icon;
                const active = mode === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => { setMode(m.value); setIsOpen(false); }}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2
                      rounded-lg transition-colors text-left text-[13px] font-medium
                      ${active
                        ? "bg-slate-100 dark:bg-neutral-800 text-[rgb(var(--primary-500))]"
                        : "text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-neutral-100"
                      }
                    `}
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="flex-1">{m.label}</span>
                    {active && <div className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-500))]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
