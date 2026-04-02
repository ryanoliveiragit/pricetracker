"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { savesApi, type SavedOffer, type SaveOfferPayload } from "@/services/savesApi";
import { toast } from "sonner";
import type { Offer } from "@/types/search";

interface SavedOffersContextValue {
  savedOffers: SavedOffer[];
  loading: boolean;
  pendingUrls: Set<string>;
  toggleSave: (offer: Offer) => Promise<void>;
  isSaved: (productUrl: string) => boolean;
  removeSave: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const SavedOffersContext = createContext<SavedOffersContextValue | undefined>(undefined);

export function SavedOffersProvider({ children }: { children: React.ReactNode }) {
  const [savedOffers, setSavedOffers] = useState<SavedOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingUrls, setPendingUrls] = useState<Set<string>>(new Set());

  const fetchSaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await savesApi.getAll();
      setSavedOffers(data);
    } catch (error) {
      console.error("Erro ao carregar ofertas salvas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSaves();
  }, [fetchSaves]);

  const isSaved = useCallback((productUrl: string) => {
    return savedOffers.some(o => o.product_url === productUrl);
  }, [savedOffers]);

  const toggleSave = async (offer: Offer) => {
    if (pendingUrls.has(offer.productUrl)) return;
    setPendingUrls(prev => new Set(prev).add(offer.productUrl));
    const existing = savedOffers.find(o => o.product_url === offer.productUrl);
    try {
      if (existing) {
        await savesApi.delete(existing.id);
        setSavedOffers(prev => prev.filter(o => o.id !== existing.id));
        toast.success("Oferta removida dos favoritos");
      } else {
        const payload: SaveOfferPayload = {
          store: offer.store,
          product_name: offer.productName,
          price: offer.price,
          currency: offer.currency,
          product_url: offer.productUrl,
          image_url: offer.imageUrl,
          availability: offer.availability,
          sku: offer.sku,
          brand: offer.brand
        };
        const newSave = await savesApi.save(payload);
        setSavedOffers(prev => [...prev, newSave]);
        toast.success("Oferta salva nos favoritos");
      }
    } catch (error: any) {
      toast.error(existing ? "Erro ao remover dos favoritos" : "Erro ao salvar oferta: " + (error.message || "Erro desconhecido"));
    } finally {
      setPendingUrls(prev => { const s = new Set(prev); s.delete(offer.productUrl); return s; });
    }
  };

  const removeSave = async (id: number) => {
    const offer = savedOffers.find(o => o.id === id);
    const url = offer?.product_url ?? String(id);
    if (pendingUrls.has(url)) return;
    setPendingUrls(prev => new Set(prev).add(url));
    try {
      await savesApi.delete(id);
      setSavedOffers(prev => prev.filter(o => o.id !== id));
      toast.success("Oferta removida");
    } catch (error) {
      toast.error("Erro ao remover");
    } finally {
      setPendingUrls(prev => { const s = new Set(prev); s.delete(url); return s; });
    }
  };

  return (
    <SavedOffersContext.Provider value={{
      savedOffers,
      loading,
      pendingUrls,
      toggleSave,
      isSaved,
      removeSave,
      refresh: fetchSaves
    }}>
      {children}
    </SavedOffersContext.Provider>
  );
}

export function useSavedOffers() {
  const context = useContext(SavedOffersContext);
  if (!context) {
    throw new Error("useSavedOffers deve ser usado dentro de SavedOffersProvider");
  }
  return context;
}
