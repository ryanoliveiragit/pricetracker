"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle2, Star, Layout, Database, Zap, X, Info, Search, Filter, Layers, Cpu, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  date: Date;
  isNew?: boolean;
}

const updates: NotificationItem[] = [
  {
    id: "1",
    title: "Módulo de Ofertas Salvas",
    description: "Favoritos agora são síncronos! Coração verde preenchido indica itens já salvos em qualquer tela.",
    icon: Star,
    date: new Date(),
    isNew: true,
  },
  {
    id: "2",
    title: "Layout de Resultados Unificado",
    description: "A aba de Ofertas Salvas agora é idêntica à de Resultados, com filtros laterais e estatísticas completas.",
    icon: Layout,
    date: new Date(),
    isNew: true,
  },
  {
    id: "6",
    title: "Busca por Variantes (Beta)",
    description: "Ajuste no campo de busca: agora com suporte a variantes de produtos para resultados mais precisos.",
    icon: Search,
    date: new Date(),
    isNew: true,
  },
  {
    id: "7",
    title: "Novos Filtros e Atributos",
    description: "Filtros laterais aprimorados com suporte a Marcas, Lojas e Unidades de Medida em tempo real.",
    icon: Filter,
    date: new Date(),
    isNew: true,
  },
  {
    id: "8",
    title: "Cache & Performance",
    description: "Novo sistema de cache de resultados e loading inteligente para uma navegação 2x mais rápida.",
    icon: Cpu,
    date: new Date(),
    isNew: true,
  },
  {
    id: "9",
    title: "Mapeamento de Itens IA",
    description: "Novo algoritmo de mapeamento de itens para agrupar ofertas semelhantes de fornecedores distintos.",
    icon: Layers,
    date: new Date(),
    isNew: true,
  },
  {
    id: "10",
    title: "White Mode (Padrão)",
    description: "Dark Mode desabilitado temporariamente para padronização da identidade visual clean.",
    icon: Sun,
    date: new Date(),
    isNew: true,
  },
  {
    id: "3",
    title: "CRUD Real & Persistência",
    description: "Integração completa com o banco de dados. Suas ofertas favoritas estão salvas permanentemente.",
    icon: Database,
    date: new Date(),
    isNew: true,
  },
];

interface NotificationsProps {
  open: boolean;
  onClose: () => void;
}

export default function UpdateNotifications({ open, onClose }: NotificationsProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay to trap clicks - highest fixed level */}
          <div className="fixed inset-0 z-[99998]" onClick={onClose} />
          
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-12 w-[380px] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden shadow-lime-500/10 z-[100]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-lime-500" />
                <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">O que há de novo?</span>
              </div>
              <button 
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-[520px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {updates.map((update) => (
                <div 
                  key={update.id}
                  className="relative flex items-start gap-4 rounded-xl p-3 transition-all hover:bg-slate-50 group border border-transparent hover:border-slate-100 bg-white/50"
                >
                  <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm group-hover:scale-110 transition-transform">
                    <update.icon className="h-4 w-4 text-lime-500" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-slate-800 truncate tracking-tight">{update.title}</p>
                      {update.isNew && (
                        <span className="flex-shrink-0 rounded-full bg-lime-500/10 border border-lime-500/30 px-1.5 py-0.5 text-[9px] font-bold text-lime-600">NOVO</span>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed text-slate-500 group-hover:text-slate-700 transition-colors">
                      {update.description}
                    </p>
                    <p className="text-[10px] text-[#A0A09A] font-medium uppercase tracking-wider pt-1">
                      {update.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
              <button 
                onClick={onClose}
                className="w-full rounded-lg bg-lime-500 py-2 text-center text-[11px] font-bold text-[#1A1A18] hover:bg-lime-600 transition-colors uppercase tracking-widest"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
