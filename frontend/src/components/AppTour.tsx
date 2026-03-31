"use client";

import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "../styles/tour.css"; // Custom Brutalist Theme
import { useRouter, usePathname } from "next/navigation";

const TOUR_STORAGE_KEY = "construprice-tour-state";

export default function AppTour() {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    // Resume tour after navigation
    const savedState = localStorage.getItem(TOUR_STORAGE_KEY);
    if (savedState) {
      const { stepIndex, active } = JSON.parse(savedState);
      if (active) {
        // Delay to allow page rendering
        setTimeout(() => {
          startTour(stepIndex);
        }, 500);
      }
    }
  }, [pathname]);

  const startTour = (startIndex = 0) => {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify({ stepIndex: startIndex, active: true }));

    const driverObj = driver({
      showProgress: true,
      animate: true,
      nextBtnText: "Próximo →",
      prevBtnText: "← Anterior",
      doneBtnText: "Finalizar 🎉",
      popoverClass: "driverjs-construprice",
      onNextClick: (element, step, { driver }) => {
        const index = driver.getActiveIndex() ?? 0;
        // Save state before moving
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify({ stepIndex: index + 1, active: true }));
        
        // Navigation Logic
        if (index === 0 && pathname !== "/results") {
          router.push("/results");
          driver.destroy();
          return;
        }
        
        driver.moveNext();
      },
      onDestroyed: () => {
        // If it was the last step, clear state
        // Otherwise, it might have been destroyed for navigation
      },
      onCloseClick: () => {
        localStorage.removeItem(TOUR_STORAGE_KEY);
        driverObj.destroy();
      },
      steps: [
        { 
          element: "#tour-search-bar", 
          popover: { 
            title: "Busca Inteligente", 
            description: "Aqui começa sua economia. Digite o material e o sistema buscará variantes em todos os fornecedores cadastrados.", 
            side: "bottom", 
            align: "start" 
          } 
        },
        // --- Results Page Steps ---
        { 
          element: "#tour-results-filters", 
          popover: { 
            title: "Filtros Avançados", 
            description: "Refine sua busca por marcas, lojas, unidades de medida e faixa de preço em tempo real.", 
            side: "right", 
            align: "start" 
          } 
        },
        { 
          element: "#tour-results-stats", 
          popover: { 
            title: "Resumo de Economia", 
            description: "Veja o total de ofertas encontradas e o melhor preço disponível no momento.", 
            side: "bottom", 
            align: "start" 
          } 
        },
        { 
          element: "#tour-results-toolbar", 
          popover: { 
            title: "Visualização e Ordem", 
            description: "Alterne entre modo grade ou lista e ordene os resultados pelo menor preço automaticamente.", 
            side: "bottom", 
            align: "end" 
          } 
        },
        { 
          element: "#tour-results-grid", 
          popover: { 
            title: "Grid de Ofertas", 
            description: "Confira cada oferta detalhadamente. Você pode salvar os favoritos clicando no ícone de coração verde.", 
            side: "top", 
            align: "center" 
          } 
        },
        // --- Global Navigation ---
        { 
          element: "#tour-nav-saves", 
          popover: { 
            title: "Favoritos Salvos", 
            description: "Todos os seus itens favoritados estão centralizados aqui para facilitar a compra futura.", 
            side: "right", 
            align: "start" 
          } 
        },
        { 
          element: "#tour-nav-settings", 
          popover: { 
            title: "Personalização", 
            description: "Ajuste o layout e as cores da plataforma para o seu estilo de trabalho.", 
            side: "right", 
            align: "start" 
          } 
        },
        {
          element: "#tour-help-button",
          popover: {
            title: "Tour Concluído!",
            description: "Parabéns! Você já sabe o básico. Clique aqui sempre que quiser rever este guia.", 
            side: "bottom", 
            align: "end" 
          },
          onDeselected: () => {
            localStorage.removeItem(TOUR_STORAGE_KEY);
          }
        }
      ]
    });

    driverRef.current = driverObj;
    driverObj.drive(startIndex);
  };

  useEffect(() => {
    const handleStartTour = () => startTour(0);
    window.addEventListener("start-app-tour", handleStartTour);
    return () => window.removeEventListener("start-app-tour", handleStartTour);
  }, [pathname]);

  return null;
}
