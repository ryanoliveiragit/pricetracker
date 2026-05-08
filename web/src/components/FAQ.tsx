"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  {
    q: "Quantos fornecedores posso conectar?",
    a: "No plano Starter você conecta até 3 fornecedores. No Pro e Enterprise, fornecedores ilimitados — incluindo os que exigem login com Selenium."
  },
  {
    q: "Como funciona o scraping automático?",
    a: "O sistema roda buscas em paralelo nos atacadistas configurados. Lojas com login usam sessões Selenium criptografadas. Os resultados chegam em streaming em tempo real, sem necessidade de aguardar o carregamento completo."
  },
  {
    q: "Os dados de acesso às lojas ficam seguros?",
    a: "Sim. Credenciais são armazenadas com criptografia AES-256 usando CREDENTIALS_ENCRYPTION_KEY. Nunca trafegam em texto puro — somente o servidor de scraping as acessa."
  },
  {
    q: "Preciso instalar algo na minha máquina?",
    a: "Não. ConstruPrice roda 100% na nuvem via Docker. Basta acessar o painel pelo navegador. Para self-hosting, disponibilizamos o docker-compose completo."
  },
  {
    q: "O Agente IA funciona como?",
    a: "Você digita em linguagem natural o que precisa — ex: 'preciso de cimento, areia e brita para 200m²'. O agente interpreta, normaliza os termos, busca em todos os fornecedores e apresenta os resultados ranqueados por preço."
  },
  {
    q: "Posso usar em equipe?",
    a: "Sim. O plano Pro suporta até 10 usuários com perfis distintos: admin, gestor, usuário e funcionário. Cada perfil tem permissões diferentes de visualização e ação."
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i}
          className={cn(
            "rounded-2xl border transition-all duration-200 overflow-hidden",
            open === i
              ? "border-white/[0.12] bg-white/[0.04]"
              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.03]"
          )}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <span className="text-[15px] font-medium text-white/90">{item.q}</span>
            <Plus className={cn(
              "h-4 w-4 text-white/40 shrink-0 transition-transform duration-200",
              open === i && "rotate-45 text-brand-500"
            )} />
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-[14px] text-white/55 leading-relaxed">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
