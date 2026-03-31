"use client";

import { motion } from "framer-motion";
import { Settings, Palette, Layout, Sparkles, Check, Sun, Moon, Sidebar, LayoutGrid, Minimize2, Maximize2, Menu } from "lucide-react";
import { useTheme, type ThemeColor, type LayoutStyle } from "../context/ThemeContext";

const THEME_COLORS = [
  { id: "purple" as ThemeColor, name: "Roxo", color: "from-purple-500 to-purple-600", rgb: "168 85 247" },
  { id: "blue" as ThemeColor, name: "Azul", color: "from-blue-500 to-blue-600", rgb: "59 130 246" },
  { id: "green" as ThemeColor, name: "Verde", color: "from-green-500 to-green-600", rgb: "34 197 94" },
  { id: "orange" as ThemeColor, name: "Laranja", color: "from-orange-500 to-orange-600", rgb: "249 115 22" },
  { id: "red" as ThemeColor, name: "Vermelho", color: "from-red-500 to-red-600", rgb: "239 68 68" }
];

const LAYOUTS = [
  { id: "sidebar" as LayoutStyle, name: "Sidebar", description: "Menu lateral colapsável", icon: Sidebar },
  { id: "topbar" as LayoutStyle, name: "Topbar", description: "Menu superior horizontal", icon: LayoutGrid },
  { id: "compact" as LayoutStyle, name: "Compacto", description: "Sidebar minimalista", icon: Minimize2 },
  { id: "wide" as LayoutStyle, name: "Amplo", description: "Layout espaçoso", icon: Maximize2 },
  { id: "minimal" as LayoutStyle, name: "Minimal", description: "Interface minimalista", icon: Menu }
];

export default function ModernSettings() {
  const { mode, color, layout, setMode, setColor, setLayout, toggleMode } = useTheme();

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-5 w-5 text-purple-400 dark:text-purple-400" />
          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Configurações</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Personalização
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Customize a aparência e o comportamento da aplicação
        </p>
      </motion.div>

      {/* Theme Mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <div className="mb-4 flex items-center gap-2">
          {mode === "dark" ? <Moon className="h-5 w-5 text-purple-400" /> : <Sun className="h-5 w-5 text-purple-600" />}
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Modo de Tema</h2>
        </div>

        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Escolha entre tema claro ou escuro
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setMode("light")}
            className={`relative rounded-lg border p-4 transition-all ${
              mode === "light"
                ? "border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-500/10"
                : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
                <Sun className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">Claro</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Tema light</p>
              </div>
              {mode === "light" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </button>

          <button
            onClick={() => setMode("dark")}
            className={`relative rounded-lg border p-4 transition-all ${
              mode === "dark"
                ? "border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-500/10"
                : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Moon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">Escuro</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Tema dark</p>
              </div>
              {mode === "dark" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </button>
        </div>
      </motion.div>

      {/* Theme Colors */}
      <motion.div
        id="tour-settings-colors"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Cor Principal</h2>
        </div>

        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Escolha a cor de destaque da interface
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_COLORS.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setColor(theme.id)}
              className={`relative rounded-lg border p-4 transition-all ${
                color === theme.id
                  ? "border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-500/10"
                  : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${theme.color} shadow-lg`} />
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{theme.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Tema {theme.name.toLowerCase()}</p>
                </div>
                {color === theme.id && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Layout Options */}
      <motion.div
        id="tour-settings-layouts"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <div className="mb-4 flex items-center gap-2">
          <Layout className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Estilo de Layout</h2>
        </div>

        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Escolha como a navegação é exibida
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LAYOUTS.map((layoutOption) => {
            const Icon = layoutOption.icon;
            return (
              <button
                key={layoutOption.id}
                onClick={() => setLayout(layoutOption.id)}
                className={`relative rounded-lg border p-4 transition-all ${
                  layout === layoutOption.id
                    ? "border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-500/10"
                    : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950/50 dark:hover:border-neutral-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                    layout === layoutOption.id
                      ? "bg-purple-500 text-white"
                      : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{layoutOption.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{layoutOption.description}</p>
                  </div>
                  {layout === layoutOption.id && (
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/50">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              <p className="font-medium text-neutral-900 dark:text-neutral-300 mb-1">Dica</p>
              <p>As alterações de layout são aplicadas imediatamente. Experimente diferentes estilos para encontrar o que melhor se adapta ao seu fluxo de trabalho!</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Sobre o Sistema
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">Versão</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">1.0.0 MVP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">Framework</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Next.js 14</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">UI Library</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Tailwind CSS + Framer Motion</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">Última Atualização</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">16/03/2026</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
