import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useCartStore } from "../store/cartStore";

const product = {
  id: "p1",
  name: "Cimento 50kg",
  price: 35.9,
  image: "https://img.test/cimento.jpg",
  url: "https://loja.test/cimento",
  store: "EstoqueAtacadista",
};

beforeEach(() => {
  act(() => useCartStore.getState().clearCart());
});

describe("cartStore — addItem", () => {
  it("adiciona produto ao carrinho", () => {
    act(() => useCartStore.getState().addItem(product));
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it("incrementa quantidade em duplicata", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().addItem(product);
    });
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("adiciona produtos distintos separadamente", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().addItem({ ...product, id: "p2", name: "Areia" });
    });
    expect(useCartStore.getState().items).toHaveLength(2);
  });
});

describe("cartStore — updateQuantity", () => {
  it("atualiza quantidade do item", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().updateQuantity("p1", 5);
    });
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("remove item quando quantidade é 0", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().updateQuantity("p1", 0);
    });
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("remove item quando quantidade é negativa", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().updateQuantity("p1", -1);
    });
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});

describe("cartStore — removeItem", () => {
  it("remove item por id", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().removeItem("p1");
    });
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("não lança ao remover id inexistente", () => {
    expect(() => act(() => useCartStore.getState().removeItem("nope"))).not.toThrow();
  });
});

describe("cartStore — getTotal / getTotalItems", () => {
  it("calcula total corretamente", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().updateQuantity("p1", 3);
    });
    expect(useCartStore.getState().getTotal()).toBeCloseTo(35.9 * 3);
  });

  it("getTotalItems soma quantidades", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().addItem({ ...product, id: "p2", name: "Areia" });
      useCartStore.getState().updateQuantity("p1", 2);
    });
    expect(useCartStore.getState().getTotalItems()).toBe(3);
  });

  it("retorna 0 para carrinho vazio", () => {
    expect(useCartStore.getState().getTotal()).toBe(0);
    expect(useCartStore.getState().getTotalItems()).toBe(0);
  });
});

describe("cartStore — clearCart", () => {
  it("limpa todos os itens", () => {
    act(() => {
      useCartStore.getState().addItem(product);
      useCartStore.getState().addItem({ ...product, id: "p2", name: "Areia" });
      useCartStore.getState().clearCart();
    });
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
