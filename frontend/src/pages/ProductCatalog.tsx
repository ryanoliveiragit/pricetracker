"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, Card, CardBody, CardHeader, Input, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from "@nextui-org/react";
import { useProductCatalog } from "../context/ProductCatalogContext";
import type { CatalogProduct, ProductInput } from "../types/catalog";

const EMPTY_FORM: ProductInput = {
  name: "",
  category: "",
  brand: "",
  unit: "",
  notes: ""
};

export default function ProductCatalog() {
  const { products, createProduct, updateProduct, removeProduct } = useProductCatalog();
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const title = useMemo(() => (editingId ? "Editar produto" : "Novo produto"), [editingId]);

  function fillForm(product: CatalogProduct): void {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      brand: product.brand,
      unit: product.unit,
      notes: product.notes ?? ""
    });
  }

  function clearForm(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (editingId) {
      updateProduct(editingId, form);
    } else {
      createProduct(form);
    }

    clearForm();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">CRUD de produtos</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Catálogo de Materiais</h1>
        <p className="mt-2 text-sm text-violet-200/80">Cadastre e gerencie produtos para seleção rápida na aba Buscar Produtos.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border border-[#2e2250] bg-[#191029] text-white">
          <CardHeader>
            <h2 className="text-sm font-semibold">{title}</h2>
          </CardHeader>
          <CardBody>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                value={form.name}
                onValueChange={(value) => setForm({ ...form, name: value })}
                placeholder="Nome do produto"
                variant="bordered"
                classNames={{ inputWrapper: "bg-[#120c20] border-[#2e2250]" }}
                isRequired
              />
              <Input
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
                placeholder="Categoria"
                variant="bordered"
                classNames={{ inputWrapper: "bg-[#120c20] border-[#2e2250]" }}
                isRequired
              />
              <Input
                value={form.brand}
                onValueChange={(value) => setForm({ ...form, brand: value })}
                placeholder="Marca"
                variant="bordered"
                classNames={{ inputWrapper: "bg-[#120c20] border-[#2e2250]" }}
                isRequired
              />
              <Input
                value={form.unit}
                onValueChange={(value) => setForm({ ...form, unit: value })}
                placeholder="Unidade (un, pct, barra...)"
                variant="bordered"
                classNames={{ inputWrapper: "bg-[#120c20] border-[#2e2250]" }}
                isRequired
              />
              <Textarea
                value={form.notes ?? ""}
                onValueChange={(value) => setForm({ ...form, notes: value })}
                placeholder="Observações"
                variant="bordered"
                classNames={{ inputWrapper: "bg-[#120c20] border-[#2e2250]" }}
              />

              <div className="flex gap-2">
                <Button type="submit" className="bg-brand-700 font-semibold text-white">
                  {editingId ? "Salvar" : "Adicionar"}
                </Button>
                {editingId ? (
                  <Button type="button" variant="bordered" className="border-violet-400/40 text-violet-100" onPress={clearForm}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="border border-[#2e2250] bg-[#191029] text-white">
          <CardHeader>
            <h2 className="text-sm font-semibold">Lista de produtos</h2>
          </CardHeader>
          <CardBody>
            <Table
              removeWrapper
              aria-label="Tabela de produtos"
              classNames={{
                th: "bg-[#120c20] text-violet-200",
                td: "text-violet-100",
                tr: "border-b border-[#2e2250]"
              }}
            >
              <TableHeader>
                <TableColumn>Produto</TableColumn>
                <TableColumn>Categoria</TableColumn>
                <TableColumn>Ações</TableColumn>
              </TableHeader>
              <TableBody items={products}>
                {(product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-xs text-violet-300">{product.brand} - {product.unit}</p>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="flat" className="bg-brand-500/30 text-brand-100" onPress={() => fillForm(product)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="flat" className="bg-red-500/20 text-red-100" onPress={() => removeProduct(product.id)}>
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
