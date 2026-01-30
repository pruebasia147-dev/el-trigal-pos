
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
    stock: 556, // Base 600 - 5 (Lismay) - 10 (Yannelys) - 29 (Albert)
    category: 'Panadería Salada',
    image: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '2', 
    name: 'Pan Canilla', 
    priceRetail: 1.00, 
    priceWholesale: 1.00, 
    cost: 0.20, 
    stock: 395, // Base 400 - 5 (Lismay)
    category: 'Panadería Salada',
    image: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    id: '3', 
    name: 'Pan Campesino', 
    priceRetail: 1.00, 
    priceWholesale: 1.00, 
    cost: 0.50, 
    stock: 36, // Base 100 - 13 (Lucia) - 51 (Mariela)
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
    stock: 67, // Base 80 - 1 (Lismay) - 8 (Albert) - 4 (Mariela)
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
    stock: 10, // Base 30 - 20 (Albert)
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
    debt: 11.50, 
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
    debt: 10.00, 
    creditLimit: 500,
    address: 'Av. Rotaria, Local 4'
  },
  {
    id: 'cli_007',
    name: 'Albert',
    businessName: 'Albert',
    debt: 57.00, // 41 + 16 (Pasta Seca)
    creditLimit: 300,
    address: 'Barrio Obrero, Calle 10'
  },
  {
    id: 'cli_008',
    name: 'Lucia',
    businessName: 'Lucia',
    debt: 13.00,
    creditLimit: 300,
    address: 'Ruta Distribución'
  },
  {
    id: 'cli_009',
    name: 'Mariela',
    businessName: 'Mariela',
    debt: 57.00,
    creditLimit: 300,
    address: 'Ruta Distribución'
  }
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 'X92-J4K',
    date: new Date().toISOString(),
    type: 'dispatch',
    clientId: 'cli_001',
    clientName: 'Lismay Rodríguez',
    sellerId: 'u1',
    totalAmount: 11.50,
    items: [
      {
        productId: '2',
        productName: 'Pan Canilla',
        quantity: 5,
        unitPrice: 1.00,
        subtotal: 5.00
      },
      {
        productId: '1',
        productName: 'Pan Francés',
        quantity: 5,
        unitPrice: 1.00,
        subtotal: 5.00
      },
      {
        productId: '5',
        productName: 'Pan de Guayaba',
        quantity: 1,
        unitPrice: 1.50,
        subtotal: 1.50
      }
    ]
  },
  {
    id: 'M23-P8L',
    date: new Date(Date.now() + 1000).toISOString(), 
    type: 'dispatch',
    clientId: 'cli_008',
    clientName: 'Lucia',
    sellerId: 'u1',
    totalAmount: 13.00,
    items: [
      {
        productId: '3',
        productName: 'Pan Campesino',
        quantity: 13,
        unitPrice: 1.00,
        subtotal: 13.00
      }
    ]
  },
  {
    id: 'B77-Q2W',
    date: new Date(Date.now() + 2000).toISOString(),
    type: 'dispatch',
    clientId: 'cli_006',
    clientName: 'Yannelys',
    sellerId: 'u1',
    totalAmount: 10.00,
    items: [
      {
        productId: '1',
        productName: 'Pan Francés',
        quantity: 10,
        unitPrice: 1.00,
        subtotal: 10.00
      }
    ]
  },
  {
    id: 'R44-Z9X',
    date: new Date(Date.now() + 3000).toISOString(),
    type: 'dispatch',
    clientId: 'cli_007',
    clientName: 'Albert',
    sellerId: 'u1',
    totalAmount: 57.00,
    items: [
      {
        productId: '1',
        productName: 'Pan Francés',
        quantity: 29,
        unitPrice: 1.00,
        subtotal: 29.00
      },
      {
        productId: '5',
        productName: 'Pan de Guayaba',
        quantity: 8,
        unitPrice: 1.50,
        subtotal: 12.00
      },
      {
        productId: '9',
        productName: 'Pasta seca',
        quantity: 20,
        unitPrice: 0.80,
        subtotal: 16.00
      }
    ]
  },
  {
    id: 'T88-X1Y',
    date: new Date(Date.now() + 4000).toISOString(),
    type: 'dispatch',
    clientId: 'cli_009',
    clientName: 'Mariela',
    sellerId: 'u1',
    totalAmount: 57.00,
    items: [
      {
        productId: '3',
        productName: 'Pan Campesino',
        quantity: 51,
        unitPrice: 1.00,
        subtotal: 51.00
      },
      {
        productId: '5',
        productName: 'Pan de Guayaba',
        quantity: 4,
        unitPrice: 1.50,
        subtotal: 6.00
      }
    ]
  }
];
