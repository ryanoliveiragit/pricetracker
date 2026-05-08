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
        className="group fixed bottom-6 right-6 z-[70] flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          boxShadow: "0 4px 20px rgba(109, 40, 217, 0.4), 0 1px 4px rgba(0,0,0,0.15)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 6px 28px rgba(109, 40, 217, 0.55), 0 2px 6px rgba(0,0,0,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 4px 20px rgba(109, 40, 217, 0.4), 0 1px 4px rgba(0,0,0,0.15)";
        }}
      >
        <MessageSquarePlus className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
        <span className="text-[13px] font-semibold leading-none">Reportar</span>
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
