import {
  Bot, Zap, Store, BarChart3, Star, Shield,
  Search, Check, ArrowRight, ChevronRight,
  Users, Sparkles, MessageSquare, Package,
  CheckCircle2, X, TrendingDown,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Marquee from "@/components/Marquee";
import FAQ from "@/components/FAQ";

/* ── Mockups ─────────────────────────────────────────── */

function AgentChatMockup() {
  return (
    <div className="relative h-full">
      <div className="absolute -inset-4 rounded-3xl" style={{ background: "radial-gradient(circle at 60% 30%, rgba(250,93,25,0.08) 0%, transparent 65%)" }} />
      <div className="relative rounded-2xl border border-white/[0.09] bg-[#0b0b0b] shadow-2xl overflow-hidden h-full flex flex-col">
        {/* Window chrome */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] bg-white/[0.015] px-4 py-3 shrink-0">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
          </div>
          <div className="flex items-center gap-2 ml-2">
            <div className="h-5 w-5 rounded-md bg-brand-500/20 border border-brand-500/20 flex items-center justify-center">
              <Bot className="h-2.5 w-2.5 text-brand-400" />
            </div>
            <span className="text-[11.5px] font-semibold text-white/55">Agente IA</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-white/25">online</span>
          </div>
        </div>

        {/* Chat + Summary */}
        <div className="flex flex-1 min-h-0">
          {/* Messages */}
          <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 overflow-hidden">
            {/* User msg */}
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-brand-500/[0.11] border border-brand-500/[0.18] px-3.5 py-2.5">
                <p className="text-[12.5px] text-white/80 leading-relaxed">cimento 50kg</p>
              </div>
            </div>

            {/* Agent: asks brand */}
            <div className="flex gap-2.5 items-start">
              <div className="h-6 w-6 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3 w-3 text-white/40" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-[12.5px] text-white/60 leading-relaxed">
                  Sobre <span className="text-white/90 font-semibold">cimento</span>: Qual marca do cimento?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Votorantim", "Itambé", "Holcim", "Qualquer"].map(b => (
                    <span key={b} className={`rounded-full px-2.5 py-1 text-[10.5px] font-medium border transition-all ${
                      b === "Itambé"
                        ? "bg-brand-500/[0.15] border-brand-500/[0.3] text-brand-300"
                        : "bg-white/[0.03] border-white/[0.08] text-white/35"
                    }`}>{b}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* User selects */}
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-brand-500/[0.11] border border-brand-500/[0.18] px-3.5 py-2.5">
                <p className="text-[12.5px] text-white/80">Itambé</p>
              </div>
            </div>

            {/* Agent: ready */}
            <div className="flex gap-2.5 items-start">
              <div className="h-6 w-6 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3 w-3 text-white/40" />
              </div>
              <div className="flex-1">
                <div className="rounded-xl border border-emerald-500/[0.2] bg-emerald-500/[0.05] px-3 py-2.5 space-y-1">
                  <p className="text-[11.5px] text-emerald-400 font-semibold">✅ Pronto para buscar!</p>
                  <p className="text-[11px] text-white/35">📦 Todos fornecedores</p>
                  <p className="text-[11px] text-white/35">📋 Cimento Itambé 50kg</p>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="mt-auto pt-1">
              <div style={{
                borderRadius: 13, padding: "1.5px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025) 50%, rgba(255,255,255,0.05))",
              }}>
                <div style={{ borderRadius: 11.5, background: "#111", padding: "8px 12px" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-white/15">Mensagem para o assistente...</span>
                    <div className="h-5 w-5 rounded-md bg-white/[0.04] flex items-center justify-center">
                      <ArrowRight className="h-2.5 w-2.5 text-white/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary sidebar */}
          <div className="w-32 border-l border-white/[0.05] p-3 flex-col gap-2 hidden sm:flex shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/20 mb-0.5">Resumo</p>
            {[
              { label: "Produto", value: "Cimento" },
              { label: "Marca",   value: "Itambé"  },
              { label: "Peso",    value: "50kg"     },
              { label: "Fornecedor", value: "Todos" },
            ].map(f => (
              <div key={f.label} className="rounded-lg bg-white/[0.025] border border-white/[0.05] px-2 py-1.5">
                <p className="text-[8.5px] text-white/20 uppercase tracking-wide">{f.label}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[11px] text-white/65 font-medium truncate flex-1">{f.value}</p>
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                </div>
              </div>
            ))}
            <button className="mt-auto w-full rounded-lg bg-brand-500 py-2 text-[10px] font-bold text-white">
              Buscar agora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsMockup() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b0b] overflow-hidden shadow-2xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
        <div className="flex gap-1.5 shrink-0">
          <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
        </div>
        <div className="flex items-center gap-2 rounded-md bg-white/[0.04] border border-white/[0.05] px-3 py-1 mx-auto">
          <Search className="h-2.5 w-2.5 text-white/20 shrink-0" />
          <span className="text-[10.5px] text-white/20 font-mono">app.construprice.com.br/results</span>
        </div>
      </div>

      <div className="flex" style={{ height: 340 }}>
        {/* Sidebar */}
        <div className="w-40 border-r border-white/[0.05] p-3 hidden sm:flex flex-col gap-1 shrink-0">
          {[
            { icon: MessageSquare, label: "Agente IA",  active: false },
            { icon: Search,        label: "Resultados", active: true  },
            { icon: Star,          label: "Salvos",     active: false },
            { icon: Package,       label: "Catálogo",   active: false },
            { icon: Store,         label: "Fornecedores",active: false },
          ].map(({ icon: Icon, label, active }) => (
            <div key={label} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
              active ? "bg-brand-500/[0.12] text-brand-400" : "text-white/22"
            }`}>
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Query bar */}
          <div className="border-b border-white/[0.05] px-4 py-2.5 flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 rounded-full bg-brand-500/[0.08] border border-brand-500/[0.18] px-2.5 py-1">
              <span className="text-[10.5px] text-brand-300 font-medium">Cimento Itambé 50kg</span>
              <X className="h-2.5 w-2.5 text-white/25" />
            </div>
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9.5px] text-white/25 font-mono">4 fornecedores · live</span>
            </div>
          </div>

          {/* Store tabs */}
          <div className="border-b border-white/[0.04] px-4 py-2 flex items-center gap-1 overflow-x-hidden shrink-0">
            {[
              { name: "Todos", n: "14", active: true  },
              { name: "EstoqueAtacadista", n: "4",  active: false },
              { name: "Megaleste", n: "4",  active: false },
              { name: "Cofema",    n: "3",  active: false },
            ].map(t => (
              <span key={t.name} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium whitespace-nowrap ${
                t.active ? "bg-white/[0.07] text-white/75" : "text-white/22"
              }`}>
                {t.name}
                <span className={`rounded-full px-1.5 text-[8.5px] ${t.active ? "bg-white/[0.1] text-white/40" : "text-white/15"}`}>{t.n}</span>
              </span>
            ))}
          </div>

          {/* Products grid */}
          <div className="flex-1 p-3.5 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 h-full">
              {[
                { store: "EstoqueAtacadista", color: "bg-orange-500", name: "Cimento Itambé CP-II 50kg", price: "R$ 35,90", best: true  },
                { store: "Megaleste",         color: "bg-blue-500",   name: "Cimento Itambé CPII 50kg",  price: "R$ 38,50", best: false },
                { store: "Cofema",            color: "bg-violet-500", name: "Cimento Itambé 50kg",       price: "R$ 39,90", best: false },
                { store: "SuperABC",          color: "bg-teal-500",   name: "Cimento Itambé 50kg Saco",  price: "R$ 41,00", best: false },
                { store: "Megaleste",         color: "bg-blue-500",   name: "Cimento Itambé CP4 50kg",   price: "R$ 43,00", best: false },
                { store: "EstoqueAtacadista", color: "bg-orange-500", name: "Cimento Itambé CP-III 50kg",price: "R$ 44,00", best: false },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl border p-2.5 flex flex-col gap-1.5 ${
                  item.best
                    ? "border-brand-500/[0.25] bg-brand-500/[0.05]"
                    : "border-white/[0.05] bg-white/[0.015]"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-3.5 w-3.5 rounded-md ${item.color} opacity-75 shrink-0`} />
                    <span className="text-[9px] text-white/28 truncate flex-1">{item.store}</span>
                    {item.best && (
                      <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[7.5px] font-bold text-white shrink-0">✓</span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-white/60 leading-snug line-clamp-2 flex-1">{item.name}</p>
                  <p className={`text-[13px] font-bold leading-none ${item.best ? "text-white" : "text-white/50"}`}>{item.price}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Streaming bar */}
          <div className="border-t border-white/[0.04] px-4 py-2 flex items-center gap-3 shrink-0">
            <div className="flex-1 h-0.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-brand-500 to-orange-400" />
            </div>
            <span className="text-[9.5px] text-white/20 font-mono shrink-0">3/4 · buscando…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuppliersMockup() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b0b] overflow-hidden h-full flex flex-col">
      <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-2 shrink-0">
        <Store className="h-3.5 w-3.5 text-white/25" />
        <span className="text-[12px] font-semibold text-white/50">Fornecedores</span>
        <span className="ml-auto rounded-full bg-emerald-500/10 border border-emerald-500/[0.2] px-2 py-0.5 text-[9px] font-mono text-emerald-400">
          4 ativos
        </span>
      </div>
      <div className="p-3 space-y-2 flex-1">
        {[
          { name: "EstoqueAtacadista", url: "estoqueatacadista.com.br", color: "bg-orange-500", login: true  },
          { name: "Megaleste",         url: "megaleste.com.br",         color: "bg-blue-500",   login: false },
          { name: "Cofema",            url: "cofema.com.br",            color: "bg-violet-500", login: true  },
          { name: "SuperABC",          url: "superabc.com.br",          color: "bg-teal-500",   login: false },
        ].map(s => (
          <div key={s.name} className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
            <div className={`h-7 w-7 rounded-lg ${s.color} opacity-80 flex items-center justify-center shrink-0`}>
              <Store className="h-3 w-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white/70 truncate">{s.name}</p>
              <p className="text-[9px] text-white/22 font-mono truncate">{s.url}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {s.login && <Shield className="h-2.5 w-2.5 text-brand-400/50" />}
              <div className="h-4 w-7 rounded-full bg-emerald-500 relative flex-shrink-0">
                <div className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-white shadow" />
              </div>
            </div>
          </div>
        ))}
        <button className="w-full rounded-xl border border-dashed border-white/[0.07] py-2 text-[10.5px] text-white/20 text-center mt-1">
          + Adicionar fornecedor
        </button>
      </div>
    </div>
  );
}

function SavedMockup() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b0b] overflow-hidden h-full flex flex-col">
      <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-2 shrink-0">
        <Star className="h-3.5 w-3.5 text-white/25" />
        <span className="text-[12px] font-semibold text-white/50">Cotações salvas</span>
        <span className="ml-auto text-[10px] text-white/20 font-mono">3 itens</span>
      </div>
      <div className="p-3 space-y-2 flex-1">
        {[
          { name: "Cimento Itambé CP-II 50kg", store: "EstoqueAtacadista", price: "R$ 35,90", delta: "−3%",  up: false },
          { name: "Areia Lavada Fina m³",       store: "Megaleste",         price: "R$ 89,00", delta: "+2%",  up: true  },
          { name: "Brita 1 — m³",               store: "SuperABC",          price: "R$112,00", delta: "−8%",  up: false },
          { name: "Tinta Suvinil Branco 18L",   store: "Cofema",            price: "R$187,00", delta: "−5%",  up: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white/65 truncate">{item.name}</p>
              <p className="text-[9px] text-white/22 mt-0.5">{item.store}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[12px] font-bold text-white/80">{item.price}</p>
              <p className={`text-[9.5px] font-mono ${item.up ? "text-red-400" : "text-emerald-400"}`}>{item.delta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Data ─────────────────────────────────────────── */

const features = [
  {
    icon: Bot,
    title: "Agente IA",
    desc: "Descreva em linguagem natural. O agente interpreta, normaliza termos técnicos e busca automaticamente.",
    tag: "Linguagem natural",
  },
  {
    icon: Zap,
    title: "Streaming em tempo real",
    desc: "Resultados chegam enquanto cada loja responde via SSE. Sem aguardar carregamento completo.",
    tag: "SSE",
  },
  {
    icon: Store,
    title: "Multi-fornecedor",
    desc: "EstoqueAtacadista, Megaleste, Cofema, SuperABC — com ou sem login. Adicione quantos quiser.",
    tag: "Ilimitado no Pro",
  },
  {
    icon: Shield,
    title: "Credenciais seguras",
    desc: "Logins criptografados com AES-256. Sessões Selenium em cache, nunca trafegam em texto puro.",
    tag: "AES-256",
  },
  {
    icon: BarChart3,
    title: "Histórico de preços",
    desc: "Acompanhe variações ao longo do tempo. Saiba quando é o melhor momento para comprar.",
    tag: "Em breve",
  },
  {
    icon: Users,
    title: "Controle de equipe",
    desc: "Perfis de admin, gestor, usuário e funcionário — cada um vê e faz apenas o que precisa.",
    tag: "Até 10 usuários",
  },
];

const plans = [
  {
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    desc: "Para autônomos e pequenas obras",
    highlight: false,
    features: ["3 fornecedores", "500 cotações/mês", "Agente IA básico", "1 usuário"],
  },
  {
    name: "Pro",
    price: "R$ 247",
    period: "/mês",
    desc: "Para construtoras e revendas",
    highlight: true,
    features: ["Fornecedores ilimitados", "Cotações ilimitadas", "Agente IA avançado", "10 usuários", "Histórico completo", "Suporte prioritário"],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    desc: "Para grandes redes e distribuidoras",
    highlight: false,
    features: ["Tudo do Pro", "Usuários ilimitados", "API de integração", "Onboarding dedicado", "SLA garantido"],
  },
];

const testimonials = [
  {
    quote: "Antes eu passava 2 horas ligando para fornecedores. Agora faço a cotação em 30 segundos.",
    name: "Rafael Costa",
    role: "Mestre de obras · SP",
    initial: "R",
  },
  {
    quote: "O agente IA entende exatamente o que preciso. Só digito o material e pronto.",
    name: "Mariana Souza",
    role: "Gestora de compras · RJ",
    initial: "M",
  },
  {
    quote: "Economizamos 28% no custo de material nos primeiros três meses. ROI imediato.",
    name: "Carlos Mendes",
    role: "Diretor de obras · MG",
    initial: "C",
  },
];

const steps = [
  { title: "Cadastre seus fornecedores", body: "Adicione atacadistas com ou sem login. Credenciais ficam criptografadas com AES-256." },
  { title: "Descreva o que precisa",      body: "Use linguagem natural ou pesquisa direta. O agente normaliza e busca em paralelo." },
  { title: "Compare e decida",            body: "Preços ranqueados lado a lado. Salve e recompre com um clique." },
];

/* ── Page ─────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-40 sm:pb-32">
        <div className="pointer-events-none absolute inset-0 dot-grid" />
        <div className="pointer-events-none absolute inset-0 radial-fade" />
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(250,93,25,0.1) 0%, transparent 60%)" }} />

        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid lg:grid-cols-[1fr_1.05fr] gap-14 lg:gap-20 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/[0.08] px-3.5 py-1.5 text-[11px] font-semibold text-brand-400 mb-8">
                <Sparkles className="h-3 w-3" />
                Agente IA com linguagem natural
              </div>

              <h1 className="text-[38px] sm:text-[50px] md:text-[58px] font-bold tracking-tight leading-[1.07] mb-6 text-balance">
                <span className="text-white">Cote materiais em</span>
                <br />
                <span className="gradient-text-brand">múltiplos atacadistas</span>
                <br />
                <span className="text-white/85">em segundos</span>
              </h1>

              <p className="text-[16px] text-white/40 leading-relaxed mb-8 max-w-[420px]">
                ConstruPrice conecta todos os seus fornecedores e compara preços automaticamente — com um agente IA que entende o que você precisa.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a href="#pricing"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-semibold text-black hover:bg-white/90 transition-all shadow-xl shadow-white/[0.06]">
                  Começar grátis
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a href="#app-preview"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-7 py-3.5 text-[14px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.16] transition-all">
                  Ver o produto
                  <ChevronRight className="h-4 w-4 opacity-60" />
                </a>
              </div>

              <div className="mt-7 flex items-center gap-5">
                <p className="text-[12px] text-white/20">14 dias grátis · Sem cartão</p>
                <span className="h-3 w-px bg-white/[0.08]" />
                <div className="flex items-center gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-brand-500/60 text-brand-500/60" />
                  ))}
                  <span className="text-[11px] text-white/20 ml-1">4.9/5</span>
                </div>
              </div>
            </div>

            {/* Right — Agent mockup */}
            <div style={{ minHeight: 420 }}>
              <AgentChatMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="border-y border-white/[0.05] py-8">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/15 mb-5">
          Fornecedores integrados
        </p>
        <Marquee />
      </div>

      {/* ── APP PREVIEW (BENTO) ── */}
      <section id="app-preview" className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-500 mb-4">Produto</p>
            <h2 className="text-3xl sm:text-[42px] font-bold gradient-text tracking-tight mb-4">
              Veja o app em ação
            </h2>
            <p className="text-white/35 text-[15px] max-w-md mx-auto">
              Do agente IA ao painel de fornecedores — tudo integrado numa plataforma que funciona do seu jeito.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Results — large */}
            <div className="lg:col-span-2">
              <ResultsMockup />
            </div>

            {/* Agent — tall (spans 2 rows) */}
            <div className="lg:row-span-2" style={{ minHeight: 500 }}>
              <AgentChatMockup />
            </div>

            {/* Bottom row */}
            <div>
              <SuppliersMockup />
            </div>
            <div>
              <SavedMockup />
            </div>
          </div>

          {/* Stats bar below bento */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: "4",    label: "Fornecedores integrados", sub: "e crescendo" },
              { value: "< 10s", label: "Tempo médio de cotação",  sub: "por fornecedor" },
              { value: "28%",  label: "Economia média em material", sub: "nos primeiros 3 meses" },
              { value: "100%", label: "Cloud — sem instalação",  sub: "acesse de qualquer lugar" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-center">
                <p className="text-[26px] font-bold text-white mb-1">{s.value}</p>
                <p className="text-[12px] text-white/50 leading-snug">{s.label}</p>
                <p className="text-[10px] text-white/20 mt-0.5 font-mono">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-500 mb-4">Funcionalidades</p>
            <h2 className="text-3xl sm:text-[42px] font-bold gradient-text tracking-tight mb-4">
              Tudo que você precisa
            </h2>
            <p className="text-white/35 text-[15px] max-w-md mx-auto">
              Uma plataforma completa para o dia a dia do setor de construção.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.11] transition-all p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center shrink-0">
                    <f.icon className="h-5 w-5 text-white/45 group-hover:text-white/65 transition-colors" />
                  </div>
                  <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[10px] font-mono text-white/25 shrink-0 mt-0.5">
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold text-white/85 mb-2">{f.title}</h3>
                <p className="text-[13px] text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-500 mb-4">Como funciona</p>
            <h2 className="text-3xl sm:text-[42px] font-bold gradient-text tracking-tight mb-4">
              Setup em 5 minutos
            </h2>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={step.title}
                className="flex gap-5 items-start rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7">
                <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-brand-500/25 bg-brand-500/[0.08] font-mono text-[12px] font-bold text-brand-400">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white/85 mb-1.5">{step.title}</h3>
                  <p className="text-[13px] text-white/35 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-500 mb-4">Depoimentos</p>
            <h2 className="text-3xl sm:text-[42px] font-bold gradient-text tracking-tight">
              Quem usa, não volta atrás
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map(t => (
              <div key={t.name}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.11] transition-all p-7">
                <div className="flex gap-0.5 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-brand-500 text-brand-500" />
                  ))}
                </div>
                <blockquote className="text-[14px] text-white/55 leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[12px] font-bold text-white/40">
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white/75">{t.name}</p>
                    <p className="text-[11px] text-white/25">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-500 mb-4">Planos</p>
            <h2 className="text-3xl sm:text-[42px] font-bold gradient-text tracking-tight mb-4">
              Simples e transparente
            </h2>
            <p className="text-white/35">Sem surpresas na fatura. Cancele quando quiser.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div key={plan.name}
                className={`rounded-2xl p-7 relative overflow-hidden ${
                  plan.highlight
                    ? "border-gradient-brand bg-[#0d0d0d]"
                    : "border border-white/[0.07] bg-white/[0.02]"
                }`}>
                {plan.highlight && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="rounded-b-full bg-brand-500 px-4 py-1 text-[10px] font-bold text-white">
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/20 mb-4 font-mono">{plan.name}</p>
                  <div className="flex items-end gap-1 mb-1.5">
                    <span className="text-[34px] font-bold text-white leading-none">{plan.price}</span>
                    {plan.period && <span className="mb-1 text-[13px] text-white/25">{plan.period}</span>}
                  </div>
                  <p className="text-[13px] text-white/30 mb-7">{plan.desc}</p>

                  <ul className="space-y-2.5 mb-7">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-[13px]">
                        <Check className={`h-3.5 w-3.5 shrink-0 ${plan.highlight ? "text-brand-400" : "text-white/20"}`} />
                        <span className="text-white/50">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <a href="#contact"
                    className={`block w-full text-center rounded-full py-3 text-[13px] font-semibold transition-all ${
                      plan.highlight
                        ? "bg-brand-500 text-white hover:bg-brand-600"
                        : "border border-white/[0.1] text-white/50 hover:text-white hover:border-white/20"
                    }`}>
                    {plan.name === "Enterprise" ? "Falar com vendas" : "Começar agora"}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-500 mb-4">FAQ</p>
            <h2 className="text-3xl sm:text-[42px] font-bold gradient-text tracking-tight">
              Perguntas frequentes
            </h2>
          </div>
          <FAQ />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="relative rounded-3xl border border-white/[0.08] bg-[#0c0c0c] px-10 py-20 sm:px-20 text-center overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 h-[350px] w-[350px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(250,93,25,0.12) 0%, transparent 60%)" }} />
            </div>
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl md:text-[46px] font-bold gradient-text tracking-tight mb-5 text-balance">
                Pronto para cotar mais rápido?
              </h2>
              <p className="text-white/35 text-[16px] mb-10 max-w-sm mx-auto">
                Junte-se às construtoras que já economizam horas por semana com ConstruPrice.
              </p>
              <a href="#pricing"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-10 py-4 text-[15px] font-semibold text-black hover:bg-white/90 transition-all shadow-xl shadow-white/[0.05]">
                Começar grátis — 14 dias
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="mt-5 text-[11px] text-white/15">Sem cartão de crédito · Setup em menos de 5 minutos</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-24 sm:py-32">
        <div className="mx-auto max-w-lg px-5 sm:px-8">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-500 mb-4">Contato</p>
            <h2 className="text-3xl font-bold gradient-text tracking-tight mb-3">Fale com a gente</h2>
            <p className="text-white/30 text-[14px]">Demo personalizada ou dúvidas sobre planos.</p>
          </div>

          <form className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="name" className="block text-[10px] font-semibold text-white/25 mb-2 uppercase tracking-wider">Nome</label>
                <input id="name" type="text" placeholder="Seu nome"
                  className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/15 focus:border-brand-500/35 focus:outline-none transition-all" />
              </div>
              <div>
                <label htmlFor="email" className="block text-[10px] font-semibold text-white/25 mb-2 uppercase tracking-wider">E-mail</label>
                <input id="email" type="email" placeholder="seu@email.com"
                  className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/15 focus:border-brand-500/35 focus:outline-none transition-all" />
              </div>
            </div>
            <div>
              <label htmlFor="message" className="block text-[10px] font-semibold text-white/25 mb-2 uppercase tracking-wider">Mensagem</label>
              <textarea id="message" rows={4} placeholder="Como podemos ajudar?"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/15 focus:border-brand-500/35 focus:outline-none transition-all resize-none" />
            </div>
            <button type="submit"
              className="w-full rounded-full bg-brand-500 py-3.5 text-[14px] font-semibold text-white hover:bg-brand-600 transition-colors">
              Enviar mensagem
            </button>
          </form>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.05] py-10">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-white/20">© 2025 ConstruPrice. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            {["Privacidade", "Termos", "Contato"].map(l => (
              <a key={l} href="#" className="text-[12px] text-white/20 hover:text-white/45 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
