"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  ExternalLink,
  Filter,
  Grid3X3,
  LayoutList,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Tag,
  TrendingDown,
  X,
} from "lucide-react";
import {
  getCatalogFacets,
  getCatalogItems,
  getCatalogStatus,
  triggerCatalogScrape,
  type CatalogFacets,
  type CatalogItem,
  type CatalogStatus,
} from "../services/searchApi";
import { useTheme } from "../context/ThemeContext";

/* ─── TYPES ─── */
type SortOption = "newest" | "price_asc" | "price_desc" | "name_asc" | "score";
type ViewMode = "grid" | "list";

interface Filters {
  q: string;
  stores: string[];
  availability: string[];
  brands: string[];
  categories: string[];
  minPrice: string;
  maxPrice: string;
  sortBy: SortOption;
}

const EMPTY_FILTERS: Filters = {
  q: "", stores: [], availability: [], brands: [], categories: [],
  minPrice: "", maxPrice: "", sortBy: "newest",
};

const PAGE_SIZE = 60;

const AVAIL_LABELS: Record<string, string> = {
  em_estoque: "Em estoque",
  por_encomenda: "Sob encomenda",
  indisponivel: "Indisponível",
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Mais recentes",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  name_asc: "Nome A–Z",
  score: "Relevância",
};

function formatAge(minutes: number | null): string {
  if (minutes === null) return "–";
  if (minutes < 60) return `${minutes}min atrás`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `${h}h atrás` : `${Math.floor(h / 24)}d atrás`;
}

/* ─── TOKENS ─── */
function tokens(isDark: boolean) {
  return {
    "--bg0": isDark ? "#0c0c0e" : "#f0f0f3",
    "--bg1": isDark ? "#161618" : "#ffffff",
    "--bg2": isDark ? "#1e1e21" : "#f7f7fa",
    "--ln": isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
    "--ln2": isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    "--t0": isDark ? "rgba(255,255,255,0.92)" : "#111",
    "--t1": isDark ? "rgba(255,255,255,0.75)" : "#333",
    "--t2": isDark ? "rgba(255,255,255,0.50)" : "#666",
    "--t3": isDark ? "rgba(255,255,255,0.30)" : "#999",
    "--acc": "#fa5d19",
    "--acc-soft": "rgba(250,93,25,0.12)",
    "--ok": "#22c55e",
    "--warn": "#f59e0b",
    "--err": "#ef4444",
  } as React.CSSProperties;
}

