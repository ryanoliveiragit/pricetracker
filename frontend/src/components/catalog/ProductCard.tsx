"use client";

import { useState } from "react";
import { ShoppingCart, ExternalLink, Star, Check, Plus, Minus, Trash2, BarChart2, RefreshCw, BookmarkPlus, Bookmark } from "lucide-react";
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

function availabilityConfig(status: string) {
  if (status === "em_estoque")
    return { label: "Em estoque", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (status === "por_encomenda")
    return { label: "Por encomenda", dot: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" };
  return { label: "Indisponível", dot: "bg-red-400", text: "text-red-400 dark:text-red-400" };
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
  const avail = availabilityConfig(offer.availability);

  const imageUrl =
    offer.imageUrl && offer.imageUrl.startsWith("http")
      ? offer.imageUrl
      : "https://placehold.co/280x280/f8fafc/cbd5e1?text=.";

  function handleAddToCart() {
    addItem({ id: itemId, name: offer.productName, price: offer.price, image: imageUrl, url: offer.productUrl, store: offer.store });
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
        name: offer.productName, category: "", brand: offer.brand ?? "",
        unit: inferUnit(offer.productName), sku: offer.sku ?? "",
        logo: offer.imageUrl?.startsWith("http") ? offer.imageUrl : "", notes: "",
      });
      setRegistered(true);
      toast.success("Cadastrado no catálogo");
    } catch {
      toast.error("Erro ao cadastrar");
    }
  }

  async function handleUpdateProduct() {
    if (!matchedProduct) return;
    await updateProduct(matchedProduct.id, {
      name: matchedProduct.name, category: matchedProduct.category,
      brand: offer.brand || matchedProduct.brand, unit: matchedProduct.unit,
      sku: offer.sku || matchedProduct.sku || "",
      logo: offer.imageUrl?.startsWith("http") ? offer.imageUrl : (matchedProduct.logo || ""),
      notes: matchedProduct.notes || "",
    });
    toast.success("Cadastro atualizado");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className={cn(
        "group flex flex-col rounded-xl border bg-white dark:bg-neutral-900",
        "transition-all duration-200",
        "hover:shadow-md hover:-translate-y-px",
        offer.isBestPrice
          ? "border-amber-200 dark:border-amber-500/20 shadow-sm shadow-amber-100 dark:shadow-amber-500/5"
          : "border-slate-200 dark:border-neutral-800 shadow-sm"
      )}
    >
      {/* Image */}
      <div
        className="relative cursor-zoom-in overflow-hidden rounded-t-xl bg-slate-50 dark:bg-neutral-800"
        onClick={() => onImageClick([imageUrl], 0, offer.productName)}
      >
        <img
          src={imageUrl}
          alt={offer.productName}
          className="h-40 w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/280x160/f8fafc/cbd5e1?text=."; }}
        />
        {offer.isBestPrice && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white tracking-wide shadow-sm">
              <Star className="h-2.5 w-2.5 fill-white" />
              MELHOR PREÇO
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3.5 gap-2.5">
        {/* Name */}
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800 dark:text-neutral-100 min-h-[2.5rem]">
          {offer.productName}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-neutral-400">
            {offer.store}
          </span>
          {offer.brand && (
            <span className="rounded border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
              {offer.brand}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-neutral-800" />

        {/* Price + availability */}
        <div className="flex items-center justify-between">
          <div>
            <span className={cn("text-xl font-bold leading-none tabular-nums",
              offer.isBestPrice ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-neutral-50"
            )}>
              {offer.price > 0 ? formatBRL(offer.price) : <span className="text-sm font-normal text-slate-400">Consultar</span>}
            </span>
          </div>
          <div className={cn("flex items-center gap-1 text-[10px] font-medium", avail.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", avail.dot)} />
            {avail.label}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center justify-end gap-0.5">
          <button onClick={() => setAnalysisOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 dark:text-neutral-600 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-500 dark:hover:text-neutral-400"
            title="Analisar preço">
            <BarChart2 className="h-3.5 w-3.5" />
          </button>
          {matchedProduct && (
            <button onClick={handleUpdateProduct}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 dark:text-neutral-600 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-500 dark:hover:text-neutral-400"
              title={`Atualizar "${matchedProduct.name}"`}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={handleRegisterProduct} disabled={registered}
            className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition",
              registered ? "text-emerald-500 dark:text-emerald-400" : "text-slate-300 dark:text-neutral-600 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-500 dark:hover:text-neutral-400"
            )}
            title={registered ? "Cadastrado" : "Cadastrar no catálogo"}>
            {registered ? <Bookmark className="h-3.5 w-3.5 fill-current" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
          </button>
          <a href={offer.productUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 dark:text-neutral-600 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-500 dark:hover:text-neutral-400"
            title="Ver no site">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Cart */}
        {inCart && cartItem ? (
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10">
              <button onClick={() => updateQuantity(itemId, cartItem.quantity - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-l-lg text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{cartItem.quantity}</span>
              <button onClick={() => updateQuantity(itemId, cartItem.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-r-lg text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button onClick={() => { removeItem(itemId); toast("Removido"); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={handleAddToCart} disabled={offer.availability === "indisponivel"}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-all active:scale-[0.98]",
              justAdded
                ? "border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : offer.availability === "indisponivel"
                ? "bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 cursor-not-allowed"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            )}>
            {justAdded ? <><Check className="h-3.5 w-3.5" /> Adicionado</> : <><ShoppingCart className="h-3.5 w-3.5" /> Adicionar</>}
          </button>
        )}
      </div>

      <PriceAnalysisModal open={analysisOpen} onClose={() => setAnalysisOpen(false)}
        productName={offer.productName} currentPrice={offer.price} store={offer.store} imageUrl={imageUrl} />
    </motion.div>
  );
}
