"use client";

import { motion } from "framer-motion";
import {
  Package, TrendingUp, BarChart3, ArrowRight, ArrowUpRight,
  Search, Store, ShoppingCart, Layers, Star,
} from "lucide-react";
import Link from "next/link";
import { useProductCatalog } from "../context/ProductCatalogContext";
import { useSuppliers } from "../context/SupplierContext";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function ModernDashboard() {
  const { products } = useProductCatalog();
  const { suppliers } = useSuppliers();
  const uniqueCategories = new Set(products.map((p) => p.category)).size;
  const uniqueBrands = new Set(products.map((p) => p.brand)).size;
  const activeSuppliers = suppliers.filter((s) => s.isActive).length;
  const productsWithImage = products.filter((p) => p.logo).length;

  const stats = [
    {
      label: "Total de Produtos",
      value: products.length,
      icon: Package,
      change: `${productsWithImage} com foto`,
      bg: "bg-emerald-50",
      iconBg: "bg-emerald-500",
      textColor: "text-emerald-700",
    },
    {
      label: "Categorias",
      value: uniqueCategories,
      icon: Layers,
      change: `${uniqueBrands} marcas`,
      bg: "bg-blue-50",
      iconBg: "bg-blue-500",
      textColor: "text-blue-700",
    },
    {
      label: "Fornecedores Ativos",
      value: activeSuppliers,
      icon: Store,
      change: `de ${suppliers.length} total`,
      bg: "bg-amber-50",
      iconBg: "bg-amber-500",
      textColor: "text-amber-700",
    },
    {
      label: "Cotacoes Realizadas",
      value: 47,
      icon: TrendingUp,
      change: "+18% este mes",
      bg: "bg-violet-50",
      iconBg: "bg-violet-500",
      textColor: "text-violet-700",
    },
  ];

  const quickActions = [
    {
      title: "Nova Busca de Precos",
      description: "Compare precos em todos os fornecedores automaticamente",
      href: "/search",
      icon: Search,
      gradient: "from-emerald-500 to-emerald-600",
    },
    {
      title: "Gerenciar Catalogo",
      description: "Adicione, edite ou importe produtos via CSV",
      href: "/products",
      icon: Package,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Ver Resultados",
      description: "Consulte as ultimas cotacoes e compare precos",
      href: "/results",
      icon: BarChart3,
      gradient: "from-violet-500 to-violet-600",
    },
  ];

  // Top categories by count
  const categoryCount: Record<string, number> = {};
  products.forEach((p) => {
    categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
  });
  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-slate-800 dark:text-neutral-100">
          Bom dia!
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
          Acompanhe seu catalogo e inicie novas cotacoes de precos
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={item}
              className="rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-card border border-slate-100 dark:border-neutral-800 transition-shadow hover:shadow-elevated"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-medium text-slate-400 dark:text-neutral-500">
                  {stat.change}
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-800 dark:text-neutral-100">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">{stat.label}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Actions + Categories */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-neutral-100 mb-4">
            Acoes Rapidas
          </h2>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-3"
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.div key={action.title} variants={item}>
                  <Link
                    href={action.href}
                    className="group block rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-card border border-slate-100 dark:border-neutral-800 transition-all hover:shadow-elevated hover:-translate-y-0.5"
                  >
                    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100 flex items-center gap-1.5">
                      {action.title}
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                      {action.description}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Top Categories */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-card border border-slate-100 dark:border-neutral-800"
        >
          <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100 mb-4">
            Top Categorias
          </h2>
          {topCategories.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-neutral-500">Nenhum produto cadastrado</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map(([cat, count], i) => {
                const pct = products.length > 0 ? Math.round((count / products.length) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-slate-700 dark:text-neutral-300">{cat}</span>
                      <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                        className={`h-full rounded-full ${
                          i === 0 ? 'bg-emerald-500' :
                          i === 1 ? 'bg-blue-500' :
                          i === 2 ? 'bg-amber-500' :
                          i === 3 ? 'bg-violet-500' :
                          'bg-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Suppliers Overview + Recent Products */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Suppliers */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-card border border-slate-100 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Fornecedores</h2>
            <Link href="/suppliers" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {suppliers.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-neutral-800/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.isActive ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-slate-200 dark:bg-neutral-700'}`}>
                    <Store className={`h-4 w-4 ${s.isActive ? 'text-emerald-600' : 'text-slate-400 dark:text-neutral-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">{s.name}</p>
                    <p className="text-xs text-slate-400 dark:text-neutral-500">{s.region ?? "BR"}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  s.isActive
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'
                }`}>
                  {s.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
            ))}
            {suppliers.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-neutral-500 text-center py-4">Nenhum fornecedor cadastrado</p>
            )}
          </div>
        </motion.div>

        {/* Recent Products */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-card border border-slate-100 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Produtos Recentes</h2>
            <Link href="/products" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {products.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-neutral-800/50 px-4 py-3">
                {p.logo ? (
                  <img src={p.logo} alt={p.name} className="h-9 w-9 rounded-lg object-contain border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-0.5" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 dark:bg-neutral-700">
                    <Package className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-neutral-300 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400 dark:text-neutral-500">{p.category} - {p.brand}</p>
                </div>
                <span className="inline-flex items-center rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-2 py-0.5 text-[11px] font-mono text-slate-500 dark:text-neutral-400">
                  {p.unit}
                </span>
              </div>
            ))}
            {products.length === 0 && (
              <div className="text-center py-8">
                <Package className="h-10 w-10 text-slate-300 dark:text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-neutral-500">Nenhum produto cadastrado</p>
                <Link href="/products" className="mt-2 inline-flex text-xs font-medium text-emerald-600 hover:text-emerald-700">
                  Cadastrar primeiro produto <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
