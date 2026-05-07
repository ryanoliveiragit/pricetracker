"use client";

import { motion } from "framer-motion";
import { ArrowRight, Package, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export default function ModernLogin() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("gestor@construprice.com");
  const [password, setPassword] = useState("123456");
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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 dark:bg-neutral-950">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full blur-[100px]"
          style={{ background: "rgb(var(--primary-500) / 0.08)" }} />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full blur-[100px]"
          style={{ background: "rgb(var(--primary-500) / 0.06)" }} />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Logo */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--primary-500))] shadow-lg shadow-[rgb(var(--primary-500))/0.20]"
            >
              <Package className="h-7 w-7 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-neutral-100">
              Bem-vindo ao ConstruPrice
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
              Faca login para acessar o painel
            </p>
          </div>

          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-white dark:bg-neutral-900 p-7 shadow-elevated border border-slate-200 dark:border-neutral-800"
          >
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
                  className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-3 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-[rgb(var(--primary-500))] focus:bg-white dark:focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-500))/0.20]"
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
                  className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-3 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-[rgb(var(--primary-500))] focus:bg-white dark:focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-500))/0.20]"
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
                className="group w-full rounded-xl bg-[rgb(var(--primary-500))] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[rgb(var(--primary-500))/0.20] transition-all hover:bg-[rgb(var(--primary-600))] hover:shadow-lg hover:shadow-[rgb(var(--primary-500))/0.25] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  {loading ? "Entrando..." : "Entrar"}
                  {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </span>
              </button>
            </form>

            {/* Demo notice */}
            <div className="mt-5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700 p-3.5">
              <div className="flex items-start gap-2.5">
                <Info className="h-4 w-4 text-[rgb(var(--primary-500))] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-500 dark:text-neutral-400">
                  <p className="font-medium text-slate-600 dark:text-neutral-300 mb-0.5">Modo demonstracao</p>
                  <p>Use as credenciais pre-preenchidas para acessar.</p>
                </div>
              </div>
            </div>
          </motion.div>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-neutral-500">
            ConstruPrice &copy; 2025
          </p>
        </motion.div>
      </div>
    </div>
  );
}
