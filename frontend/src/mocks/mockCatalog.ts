import type { CatalogProduct } from "../types/catalog";

export const mockCatalog: CatalogProduct[] = [
  {
    id: "p-1",
    name: "Fita Isolante Imperial 20m",
    category: "Elétrica",
    brand: "Imperial",
    unit: "PCT/10",
    notes: "Pacote com 10 unidades",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-2",
    name: "Lâmpada LED 9W Branca",
    category: "Iluminação",
    brand: "Philips",
    unit: "un",
    notes: "Luz branca fria 6500K",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-3",
    name: "Veda Rosca 18mm",
    category: "Hidráulica",
    brand: "Tigre",
    unit: "un",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-4",
    name: "Ferro 3/8 (10mm) CA-50",
    category: "Estrutural",
    brand: "Gerdau",
    unit: "Barra 12m",
    notes: "Vergalhão para estrutura",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-5",
    name: "Rejunte Cinza Platina",
    category: "Acabamento",
    brand: "Quartzolit",
    unit: "Saco 1kg",
    notes: "Para ambientes internos e externos",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-6",
    name: "Cimento Portland CP-II 50kg",
    category: "Cimento",
    brand: "Votorantim",
    unit: "Saco 50kg",
    notes: "Uso geral em construções",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-7",
    name: "Areia Média Lavada",
    category: "Areia",
    brand: "Areia Fina",
    unit: "m³",
    notes: "Para reboco e assentamento",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-8",
    name: "Tijolo Cerâmico 6 Furos",
    category: "Tijolo",
    brand: "Cerâmica São João",
    unit: "Milheiro",
    notes: "9x14x19cm",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-9",
    name: "Tinta Acrílica Branca 18L",
    category: "Tinta",
    brand: "Suvinil",
    unit: "Lata 18L",
    notes: "Acabamento fosco premium",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-10",
    name: "Argamassa AC-II Cinza",
    category: "Argamassa",
    brand: "Votomassa",
    unit: "Saco 20kg",
    notes: "Para assentamento de cerâmica",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-11",
    name: "Piso Cerâmico 45x45cm",
    category: "Revestimento",
    brand: "Portobello",
    unit: "m²",
    notes: "Acabamento acetinado",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-12",
    name: "Telha Cerâmica Portuguesa",
    category: "Telha",
    brand: "Cerâmica Martins",
    unit: "Unidade",
    notes: "Rendimento: 16 telhas/m²",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-13",
    name: "Tubo PVC 100mm Esgoto",
    category: "Hidráulica",
    brand: "Tigre",
    unit: "Barra 6m",
    notes: "Linha Esgoto Predial",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-14",
    name: "Torneira Cromada 1/2",
    category: "Hidráulica",
    brand: "Deca",
    unit: "Unidade",
    notes: "Para pia de cozinha",
    createdAt: new Date().toISOString()
  },
  {
    id: "p-15",
    name: "Porta de Madeira 80x210cm",
    category: "Esquadria",
    brand: "Eucatex",
    unit: "Unidade",
    notes: "Modelo lisa pronta para pintura",
    createdAt: new Date().toISOString()
  }
];
