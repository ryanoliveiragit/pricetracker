import { useMemo, useState } from "react";
import { Button, Chip, Select, SelectItem } from "@nextui-org/react";
import type { CatalogProduct } from "../types/catalog";

interface ProductPickerProps {
  products: CatalogProduct[];
  selectedProductIds: string[];
  onChange: (nextIds: string[]) => void;
}

export default function ProductPicker({ products, selectedProductIds, onChange }: ProductPickerProps) {
  const [currentId, setCurrentId] = useState<string>("");

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.includes(product.id)),
    [products, selectedProductIds]
  );

  function addCurrent(): void {
    if (!currentId) {
      return;
    }

    if (selectedProductIds.includes(currentId)) {
      setCurrentId("");
      return;
    }

    onChange([...selectedProductIds, currentId]);
    setCurrentId("");
  }

  function removeItem(id: string): void {
    onChange(selectedProductIds.filter((itemId) => itemId !== id));
  }

  return (
    <div className="rounded-2xl border border-[#2e2250] bg-[#191029] p-4">
      <label className="block text-sm font-medium text-violet-100">Selecionar produtos cadastrados</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Select
          selectedKeys={currentId ? [currentId] : []}
          placeholder="Escolha um produto do catálogo"
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            setCurrentId(selected ? String(selected) : "");
          }}
          className="w-full"
          classNames={{
            trigger: "bg-[#120c20] border border-[#2e2250] text-violet-100"
          }}
        >
          {products.map((product) => (
            <SelectItem key={product.id} textValue={product.name}>
              {product.name} - {product.brand}
            </SelectItem>
          ))}
        </Select>

        <Button color="secondary" onPress={addCurrent} className="bg-brand-700 text-white">
          Adicionar
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {selectedProducts.map((product) => (
          <Chip
            key={product.id}
            onClose={() => removeItem(product.id)}
            variant="flat"
            className="border border-brand-500/30 bg-brand-500/20 text-brand-100"
          >
            {product.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}
