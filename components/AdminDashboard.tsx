
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { AppSettings, Client, Product, Sale, AuditLog } from '../types';
import SalesAnalytics from './SalesAnalytics';
import ClientCRM from './ClientCRM';
import { 
  LayoutDashboard, Package, Users, Settings, LogOut, 
  TrendingUp, DollarSign, Edit, Menu, X, Plus, BarChart3, 
  Wallet, ArrowUpRight, CalendarClock, Activity, Calculator, Trash2,
  AlertCircle, CalendarDays, Coins, Warehouse, PieChart, Save, Upload, Store,
  MessageSquare, Send, Bot, ScrollText, UserCog, AlertTriangle, Loader2, Truck
} from 'lucide-react';

interface AdminProps {
  onLogout: () => void;
}

// --- Types for Simulation ---
interface SimProduct extends Product {
    simDailyQty: number; // Estimated daily sales volume
}

interface SimExpense {
    id: string;
    name: string;
    amount: number;
    frequency: 'daily' | 'weekly' | 'monthly';
}

const AdminDashboard: React.FC<AdminProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'inventory' | 'clients' | 'simulation' | 'settings' | 'logs'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ exchangeRate: 0, businessName: '', rif: '', address: '', phone: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Reset States
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  // Simple edit states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // New State for Profit Detail Modal
  const [showProfitDetail, setShowProfitDetail] = useState(false);

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [p, c, s, st] = await Promise.all([
      db.getProducts(),
      db.getClients(),
      db.getSales(),
      db.getSettings()
    ]);
    setProducts(p);
    setClients(c);
    setSales(s);
    setSettings(st);
  };
  
  const loadLogs = async () => {
      const logs = await db.getAuditLogs();
      setAuditLogs(logs);
  };

  useEffect(() => {
    loadData();
    if (activeTab === 'logs') {
        loadLogs();
    }
  }, [activeTab]);

  const handleUpdateSettings = async () => {
    await db.saveSettings(settings);
    alert('Ajustes guardados correctamente.');
    loadLogs();
  };

  const handleResetSales = async () => {
      if (confirm('⚠️ ATENCIÓN: Esta acción dejará el sistema en CERO.\n\n¿Deseas eliminar todas las ventas y reiniciar deudas?')) {
          setIsResetting(true);
          setResetStatus('Borrando datos...');
          try {
              // 1. Ejecutar limpieza en BD
              await db.clearAllSalesData((status) => setResetStatus(status));
              
              // 2. Limpiar estado local INMEDIATAMENTE para feedback visual "en cero"
              setSales([]);
              setClients(prev => prev.map(c => ({...c, debt: 0})));
              
              alert('✅ Sistema reiniciado a CERO exitosamente.');
              
              // 3. Recargar para asegurar consistencia
              window.location.reload();
          } catch (e: any) {
              alert(`Error: ${e.message}`);
              setIsResetting(false);
              setResetStatus('');
          }
      }
  };

  const handleSaveProduct = async (product: Product) => {
    await db.updateProduct(product);
    setEditingProduct(null);
    loadData();
    // No need to call loadLogs() here as db.ts logs automatically, but if we want instant feedback in the Logs tab (if active):
    if(activeTab === 'logs') loadLogs();
  };

  const handleSaveClient = async (client: Client) => {
    await db.updateClient(client);
    setEditingClient(null);
    loadData();
  };

  const handleNavClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  // --- Backup Functions ---
  const handleDownloadBackup = async () => {
      const json = await db.getDatabaseDump();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_${settings.businessName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          const json = event.target?.result as string;
          if (json) {
              const success = await db.restoreDatabase(json);
              if (success) {
                  alert('¡Base de datos restaurada con éxito! La página se recargará.');
                  window.location.reload();
              } else {
                  alert('Error: El archivo no es válido.');
              }
          }
      };
      reader.readAsText(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Financial & Projection Logic ---
  const calculateFinancials = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Helper to calc profit for a set of sales
    const getProfit = (saleList: Sale[]) => {
      let cost = 0;
      let revenue = 0;
      saleList.forEach(sale => {
        revenue += sale.totalAmount;
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          // Estimate cost based on current product cost (or 70% of price if product deleted)
          const itemCost = product ? product.cost * item.quantity : (item.subtotal * 0.7);
          cost += itemCost;
        });
      });
      return revenue - cost;
    };

    // 1. Daily Stats (Separated by Cash vs Credit)
    const todaySales = sales.filter(s => new Date(s.date) >= startOfToday);
    
    // Cash Sales (Mostrador) - Dinero Real
    const todayCashSales = todaySales.filter(s => s.type === 'pos');
    const todayCashRevenue = todayCashSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const todayCashProfit = getProfit(todayCashSales);

    // Credit Sales (Despacho) - Cuentas por Cobrar
    const todayCreditSales = todaySales.filter(s => s.type === 'dispatch');
    const todayCreditRevenue = todayCreditSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const todayCreditProfit = getProfit(todayCreditSales);

    // 2. Monthly Stats
    const monthSales = sales.filter(s => new Date(s.date) >= startOfMonth);
    const monthRevenue = monthSales.reduce((acc, curr) => acc + curr.totalAmount, 0); // Total operations
    
    // 3. Projections
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const avgDailyRevenue = monthRevenue / daysPassed;
    const projectedRevenue = monthRevenue + (avgDailyRevenue * (daysInMonth - daysPassed));

    // 4. Assets & Liabilities (Professional Additions)
    const totalDebt = clients.reduce((sum, c) => sum + c.debt, 0);
    const inventoryValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);
    const lowStockCount = products.filter(p => p.stock <= 20).length;

    return { 
        todayCashRevenue, 
        todayCashProfit, 
        todayCreditRevenue,
        todayCreditProfit,
        todayCount: todaySales.length,
        monthRevenue, 
        projectedRevenue,
        totalDebt,
        inventoryValue,
        lowStockCount,
        todaySales // Pass this for the modal
    };
  };

  const financials = calculateFinancials();

  // --- Logic for Daily Profit Breakdown ---
  const getDailyProfitBreakdown = () => {
      const breakdown: Record<string, { 
          name: string, 
          qty: number, 
          revenue: number, 
          totalCost: number, 
          avgUnitPrice: number,
          unitCost: number 
      }> = {};

      // Filter only POS (Cash) sales for "Realized Profit"
      const realizedSales = financials.todaySales.filter(s => s.type === 'pos');

      realizedSales.forEach(sale => {
          sale.items.forEach(item => {
              const prod = products.find(p => p.id === item.productId);
              // Use current cost if available, else estimate
              const unitCost = prod ? prod.cost : (item.unitPrice * 0.6); 

              if (!breakdown[item.productId]) {
                  breakdown[item.productId] = {
                      name: item.productName,
                      qty: 0,
                      revenue: 0,
                      totalCost: 0,
                      avgUnitPrice: 0,
                      unitCost: unitCost
                  };
              }
              
              breakdown[item.productId].qty += item.quantity;
              breakdown[item.productId].revenue += item.subtotal;
              breakdown[item.productId].totalCost += (unitCost * item.quantity);
          });
      });

      // Convert to array and calculate unit averages
      return Object.values(breakdown).map(item => ({
          ...item,
          avgUnitPrice: item.revenue / item.qty,
          profit: item.revenue - item.totalCost
      })).sort((a,b) => b.profit - a.profit);
  };

  const profitBreakdown = getDailyProfitBreakdown();

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!chatMessage.trim()) return;
    
    // Fake interaction for demo
    alert(`Mensaje enviado: "${chatMessage}"\n\nNota: Para que el asistente pueda modificar la base de datos realmente, se requiere integración con un servicio de IA en el backend.`);
    setChatMessage('');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <span className="font-bold text-lg text-bakery-600">{settings.businessName || 'Admin Panel'}</span>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 transform 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0
      `}>
        <div className="p-8 hidden md:block">
          <h1 className="text-xl font-extrabold text-bakery-600 tracking-tight leading-tight">{settings.businessName || 'El Trigal'}</h1>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">Panel Administrativo</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-20 md:mt-0">
          {[
            { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
            { id: 'analytics', label: 'Reportes Detallados', icon: BarChart3 },
            { id: 'simulation', label: 'Simulador (Nuevo)', icon: Calculator },
            { id: 'clients', label: 'Clientes CRM', icon: Users },
            { id: 'inventory', label: 'Inventario', icon: Package },
            { id: 'logs', label: 'Actividad', icon: ScrollText }, // NEW TAB
            { id: 'settings', label: 'Ajustes', icon: Settings },
          ].map((item) => (
             <button 
                key={item.id}
                onClick={() => handleNavClick(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  activeTab === item.id 
                    ? 'bg-bakery-50 text-bakery-700 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={20} className={activeTab === item.id ? "text-bakery-500" : "text-gray-400"} /> 
                {item.label}
              </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 mb-16 md:mb-0">
          <button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors w-full px-4 py-3 rounded-xl hover:bg-red-50 font-medium">
            <LogOut size={20} /> Salir
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 pt-20 md:pt-8 w-full max-w-[1600px] mx-auto scroll-smooth">
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                    <p className="text-gray-500 mt-1">Resumen ejecutivo del negocio.</p>
                </div>
                <div className="hidden sm:block text-right">
                    <p className="text-sm font-bold text-bakery-600 bg-bakery-50 px-3 py-1 rounded-full border border-bakery-100">
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
            </div>
            
            {/* --- Section 1: Financial Pulse --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 
                 {/* CASH FLOW CARD (REAL MONEY) */}
                 <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48 group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80}/></div>
                    <div>
                        <div className="flex items-center gap-2 text-bakery-400 mb-1">
                            <Activity size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Dinero en Caja (Hoy)</span>
                        </div>
                        <h3 className="text-4xl font-bold tracking-tight">${financials.todayCashRevenue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <p className="text-sm text-gray-400 mt-1">Ventas de Mostrador (Contado)</p>
                    </div>
                 </div>

                 {/* CREDIT SALES CARD (ACCOUNTS RECEIVABLE GENERATED TODAY) */}
                 <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48 group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Truck size={80}/></div>
                    <div>
                        <div className="flex items-center gap-2 text-blue-200 mb-1">
                            <Truck size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Despachos a Crédito (Hoy)</span>
                        </div>
                        <h3 className="text-4xl font-bold tracking-tight">${financials.todayCreditRevenue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <p className="text-sm text-blue-100 mt-1">Pendiente por Cobrar</p>
                    </div>
                 </div>
            </div>

            {/* --- Section 2: Profit & Projections --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Realized Profit (Cash Based) */}
                <div 
                    onClick={() => setShowProfitDetail(true)}
                    className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 rounded-2xl shadow-sm border border-emerald-600 cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={60}/></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-emerald-100 mb-2">
                            <Wallet size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Ganancia Líquida (Hoy)</span>
                        </div>
                        <h3 className="text-3xl font-bold tracking-tight">${financials.todayCashProfit.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        
                        <div className="mt-4 pt-4 border-t border-emerald-400/30 flex justify-between items-center text-xs">
                             <span className="text-emerald-100">Disponible Real</span>
                             <span className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold">Ver Detalle</span>
                        </div>
                    </div>
                </div>

                {/* Unrealized Profit (Credit Based) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-2">Ganancia Por Cobrar</p>
                            <p className="text-3xl font-bold text-blue-600">${financials.todayCreditProfit.toLocaleString('es-US', {minimumFractionDigits: 2})}</p>
                            <p className="text-xs text-gray-400 mt-1">Estimada en despachos de hoy</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-500 rounded-xl group-hover:scale-110 transition-transform">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                </div>

                {/* Total Accounts Receivable */}
                <div 
                    onClick={() => setActiveTab('clients')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group cursor-pointer hover:shadow-md hover:border-red-100 transition-all"
                >
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase mb-1 group-hover:text-red-500 transition-colors">Total Cuentas por Cobrar</p>
                        <h3 className="text-3xl font-bold text-red-600">${financials.totalDebt.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <p className="text-xs text-gray-400 mt-1">Capital pendiente acumulado</p>
                    </div>
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:scale-110 transition-transform">
                        <Coins size={24} />
                    </div>
                </div>
            </div>

            {/* --- Section 3: Inventory & Chart --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Inventory Value */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                            <Warehouse size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Inventario</h3>
                            <p className="text-xs text-gray-500">Valor al costo</p>
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-3xl font-bold text-blue-900">${financials.inventoryValue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${financials.lowStockCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                {financials.lowStockCount} alertas de stock
                            </span>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                    <div className="mb-4 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Tendencia de Ingresos</h3>
                            <p className="text-sm text-gray-500">Comportamiento de ventas últimos 14 días</p>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                            <span className="w-2 h-2 rounded-full bg-bakery-500"></span>
                            <span className="text-xs font-bold text-gray-600">Total Operaciones</span>
                        </div>
                    </div>
                    <div className="h-40 w-full">
                        <ModernSplineChart sales={sales} days={14} />
                    </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
            <SalesAnalytics sales={sales} products={products} settings={settings} />
        )}

        {activeTab === 'simulation' && (
            <SimulationPanel products={products} />
        )}

        {activeTab === 'inventory' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Inventario</h2>
                <p className="text-gray-500">Gestión de productos y precios.</p>
              </div>
              <button 
                onClick={() => setEditingProduct({ id: crypto.randomUUID(), name: 'Nuevo Producto', priceRetail: 0, priceWholesale: 0, cost: 0, stock: 0, category: 'General' })}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
              >
                <Plus size={18} /> Nuevo Producto
              </button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="p-5">Producto</th>
                      <th className="p-5">Categoría</th>
                      <th className="p-5">Costo</th>
                      <th className="p-5">P. Detal</th>
                      <th className="p-5">P. Mayor</th>
                      <th className="p-5">Stock</th>
                      <th className="p-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-5 font-bold text-gray-800">{p.name}</td>
                        <td className="p-5 text-gray-500">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-bold">{p.category}</span>
                        </td>
                        <td className="p-5 text-gray-500">${p.cost.toFixed(2)}</td>
                        <td className="p-5 text-green-600 font-bold">${p.priceRetail.toFixed(2)}</td>
                        <td className="p-5 text-blue-600 font-bold">${p.priceWholesale.toFixed(2)}</td>
                        <td className="p-5">
                          <span className={`px-2 py-1 rounded-md font-bold text-xs ${p.stock < 20 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {p.stock} uds
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <button onClick={() => setEditingProduct(p)} className="text-gray-400 hover:text-bakery-600 p-2 transition-colors"><Edit size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
           <div className="h-full flex flex-col">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 flex-none">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900">Clientes CRM</h2>
                    <p className="text-gray-500 text-sm">Gestión inteligente de cartera.</p>
                 </div>
                 <button 
                    onClick={() => setEditingClient({ id: crypto.randomUUID(), name: '', businessName: '', debt: 0, creditLimit: 0, address: '' })}
                    className="bg-gray-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
                  >
                    <Plus size={18} /> Nuevo Cliente
                  </button>
               </div>
               
               <ClientCRM 
                    clients={clients} 
                    sales={sales} 
                    products={products}
                    settings={settings}
                    onEditClient={setEditingClient} 
                    onRefreshData={loadData}
               />
            </div>
        )}

        {activeTab === 'logs' && (
            <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Bitácora de Actividad</h2>
                        <p className="text-gray-500">Registro histórico de cambios en el sistema.</p>
                    </div>
                    <button onClick={loadLogs} className="text-sm font-bold text-bakery-600 bg-bakery-50 px-4 py-2 rounded-lg hover:bg-bakery-100">
                        Actualizar
                    </button>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha / Hora</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Acción</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {auditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        <ScrollText size={32} className="mx-auto mb-2 opacity-20"/>
                                        <p>No hay registros de actividad aún.</p>
                                    </td>
                                </tr>
                            ) : (
                                auditLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{new Date(log.date).toLocaleDateString()}</div>
                                            <div className="text-xs text-gray-500">{new Date(log.date).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                                                log.action.includes('ELIMINAR') || log.action.includes('RESET') ? 'bg-red-100 text-red-700' :
                                                log.action.includes('EDITAR') || log.action.includes('CONFIGURACIÓN') ? 'bg-orange-100 text-orange-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <UserCog size={16} className="text-gray-400"/>
                                                <span className="text-gray-700">{log.user || 'Sistema'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                                            {log.details}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl w-full animate-in fade-in duration-500 space-y-8 pb-10">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">Datos del Negocio</h3>
                        <p className="text-sm text-gray-500">Información visible en facturas y reportes.</p>
                    </div>
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                        <Store size={24} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Negocio</label>
                        <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-bakery-400 outline-none transition-all"
                            value={settings.businessName}
                            onChange={(e) => setSettings({...settings, businessName: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">RIF / ID Legal</label>
                        <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-bakery-400 outline-none transition-all"
                            value={settings.rif}
                            onChange={(e) => setSettings({...settings, rif: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Dirección Fiscal</label>
                        <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-bakery-400 outline-none transition-all"
                            value={settings.address}
                            onChange={(e) => setSettings({...settings, address: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono Contacto</label>
                        <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-bakery-400 outline-none transition-all"
                            value={settings.phone}
                            onChange={(e) => setSettings({...settings, phone: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Tasa de Cambio (Bs/USD)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400 font-bold">Bs</span>
                            <input 
                                type="number" 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-bakery-400 outline-none transition-all font-mono font-bold text-lg"
                                value={settings.exchangeRate}
                                onChange={(e) => setSettings({...settings, exchangeRate: parseFloat(e.target.value)})}
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                     <button 
                        onClick={handleUpdateSettings}
                        className="bg-bakery-600 hover:bg-bakery-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-all flex items-center gap-2"
                     >
                         <Save size={20} /> Guardar Cambios
                     </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">Copia de Seguridad</h3>
                        <p className="text-sm text-gray-500">Respalda o restaura la base de datos completa.</p>
                    </div>
                    <div className="bg-gray-100 text-gray-600 p-2 rounded-lg">
                        <Upload size={24} />
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={handleDownloadBackup}
                        className="flex-1 bg-gray-50 border-2 border-gray-200 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:bg-gray-100 transition-colors group"
                    >
                        <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                            <Save size={24} className="text-gray-600" />
                        </div>
                        <div className="text-center">
                            <h4 className="font-bold text-gray-800">Descargar Respaldo</h4>
                            <p className="text-xs text-gray-500">Guardar archivo .JSON localmente</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 bg-gray-50 border-2 border-gray-200 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:bg-gray-100 transition-colors group"
                    >
                        <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                            <Upload size={24} className="text-gray-600" />
                        </div>
                         <div className="text-center">
                            <h4 className="font-bold text-gray-800">Restaurar Datos</h4>
                            <p className="text-xs text-gray-500">Cargar archivo .JSON previo</p>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".json" 
                            onChange={handleRestoreBackup}
                        />
                    </button>
                </div>
            </div>

            <div className="bg-red-50 p-8 rounded-2xl shadow-sm border border-red-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-red-900">Zona de Peligro</h3>
                        <p className="text-xs text-red-500">Acciones destructivas e irreversibles.</p>
                    </div>
                </div>
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-red-200">
                    <div>
                        <p className="font-bold text-red-800">Borrar Historial de Ventas</p>
                        <p className="text-xs text-gray-500 mt-1 max-w-md">
                            Esta acción eliminará <b>todas</b> las ventas registradas y reiniciará la deuda de todos los clientes a $0.
                        </p>
                    </div>
                    <button 
                        onClick={handleResetSales}
                        disabled={isResetting}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isResetting && <Loader2 size={16} className="animate-spin" />}
                        {isResetting ? (resetStatus || 'Borrando...') : 'Borrar Todo'}
                    </button>
                </div>
            </div>
          </div>
        )}
      </main>

      {/* --- FLOATING CHAT --- */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
         {isChatOpen && (
             <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 sm:w-96 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 origin-bottom-right h-[400px]">
                 <div className="bg-bakery-600 text-white p-4 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                         <Bot size={20} />
                         <h3 className="font-bold">Asistente AI</h3>
                     </div>
                     <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={16}/></button>
                 </div>
                 <div className="flex-1 bg-gray-50 p-4 overflow-y-auto">
                     <div className="flex gap-2 items-start mb-4">
                         <div className="bg-bakery-100 p-2 rounded-lg rounded-tl-none">
                             <p className="text-sm text-gray-700">Hola, soy tu asistente virtual.</p>
                         </div>
                     </div>
                 </div>
                 <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                     <input 
                        type="text" 
                        placeholder="Escribe aquí..." 
                        className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bakery-400"
                        value={chatMessage}
                        onChange={e => setChatMessage(e.target.value)}
                     />
                     <button type="submit" className="bg-bakery-600 text-white p-2 rounded-full hover:bg-bakery-700 transition-colors">
                         <Send size={16} />
                     </button>
                 </form>
             </div>
         )}
         
         <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="bg-bakery-600 text-white p-4 rounded-full shadow-lg hover:bg-bakery-700 hover:scale-105 transition-all flex items-center justify-center"
         >
             {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
         </button>
      </div>

      {/* PROFIT DETAIL MODAL (UPDATED to show Liquid Profit only) */}
      {showProfitDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Wallet className="text-emerald-600" /> Ganancia Líquida (Contado)
                        </h2>
                        <p className="text-sm text-gray-500">Solo ventas de mostrador cobradas en caja.</p>
                    </div>
                    <button onClick={() => setShowProfitDetail(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="px-6 py-4 font-bold bg-white">Producto</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Cant (POS)</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Costo Unit.</th>
                                <th className="px-6 py-4 font-bold text-center bg-white text-emerald-600">Margen</th>
                                <th className="px-6 py-4 font-bold text-right bg-white">Venta Total</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-emerald-700">Ganancia Real</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {profitBreakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-400">
                                        No hay ventas de contado registradas hoy.
                                    </td>
                                </tr>
                            ) : (
                                profitBreakdown.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 px-2 py-1 rounded-md font-bold text-gray-700">{item.qty}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            ${item.unitCost.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-emerald-600 bg-emerald-50/10">
                                            +${(item.avgUnitPrice - item.unitCost).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-600">
                                            ${item.revenue.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600 bg-emerald-50/30">
                                            +${item.profit.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-gray-900 text-white rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center z-20">
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Total Líquido</p>
                        <p className="text-sm opacity-80">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-400">${financials.todayCashProfit.toFixed(2)}</p>
                        <p className="text-xs text-emerald-200">Ganancia en Mano</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{editingProduct.id.includes('-') ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                <button onClick={() => setEditingProduct(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none"
                    value={editingProduct.name}
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Precio Detal ($)</label>
                <input 
                    type="number" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none font-bold"
                    value={editingProduct.priceRetail}
                    onChange={e => setEditingProduct({...editingProduct, priceRetail: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Precio Mayor ($)</label>
                <input 
                    type="number" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none font-bold"
                    value={editingProduct.priceWholesale}
                    onChange={e => setEditingProduct({...editingProduct, priceWholesale: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Costo ($)</label>
                <input 
                    type="number" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none"
                    value={editingProduct.cost}
                    onChange={e => setEditingProduct({...editingProduct, cost: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Stock Actual</label>
                <input 
                    type="number" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none"
                    value={editingProduct.stock}
                    onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})}
                />
              </div>
              <div className="col-span-2">
                 <label className="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                 <select 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none"
                    value={editingProduct.category}
                    onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                 >
                     <option value="Panadería Salada">Panadería Salada</option>
                     <option value="Panadería Dulce">Panadería Dulce</option>
                     <option value="Repostería">Repostería</option>
                     <option value="General">General</option>
                 </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">URL Imagen (Opcional)</label>
                <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none text-xs"
                    value={editingProduct.image || ''}
                    onChange={e => setEditingProduct({...editingProduct, image: e.target.value})}
                    placeholder="https://..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                {editingProduct.id.includes('-') && (
                    <button 
                        onClick={async () => {
                            if(confirm('¿Borrar producto permanentemente?')) {
                                await db.deleteProduct(editingProduct.id);
                                setEditingProduct(null);
                                loadData();
                            }
                        }}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-bold flex items-center gap-2"
                    >
                        <Trash2 size={18}/> Eliminar
                    </button>
                )}
                <button 
                    onClick={() => handleSaveProduct(editingProduct)}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 shadow-md"
                >
                    Guardar
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{editingClient.id.includes('_') ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                <button onClick={() => setEditingClient(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Negocio</label>
                <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none"
                    value={editingClient.businessName}
                    onChange={e => setEditingClient({...editingClient, businessName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Contacto</label>
                <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none"
                    value={editingClient.name}
                    onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Límite de Crédito ($)</label>
                <input 
                    type="number" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none font-bold"
                    value={editingClient.creditLimit}
                    onChange={e => setEditingClient({...editingClient, creditLimit: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Dirección</label>
                <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-bakery-400 outline-none"
                    value={editingClient.address}
                    onChange={e => setEditingClient({...editingClient, address: e.target.value})}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button 
                    onClick={() => handleSaveClient(editingClient)}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 shadow-md"
                >
                    Guardar Cliente
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModernSplineChart: React.FC<{ sales: Sale[]; days: number }> = ({ sales, days }) => {
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const daySales = sales.filter(
        (s) => new Date(s.date).toDateString() === d.toDateString()
      );
      const total = daySales.reduce((acc, curr) => acc + curr.totalAmount, 0);
      result.push({ date: d, value: total });
    }
    return result;
  }, [sales, days]);

  if (data.every((d) => d.value === 0)) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
        No hay datos suficientes para graficar.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 10);
  const getX = (index: number) => (index / (data.length - 1)) * 100;
  const getY = (val: number) => 100 - (val / maxVal) * 80 - 10; // Reserve padding

  let pathD = `M0,${getY(data[0].value)}`;
  for (let i = 0; i < data.length - 1; i++) {
    const x0 = getX(i);
    const y0 = getY(data[i].value);
    const x1 = getX(i + 1);
    const y1 = getY(data[i + 1].value);
    const cp1x = x0 + (x1 - x0) * 0.5;
    const cp2x = x1 - (x1 - x0) * 0.5;
    pathD += ` C${cp1x},${y0} ${cp2x},${y1} ${x1},${y1}`;
  }

  const fillPath = `${pathD} L100,100 L0,100 Z`;

  return (
    <div className="w-full h-full relative overflow-visible group">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#chartGradient)" />
        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
        {data.map((pt, i) => (
          <circle
            key={i}
            cx={getX(i)}
            cy={getY(pt.value)}
            r="2"
            fill="white"
            stroke="#c2410c"
            strokeWidth="1"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <title>
              {pt.date.toLocaleDateString()}: ${pt.value.toFixed(2)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        <span>{data[0].date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <span>{data[Math.floor(data.length / 2)].date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <span>Hoy</span>
      </div>
    </div>
  );
};

const SimulationPanel: React.FC<{ products: Product[] }> = ({ products }) => {
  const [simProducts, setSimProducts] = useState<SimProduct[]>([]);
  const [expenses, setExpenses] = useState<SimExpense[]>([
    { id: '1', name: 'Alquiler', amount: 0, frequency: 'monthly' },
    { id: '2', name: 'Nómina', amount: 0, frequency: 'weekly' },
  ]);

  useEffect(() => {
    if (products.length > 0 && simProducts.length === 0) {
      setSimProducts(products.map((p) => ({ ...p, simDailyQty: 0 })));
    }
  }, [products]);

  const updateSimQty = (id: string, qty: number) => {
    setSimProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, simDailyQty: Math.max(0, qty) } : p))
    );
  };

  const updateExpense = (id: string, field: keyof SimExpense, value: any) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const addExpense = () => {
    setExpenses([
      ...expenses,
      { id: crypto.randomUUID(), name: 'Nuevo Gasto', amount: 0, frequency: 'monthly' },
    ]);
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  // Calculations
  const dailyRevenue = simProducts.reduce((sum, p) => sum + p.priceRetail * p.simDailyQty, 0);
  const dailyCost = simProducts.reduce((sum, p) => sum + p.cost * p.simDailyQty, 0);
  const dailyGrossProfit = dailyRevenue - dailyCost;

  const dailyFixedExpenses = expenses.reduce((sum, e) => {
    if (e.frequency === 'daily') return sum + e.amount;
    if (e.frequency === 'weekly') return sum + e.amount / 7;
    if (e.frequency === 'monthly') return sum + e.amount / 30;
    return sum;
  }, 0);

  const dailyNetProfit = dailyGrossProfit - dailyFixedExpenses;
  const monthlyNetProfit = dailyNetProfit * 30;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 pb-20">
      {/* Configuration Column */}
      <div className="lg:col-span-2 space-y-8">
        {/* Product Simulator */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Simulación de Ventas Diarias</h3>
              <p className="text-xs text-gray-500">Estima cuántas unidades venderás al día.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {simProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Ganancia/ud: <span className="text-green-600 font-bold">${(p.priceRetail - p.cost).toFixed(2)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSimQty(p.id, p.simDailyQty - 5)}
                    className="w-8 h-8 flex items-center justify-center bg-white border rounded-lg hover:bg-gray-100"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={p.simDailyQty}
                    onChange={(e) => updateSimQty(p.id, parseInt(e.target.value) || 0)}
                    className="w-12 text-center font-bold bg-transparent focus:outline-none"
                  />
                  <button
                    onClick={() => updateSimQty(p.id, p.simDailyQty + 5)}
                    className="w-8 h-8 flex items-center justify-center bg-white border rounded-lg hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses Simulator */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <Wallet size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Gastos Operativos</h3>
                <p className="text-xs text-gray-500">Costos fijos recurrentes.</p>
              </div>
            </div>
            <button
              onClick={addExpense}
              className="text-xs font-bold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center gap-3">
                <input
                  type="text"
                  value={expense.name}
                  onChange={(e) => updateExpense(expense.id, 'name', e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  placeholder="Nombre del gasto"
                />
                <input
                  type="number"
                  value={expense.amount}
                  onChange={(e) => updateExpense(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-24 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-right focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  placeholder="0.00"
                />
                <select
                  value={expense.frequency}
                  onChange={(e) => updateExpense(expense.id, 'frequency', e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
                <button onClick={() => removeExpense(expense.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Results Column */}
      <div className="space-y-6">
        <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl sticky top-6">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Calculator size={20} className="text-purple-400" /> Resultados Proyectados
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Ventas Diarias Estimadas</span>
              <span className="font-bold">${dailyRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Costo Mercancía</span>
              <span className="font-bold text-red-400">-${dailyCost.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between items-center text-sm">
              <span className="text-gray-300">Utilidad Bruta Diaria</span>
              <span className="font-bold text-green-400">+${dailyGrossProfit.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm mt-4">
              <span className="text-gray-400">Gastos Fijos (Diario)</span>
              <span className="font-bold text-red-400">-${dailyFixedExpenses.toFixed(2)}</span>
            </div>

            <div className="border-t border-gray-700 pt-4 mt-4">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Utilidad Neta Mensual</p>
              <p className={`text-4xl font-bold ${monthlyNetProfit >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                ${monthlyNetProfit.toLocaleString('es-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                *Proyección basada en 30 días operando con estos promedios.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
