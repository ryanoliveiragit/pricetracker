import type { SearchItemResult } from "../types/search";
import { formatPrice } from "../utils/materials";
import { TrendingDown, ExternalLink, ShoppingCart, CheckCircle2, Clock, Crown, Store } from "lucide-react";

interface ResultsTableProps {
  items: SearchItemResult[];
}

function availabilityLabel(value: string): string {
  if (value === "em_estoque") {
    return "Em estoque";
  }

  if (value === "por_encomenda") {
    return "Por encomenda";
  }

  return "Indisponível";
}

export default function ResultsTable({ items }: ResultsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
        Nenhum resultado encontrado com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => {
        const prices = item.offers.map((offer) => offer.price);
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const savings = maxPrice - minPrice;

        return (
          <article key={item.rawQuery} className="overflow-hidden rounded-2xl border border-[#2e2250] bg-[#191029] shadow-lg hover:border-brand-500/30 transition-all">
            <header className="border-b border-[#2e2250] bg-gradient-to-r from-brand-500/10 to-transparent p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{item.rawQuery}</h2>
                  {item.normalizedQuery ? (
                    <p className="mt-1 text-xs text-violet-300">Busca normalizada: {item.normalizedQuery}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs text-violet-400">Economia possível</p>
                  <p className="text-xl font-bold text-green-400">{formatPrice(savings > 0 ? savings : 0)}</p>
                </div>
              </div>
            </header>

            <div className="divide-y divide-[#2e2250]">
              {item.offers.map((offer) => {
                const isAvailable = offer.availability === "em_estoque";
                
                return (
                  <div 
                    key={`${item.rawQuery}-${offer.store}`} 
                    className={`p-6 hover:bg-[#120c20] transition-all duration-300 relative ${
                      offer.isBestPrice ? "bg-gradient-to-r from-yellow-500/10 via-green-500/5 to-transparent border-l-4 border-l-yellow-500 shadow-lg" : ""
                    }`}
                  >
                    {/* Coroa dourada para melhor preço */}
                    {offer.isBestPrice && (
                      <div className="absolute -top-3 left-6 z-20">
                        <div className="relative">
                          <div className="absolute inset-0 bg-yellow-500/30 blur-xl animate-pulse" />
                          <div className="relative flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 px-4 py-1.5 shadow-[0_8px_20px_rgba(245,158,11,0.4)] border-2 border-yellow-300">
                            <Crown className="h-4.5 w-4.5 text-yellow-950 fill-yellow-950" />
                            <span className="text-[11px] font-black text-yellow-950 uppercase tracking-widest">Em Destaque</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      {/* Logo e informações do fornecedor */}
                      <div className="flex items-start gap-4 flex-1">
                        {/* Logo do fornecedor */}
                        <div className="flex-shrink-0">
                          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border-2 border-[#2e2250] flex items-center justify-center overflow-hidden">
                            {offer.store ? (
                              <div className="flex flex-col items-center justify-center p-2">
                                <Store className="h-6 w-6 text-brand-400 mb-1" />
                                <span className="text-[8px] font-bold text-brand-300 text-center leading-tight">
                                  {offer.store.split(' ').slice(0, 2).join(' ')}
                                </span>
                              </div>
                            ) : (
                              <Store className="h-8 w-8 text-brand-400" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold text-white">{offer.store}</h3>
                          
                          {isAvailable ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Em Estoque
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/30">
                              <Clock className="h-3.5 w-3.5" />
                              Por Encomenda
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-violet-300 line-clamp-2">{offer.productName}</p>
                      </div>
                      </div>

                      {/* Preço e ações */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-violet-400 mb-1">Preço</p>
                          <div className="flex items-baseline gap-2">
                            {offer.isBestPrice && (
                              <Crown className="h-5 w-5 text-yellow-500 fill-yellow-500 animate-pulse" />
                            )}
                            <p className={`text-4xl font-black tracking-tight ${
                              offer.isBestPrice ? "text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-green-400" : "text-white"
                            }`}>
                              {formatPrice(offer.price, offer.currency)}
                            </p>
                          </div>
                          <p className="text-xs text-violet-400 mt-1">{offer.currency}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <a
                            href={offer.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#2e2250] bg-[#120c20] px-5 py-3 text-sm font-semibold text-violet-100 hover:bg-brand-500/20 hover:border-brand-500/50 transition-all hover:scale-105"
                            title="Ver produto"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Ver Produto
                          </a>
                          {offer.addToCartUrl ? (
                            <a
                              href={offer.addToCartUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:scale-105 shadow-xl ${
                                offer.isBestPrice 
                                  ? "bg-gradient-to-r from-yellow-500 to-green-500 hover:from-yellow-400 hover:to-green-400 shadow-yellow-500/50" 
                                  : "bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-600 hover:to-brand-500 shadow-brand-500/50"
                              }`}
                              title="Adicionar ao carrinho"
                            >
                              <ShoppingCart className="h-4 w-4" />
                              Adicionar
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}
