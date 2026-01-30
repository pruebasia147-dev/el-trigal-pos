import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_CLIENTS, INITIAL_PRODUCTS, INITIAL_SETTINGS } from "../constants";
import { AppSettings, AuditLog, Client, Product, Sale, SaleItem, SuspendedSale } from "../types";

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://okatgcixtvmdjvsyxeau.supabase.co';
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

  // --- SISTEMA DE AUDITORÍA (LOGS) ---
  async logAction(action: string, details: string, user: string = 'Admin'): Promise<void> {
    try {
        await this.supabase.from('audit_logs').insert({
            id: this.generateId(),
            date: new Date().toISOString(),
            action,
            details,
            user
        });
    } catch (e) {
        console.error("Error guardando log:", e);
    }
  }

  async getAuditLogs(): Promise<AuditLog[]> {
      const { data } = await this.supabase.from('audit_logs').select('*').order('date', { ascending: false }).limit(100);
      return data || [];
  }

  // --- Inicialización ---
  async init() {
    try {
        const { count, error } = await this.supabase.from('products').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("⚠️ Error conectando a Supabase. Verifica tu API Key.", error);
            return;
        }

        if (count === 0) {
            console.log("Base de datos vacía. Subiendo datos iniciales...");
            await this.supabase.from('products').insert(INITIAL_PRODUCTS);
            await this.supabase.from('clients').insert(INITIAL_CLIENTS);
            
            const { data } = await this.supabase.from('settings').select('*').single();
            if (!data) {
                await this.supabase.from('settings').insert({ id: 1, ...INITIAL_SETTINGS });
            }
            await this.logAction('SISTEMA', 'Inicialización de base de datos completa');
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
    const isNew = !productToSave.id;
    if (isNew) productToSave.id = this.generateId();

    const { error } = await this.supabase.from('products').upsert(productToSave);
    if (error) throw error;

    await this.logAction(
        isNew ? 'CREAR PRODUCTO' : 'EDITAR PRODUCTO', 
        `Producto: ${productToSave.name}. Precio: $${productToSave.priceRetail}`
    );
  }

  async deleteProduct(id: string): Promise<void> {
    await this.supabase.from('products').delete().eq('id', id);
    await this.logAction('ELIMINAR PRODUCTO', `ID Producto eliminado: ${id}`);
  }

  // --- Funciones de Clientes ---
  async getClients(): Promise<Client[]> {
    const { data, error } = await this.supabase.from('clients').select('*');
    if (error) console.error(error);
    return data || [];
  }

  async updateClient(updatedClient: Client): Promise<void> {
    const clientToSave = { ...updatedClient };
    const isNew = !clientToSave.id;
    if (isNew) clientToSave.id = this.generateId();

    const { error } = await this.supabase.from('clients').upsert(clientToSave);
    if (error) throw error;

    await this.logAction(
        isNew ? 'CREAR CLIENTE' : 'EDITAR CLIENTE', 
        `Cliente: ${clientToSave.businessName}`
    );
  }

  async registerClientPayment(clientId: string, amount: number): Promise<void> {
    const { data: client } = await this.supabase.from('clients').select('*').eq('id', clientId).single();
    if (!client) throw new Error("Cliente no encontrado");
    
    const newDebt = Math.max(0, client.debt - amount);
    await this.supabase.from('clients').update({ debt: newDebt }).eq('id', clientId);

    await this.logAction('PAGO CLIENTE', `Abono de $${amount} al cliente ${client.businessName}`);
  }

  // --- Configuración ---
  async getSettings(): Promise<AppSettings> {
    const { data } = await this.supabase.from('settings').select('*').single();
    if (data) return data;
    return INITIAL_SETTINGS;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.supabase.from('settings').upsert({ id: 1, ...settings });
    await this.logAction('CONFIGURACIÓN', `Tasa cambiada a: ${settings.exchangeRate} o datos de negocio actualizados`);
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
    const { data, error } = await this.supabase.from('sales').select('*').order('date', { ascending: false }).limit(200);
    if (error) console.error(error);
    return data || [];
  }

  async updateSale(updatedSale: Sale): Promise<void> {
      await this.supabase.from('sales').update(updatedSale).eq('id', updatedSale.id);
      await this.logAction('EDITAR FACTURA', `Factura #${updatedSale.id.slice(0,6)} modificada. Nuevo total: $${updatedSale.totalAmount}`);
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
      
      await this.logAction('ELIMINAR FACTURA', `Factura #${saleId.slice(0,6)} eliminada y stock revertido.`);
  }

  async createRetailSale(items: SaleItem[], sellerId: string): Promise<void> {
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    const saleId = this.generateId();
    const sale: Sale = {
      id: saleId,
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
    // No logueamos cada venta normal para no saturar, pero podríamos si quisieras.
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
          await this.logAction('RESTAURACIÓN', 'Base de datos restaurada desde archivo');
          return true;
      } catch { return false; }
  }

  // --- RESET TOTAL (MODO EXTERMINIO) ---
  // Esta versión es la más robusta posible: primero lee todos los IDs y luego los borra explícitamente.
  // Esto evita problemas con filtros genéricos (como gte o neq) que a veces son bloqueados por políticas de seguridad.
  async clearAllSalesData(onProgress?: (status: string) => void): Promise<void> {
      try {
          // 1. Borrar VENTAS (Fetching IDs first ensures we target existing rows)
          if(onProgress) onProgress("Obteniendo registros de venta...");
          const { data: allSales } = await this.supabase.from('sales').select('id');
          
          if (allSales && allSales.length > 0) {
              const saleIds = allSales.map(s => s.id);
              if(onProgress) onProgress(`Eliminando ${saleIds.length} facturas...`);
              
              // Borramos en lotes de 100 para evitar timeout
              for (let i = 0; i < saleIds.length; i += 100) {
                  const chunk = saleIds.slice(i, i + 100);
                  const { error } = await this.supabase.from('sales').delete().in('id', chunk);
                  if (error) console.error("Error borrando lote ventas:", error);
              }
          }

          // 2. Borrar VENTAS SUSPENDIDAS
          if(onProgress) onProgress("Limpiando carritos en espera...");
          const { data: allSuspended } = await this.supabase.from('suspended_sales').select('id');
          
          if (allSuspended && allSuspended.length > 0) {
              const suspIds = allSuspended.map(s => s.id);
              await this.supabase.from('suspended_sales').delete().in('id', suspIds);
          }

          // 3. Resetear DEUDAS de Clientes
          if(onProgress) onProgress("Restableciendo cuentas de clientes...");
          const { data: allClients } = await this.supabase.from('clients').select('id');
          
          if (allClients && allClients.length > 0) {
              const clientIds = allClients.map(c => c.id);
              // Update debt to 0 for all IDs found
              await this.supabase.from('clients').update({ debt: 0 }).in('id', clientIds);
          }

          if(onProgress) onProgress("Limpieza finalizada.");
          await this.logAction('RESET TOTAL', 'Se ha limpiado toda la base de datos de ventas.');

      } catch (error: any) {
          console.error("Critical Reset Error:", error);
          throw new Error("Falló el proceso de limpieza. Ver consola.");
      }
  }
}

export const db = new DBService();