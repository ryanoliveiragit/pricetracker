import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  url: string;
  store: string;
  quantity: number;
}

interface CartState {
  items: CartProduct[];
  addItem: (product: Omit<CartProduct, "quantity">) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  getTotal: () => number;
  getTotalItems: () => number;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...product, quantity: 1 }] };
        }),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      getTotalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      clearCart: () => set({ items: [] }),
    }),
    { name: "pricetracker-cart" }
  )
);
