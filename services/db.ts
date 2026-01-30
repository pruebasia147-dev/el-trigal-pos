import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_CLIENTS, INITIAL_PRODUCTS, INITIAL_SETTINGS } from "../constants";
import { AppSettings, Client, Product, Sale, SaleItem, SuspendedSale } from "../types";

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://okatgcixtvmdjvsyxeau.supabase.co';
// NOTA: Usamos la clave provista. Si falla la conexión, verificar en Supabase: Settings -> API -> anon public key
const SUPABASE_KEY = 'sb_publishable_2M2-3m7ATCB0-JBTW1B3AA_etOLVD85';

class DBService {
  private supabase: SupabaseClient;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    window.addEventListener('online', () => this.isOnline = true);
    window.addEventListener('offline', () => this.isOnline = false);
  }

  private generateId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    result += '-';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  }

  // --- Inicialización ---
  async init() {
    try {
        // Intentamos conectar. Si hay error, lo mostramos en consola.
        const { count, error } = await this.supabase.from('products').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("⚠️ Error conectando a Supabase. Verifica tu API Key.", error);
            return;
        }

        // Si la base de datos existe pero está vacía, subimos los datos de prueba (constants.ts)
        if (count === 0) {
            console.log("Base de datos vacía. Subiendo datos iniciales...");
            await this.supabase.from('products').insert(INITIAL_PRODUCTS);
            await this.supabase.from('clients').insert(INITIAL_CLIENTS);
            
            // Verificar settings
            const { data } = await this.supabase.from('settings').select('*').single();
            if (!data) {
                await this.supabase.from('settings').insert({ id: 1, ...INITIAL_SETTINGS });
            }
        }
    } catch (e) {
        console.error("Error crítico en init:", e);
    }
  }

  // --- Funciones de Productos ---
  async getProducts(): Promise<Product[]> {
    const { data, error } = await this.supabase.from('products').select('*');
    if (error) console.error(error);
    return data || [];
  }

  async updateProduct(updatedProduct: Product): Promise<void> {
    const productToSave = { ...updatedProduct };
    if (!productToSave.id) productToSave.id = this.generateId();

    const { error } = await this.supabase.from('products').upsert(productToSave);
    if (error) throw error;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.supabase.from('products').delete().eq('id', id);
  }

  // --- Funciones de Clientes ---
  async getClients(): Promise<Client[]> {
    const { data, error } = await this.supabase.from('clients').select('*');
    if (error) console.error(error);
    return data || [];
  }

  async updateClient(updatedClient: Client): Promise<void> {
    const clientToSave = { ...updatedClient };
    if (!clientToSave.id) clientToSave.id = this.generateId();

    const { error } = await this.supabase.from('clients').upsert(clientToSave);
    if (error) throw error;
  }

  async registerClientPayment(clientId: string, amount: number): Promise<void> {
    const { data: client } = await this.supabase.from('clients').select('debt').eq('id', clientId).single();
    if (!client) throw new Error("Cliente no encontrado");
    const newDebt = Math.max(0, client.debt - amount);
    await this.supabase.from('clients').update({ debt: newDebt }).eq('id', clientId);
  }

  // --- Configuración ---
  async getSettings(): Promise<AppSettings> {
    const { data } = await this.supabase.from('settings').select('*').single();
    if (data) return data;
    return INITIAL_SETTINGS;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.supabase.from('settings').upsert({ id: 1, ...settings });
  }

  // --- Ventas Suspendidas ---
  async getSuspendedSales(): Promise<SuspendedSale[]> {
      const { data } = await this.supabase.from('suspended_sales').select('*');
      return data || [];
  }

  async addSuspendedSale(sale: SuspendedSale): Promise<void> {
      const saleToSave = { ...sale, id: sale.id || this.generateId() };
      await this.supabase.from('suspended_sales').insert(saleToSave);
  }

  async removeSuspendedSale(id: string): Promise<void> {
      await this.supabase.from('suspended_sales').delete().eq('id', id);
  }

  // --- Ventas ---
  async getSales(): Promise<Sale[]> {
    // Traemos las últimas 200 ventas para no saturar
    const { data, error } = await this.supabase.from('sales').select('*').order('date', { ascending: false }).limit(200);
    if (error) console.error(error);
    return data || [];
  }

  async updateSale(updatedSale: Sale): Promise<void> {
      await this.supabase.from('sales').update(updatedSale).eq('id', updatedSale.id);
  }

  async deleteSale(saleId: string): Promise<void> {
      // 1. Obtener la venta
      const { data: sale } = await this.supabase.from('sales').select('*').eq('id', saleId).single();
      if (!sale) return;

      // 2. Devolver productos al Stock
      for (const item of sale.items) {
          const { data: prod } = await this.supabase.from('products').select('stock').eq('id', item.productId).single();
          if (prod) {
              await this.supabase.from('products').update({ stock: prod.stock + item.quantity }).eq('id', item.productId);
          }
      }

      // 3. Ajustar deuda si era un despacho
      if (sale.type === 'dispatch' && sale.clientId) {
          const { data: client } = await this.supabase.from('clients').select('debt').eq('id', sale.clientId).single();
          if (client) {
              const newDebt = Math.max(0, client.debt - sale.totalAmount);
              await this.supabase.from('clients').update({ debt: newDebt }).eq('id', sale.clientId);
          }
      }

      // 4. Borrar el registro
      await this.supabase.from('sales').delete().eq('id', saleId);
  }

  async createRetailSale(items: SaleItem[], sellerId: string): Promise<void> {
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    const sale: Sale = {
      id: this.generateId(),
      date: new Date().toISOString(),
      type: 'pos',
      items,
      totalAmount,
      sellerId
    };

    const { error } = await this.supabase.from('sales').insert(sale);
    if (error) throw error;

    for (const item of items) {
        const { data: prod } = await this.supabase.from('products').select('stock').eq('id', item.productId).single();
        if (prod) {
            await this.supabase.from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.productId);
        }
    }
  }

  async createDispatchSale(clientId: string, items: SaleItem[], sellerId: string): Promise<void> {
    const { data: client } = await this.supabase.from('clients').select('*').eq('id', clientId).single();
    if (!client) throw new Error("Cliente no encontrado");

    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    const sale: Sale = {
      id: this.generateId(),
      date: new Date().toISOString(),
      type: 'dispatch',
      items,
      totalAmount,
      clientId,
      clientName: client.name,
      sellerId
    };

    await this.supabase.from('sales').insert(sale);
    await this.supabase.from('clients').update({ debt: client.debt + totalAmount }).eq('id', clientId);

    for (const item of items) {
        const { data: prod } = await this.supabase.from('products').select('stock').eq('id', item.productId).single();
        if (prod) {
            await this.supabase.from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.productId);
        }
    }
  }
  
  // Respaldos (Mantiene funcionalidad básica)
  async getDatabaseDump(): Promise<string> {
      const [p, c, s, st] = await Promise.all([
          this.getProducts(), this.getClients(), this.getSales(), this.getSettings()
      ]);
      return JSON.stringify({ products: p, clients: c, sales: s, settings: st, date: new Date() }, null, 2);
  }

  async restoreDatabase(jsonString: string): Promise<boolean> {
      try {
          const data = JSON.parse(jsonString);
          if (data.products) await this.supabase.from('products').upsert(data.products);
          if (data.clients) await this.supabase.from('clients').upsert(data.clients);
          return true;
      } catch { return false; }
  }
}

export const db = new DBService();