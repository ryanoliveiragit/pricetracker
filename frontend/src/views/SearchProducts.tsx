"use client";

import { Button, Card, CardBody, CardHeader } from "@nextui-org/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProductCatalog } from "../context/ProductCatalogContext";

export default function SearchProducts() {
  const router = useRouter();
  const { products, loading } = useProductCatalog();
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const selectedItems = useMemo(
    () => products.filter((product) => selectedProductIds.includes(product.id)).map((product) => product.name),
    [selectedProductIds, products]
  );

  function handleSearch(): void {
    if (selectedItems.length === 0) {
      return;
    }

    localStorage.setItem("construprice-last-search-items", JSON.stringify(selectedItems));

    router.push("/results");
  }

  return (
    <main className="space-y-6">
      <header className="rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-500/20 to-transparent p-6 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Buscar Produtos</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Monte sua cotação por seleção</h1>
        <p className="mt-2 max-w-3xl text-sm text-violet-100/80">
          Neste fluxo, a lista é adicionada apenas via seleção do catálogo (sem digitação manual).
        </p>
      </header>

      <Card className="border border-[#2e2250] bg-[#120c20] text-white">
        <CardHeader>
          <h2 className="text-lg font-semibold">Selecionar itens para busca</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-violet-300">Selecione os produtos para buscar:</p>
            {loading ? (
              <p className="text-sm text-violet-400">Carregando produtos...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-violet-400">Nenhum produto cadastrado. Adicione produtos no Catálogo primeiro.</p>
            ) : (
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 p-2 rounded hover:bg-[#2e2250]/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductIds([...selectedProductIds, product.id]);
                        } else {
                          setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-white">{product.name}</span>
                    <span className="text-xs text-violet-400">({product.category})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-violet-200/80">Itens selecionados: {selectedItems.length} (máx. 20)</p>
            <Button
              color="secondary"
              className="bg-brand-700 text-white"
              isDisabled={selectedItems.length === 0}
              onPress={handleSearch}
            >
              Pesquisar preços
            </Button>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
