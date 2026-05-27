"use client";

import { motion } from "framer-motion";
import { ArrowRight, Package, Info, Search, TrendingDown, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { getTenantSlug } from "../services/headers";
import GlobePriceScannerSection from "../components/GlobePriceScanner";

export default function ModernLogin() {
  const { login } = useAuth();
  const router = useRouter();
  const isTenant = Boolean(getTenantSlug());
  const [email, setEmail] = useState(isTenant ? "gestor@construprice.com" : "superadmin@construprice.com");
  const [password, setPassword] = useState(isTenant ? "gestor123" : "superadmin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel autenticar");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: Search,       label: "Busca simultânea",    desc: "Varre dezenas de lojas ao mesmo tempo" },
    { icon: TrendingDown, label: "Menor preço",         desc: "Identifica automaticamente o melhor preço" },
    { icon: Zap,          label: "Tempo real",          desc: "Resultados em segundos, não em horas" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">

      {/* ══ HERO SECTION ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full blur-[120px]"
            style={{ background: "rgb(var(--primary-500) / 0.07)" }}
          />
          <div
            className="absolute -bottom-20 -left-40 h-[500px] w-[500px] rounded-full blur-[100px]"
            style={{ background: "rgb(var(--primary-500) / 0.05)" }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid min-h-screen items-center gap-12 py-16 lg:grid-cols-2 lg:gap-20">

            {/* Left: marketing copy */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8 order-2 lg:order-1"
            >
              {/* Logo + name */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
                  style={{
                    background: "rgb(var(--primary-500))",
                    boxShadow: "0 8px 24px rgb(var(--primary-500) / 0.30)",
                  }}
                >
                  <Package className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-800 dark:text-neutral-100 tracking-tight">
                  ConstruPrice
                </span>
              </div>

              {/* Headline */}
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--primary-500))]/25 bg-[rgb(var(--primary-500))]/8 px-3.5 py-1.5">
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-500))]"
                  />
                  <span className="text-xs font-semibold text-[rgb(var(--primary-500))]">
                    Scraping de preços ativo
                  </span>
                </div>
                <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white lg:text-5xl">
                  Cotação de materiais{" "}
                  <span className="text-[rgb(var(--primary-500))]">sem esforço</span>
                </h1>
                <p className="text-base leading-relaxed text-slate-500 dark:text-neutral-400 max-w-md">
                  Automatize a pesquisa de preços de materiais de construção.
                  Compare dezenas de fornecedores em segundos e tome decisões
                  baseadas em dados reais.
                </p>
              </div>

              {/* Feature chips */}
              <div className="flex flex-col gap-3">
                {features.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "rgb(var(--primary-500) / 0.10)" }}
                    >
                      <Icon className="h-4 w-4 text-[rgb(var(--primary-500))]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: login form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="order-1 lg:order-2"
            >
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-7 shadow-xl shadow-slate-200/60 dark:shadow-black/40 border border-slate-200 dark:border-neutral-800">
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-neutral-100">
                    Acessar plataforma
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
                    Entre com suas credenciais
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-neutral-300">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-3 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-[rgb(var(--primary-500))] focus:bg-white dark:focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-500))]/20"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-neutral-300">
                      Senha
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-3 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-[rgb(var(--primary-500))] focus:bg-white dark:focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-500))]/20"
                      placeholder="********"
                      required
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400"
                    >
                      {error}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full rounded-xl bg-[rgb(var(--primary-500))] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[rgb(var(--primary-600))] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ boxShadow: "0 4px 16px rgb(var(--primary-500) / 0.25)" }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {loading ? "Entrando..." : "Entrar"}
                      {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                    </span>
                  </button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-500 dark:text-neutral-400">
                  Não tem uma conta?{" "}
                  <a href="/cadastro" className="font-medium text-[rgb(var(--primary-500))] hover:underline">
                    Criar plataforma grátis
                  </a>
                </p>

                <div className="mt-5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-[rgb(var(--primary-500))] flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-500 dark:text-neutral-400">
                      <p className="font-medium text-slate-600 dark:text-neutral-300 mb-0.5">
                        {isTenant ? "Modo demonstração (tenant)" : "Acesso super admin"}
                      </p>
                      <p>
                        {isTenant
                          ? "Use as credenciais pré-preenchidas para acessar."
                          : "Sem subdomínio detectado — login como super admin."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-5 text-center text-xs text-slate-400 dark:text-neutral-600">
                ConstruPrice &copy; 2025
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══ GLOBE SECTION ════════════════════════════════════════════════════ */}
      <GlobePriceScannerSection />

    </div>
  );
}
