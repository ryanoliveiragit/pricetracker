"use client";

import React, { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ImageModalProps {
  images: string[];
  currentIndex: number;
  productName: string;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImageModal({
  images,
  currentIndex,
  productName,
  open,
  onClose,
  onNavigate,
}: ImageModalProps) {
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
    },
    [open, hasPrev, hasNext, currentIndex, onClose, onNavigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Bloquear scroll quando aberto
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Container da imagem — não propaga o click */}
          <motion.div
            className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Imagem */}
            <img
              src={images[currentIndex]}
              alt={productName}
              className="max-h-[80vh] max-w-[80vw] rounded-2xl object-contain shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://placehold.co/600x400/1a1a2e/9b8fcf?text=Sem+imagem";
              }}
            />

            {/* Botão fechar */}
            <button
              onClick={onClose}
              className="absolute -right-4 -top-4 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 shadow-lg transition hover:bg-red-500/80 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Navegação — esquerda */}
            {hasPrev && (
              <button
                onClick={() => onNavigate(currentIndex - 1)}
                className="absolute -left-5 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800/90 text-neutral-200 shadow-lg backdrop-blur transition hover:bg-emerald-600 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {/* Navegação — direita */}
            {hasNext && (
              <button
                onClick={() => onNavigate(currentIndex + 1)}
                className="absolute -right-5 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800/90 text-neutral-200 shadow-lg backdrop-blur transition hover:bg-emerald-600 hover:text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            {/* Nome do produto */}
            <div className="absolute bottom-0 left-0 right-0 rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
              <p className="truncate text-center text-sm font-medium text-white">
                {productName}
              </p>
              {images.length > 1 && (
                <p className="text-center text-xs text-neutral-400">
                  {currentIndex + 1} / {images.length}
                </p>
              )}
            </div>
          </motion.div>

          {/* Hint zoom */}
          <div className="absolute bottom-6 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/60 backdrop-blur">
            <ZoomIn className="h-3.5 w-3.5" />
            ESC ou clique fora para fechar
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ModalState {
  open: boolean;
  images: string[];
  index: number;
  name: string;
}

// Hook auxiliar para gerenciar estado do modal
export function useImageModal() {
  const [state, setState] = React.useState<ModalState>({
    open: false,
    images: [],
    index: 0,
    name: "",
  });

  const openModal = (images: string[], index = 0, name = "") =>
    setState({ open: true, images, index, name });

  const close = () => setState((s) => ({ ...s, open: false }));
  const navigate = (index: number) => setState((s) => ({ ...s, index }));

  return { state, openModal, close, navigate };
}
