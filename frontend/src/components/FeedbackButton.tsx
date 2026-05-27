"use client";

import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Reportar problema de busca"
        className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:text-slate-800 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200"
      >
        <MessageSquarePlus className="h-[14px] w-[14px] shrink-0" strokeWidth={1.5} />
        <span className="text-[12px] font-medium leading-none">Reportar</span>
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
