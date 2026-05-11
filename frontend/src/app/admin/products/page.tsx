"use client";

import { useEffect, useState, useRef } from "react";
import { productsApi, type ApiProduct } from "../../../services/api";
import { getCatalogFacets, getCatalogStatus, getCatalogItems, type CatalogFacets, type CatalogStatus, type CatalogItemsResponse } from "../../../services/searchApi";
import { notify } from "../_toast";

export default function ProductsPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItemsResponse | null>(null);
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [p, f, cs, ci] = await Promise.allSettled([
          productsApi.getAll(),
          getCatalogFacets(),
          getCatalogStatus(),
          getCatalogItems({ limit: 20 }),
        ]);
        if (p.status === "fulfilled") setProducts(p.value);
        if (f.status === "fulfilled") setFacets(f.value);
        if (cs.status === "fulfilled") setCatalogStatus(cs.value);
        if (ci.status === "fulfilled") setCatalogItems(ci.value);
      } catch { notify("Erro ao carregar dados", "error"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const cats = facets?.categories.map(c => c.name) ?? [...new Set(products.map(p => p.category).filter(Boolean))];

  async function handleDelete(p: ApiProduct) {
    if (!confirm(`Remover "${p.name}" permanentemente?`)) return;
    try {
      await productsApi.delete(p.id);
      setProducts(prev => prev.filter(x => x.id !== p.id));
      notify("Produto removido");
    } catch { notify("Erro ao remover", "error"); }
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await productsApi.importCsv(file);
      notify(`${res.imported} importados, ${res.skipped} ignorados`);
      // Reload
      setProducts(await productsApi.getAll());
    } catch { notify("Erro ao importar CSV", "error"); }
    if (fileRef.current) fileRef.current.value = "";
  }

  const filteredProducts = products.filter(p => {
    if (cat !== "all" && p.category !== cat) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && !(p.sku || "").toLowerCase().includes(q.toLowerCase()) && !(p.brand || "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="pg">
      <div className="pg-head">
        <div><h1>Produtos</h1><p>Catálogo global · {catalogStatus?.totalProducts?.toLocaleString("pt-BR") || products.length} produtos indexados</p></div>
        <div className="pg-actions">
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleImportCsv} />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3v13M6 12l6 6 6-6M4 21h16"/></svg>
            Importar CSV
          </button>
          <button className="btn" onClick={() => notify("Exportação iniciada")}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3v13M6 12l6 6 6-6M4 21h16"/></svg>
            Exportar
          </button>
          <button className="btn btn-accent" onClick={() => notify("Novo produto — em breve")}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 5v14M5 12h14"/></svg>
            Novo
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label"><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg><span>Produtos totais</span></div>
          <div className="kpi-value mono">{catalogStatus?.totalProducts?.toLocaleString("pt-BR") ?? products.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><span>Categorias</span></div>
          <div className="kpi-value mono" style={{ color: "var(--info)" }}>{facets?.categories?.length || cats.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><span>Marcas</span></div>
          <div className="kpi-value mono" style={{ color: "var(--ok)" }}>{facets?.brands?.length || "—"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><span>{catalogStatus?.isScraping ? "Scraping em andamento" : "Último scrape"}</span></div>
          <div className="kpi-value mono" style={{ color: catalogStatus?.catalogAgeMinutes != null && catalogStatus.catalogAgeMinutes > 120 ? "var(--warn)" : "var(--text)", fontSize: 20 }}>
            {catalogStatus?.catalogAgeMinutes != null ? `${catalogStatus.catalogAgeMinutes} min` : "—"}
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="toolbar">
              <div className="inp" style={{ flex: 1, maxWidth: 320 }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.3-4.3"/></svg>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produto, SKU ou marca…" />
              </div>
              <select value={cat} onChange={e => setCat(e.target.value)} className="btn sm">
                <option value="all">Todas categorias</option>
                {cats.map(c => <option key={c}>{c}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 11.5 }}>{filteredProducts.length} produtos</span>
            </div>
            <div className="tbl-wrapper">
              <table className="tbl">
                <thead><tr><th>Produto</th><th>Categoria</th><th>Marca</th><th>SKU</th><th>Unidade</th><th /></tr></thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id}>
                      <td><div className="cell-meta"><b>{p.name}</b></div></td>
                      <td><span className="chip">{p.category}</span></td>
                      <td>{p.brand || "—"}</td>
                      <td className="mono muted" style={{ fontSize: 11.5 }}>{p.sku || "—"}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{p.unit || "—"}</td>
                      <td><div className="row" style={{ justifyContent: "flex-end", gap: 2 }}>
                        <button className="btn icon btn-ghost" title="Ver" onClick={() => notify(`Detalhes: ${p.name}`)}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M14 3h7v7M21 3l-9 9M19 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>
                        </button>
                        <button className="btn icon btn-ghost" title="Remover" onClick={() => handleDelete(p)}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div></td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={6}><div className="empty">Nenhum produto encontrado</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {catalogItems && (
              <>
                <div className="card-h" style={{ borderTop: "1px solid var(--line)" }}><h3>Itens do catálogo (scraped)</h3><span className="muted" style={{ fontSize: 11 }}>Últimos {catalogItems.items.length} de {catalogItems.total}</span></div>
                <div className="tbl-wrapper">
                  <table className="tbl">
                    <thead><tr><th>Produto</th><th>Loja</th><th>Preço</th><th>Disponibilidade</th></tr></thead>
                    <tbody>
                      {catalogItems.items.slice(0, 10).map(item => (
                        <tr key={item.id}>
                          <td><b>{item.productName}</b></td>
                          <td><span className="chip">{item.store}</span></td>
                          <td className="mono" style={{ fontWeight: 600 }}>{item.price.toLocaleString("pt-BR", { style: "currency", currency: item.currency || "BRL" })}</td>
                          <td><span className={`chip ${item.availability === "em_estoque" ? "ok" : item.availability === "indisponivel" ? "err" : "warn"}`}>{item.availability}</span></td>
                        </tr>
                      ))}
                      {catalogItems.items.length === 0 && <tr><td colSpan={4}><div className="empty">Catálogo vazio</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
