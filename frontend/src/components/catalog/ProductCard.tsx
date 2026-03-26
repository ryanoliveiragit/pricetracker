"use client";

import { useState } from "react";
import { ShoppingCart, ExternalLink, Star, Check, Plus, Minus, Trash2, BarChart2, RefreshCw, Store as StoreIcon, BookmarkPlus, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { Offer } from "@/types/search";
import { useCartStore } from "@/store/cartStore";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { PriceAnalysisModal } from "./PriceAnalysisModal";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  offer: Offer;
  index?: number;
  onImageClick: (images: string[], index: number, name: string) => void;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function availabilityBadge(status: string) {
  if (status === "em_estoque")
    return { label: "Em estoque", dot: "bg-emerald-500", cls: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" };
  if (status === "por_encomenda")
    return { label: "Por encomenda", dot: "bg-amber-400", cls: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" };
  return { label: "Indisponível", dot: "bg-slate-400", cls: "text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800" };
}

export function ProductCard({ offer, index = 0, onImageClick }: ProductCardProps) {
  const { products, updateProduct, createProduct } = useProductCatalog();
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const items = useCartStore((s) => s.items);
  const [justAdded, setJustAdded] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [registered, setRegistered] = useState(false);

  const itemId = `${offer.store}-${offer.sku ?? offer.productName}`;
  const cartItem = items.find((i) => i.id === itemId);
  const inCart = !!cartItem;
  const badge = availabilityBadge(offer.availability);

  const imageUrl =
    offer.imageUrl && offer.imageUrl.startsWith("http")
      ? offer.imageUrl
      : "https://placehold.co/280x280/f1f5f9/94a3b8?text=Sem+imagem";

  function handleAddToCart() {
    addItem({
      id: itemId,
      name: offer.productName,
      price: offer.price,
      image: imageUrl,
      url: offer.productUrl,
      store: offer.store,
    });
    toast.success("Adicionado ao carrinho");
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  const matchedProduct = products.find((p) => {
    const nameNorm = offer.productName.toLowerCase().replace(/^✓\s*/, "");
    return nameNorm.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(nameNorm.split(" ").slice(0, 3).join(" "));
  });

  function inferUnit(name: string): string {
    const n = name.toLowerCase();
    if (/\d+\s*kg/.test(n)) return "KG";
    if (/\d+\s*(l|lt|litro)/.test(n)) return "L";
    if (/\d+\s*ml/.test(n)) return "ML";
    if (/\d+\s*m²/.test(n)) return "M²";
    if (/\d+\s*m/.test(n)) return "M";
    if (/\b(cx|caixa)\b/.test(n)) return "CX";
    if (/\b(sc|saco)\b/.test(n)) return "SC";
    if (/\b(pc|peça|peca)\b/.test(n)) return "PC";
    return "UN";
  }

  async function handleRegisterProduct() {
    try {
      await createProduct({
        name: offer.productName,
        category: "",
        brand: offer.brand ?? "",
        unit: inferUnit(offer.productName),
        sku: offer.sku ?? "",
        logo: offer.imageUrl?.startsWith("http") ? offer.imageUrl : "",
        notes: "",
      });
      setRegistered(true);
      toast.success("Produto cadastrado no catálogo!");
    } catch {
      toast.error("Erro ao cadastrar produto");
    }
  }

  async function handleUpdateProduct() {
    if (!matchedProduct) {
      toast.error("Nenhum produto cadastrado corresponde a esta oferta");
      return;
    }
    await updateProduct(matchedProduct.id, {
      name: matchedProduct.name,
      category: matchedProduct.category,
      brand: offer.brand || matchedProduct.brand,
      unit: matchedProduct.unit,
      sku: offer.sku || matchedProduct.sku || "",
      logo: offer.imageUrl && offer.imageUrl.startsWith("http") ? offer.imageUrl : (matchedProduct.logo || ""),
      notes: matchedProduct.notes || "",
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        "group flex flex-col rounded-2xl border bg-white dark:bg-neutral-900 shadow-card",
        "border-slate-200 dark:border-neutral-800 transition-all duration-300",
        "hover:shadow-elevated hover:-translate-y-0.5",
        offer.isBestPrice && "ring-2 ring-emerald-500/30 border-emerald-200 dark:border-emerald-500/30"
      )}
    >
      {/* Image */}
      <div
        className="relative cursor-zoom-in overflow-hidden rounded-t-2xl bg-slate-50 dark:bg-neutral-800"
        onClick={() => onImageClick([imageUrl], 0, offer.productName)}
      >
        <img
          src={imageUrl}
          alt={offer.productName}
          className="h-44 w-full object-contain transition-transform duration-500 group-hover:scale-105 p-3"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://placehold.co/280x180/f1f5f9/94a3b8?text=Sem+imagem";
          }}
        />

        {offer.isBestPrice && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute left-2 top-2 z-10"
          >
            <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
              <Star className="h-2.5 w-2.5 fill-white" />
              Melhor preço
            </span>
          </motion.div>
        )}

        <div
          className={cn(
            "absolute right-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm",
            badge.cls
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", badge.dot)} />
          {badge.label}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1.5">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 dark:text-neutral-100">
            {offer.productName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-neutral-400">
              <StoreIcon className="h-2.5 w-2.5" />
              {offer.store}
            </span>
            {offer.brand && (
              <span className="rounded-md bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                {offer.brand}
              </span>
            )}
            {offer.sku && (
              <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">SKU: {offer.sku}</span>
            )}
          </div>
          {offer.description && (
            <p className="line-clamp-1 text-[11px] text-slate-400 dark:text-neutral-500 leading-relaxed">
              {offer.description}
            </p>
          )}
        </div>

        {/* Price + actions row */}
        <div className="flex items-end justify-between mt-auto">
          <div>
            <span
              className={cn(
                "text-xl font-bold leading-none",
                offer.isBestPrice ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-neutral-100"
              )}
            >
              {formatBRL(offer.price)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAnalysisOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-emerald-600 dark:hover:text-emerald-400"
              title="Analisar preço no mercado"
            >
              <BarChart2 className="h-3.5 w-3.5" />
            </button>
            {matchedProduct && (
              <button
                onClick={handleUpdateProduct}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-emerald-600 dark:hover:text-emerald-400"
                title={`Atualizar cadastro de "${matchedProduct.name}"`}
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={handleRegisterProduct}
              disabled={registered}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition",
                registered
                  ? "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                  : "text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-emerald-600 dark:hover:text-emerald-400"
              )}
              title={registered ? "Cadastrado no catálogo" : "Cadastrar no catálogo"}
            >
              {registered ? <Bookmark className="h-3.5 w-3.5 fill-current" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            </button>
            <a
              href={offer.productUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-emerald-600 dark:hover:text-emerald-400"
              title="Ver no site"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Cart button */}
        {inCart && cartItem ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10">
              <button
                onClick={() => updateQuantity(itemId, cartItem.quantity - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-l-xl text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[28px] text-center text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {cartItem.quantity}
              </span>
              <button
                onClick={() => updateQuantity(itemId, cartItem.quantity + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-r-xl text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => { removeItem(itemId); toast("Removido do carrinho"); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 transition hover:border-red-200 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={offer.availability === "indisponivel"}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
              justAdded
                ? "border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/15",
              "disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
            )}
          >
            {justAdded ? (
              <><Check className="h-4 w-4" /> Adicionado!</>
            ) : (
              <><ShoppingCart className="h-4 w-4" /> Adicionar ao carrinho</>
            )}
          </button>
        )}
      </div>

      <PriceAnalysisModal
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        productName={offer.productName}
        currentPrice={offer.price}
        store={offer.store}
        imageUrl={imageUrl}
      />
    </motion.div>
  );
}
