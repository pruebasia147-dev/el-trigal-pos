
import { AppSettings, Client, Product, Sale } from "./types";

export const INITIAL_SETTINGS: AppSettings = {
  exchangeRate: 46.0,
  businessName: "Panadería - Distribuidor Mayorista",
  rif: "",
  address: "",
  phone: ""
};

export const INITIAL_PRODUCTS: Product[] = [
  // Pan Salado
  { 
    id: '1', 
    name: 'Pan Francés', 
    priceRetail: 1.00, 
    priceWholesale: 1.00, 
    cost: 0.10, 
    stock: 600, 
    category: 'Panadería Salada',
    image: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '2', 
    name: 'Pan Canilla', 
    priceRetail: 1.00, 
    priceWholesale: 1.00, 
    cost: 0.20, 
    stock: 400, 
    category: 'Panadería Salada',
    image: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '3', 
    name: 'Pan Campesino', 
    priceRetail: 1.00, 
    priceWholesale: 1.00, 
    cost: 0.50, 
    stock: 100, 
    category: 'Panadería Salada',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '4', 
    name: 'Pan Sobado', 
    priceRetail: 1.00, 
    priceWholesale: 0.75, 
    cost: 0.40, 
    stock: 120, 
    category: 'Panadería Salada',
    image: 'https://images.unsplash.com/photo-1623334044303-241021148842?auto=format&fit=crop&q=80&w=400' 
  },
  
  // Pan Dulce / Rellenos
  { 
    id: '5', 
    name: 'Pan de Guayaba', 
    priceRetail: 1.50, 
    priceWholesale: 1.50, 
    cost: 0.70, 
    stock: 80, 
    category: 'Panadería Dulce',
    image: 'https://images.unsplash.com/photo-1598346762291-aee88549193f?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '6', 
    name: 'Pan de Queso', 
    priceRetail: 2.00, 
    priceWholesale: 1.60, 
    cost: 0.90, 
    stock: 60, 
    category: 'Panadería Dulce',
    image: 'https://images.unsplash.com/photo-1618625964097-9e0c157f9208?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '7', 
    name: 'Pan Dulce (Acemita)', 
    priceRetail: 0.80, 
    priceWholesale: 0.60, 
    cost: 0.30, 
    stock: 150, 
    category: 'Panadería Dulce',
    image: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '8', 
    name: 'Pan de Coco', 
    priceRetail: 1.50, 
    priceWholesale: 1.10, 
    cost: 0.60, 
    stock: 50, 
    category: 'Panadería Dulce',
    image: 'https://images.unsplash.com/photo-1579306194872-64d3b7bac4c2?auto=format&fit=crop&q=80&w=400' 
  },

  // Repostería / Otros
  { 
    id: '9', 
    name: 'Pasta seca', 
    priceRetail: 0.80, 
    priceWholesale: 0.80, 
    cost: 0.50, 
    stock: 30, 
    category: 'Repostería',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '10', 
    name: 'Galletas Polvorosas', 
    priceRetail: 2.50, 
    priceWholesale: 1.90, 
    cost: 1.00, 
    stock: 40, 
    category: 'Repostería',
    image: 'https://images.unsplash.com/photo-1499636138143-bd649043ea52?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '11', 
    name: 'Catalinas', 
    priceRetail: 0.60, 
    priceWholesale: 0.40, 
    cost: 0.20, 
    stock: 100, 
    category: 'Repostería',
    image: 'https://images.unsplash.com/photo-1616031036574-569d414c5140?auto=format&fit=crop&q=80&w=400' 
  },
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli_001',
    name: 'Lismay Rodríguez',
    businessName: 'Lismay Rodríguez',
    debt: 0, 
    creditLimit: 500,
    address: 'Ruta Distribución'
  },
  {
    id: 'cli_002',
    name: 'Leudis',
    businessName: 'Leudis',
    debt: 0,
    creditLimit: 300,
    address: 'Ruta Distribución'
  },
  {
    id: 'cli_003',
    name: 'Girasoles',
    businessName: 'Girasoles',
    debt: 0,
    creditLimit: 500,
    address: 'Ruta Distribución'
  },
  {
    id: 'cli_004',
    name: 'Roselin',
    businessName: 'Roselin',
    debt: 0,
    creditLimit: 300,
    address: 'Ruta Distribución'
  },
  {
    id: 'cli_005',
    name: 'Leonard',
    businessName: 'Leonard',
    debt: 0,
    creditLimit: 300,
    address: 'Ruta Distribución'
  },
  {
    id: 'cli_006',
    name: 'Yannelys',
    businessName: 'Yannelys',
    debt: 0, 
    creditLimit: 500,
    address: 'Av. Rotaria, Local 4'
  },
  {
    id: 'cli_007',
    name: 'Albert',
    businessName: 'Albert',
    debt: 0, 
    creditLimit: 300,
    address: 'Barrio Obrero, Calle 10'
  },
  {
    id: 'cli_008',
    name: 'Lucia',
    businessName: 'Lucia',
    debt: 0,
    creditLimit: 300,
    address: 'Ruta Distribución'
  },
  {
    id: 'cli_009',
    name: 'Mariela',
    businessName: 'Mariela',
    debt: 0,
    creditLimit: 300,
    address: 'Ruta Distribución'
  }
];

export const INITIAL_SALES: Sale[] = [];
