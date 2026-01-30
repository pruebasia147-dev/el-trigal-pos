
import { INITIAL_CLIENTS, INITIAL_PRODUCTS, INITIAL_SALES, INITIAL_SETTINGS } from "../constants";
import { AppSettings, Client, Product, Sale, SaleItem, SuspendedSale } from "../types";

const DELAY = 300; // Simulate network latency

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class DBService {
  private get<T>(key: string, initial: T): T {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : initial;
  }

  private set(key: string, data: any) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Helper for ID generation: Creates short, random receipt-like codes (e.g., "K9X-2M1")
  private generateId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    result += '-';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  }

  // --- Init ---
  async init() {
    // Check if data exists, if not, initialize with constants.
    // We do NOT overwrite if data already exists to preserve user data across reloads.
    if (!localStorage.getItem('products')) this.set('products', INITIAL_PRODUCTS);
    if (!localStorage.getItem('clients')) this.set('clients', INITIAL_CLIENTS);
    if (!localStorage.getItem('sales')) this.set('sales', INITIAL_SALES);
    if (!localStorage.getItem('settings')) this.set('settings', INITIAL_SETTINGS);
    if (!localStorage.getItem('suspended_sales')) this.set('suspended_sales', []);
  }

  // --- BACKUP & RESTORE SYSTEM ---
  async getDatabaseDump(): Promise<string> {
      const dump = {
          products: this.get('products', []),
          clients: this.get('clients', []),
          sales: this.get('sales', []),
          settings: this.get('settings', INITIAL_SETTINGS),
          suspended_sales: this.get('suspended_sales', []),
          backupDate: new Date().toISOString()
      };
      return JSON.stringify(dump, null, 2);
  }

  async restoreDatabase(jsonString: string): Promise<boolean> {
      try {
          const data = JSON.parse(jsonString);
          
          // Basic validation
          if (!data.products || !data.sales) throw new Error("Archivo de respaldo inválido");

          this.set('products', data.products);
          this.set('clients', data.clients || []);
          this.set('sales', data.sales || []);
          this.set('settings', data.settings || INITIAL_SETTINGS);
          this.set('suspended_sales', data.suspended_sales || []);
          
          return true;
      } catch (e) {
          console.error("Restore failed", e);
          return false;
      }
  }

  // --- Products ---
  async getProducts(): Promise<Product[]> {
    await sleep(DELAY);
    return this.get<Product[]>('products', INITIAL_PRODUCTS);
  }

  async updateProduct(updatedProduct: Product): Promise<void> {
    await sleep(DELAY);
    const products = this.get<Product[]>('products', []);
    const index = products.findIndex(p => p.id === updatedProduct.id);
    if (index >= 0) {
      products[index] = updatedProduct;
    } else {
      products.push({ ...updatedProduct, id: this.generateId() });
    }
    this.set('products', products);
  }

  async deleteProduct(id: string): Promise<void> {
    const products = this.get<Product[]>('products', []);
    this.set('products', products.filter(p => p.id !== id));
  }

  // --- Clients ---
  async getClients(): Promise<Client[]> {
    await sleep(DELAY);
    return this.get<Client[]>('clients', INITIAL_CLIENTS);
  }

  async updateClient(updatedClient: Client): Promise<void> {
    await sleep(DELAY);
    const clients = this.get<Client[]>('clients', []);
    const index = clients.findIndex(c => c.id === updatedClient.id);
    if (index >= 0) {
      clients[index] = updatedClient;
    } else {
      clients.push({ ...updatedClient, id: this.generateId() });
    }
    this.set('clients', clients);
  }

  // New Method: Register Payment (Abono)
  async registerClientPayment(clientId: string, amount: number): Promise<void> {
    await sleep(DELAY);
    const clients = this.get<Client[]>('clients', []);
    const index = clients.findIndex(c => c.id === clientId);
    
    if (index === -1) throw new Error("Cliente no encontrado");

    // Reduce debt
    clients[index].debt = Math.max(0, clients[index].debt - amount);
    
    this.set('clients', clients);
  }

  // --- Settings ---
  getSettings(): AppSettings {
    return this.get<AppSettings>('settings', INITIAL_SETTINGS);
  }

  saveSettings(settings: AppSettings) {
    this.set('settings', settings);
  }

  // --- Suspended Sales (Pause/Resume) ---
  async getSuspendedSales(): Promise<SuspendedSale[]> {
      // No delay for this UI interaction usually
      return this.get<SuspendedSale[]>('suspended_sales', []);
  }

  async addSuspendedSale(sale: SuspendedSale): Promise<void> {
      const list = this.get<SuspendedSale[]>('suspended_sales', []);
      // Ensure the ID is unique if passed manually, or generate one
      const newSale = { ...sale, id: sale.id || this.generateId() };
      list.push(newSale);
      this.set('suspended_sales', list);
  }

  async removeSuspendedSale(id: string): Promise<void> {
      const list = this.get<SuspendedSale[]>('suspended_sales', []);
      this.set('suspended_sales', list.filter(s => s.id !== id));
  }

  // --- Sales & Transactions ---
  async getSales(): Promise<Sale[]> {
    await sleep(DELAY);
    return this.get<Sale[]>('sales', []);
  }

  // Update an existing sale (Admin Feature)
  async updateSale(updatedSale: Sale): Promise<void> {
      await sleep(DELAY);
      const sales = this.get<Sale[]>('sales', []);
      const index = sales.findIndex(s => s.id === updatedSale.id);
      
      if (index >= 0) {
          const oldSale = sales[index];
          
          // Basic Debt Adjustment Logic
          if (updatedSale.type === 'dispatch' && updatedSale.clientId) {
              const clients = this.get<Client[]>('clients', []);
              const clientIndex = clients.findIndex(c => c.id === updatedSale.clientId);
              if (clientIndex >= 0) {
                  const debtDiff = updatedSale.totalAmount - oldSale.totalAmount;
                  clients[clientIndex].debt += debtDiff;
                  this.set('clients', clients);
              }
          }

          sales[index] = updatedSale;
          this.set('sales', sales);
      }
  }

  // Delete Sale (Reverses Stock and Debt)
  async deleteSale(saleId: string): Promise<void> {
      await sleep(DELAY);
      const sales = this.get<Sale[]>('sales', []);
      const saleIndex = sales.findIndex(s => s.id === saleId);
      
      if (saleIndex === -1) return;

      const sale = sales[saleIndex];
      const products = this.get<Product[]>('products', []);
      const clients = this.get<Client[]>('clients', []);

      // 1. Revert Stock (Add items back)
      sale.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
              prod.stock += item.quantity;
          }
      });

      // 2. Revert Debt (If it was a credit sale)
      if (sale.type === 'dispatch' && sale.clientId) {
          const client = clients.find(c => c.id === sale.clientId);
          if (client) {
              // Ensure we don't go below zero
              client.debt = Math.max(0, client.debt - sale.totalAmount);
          }
      }

      // 3. Remove Sale Record
      sales.splice(saleIndex, 1);

      // Save all changes
      this.set('products', products);
      this.set('clients', clients);
      this.set('sales', sales);
  }

  // Transaction: Retail Sale (Stock reduction only)
  async createRetailSale(items: SaleItem[], sellerId: string): Promise<void> {
    await sleep(DELAY);
    const products = this.get<Product[]>('products', []);
    
    // Deduct stock
    items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        product.stock -= item.quantity;
      }
    });

    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    
    const sale: Sale = {
      id: this.generateId(),
      date: new Date().toISOString(),
      type: 'pos',
      items,
      totalAmount,
      sellerId
    };

    const sales = this.get<Sale[]>('sales', []);
    sales.push(sale);

    this.set('products', products);
    this.set('sales', sales);
  }

  // Transaction: Dispatch Sale (Stock reduction + Client Debt Increase)
  async createDispatchSale(clientId: string, items: SaleItem[], sellerId: string): Promise<void> {
    await sleep(DELAY);
    const products = this.get<Product[]>('products', []);
    const clients = this.get<Client[]>('clients', []);

    const clientIndex = clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) throw new Error("Cliente no encontrado");

    // Deduct stock
    items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        product.stock -= item.quantity;
      }
    });

    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    // Increase Debt
    clients[clientIndex].debt += totalAmount;

    const sale: Sale = {
      id: this.generateId(),
      date: new Date().toISOString(),
      type: 'dispatch',
      items,
      totalAmount,
      clientId,
      clientName: clients[clientIndex].name,
      sellerId
    };

    const sales = this.get<Sale[]>('sales', []);
    sales.push(sale);

    this.set('products', products);
    this.set('clients', clients);
    this.set('sales', sales);
  }
}

export const db = new DBService();
