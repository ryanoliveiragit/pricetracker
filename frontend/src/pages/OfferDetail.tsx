"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft, ExternalLink, Package, Tag, Store,
  CheckCircle, Clock, AlertCircle, ShoppingCart, Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Offer } from "../types/search";

interface StoredOffer extends Offer {
  rawQuery: string;
}

export default function OfferDetail() {
  const router = useRouter();
  const [offer, setOffer] = useState<StoredOffer | null>(null);

  useEffect(() => {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem("construprice-selected-offer")
        : null;
    if (!raw) return;
    try {
      setOffer(JSON.parse(raw) as StoredOffer);
    } catch {
      /* ignore */
    }
  }, []);

  function handleUsarNoCadastro() {
    if (!offer) return;
    localStorage.setItem(
      "construprice-prefill-product",
      JSON.stringify({
        name: offer.productName.replace(/^✓\s*/, ""),
        brand: offer.brand ?? "",
        notes: offer.description ?? "",
        imageUrl: offer.imageUrl ?? "",
        sku: offer.sku ?? "",
      })
    );
    void router.push("/products");
  }

  if (!offer) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800">
            <AlertCircle className="h-8 w-8 text-neutral-500" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-neutral-100">
            Nenhuma oferta selecionada
          </h2>
          <p className="mb-6 text-sm text-neutral-400">
            Volte para os resultados e selecione uma oferta
          </p>
          <Link
            href="/results"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos Resultados
          </Link>
        </motion.div>
      </div>
    );
  }

  const isAvailable = offer.availability === "em_estoque";
  const cleanName = offer.productName.replace(/^✓\s*/, "");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm text-neutral-500"
      >
        <Link href="/results" className="flex items-center gap-1 hover:text-purple-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Resultados
        </Link>
        <span>/</span>
        <span className="text-neutral-300 line-clamp-1">{cleanName}</span>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Image column ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="sticky top-6 space-y-4">
            {/* Main image */}
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
              {offer.imageUrl ? (
                <img
                  src={offer.imageUrl}
                  alt={cleanName}
                  className="h-full w-full object-contain p-6"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-30">
                  <Package className="h-16 w-16 text-neutral-400" />
                  <span className="text-sm text-neutral-500">Sem imagem</span>
                </div>
              )}
            </div>

            {/* Query context */}
            {offer.rawQuery && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
                <p className="text-xs text-neutral-500 mb-1">Buscado como</p>
                <p className="text-sm font-medium text-purple-400">&quot;{offer.rawQuery}&quot;</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Info column ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="lg:col-span-3 space-y-5"
        >
          {/* Store + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5">
              <Store className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs font-medium text-neutral-300">{offer.store}</span>
            </div>
            {offer.sku && (
              <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5">
                <Tag className="h-3.5 w-3.5 text-neutral-500" />
                <span className="font-mono text-xs text-neutral-400">SKU {offer.sku}</span>
              </div>
            )}
            {offer.isBestPrice && (
              <span className="flex items-center gap-1 rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-300">
                <Star className="h-3.5 w-3.5 fill-purple-400 text-purple-400" />
                Melhor Preço
              </span>
            )}
          </div>

          {/* Name */}
          <div>
            <h1 className="text-2xl font-bold leading-snug text-neutral-100">
              {cleanName}
            </h1>
          </div>

          {/* Availability */}
          <div className="flex items-center gap-2">
            {isAvailable ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm font-semibold text-green-400">EM ESTOQUE</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-400">POR ENCOMENDA</span>
              </>
            )}
          </div>

          {/* Price block */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
            <p className="text-xs text-neutral-500 mb-1">Vendido por <span className="text-neutral-400">{offer.store}</span></p>
            <p className="text-4xl font-bold text-neutral-100">
              R$ {offer.price > 0 ? offer.price.toFixed(2) : "—"}
            </p>
            {offer.price === 0 && (
              <p className="mt-1 text-xs text-neutral-500">Consulte disponibilidade no site</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={offer.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-500 py-3 text-sm font-semibold text-white transition-all hover:bg-purple-400"
            >
              <ShoppingCart className="h-4 w-4" />
              Comprar na Loja Oficial
            </a>
            <button
              onClick={handleUsarNoCadastro}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 py-3 text-sm font-semibold text-neutral-200 transition-all hover:border-purple-500/50 hover:bg-neutral-700"
            >
              <Package className="h-4 w-4" />
              Usar no Cadastro
            </button>
          </div>

          <a
            href={offer.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-neutral-600 hover:text-purple-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{offer.productUrl}</span>
          </a>

          {/* Description */}
          {offer.description && offer.description !== offer.productName && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-1 w-4 rounded-full bg-purple-500" />
                <p className="text-sm font-semibold text-neutral-200">Descrição do Produto</p>
              </div>
              <p className="text-sm leading-relaxed text-neutral-400">
                {offer.description}
              </p>
            </div>
          )}

          {/* Specs grid */}
          {(offer.brand || offer.sku) && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-4 rounded-full bg-purple-500" />
                <p className="text-sm font-semibold text-neutral-200">Especificações</p>
              </div>
              <div className="divide-y divide-neutral-800">
                {offer.brand && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-neutral-500">Marca</span>
                    <span className="text-sm font-medium text-neutral-200">{offer.brand}</span>
                  </div>
                )}
                {offer.sku && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-neutral-500">Código / SKU</span>
                    <span className="font-mono text-sm text-neutral-200">{offer.sku}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-neutral-500">Fornecedor</span>
                  <span className="text-sm font-medium text-neutral-200">{offer.store}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-neutral-500">Disponibilidade</span>
                  <span className={`text-sm font-semibold ${isAvailable ? "text-green-400" : "text-yellow-400"}`}>
                    {isAvailable ? "Em estoque" : "Por encomenda"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-neutral-500">Moeda</span>
                  <span className="text-sm text-neutral-200">{offer.currency}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
