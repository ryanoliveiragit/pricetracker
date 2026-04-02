"use client";

import { useState } from "react";
import { ShoppingCart, ExternalLink, Star, Check, Plus, Minus, Trash2, BarChart2, RefreshCw, BookmarkPlus, Heart, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { Offer } from "@/types/search";
import { useCartStore } from "@/store/cartStore";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { PriceAnalysisModal } from "./PriceAnalysisModal";
import { cn } from "@/lib/utils";
import { useSavedOffers } from "@/context/SavedOffersContext";

interface ProductCardProps {
  offer: Offer;
  index?: number;
  onImageClick: (images: string[], index: number, name: string) => void;
  searchQuery?: string;
  onRemove?: () => void;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function availabilityConfig(status: string) {
  if (status === "em_estoque")
    return { label: "Em estoque", dot: "bg-lime-500", text: "text-lime-600 dark:text-lime-400" };
  if (status === "por_encomenda")
    return { label: "Por encomenda", dot: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" };
  return { label: "Indisponível", dot: "bg-red-400", text: "text-red-400 dark:text-red-400" };
}

export function ProductCard({ offer, index = 0, onImageClick, searchQuery, onRemove }: ProductCardProps) {
  const { products, updateProduct, createProduct } = useProductCatalog();
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const items = useCartStore((s) => s.items);
  const [justAdded, setJustAdded] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const { isSaved: checkIsSaved, toggleSave, pendingUrls } = useSavedOffers();
  const isSaved = checkIsSaved(offer.productUrl);
  const isSavePending = pendingUrls.has(offer.productUrl);

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

  async function handleRegisterProduct() {
    const productName = searchQuery?.trim()
      ? searchQuery.trim().charAt(0).toUpperCase() + searchQuery.trim().slice(1).toLowerCase()
      : offer.productName;
    setRegisterLoading(true);
    try {
      await createProduct({
        name: productName, category: "", brand: "",
        unit: "", sku: offer.sku ?? "",
        logo: offer.imageUrl?.startsWith("http") ? offer.imageUrl : "", notes: "",
      });
      setRegistered(true);
      toast.success("Cadastrado no catálogo");
    } catch {
      toast.error("Erro ao cadastrar");
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handleUpdateProduct() {
    if (!matchedProduct) return;
    await updateProduct(matchedProduct.id, {
      name: matchedProduct.name,
      category: matchedProduct.category,
      brand: offer.brand || matchedProduct.brand,
      unit: matchedProduct.unit,
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
          ? "border-lime-300 dark:border-lime-500/30 shadow-[0_0_15px_-3px_rgba(132,204,22,0.15)] dark:shadow-[0_0_15px_-3px_rgba(132,204,22,0.1)]"
          : "border-slate-200 dark:border-neutral-800 shadow-sm"
      )}
    >
      {/* Image */}
      <div
        className="relative cursor-zoom-in overflow-hidden rounded-t-xl bg-white dark:bg-white border-b border-slate-100 dark:border-neutral-200"
        onClick={() => onImageClick([imageUrl], 0, offer.productName)}
      >
        <img
          src={imageUrl}
          alt={offer.productName}
          className="h-40 w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/280x160/f8fafc/cbd5e1?text=."; }}
        />
        
        {/* Remove button (only in favorites page) */}
        {onRemove ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 border border-red-100 text-red-400 shadow-sm transition-all z-10 hover:bg-red-50 hover:text-red-600 hover:scale-110"
            title="Remover dos favoritos"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          /* Save Offer Button (Heart) */
          <button
            onClick={(e) => { e.stopPropagation(); toggleSave(offer); }}
            disabled={isSavePending}
            className={cn(
              "absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 border shadow-sm transition-all z-10",
              isSavePending
                ? "border-slate-200 text-slate-300 cursor-wait"
                : isSaved
                ? "border-[#84CC16]/20 text-[#84CC16]"
                : "border-slate-100 text-slate-400 hover:text-[#84CC16] hover:scale-110"
            )}
            title={isSaved ? "Remover dos favoritos" : "Salvar nos favoritos"}
          >
            {isSavePending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Heart className={cn("h-4 w-4", isSaved && "fill-[#84CC16]")} />}
          </button>
        )}

        {offer.isBestPrice && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 rounded-md bg-white/90 dark:bg-neutral-900/90 border border-lime-200 dark:border-lime-500/20 px-2.5 py-1 text-[10px] font-bold text-lime-600 dark:text-lime-400 tracking-wide shadow-sm backdrop-blur-sm">
              <Star className="h-3 w-3 fill-lime-500 text-lime-500" />
              MENOR PREÇO
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
              offer.isBestPrice ? "text-lime-600 dark:text-lime-400" : "text-slate-900 dark:text-neutral-50"
            )}>
              {offer.price > 0 ? formatBRL(offer.price) : <span className="text-sm font-normal text-slate-400">Consultar</span>}
            </span>
          </div>
          <div className={cn("flex items-center gap-1 text-[10px] font-medium", avail.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", avail.dot)} />
            {avail.label}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Salvar no catálogo — botão com texto */}
          <button
            onClick={registered || registerLoading ? undefined : handleRegisterProduct}
            disabled={registered || registerLoading}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all",
              registered
                ? "bg-lime-50 dark:bg-lime-500/10 text-lime-600 dark:text-lime-400 cursor-default"
                : registerLoading
                ? "border border-dashed border-slate-200 dark:border-neutral-700 text-slate-300 dark:text-neutral-600 cursor-wait"
                : "border border-dashed border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
            )}
          >
            {registered
              ? <><Check className="h-3 w-3" /> Salvo no catálogo</>
              : registerLoading
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</>
              : <><BookmarkPlus className="h-3 w-3" /> Salvar produto</>}
          </button>

          {/* Ações secundárias */}
          <div className="flex items-center gap-0.5">
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
            <a href={offer.productUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 dark:text-neutral-600 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-500 dark:hover:text-neutral-400"
              title="Ver no site">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Cart */}
        {inCart && cartItem ? (
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 items-center justify-between rounded-lg border border-lime-200 dark:border-lime-500/30 bg-lime-50 dark:bg-lime-500/10">
              <button onClick={() => updateQuantity(itemId, cartItem.quantity - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-l-lg text-lime-600 dark:text-lime-400 transition hover:bg-lime-100 dark:hover:bg-lime-500/20">
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-sm font-bold text-lime-700 dark:text-lime-400">{cartItem.quantity}</span>
              <button onClick={() => updateQuantity(itemId, cartItem.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-r-lg text-lime-600 dark:text-lime-400 transition hover:bg-lime-100 dark:hover:bg-lime-500/20">
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
                ? "border border-lime-200 dark:border-lime-500/30 bg-lime-50 dark:bg-lime-500/10 text-lime-700 dark:text-lime-400"
                : offer.availability === "indisponivel"
                ? "bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 cursor-not-allowed"
                : "bg-lime-500 text-white hover:bg-lime-600"
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
