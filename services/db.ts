
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_CLIENTS, INITIAL_PRODUCTS, INITIAL_SETTINGS } from "../constants";
import { AppSettings, AuditLog, Client, Payment, Product, Sale, SaleItem, SuspendedSale } from "../types";

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://okatgcixtvmdjvsyxeau.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2M2-3m7ATCB0-JBTW1B3AA_etOLVD85';

interface PendingAction {
    id: string;
    type: 'SALE_RETAIL' | 'SALE_DISPATCH' | 'PAYMENT' | 'UPDATE_CLIENT';
    payload: any;
    timestamp: number;
}

class DBService {
  private supabase: SupabaseClient;
  public isOnline: boolean = navigator.onLine;
  private pendingQueue: PendingAction[] = [];

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Cargar cola pendiente del almacenamiento local
    const savedQueue = localStorage.getItem('offlineQueue');
    if (savedQueue) {
        this.pendingQueue = JSON.parse(savedQueue);
    }

    window.addEventListener('online', () => {
        this.isOnline = true;
        console.log("🟢 Conexión restaurada. Sincronizando...");
        this.syncPendingActions();
    });
    
    window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log("🔴 Sin conexión. Modo Offline activado.");
    });
  }

  private saveQueue() {
      localStorage.setItem('offlineQueue', JSON.stringify(this.pendingQueue));
  }

  private generateId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    result += '-';
    for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  }

  // --- SINCRONIZACIÓN AUTOMÁTICA ---
  async syncPendingActions() {
      if (this.pendingQueue.length === 0) return;

      const queue = [...this.pendingQueue]; // Copia para iterar
      const failed: PendingAction[] = [];

      // Notificar al usuario (opcional, visualmente se podría mejorar)
      // alert(`Sincronizando ${queue.length} operaciones pendientes...`);

      for (const action of queue) {
          try {
              console.log(`Syncing action: ${action.type}`, action.payload);
              switch (action.type) {
                  case 'SALE_RETAIL':
                      await this.createRetailSale(action.payload.items, action.payload.sellerId, true);
                      break;
                  case 'SALE_DISPATCH':
                      await this.createDispatchSale(action.payload.clientId, action.payload.items, action.payload.sellerId, true);
                      break;
                  case 'PAYMENT':
                      await this.registerClientPayment(action.payload.clientId, action.payload.amount, action.payload.note, true);
                      break;
                  case 'UPDATE_CLIENT':
                      await this.updateClient(action.payload, true);
                      break;
              }
          } catch (e) {
              console.error("Error syncing item:", e);
              failed.push(action); // Si falla, lo mantenemos para intentar luego
          }
      }

      this.pendingQueue = failed;
      this.saveQueue();
      
      if (failed.length === 0) {
          console.log("✅ Sincronización completada exitosamente.");
          // Recargar datos frescos
          await this.getProducts(); 
          await this.getClients();
      }
  }

  // --- SISTEMA DE AUDITORÍA (LOGS) ---
  async logAction(action: string, details: string, user: string = 'Admin'): Promise<void> {
    if (!this.isOnline) return; // No loguear offline para ahorrar ancho de banda al reconectar
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
      if (!this.isOnline) return [];
      const { data } = await this.supabase.from('audit_logs').select('*').order('date', { ascending: false }).limit(100);
      return data || [];
  }

  // --- Inicialización ---
  async init() {
    if (!this.isOnline) return; // Skip init check if offline
    try {
        const { count, error } = await this.supabase.from('products').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("⚠️ Error conectando a Supabase.", error);
            return;
        }

        if (count === 0) {
            await this.supabase.from('products').insert(INITIAL_PRODUCTS);
            await this.supabase.from('clients').insert(INITIAL_CLIENTS);
            const { data } = await this.supabase.from('settings').select('*').single();
            if (!data) {
                await this.supabase.from('settings').insert({ id: 1, ...INITIAL_SETTINGS });
            }
        }
        // Intentar sincronizar al inicio si hay internet
        this.syncPendingActions();
    } catch (e) {
        console.error("Error en init:", e);
    }
  }

  // --- Funciones de Productos ---
  async getProducts(): Promise<Product[]> {
    if (this.isOnline) {
        const { data, error } = await this.supabase.from('products').select('*');
        if (!error && data) {
            localStorage.setItem('cachedProducts', JSON.stringify(data)); // Cachear
            return data;
        }
    }
    // Fallback Offline
    const cached = localStorage.getItem('cachedProducts');
    return cached ? JSON.parse(cached) : [];
  }

  async updateProduct(updatedProduct: Product): Promise<void> {
    if (!this.isOnline) {
        alert("La edición de inventario solo está disponible ONLINE.");
        return;
    }
    const productToSave = { ...updatedProduct };
    const isNew = !productToSave.id;
    if (isNew) productToSave.id = this.generateId();

    const { error } = await this.supabase.from('products').upsert(productToSave);
    if (error) throw error;

    await this.logAction(isNew ? 'CREAR PRODUCTO' : 'EDITAR PRODUCTO', `Producto: ${productToSave.name}`);
  }

  async deleteProduct(id: string): Promise<void> {
    if (!this.isOnline) return;
    await this.supabase.from('products').delete().eq('id', id);
    await this.logAction('ELIMINAR PRODUCTO', `ID Producto eliminado: ${id}`);
  }

  // --- Funciones de Clientes ---
  async getClients(): Promise<Client[]> {
    if (this.isOnline) {
        const { data, error } = await this.supabase.from('clients').select('*');
        if (!error && data) {
            localStorage.setItem('cachedClients', JSON.stringify(data));
            return data;
        }
    }
    const cached = localStorage.getItem('cachedClients');
    return cached ? JSON.parse(cached) : [];
  }

  async updateClient(updatedClient: Client, isSync = false): Promise<void> {
    if (!this.isOnline && !isSync) {
        this.pendingQueue.push({
            id: this.generateId(),
            type: 'UPDATE_CLIENT',
            payload: updatedClient,
            timestamp: Date.now()
        });
        this.saveQueue();
        return;
    }

    const clientToSave = { ...updatedClient };
    const isNew = !clientToSave.id;
    if (isNew) clientToSave.id = this.generateId();

    const { error } = await this.supabase.from('clients').upsert(clientToSave);
    if (error) throw error;
  }

  async registerClientPayment(clientId: string, amount: number, note: string = '', isSync = false): Promise<void> {
    if (!this.isOnline && !isSync) {
        // Optimistic UI: Update local cache immediately so user sees the change
        const cached = localStorage.getItem('cachedClients');
        if (cached) {
            const clients: Client[] = JSON.parse(cached);
            const idx = clients.findIndex(c => c.id === clientId);
            if (idx >= 0) {
                clients[idx].debt = Math.max(0, clients[idx].debt - amount);
                localStorage.setItem('cachedClients', JSON.stringify(clients));
            }
        }

        this.pendingQueue.push({
            id: this.generateId(),
            type: 'PAYMENT',
            payload: { clientId, amount, note },
            timestamp: Date.now()
        });
        this.saveQueue();
        return;
    }

    const { data: client } = await this.supabase.from('clients').select('*').eq('id', clientId).single();
    if (!client) return; // Fail silently if syncing and client gone
    
    const newDebt = Math.max(0, client.debt - amount);
    await this.supabase.from('clients').update({ debt: newDebt }).eq('id', clientId);
    
    await this.supabase.from('payments').insert({
        id: this.generateId(),
        clientId,
        amount,
        date: new Date().toISOString(), 
        note
    });

    if (!isSync) await this.logAction('PAGO CLIENTE', `Cobro de $${amount} a ${client.businessName}`);
  }

  async getPayments(): Promise<Payment[]> {
      if (!this.isOnline) return [];
      const { data } = await this.supabase.from('payments').select('*').order('date', { ascending: false }).limit(200);
      return data || [];
  }

  async payDispatchInvoice(saleId: string, amount: number, clientId: string): Promise<void> {
      if (!this.isOnline) {
          alert("El cobro de facturas específicas requiere conexión para validar ID.");
          return;
      }
      const { error: saleError } = await this.supabase.from('sales').update({ type: 'pos' }).eq('id', saleId);
      if (saleError) throw saleError;
      await this.registerClientPayment(clientId, amount, `Pago Factura #${saleId.slice(0,6)}`);
  }

  async getSettings(): Promise<AppSettings> {
    // Cache settings too
    if (this.isOnline) {
        const { data } = await this.supabase.from('settings').select('*').single();
        if (data) {
            localStorage.setItem('cachedSettings', JSON.stringify(data));
            return data;
        }
    }
    const cached = localStorage.getItem('cachedSettings');
    return cached ? JSON.parse(cached) : INITIAL_SETTINGS;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if(!this.isOnline) { alert("Configuración requiere internet"); return; }
    await this.supabase.from('settings').upsert({ id: 1, ...settings });
    await this.logAction('CONFIGURACIÓN', `Tasa cambiada a: ${settings.exchangeRate}`);
  }

  // --- Ventas Suspendidas (Siempre LocalStorage) ---
  async getSuspendedSales(): Promise<SuspendedSale[]> {
      // Use localStorage for suspended sales to ensure they persist offline/refresh
      const local = localStorage.getItem('localSuspendedSales');
      if (local) return JSON.parse(local);
      
      // Fallback to DB if online
      if (this.isOnline) {
          const { data } = await this.supabase.from('suspended_sales').select('*');
          return data || [];
      }
      return [];
  }

  async addSuspendedSale(sale: SuspendedSale): Promise<void> {
      // Save locally first
      const local = await this.getSuspendedSales();
      const saleToSave = { ...sale, id: sale.id || this.generateId() };
      localStorage.setItem('localSuspendedSales', JSON.stringify([...local, saleToSave]));

      if (this.isOnline) {
          await this.supabase.from('suspended_sales').insert(saleToSave);
      }
  }

  async removeSuspendedSale(id: string): Promise<void> {
      const local = await this.getSuspendedSales();
      const filtered = local.filter(s => s.id !== id);
      localStorage.setItem('localSuspendedSales', JSON.stringify(filtered));

      if (this.isOnline) {
          await this.supabase.from('suspended_sales').delete().eq('id', id);
      }
  }

  // --- Ventas ---
  async getSales(): Promise<Sale[]> {
    if (this.isOnline) {
        const { data, error } = await this.supabase.from('sales').select('*').order('date', { ascending: false }).limit(200);
        if (!error && data) {
            localStorage.setItem('cachedSales', JSON.stringify(data));
            return data;
        }
    }
    const cached = localStorage.getItem('cachedSales');
    return cached ? JSON.parse(cached) : [];
  }

  async updateSale(updatedSale: Sale): Promise<void> {
      if(!this.isOnline) return;
      await this.supabase.from('sales').update(updatedSale).eq('id', updatedSale.id);
      await this.logAction('EDITAR FACTURA', `Factura #${updatedSale.id.slice(0,6)} modificada.`);
  }

  async deleteSale(saleId: string): Promise<void> {
      if(!this.isOnline) return;
      // Logic for delete is complex offline, restriction to online for safety on "delete"
      const { data: sale } = await this.supabase.from('sales').select('*').eq('id', saleId).single();
      if (!sale) return;

      for (const item of sale.items) {
          const { data: prod } = await this.supabase.from('products').select('stock').eq('id', item.productId).single();
          if (prod) {
              await this.supabase.from('products').update({ stock: prod.stock + item.quantity }).eq('id', item.productId);
          }
      }

      if (sale.type === 'dispatch' && sale.clientId) {
          const { data: client } = await this.supabase.from('clients').select('debt').eq('id', sale.clientId).single();
          if (client) {
              const newDebt = Math.max(0, client.debt - sale.totalAmount);
              await this.supabase.from('clients').update({ debt: newDebt }).eq('id', sale.clientId);
          }
      }

      await this.supabase.from('sales').delete().eq('id', saleId);
      await this.logAction('ELIMINAR FACTURA', `Factura #${saleId.slice(0,6)} eliminada.`);
  }

  async createRetailSale(items: SaleItem[], sellerId: string, isSync = false): Promise<void> {
    if (!this.isOnline && !isSync) {
        this.pendingQueue.push({
            id: this.generateId(),
            type: 'SALE_RETAIL',
            payload: { items, sellerId },
            timestamp: Date.now()
        });
        this.saveQueue();
        
        // Optimistic Stock Update
        const cached = localStorage.getItem('cachedProducts');
        if (cached) {
            const prods: Product[] = JSON.parse(cached);
            items.forEach(item => {
                const p = prods.find(x => x.id === item.productId);
                if (p) p.stock -= item.quantity;
            });
            localStorage.setItem('cachedProducts', JSON.stringify(prods));
        }
        return;
    }

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

    // Update DB Stock
    for (const item of items) {
        // Simple decrement query
        const { data: prod } = await this.supabase.from('products').select('stock').eq('id', item.productId).single();
        if (prod) {
            await this.supabase.from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.productId);
        }
    }
  }

  async createDispatchSale(clientId: string, items: SaleItem[], sellerId: string, isSync = false): Promise<void> {
    // Necesitamos el cliente para el nombre
    let clientName = '';
    
    // Obtener cliente (cache o DB)
    if (this.isOnline) {
        const { data } = await this.supabase.from('clients').select('name').eq('id', clientId).single();
        clientName = data?.name || 'Cliente';
    } else {
        const cached = localStorage.getItem('cachedClients');
        if (cached) {
            const clients: Client[] = JSON.parse(cached);
            clientName = clients.find(c => c.id === clientId)?.name || 'Cliente Offline';
        }
    }

    if (!this.isOnline && !isSync) {
        this.pendingQueue.push({
            id: this.generateId(),
            type: 'SALE_DISPATCH',
            payload: { clientId, items, sellerId },
            timestamp: Date.now()
        });
        this.saveQueue();

        // Optimistic Updates
        const cachedProds = localStorage.getItem('cachedProducts');
        if (cachedProds) {
            const prods: Product[] = JSON.parse(cachedProds);
            items.forEach(item => {
                const p = prods.find(x => x.id === item.productId);
                if (p) p.stock -= item.quantity;
            });
            localStorage.setItem('cachedProducts', JSON.stringify(prods));
        }
        const cachedClients = localStorage.getItem('cachedClients');
        if (cachedClients) {
            const clients: Client[] = JSON.parse(cachedClients);
            const c = clients.find(x => x.id === clientId);
            if (c) {
                const total = items.reduce((sum, item) => sum + item.subtotal, 0);
                c.debt += total;
            }
            localStorage.setItem('cachedClients', JSON.stringify(clients));
        }
        return;
    }

    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    const sale: Sale = {
      id: this.generateId(),
      date: new Date().toISOString(),
      type: 'dispatch',
      items,
      totalAmount,
      clientId,
      clientName: clientName,
      sellerId
    };

    await this.supabase.from('sales').insert(sale);
    
    // Update Debt DB
    const { data: clientData } = await this.supabase.from('clients').select('debt').eq('id', clientId).single();
    if(clientData) {
        await this.supabase.from('clients').update({ debt: clientData.debt + totalAmount }).eq('id', clientId);
    }

    // Update Stock DB
    for (const item of items) {
        const { data: prod } = await this.supabase.from('products').select('stock').eq('id', item.productId).single();
        if (prod) {
            await this.supabase.from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.productId);
        }
    }
  }
  
  // Respaldos y Limpieza
  async getDatabaseDump(): Promise<string> {
      const [p, c, s, st] = await Promise.all([
          this.getProducts(), this.getClients(), this.getSales(), this.getSettings()
      ]);
      return JSON.stringify({ products: p, clients: c, sales: s, settings: st, date: new Date() }, null, 2);
  }

  async restoreDatabase(jsonString: string): Promise<boolean> {
      if(!this.isOnline) return false;
      try {
          const data = JSON.parse(jsonString);
          if (data.products) await this.supabase.from('products').upsert(data.products);
          if (data.clients) await this.supabase.from('clients').upsert(data.clients);
          await this.logAction('RESTAURACIÓN', 'Base de datos restaurada desde archivo');
          return true;
      } catch { return false; }
  }

  async clearAllSalesData(onProgress?: (status: string) => void): Promise<void> {
      if(!this.isOnline) { alert("Limpieza requiere internet"); return; }
      try {
          if(onProgress) onProgress("Obteniendo registros de venta...");
          const { data: allSales } = await this.supabase.from('sales').select('id');
          if (allSales && allSales.length > 0) {
              const saleIds = allSales.map(s => s.id);
              if(onProgress) onProgress(`Eliminando ${saleIds.length} facturas...`);
              for (let i = 0; i < saleIds.length; i += 100) {
                  const chunk = saleIds.slice(i, i + 100);
                  await this.supabase.from('sales').delete().in('id', chunk);
              }
          }

          if(onProgress) onProgress("Limpiando carritos en espera...");
          const { data: allSuspended } = await this.supabase.from('suspended_sales').select('id');
          if (allSuspended && allSuspended.length > 0) {
              const suspIds = allSuspended.map(s => s.id);
              await this.supabase.from('suspended_sales').delete().in('id', suspIds);
          }

          if(onProgress) onProgress("Limpiando historial de pagos...");
          const { data: allPayments } = await this.supabase.from('payments').select('id');
          if (allPayments && allPayments.length > 0) {
              const payIds = allPayments.map(p => p.id);
              await this.supabase.from('payments').delete().in('id', payIds);
          }

          if(onProgress) onProgress("Restableciendo cuentas de clientes...");
          const { data: allClients } = await this.supabase.from('clients').select('id');
          if (allClients && allClients.length > 0) {
              const clientIds = allClients.map(c => c.id);
              await this.supabase.from('clients').update({ debt: 0 }).in('id', clientIds);
          }

          if(onProgress) onProgress("Limpieza finalizada.");
          await this.logAction('RESET TOTAL', 'Se ha limpiado toda la base de datos.');

      } catch (error: any) {
          console.error("Critical Reset Error:", error);
          throw new Error("Falló el proceso de limpieza.");
      }
  }
}

export const db = new DBService();