/* ─── AVAILABILITY BADGE ─── */
function AvailBadge({ value }: { value: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    em_estoque:    { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", label: "Em estoque" },
    por_encomenda: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", label: "Encomenda" },
    indisponivel:  { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", label: "Indisponível" },
  };
  const c = config[value] ?? config.indisponivel;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: c.bg, color: c.color, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {c.label.toUpperCase()}
    </span>
  );
}

/* ─── CHECKBOX GROUP ─── */
function CheckGroup({
  title, items, selected, onToggle, searchable = false, maxVisible = 8,
}: {
  title: string;
  items: { name: string; count: number }[];
  selected: string[];
  onToggle: (v: string) => void;
  searchable?: boolean;
  maxVisible?: number;
}) {
  const [open, setOpen] = useState(true);
  const [localQ, setLocalQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = localQ
    ? items.filter(i => i.name.toLowerCase().includes(localQ.toLowerCase()))
    : items;
  const visible = showAll ? filtered : filtered.slice(0, maxVisible);
  const hiddenCount = filtered.length - maxVisible;

  return (
    <div style={{ borderBottom: "1px solid var(--ln)", paddingBottom: 10, marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "none", border: "none", padding: "4px 0 6px", cursor: "pointer", fontFamily: "inherit",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
          {selected.length > 0 && (
            <span style={{ marginLeft: 5, fontSize: 9, background: "var(--acc)", color: "#fff", borderRadius: 10, padding: "1px 5px" }}>{selected.length}</span>
          )}
        </span>
        {open ? <ChevronUp size={12} style={{ color: "var(--t3)" }} /> : <ChevronDown size={12} style={{ color: "var(--t3)" }} />}
      </button>

      {open && (
        <div>
          {searchable && items.length > 8 && (
            <div style={{ position: "relative", marginBottom: 6 }}>
              <Search size={10} style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }} />
              <input
                value={localQ}
                onChange={e => setLocalQ(e.target.value)}
                placeholder="Filtrar…"
                style={{
                  width: "100%", padding: "4px 8px 4px 22px", borderRadius: 6,
                  background: "var(--bg2)", border: "1px solid var(--ln)",
                  fontSize: 11, color: "var(--t1)", fontFamily: "inherit", outline: "none",
                }}
              />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {visible.map(item => (
              <label key={item.name} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", padding: "2px 0" }}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.name)}
                  onChange={() => onToggle(item.name)}
                  style={{ accentColor: "var(--acc)", width: 13, height: 13, flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 11, color: selected.includes(item.name) ? "var(--t0)" : "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </span>
                <span style={{ fontSize: 10, color: "var(--t3)", flexShrink: 0 }}>{item.count.toLocaleString("pt-BR")}</span>
              </label>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button onClick={() => setShowAll(v => !v)} style={{
              marginTop: 5, fontSize: 11, color: "var(--acc)", background: "none",
              border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0,
            }}>
              {showAll ? "Mostrar menos" : `+ ${hiddenCount} mais`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── PRICE RANGE ─── */
function PriceRange({
  min, max, valueMin, valueMax, onChange,
}: {
  min: number; max: number;
  valueMin: string; valueMax: string;
  onChange: (min: string, max: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "5px 8px", borderRadius: 6,
    background: "var(--bg2)", border: "1px solid var(--ln)",
    fontSize: 11, color: "var(--t1)", fontFamily: "inherit", outline: "none",
  };
  return (
    <div style={{ borderBottom: "1px solid var(--ln)", paddingBottom: 10, marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "none", border: "none", padding: "4px 0 6px", cursor: "pointer", fontFamily: "inherit",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Faixa de Preço
          {(valueMin || valueMax) && <span style={{ marginLeft: 5, fontSize: 9, background: "var(--acc)", color: "#fff", borderRadius: 10, padding: "1px 5px" }}>1</span>}
        </span>
        {open ? <ChevronUp size={12} style={{ color: "var(--t3)" }} /> : <ChevronDown size={12} style={{ color: "var(--t3)" }} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, color: "var(--t3)" }}>
            Intervalo: R$ {min.toFixed(0)} – R$ {max.toFixed(0)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3 }}>Mínimo</div>
              <input value={valueMin} onChange={e => onChange(e.target.value, valueMax)}
                placeholder={`R$ ${min.toFixed(0)}`} type="number" min={0} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3 }}>Máximo</div>
              <input value={valueMax} onChange={e => onChange(valueMin, e.target.value)}
                placeholder={`R$ ${max.toFixed(0)}`} type="number" min={0} style={inputStyle} />
            </div>
          </div>
          {(valueMin || valueMax) && (
            <button onClick={() => onChange("", "")} style={{ fontSize: 11, color: "var(--t3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>
              Limpar faixa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── STORE COLORS ─── */
const STORE_COLORS: Record<string, string> = {
  "EstoqueAtacadista": "#3b82f6",
  "Megaleste": "#8b5cf6",
  "Cofema": "#06b6d4",
  "SuperABC": "#10b981",
};
function storeColor(name: string) {
  return STORE_COLORS[name] ?? "#6b7280";
}

/* ─── PRODUCT CARD (grid) ─── */
function ProductCard({ item, bestPrice }: { item: CatalogItem; bestPrice?: number }) {
  const [hovered, setHovered] = useState(false);
  const isBest = bestPrice !== undefined && item.price === bestPrice && item.price > 0;

  const availConfig: Record<string, { dot: string; label: string }> = {
    em_estoque:    { dot: "#22c55e", label: "Em estoque" },
    por_encomenda: { dot: "#f59e0b", label: "Encomenda" },
    indisponivel:  { dot: "#ef4444", label: "Indisponível" },
  };
  const avail = availConfig[item.availability] ?? availConfig.indisponivel;
  const sc = storeColor(item.store);

  return (
    <a
      href={item.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--bg1)",
        border: `1px solid ${isBest ? "var(--acc)" : hovered ? "var(--ln2)" : "var(--ln)"}`,
        borderRadius: 12, overflow: "hidden",
        textDecoration: "none", color: "inherit", position: "relative",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 12px 32px rgba(0,0,0,0.25)"
          : isBest
          ? "0 0 0 1px rgba(250,93,25,0.25), 0 4px 16px rgba(250,93,25,0.1)"
          : "0 1px 3px rgba(0,0,0,0.08)",
        transition: "border-color 200ms, transform 200ms, box-shadow 200ms",
      }}
    >
      {/* Top accent line for best price */}
      {isBest && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #fa5d19, #ff9d6a)", zIndex: 3 }} />
      )}

      {/* Floating badges */}
      {isBest && (
        <div style={{ position: "absolute", top: 10, left: 8, zIndex: 3, pointerEvents: "none", display: "flex", alignItems: "center", gap: 3, fontSize: 8, fontWeight: 800, letterSpacing: "0.07em", background: "#fa5d19", color: "#fff", padding: "3px 7px", borderRadius: 6, boxShadow: "0 2px 10px rgba(250,93,25,0.5)" }}>
          <TrendingDown size={8} /> MENOR PREÇO
        </div>
      )}

      {/* ── IMAGE AREA ── */}
      <div style={{
        height: 148, flexShrink: 0, position: "relative", overflow: "hidden",
        background: "#ffffff",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>

        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.productName}
            style={{
              maxWidth: "85%", maxHeight: "85%", objectFit: "contain",
              transform: hovered ? "scale(1.08)" : "scale(1)",
              transition: "transform 280ms cubic-bezier(0.34,1.56,0.64,1)",
              position: "relative", zIndex: 1,
            }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: sc, opacity: 0.15, position: "absolute" }} />
            <Box size={28} style={{ color: sc, opacity: 0.5 }} />
            <span style={{ fontSize: 10, color: "#888", fontWeight: 600, letterSpacing: "0.05em" }}>{item.store}</span>
          </div>
        )}

        {/* Hover CTA */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          background: "rgba(10,10,12,0.62)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0, transition: "opacity 200ms",
          backdropFilter: "blur(3px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: "#111", padding: "7px 16px", borderRadius: 24, fontSize: 12, fontWeight: 700, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
            Ver produto <ExternalLink size={12} />
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "11px 12px 13px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>

        {/* Store chip + category */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: `${sc}18`, border: `1px solid ${sc}30`, padding: "1px 7px", borderRadius: 20 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: sc, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: sc, fontWeight: 700 }}>{item.store}</span>
          </div>
          <span style={{ fontSize: 9, color: "var(--t3)" }}>·</span>
          <span style={{ fontSize: 9, color: "var(--acc)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
            {item.sourceQuery}
          </span>
        </div>

        {/* Product name */}
        <div style={{
          fontSize: 12, fontWeight: 600, color: "var(--t0)", lineHeight: 1.45,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", minHeight: 35,
        }}>
          {item.productName}
        </div>

        {/* Brand */}
        {item.brand && (
          <div style={{ fontSize: 10, color: "var(--t3)", fontStyle: "italic", marginTop: -2 }}>
            {item.brand}
          </div>
        )}

        {/* Separator */}
        <div style={{ height: 1, background: "var(--ln)" }} />

        {/* Price row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1, marginBottom: 2 }}>R$</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: isBest ? "#fa5d19" : "var(--t0)", lineHeight: 1 }}>
              {item.price.toFixed(2)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: avail.dot, boxShadow: `0 0 5px ${avail.dot}` }} />
              <span style={{ fontSize: 9, color: "var(--t2)" }}>{avail.label}</span>
            </div>
            {isBest && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#22c55e", fontWeight: 700 }}>
                <Star size={9} fill="currentColor" /> Melhor preço
              </div>
            )}
          </div>
        </div>

        {/* SKU */}
        {item.sku && (
          <div style={{ fontSize: 9, color: "var(--t3)" }}>SKU: {item.sku}</div>
        )}
      </div>
    </a>
  );
}

/* ─── PRODUCT ROW (list) ─── */
function ProductRow({ item, bestPrice, allBestPrice }: { item: CatalogItem; bestPrice?: number; allBestPrice?: number }) {
  const [hovered, setHovered] = useState(false);
  const isBest = bestPrice !== undefined && item.price === bestPrice && item.price > 0;
  const priceDelta = (allBestPrice && allBestPrice > 0 && !isBest && item.price > 0)
    ? ((item.price - allBestPrice) / allBestPrice * 100)
    : null;

  const sc = storeColor(item.store);
  const availConfig: Record<string, { dot: string; label: string }> = {
    em_estoque:    { dot: "#22c55e", label: "Em estoque" },
    por_encomenda: { dot: "#f59e0b", label: "Sob encomenda" },
    indisponivel:  { dot: "#ef4444", label: "Indisponível" },
  };
  const avail = availConfig[item.availability] ?? availConfig.indisponivel;

  return (
    <a
      href={item.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr auto 120px",
        gap: 14, padding: "12px 16px",
        background: hovered ? (isBest ? "rgba(250,93,25,0.08)" : "var(--bg2)") : (isBest ? "var(--acc-soft)" : "var(--bg1)"),
        border: `1px solid ${isBest ? "var(--acc)" : hovered ? "var(--ln2)" : "var(--ln)"}`,
        borderLeft: `3px solid ${isBest ? "var(--acc)" : sc}`,
        borderRadius: 10, textDecoration: "none", color: "inherit",
        alignItems: "center", transition: "all 150ms",
      }}
    >
      {/* Thumb */}
      <div style={{
        width: 64, height: 64, borderRadius: 8, overflow: "hidden", flexShrink: 0,
        background: "repeating-conic-gradient(#e8e8ea 0% 25%, #f2f2f5 0% 50%) 0 0 / 10px 10px",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${sc}30`, position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${sc}25 0%, transparent 70%)` }} />
        {item.imageUrl
          ? <img src={item.imageUrl} alt="" style={{ width: "85%", height: "85%", objectFit: "contain", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.15))", position: "relative", zIndex: 1 }} />
          : <Box size={22} style={{ color: sc, opacity: 0.4, position: "relative", zIndex: 1 }} />
        }
      </div>

      {/* Main info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, fontWeight: 700, background: "var(--acc-soft)", color: "var(--acc)", padding: "1px 6px", borderRadius: 4 }}>
            {item.sourceQuery}
          </span>
          {item.brand && <span style={{ fontSize: 10, color: "var(--t3)", fontStyle: "italic" }}>{item.brand}</span>}
          {isBest && (
            <span style={{ fontSize: 9, fontWeight: 700, background: "var(--acc)", color: "#fff", padding: "1px 6px", borderRadius: 4, display: "flex", alignItems: "center", gap: 3 }}>
              <TrendingDown size={8} /> MENOR PREÇO
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.productName}
        </div>
        {item.description && (
          <div style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.description}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc }} />
            <span style={{ fontSize: 10, color: "var(--t2)", fontWeight: 500 }}>{item.store}</span>
          </div>
          {item.sku && (
            <span style={{ fontSize: 10, color: "var(--t3)", background: "var(--bg2)", border: "1px solid var(--ln)", padding: "0 5px", borderRadius: 4 }}>
              SKU: {item.sku}
            </span>
          )}
          {item.scrapedAt && (
            <span style={{ fontSize: 9, color: "var(--t3)" }}>
              {new Date(item.scrapedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}
        </div>
      </div>

      {/* Availability */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: avail.dot, boxShadow: `0 0 6px ${avail.dot}88` }} />
        <span style={{ fontSize: 10, color: "var(--t2)", whiteSpace: "nowrap" }}>{avail.label}</span>
      </div>

      {/* Price block */}
      <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: isBest ? "var(--acc)" : "var(--t0)", lineHeight: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--t3)" }}>R$&nbsp;</span>
          {item.price.toFixed(2)}
        </div>
        {priceDelta !== null && (
          <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>+{priceDelta.toFixed(0)}% do menor</span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: hovered ? "var(--acc)" : "var(--t3)", transition: "color 150ms", display: "flex", alignItems: "center", gap: 3, fontWeight: 500 }}>
            Ver produto <ExternalLink size={10} />
          </span>
        </div>
      </div>
    </a>
  );
}

/* ─── ACTIVE FILTER CHIP ─── */
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 10px", background: "var(--acc-soft)", border: "1px solid var(--acc)", borderRadius: 20, fontSize: 11, color: "var(--acc)", whiteSpace: "nowrap" }}>
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--acc)" }}>
        <X size={10} />
      </button>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function CatalogView() {
  const { isDark } = useTheme();
  const t = tokens(isDark);

  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bestPrice = items.length > 0
    ? Math.min(...items.filter(i => i.price > 0).map(i => i.price))
    : undefined;

  const fetchAll = useCallback(async () => {
    const [s, f] = await Promise.all([getCatalogStatus(), getCatalogFacets()]);
    setStatus(s);
    setFacets(f);
  }, []);

  const fetchItems = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    try {
      const res = await getCatalogItems({
        q: f.q,
        stores: f.stores.join(","),
        availability: f.availability.join(","),
        brands: f.brands.join(","),
        categories: f.categories.join(","),
        minPrice: f.minPrice ? Number(f.minPrice) : undefined,
        maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
        sortBy: f.sortBy,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    void fetchItems(EMPTY_FILTERS, 1);
  }, [fetchAll, fetchItems]);

  // Debounce text search, immediate for other filters
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      void fetchItems(filters, 1);
    }, 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    void fetchItems(filters, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function toggle<K extends keyof Filters>(key: K, value: string) {
    setFilters(prev => {
      const arr = prev[key] as string[];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
    setPage(1);
  }

  function setF<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  async function handleTriggerScrape() {
    if (scraping) return;
    setScraping(true);
    try {
      await triggerCatalogScrape();
      setTimeout(() => void fetchAll(), 2500);
    } catch { /* ignore */ } finally {
      setScraping(false);
    }
  }

  const activeChips: { label: string; clear: () => void }[] = [
    ...filters.stores.map(s => ({ label: `Loja: ${s}`, clear: () => toggle("stores", s) })),
    ...filters.brands.map(b => ({ label: `Marca: ${b}`, clear: () => toggle("brands", b) })),
    ...filters.categories.map(c => ({ label: `Categoria: ${c}`, clear: () => toggle("categories", c) })),
    ...filters.availability.map(a => ({ label: AVAIL_LABELS[a] ?? a, clear: () => toggle("availability", a) })),
    ...(filters.minPrice ? [{ label: `Mín: R$ ${filters.minPrice}`, clear: () => setF("minPrice", "") }] : []),
    ...(filters.maxPrice ? [{ label: `Máx: R$ ${filters.maxPrice}`, clear: () => setF("maxPrice", "") }] : []),
  ];

  const hasFilter = filters.q || activeChips.length > 0;

  const SIDEBAR_W = sidebarOpen ? 240 : 0;

  return (
    <div style={{ ...t, minHeight: "100vh", background: "var(--bg0)", color: "var(--t0)", fontFamily: "'Inter', system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--ln2); border-radius: 4px; }

        /* ── Responsive ── */
        .catalog-topbar-stats { display: flex; gap: 6px; overflow-x: auto; }
        .catalog-topbar-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .catalog-layout { display: flex; min-height: calc(100vh - 52px); }
        .catalog-sidebar { width: 240px; flex-shrink: 0; border-right: 1px solid var(--ln); padding: 16px 14px; background: var(--bg1); overflow-y: auto; position: sticky; top: 52px; max-height: calc(100vh - 52px); }
        .catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 10px; }

        @media (max-width: 768px) {
          .catalog-topbar { flex-wrap: wrap; gap: 8px; height: auto !important; padding: 10px 14px !important; }
          .catalog-topbar-stats { max-width: 100%; flex: 1 1 100%; order: 2; }
          .catalog-topbar-actions { order: 1; width: 100%; justify-content: flex-end; }
          .catalog-sidebar { display: none; }
          .catalog-sidebar-open { display: block; position: fixed; inset: 0; z-index: 50; width: 280px; box-shadow: 4px 0 24px rgba(0,0,0,0.3); top: 0; max-height: 100vh; overflow-y: auto; }
          .catalog-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
          .catalog-main { padding: 12px 12px 32px !important; }
        }

        @media (max-width: 480px) {
          .catalog-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* Top bar */}
      <div className="catalog-topbar" style={{ borderBottom: "1px solid var(--ln)", background: "var(--bg1)", padding: "0 24px", display: "flex", alignItems: "center", gap: 12, height: 52, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Database size={16} style={{ color: "var(--acc)" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t0)" }}>Catálogo Local</span>
        </div>

        {/* Stats pills */}
        {status && (
          <div className="catalog-topbar-stats" style={{ marginLeft: 8 }}>
            <div style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "var(--acc-soft)", color: "var(--acc)", fontWeight: 600 }}>
              {status.totalProducts.toLocaleString("pt-BR")} produtos
            </div>
            {Object.entries(status.stores).map(([name, s]) => (
              <div key={name} style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "var(--bg2)", color: "var(--t2)", border: "1px solid var(--ln)" }}>
                {name}: {s.product_count.toLocaleString("pt-BR")} · {formatAge(s.age_minutes)}
              </div>
            ))}
            {status.isScraping && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "rgba(250,93,25,0.08)", color: "var(--acc)", border: "1px solid var(--acc-soft)" }}>
                <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> Scraping…
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* View + sort controls */}
        <div className="catalog-topbar-actions">
          <select
            value={filters.sortBy}
            onChange={e => setF("sortBy", e.target.value as SortOption)}
            style={{ background: "var(--bg2)", border: "1px solid var(--ln)", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "var(--t1)", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
          >
            {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <div style={{ display: "flex", background: "var(--bg2)", border: "1px solid var(--ln)", borderRadius: 7, overflow: "hidden" }}>
            {(["grid", "list"] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: "5px 9px", background: viewMode === mode ? "var(--acc)" : "transparent",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                color: viewMode === mode ? "#fff" : "var(--t3)", transition: "all 150ms",
              }}>
                {mode === "grid" ? <Grid3X3 size={13} /> : <LayoutList size={13} />}
              </button>
            ))}
          </div>

          <button onClick={() => setSidebarOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: sidebarOpen ? "var(--acc-soft)" : "var(--bg2)", border: `1px solid ${sidebarOpen ? "var(--acc)" : "var(--ln)"}`, fontSize: 11, color: sidebarOpen ? "var(--acc)" : "var(--t2)", cursor: "pointer", fontFamily: "inherit", transition: "all 150ms" }}>
            <SlidersHorizontal size={12} /> Filtros {activeChips.length > 0 && `(${activeChips.length})`}
          </button>

          <button onClick={() => void handleTriggerScrape()} disabled={scraping || (status?.isScraping ?? false)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, background: "var(--acc)", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: scraping || status?.isScraping ? "not-allowed" : "pointer", opacity: scraping || status?.isScraping ? 0.6 : 1, fontFamily: "inherit" }}>
            <RefreshCw size={11} style={{ animation: scraping || status?.isScraping ? "spin 1s linear infinite" : "none" }} />
            Atualizar
          </button>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 52px)" }}>
        {/* ── LEFT FILTER SIDEBAR ── */}
        {sidebarOpen && (
          <div style={{ width: SIDEBAR_W, flexShrink: 0, borderRight: "1px solid var(--ln)", padding: "16px 14px", background: "var(--bg1)", overflowY: "auto", position: "sticky", top: 52, maxHeight: "calc(100vh - 52px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <Filter size={12} style={{ color: "var(--t3)" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)" }}>FILTROS</span>
              {hasFilter && (
                <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} style={{ marginLeft: "auto", fontSize: 10, color: "var(--acc)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  Limpar todos
                </button>
              )}
            </div>

            {/* Search */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }} />
              <input
                value={filters.q}
                onChange={e => setF("q", e.target.value)}
                placeholder="Buscar por nome…"
                style={{ width: "100%", padding: "7px 28px 7px 26px", borderRadius: 7, background: "var(--bg2)", border: "1px solid var(--ln)", fontSize: 11, color: "var(--t0)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "var(--acc)"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "var(--ln)"; }}
              />
              {filters.q && (
                <button onClick={() => setF("q", "")} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--t3)" }}>
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Price range */}
            {facets && (facets.price_min > 0 || facets.price_max > 0) && (
              <PriceRange
                min={facets.price_min} max={facets.price_max}
                valueMin={filters.minPrice} valueMax={filters.maxPrice}
                onChange={(mn, mx) => { setF("minPrice", mn); setF("maxPrice", mx); }}
              />
            )}

            {/* Availability */}
            {facets && facets.availability.length > 0 && (
              <CheckGroup
                title="Disponibilidade"
                items={facets.availability.map(a => ({ name: a.name, count: a.count }))}
                selected={filters.availability}
                onToggle={v => toggle("availability", v)}
              />
            )}

            {/* Stores */}
            {facets && facets.stores.length > 0 && (
              <CheckGroup title="Lojas" items={facets.stores} selected={filters.stores} onToggle={v => toggle("stores", v)} />
            )}

            {/* Categories */}
            {facets && facets.categories.length > 0 && (
              <CheckGroup
                title="Categorias de busca"
                items={facets.categories}
                selected={filters.categories}
                onToggle={v => toggle("categories", v)}
                searchable maxVisible={10}
              />
            )}

            {/* Brands */}
            {facets && facets.brands.length > 0 && (
              <CheckGroup
                title="Marcas"
                items={facets.brands}
                selected={filters.brands}
                onToggle={v => toggle("brands", v)}
                searchable maxVisible={8}
              />
            )}
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, minWidth: 0, padding: "16px 20px 40px" }}>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {activeChips.map((chip, i) => <Chip key={i} label={chip.label} onRemove={chip.clear} />)}
              <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} style={{ fontSize: 11, color: "var(--t3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "3px 6px" }}>
                Limpar todos
              </button>
            </div>
          )}

          {/* Result count + page info */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--t2)" }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Loader2 size={12} style={{ animation: "spin 1s linear infinite", color: "var(--acc)" }} /> Buscando…</span>
              ) : (
                <span><strong style={{ color: "var(--t0)" }}>{total.toLocaleString("pt-BR")}</strong> produto{total !== 1 ? "s" : ""} {hasFilter ? "filtrado" : ""}s</span>
              )}
            </div>
            {totalPages > 1 && (
              <div style={{ fontSize: 11, color: "var(--t3)" }}>Página {page} de {totalPages}</div>
            )}
          </div>

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 220, gap: 10, color: "var(--t3)" }}>
              <Tag size={32} style={{ opacity: 0.25 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--t2)" }}>Nenhum produto encontrado</span>
              {!status?.totalProducts
                ? <span style={{ fontSize: 12 }}>Clique em "Atualizar" para popular o catálogo via scraping</span>
                : <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} style={{ fontSize: 12, color: "var(--acc)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Limpar filtros</button>
              }
            </div>
          )}

          {/* Grid */}
          {viewMode === "grid" && items.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10, opacity: loading ? 0.45 : 1, transition: "opacity 200ms" }}>
              {items.map((item) => (
                <ProductCard key={item.id} item={item} bestPrice={bestPrice} />
              ))}
            </div>
          )}

          {/* List */}
          {viewMode === "list" && items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: loading ? 0.45 : 1, transition: "opacity 200ms" }}>
              {items.map(item => <ProductRow key={item.id} item={item} bestPrice={bestPrice} allBestPrice={bestPrice} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 28 }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "5px 10px", borderRadius: 7, background: "var(--bg1)", border: "1px solid var(--ln)", fontSize: 11, color: "var(--t2)", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: "inherit" }}>«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 7, background: "var(--bg1)", border: "1px solid var(--ln)", fontSize: 11, color: "var(--t2)", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: "inherit" }}>
                <ChevronLeft size={12} /> Anterior
              </button>

              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const mid = Math.min(Math.max(page, 4), totalPages - 3);
                const p = totalPages <= 7 ? i + 1 : mid - 3 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)} style={{ width: 30, height: 30, borderRadius: 7, background: p === page ? "var(--acc)" : "var(--bg1)", border: `1px solid ${p === page ? "var(--acc)" : "var(--ln)"}`, fontSize: 12, color: p === page ? "#fff" : "var(--t2)", cursor: "pointer", fontFamily: "inherit", fontWeight: p === page ? 700 : 400 }}>{p}</button>
                );
              })}

              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 7, background: "var(--bg1)", border: "1px solid var(--ln)", fontSize: 11, color: "var(--t2)", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: "inherit" }}>
                Próxima <ChevronRight size={12} />
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "5px 10px", borderRadius: 7, background: "var(--bg1)", border: "1px solid var(--ln)", fontSize: 11, color: "var(--t2)", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: "inherit" }}>»</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
