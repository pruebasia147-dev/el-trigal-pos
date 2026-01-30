
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { AppSettings, Client, Product, Sale, AuditLog, Payment } from '../types';
import SalesAnalytics from './SalesAnalytics';
import ClientCRM from './ClientCRM';
import { 
  LayoutDashboard, Package, Users, Settings, LogOut, 
  TrendingUp, DollarSign, Edit, Menu, X, Plus, BarChart3, 
  Wallet, Activity, Calculator, Trash2,
  CalendarDays, Coins, Warehouse, PieChart, ScrollText, UserCog, Truck, ArrowRight, Tag
} from 'lucide-react';

interface AdminProps {
  onLogout: () => void;
}

// --- Types for Simple Simulation ---
interface SimProduct extends Product {
    simDailyQty: number; // Cantidad diaria simulada
}

interface SimExpense {
    id: string;
    name: string;
    amount: number;
    frequency: 'Diario' | 'Semanal' | 'Mensual';
}

const AdminDashboard: React.FC<AdminProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'inventory' | 'clients' | 'simulation' | 'settings' | 'logs'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ exchangeRate: 0, businessName: '', rif: '', address: '', phone: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Reset States
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  // Chat State
  const [chatMessage, setChatMessage] = useState('');

  // Simple edit states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // --- MODAL STATES ---
  const [showProfitDetail, setShowProfitDetail] = useState(false);
  const [showCashFlowDetail, setShowCashFlowDetail] = useState(false);
  const [showCreditDetail, setShowCreditDetail] = useState(false);
  
  // New Modals for Secondary Cards
  const [showPendingProfitDetail, setShowPendingProfitDetail] = useState(false);
  const [showTotalDebtDetail, setShowTotalDebtDetail] = useState(false);
  const [showInventoryDetail, setShowInventoryDetail] = useState(false);
  const [showInventoryRetailDetail, setShowInventoryRetailDetail] = useState(false); // NEW

  // --- SIMPLE SIMULATION STATE ---
  const [simProducts, setSimProducts] = useState<SimProduct[]>([]);
  const [simExpenses, setSimExpenses] = useState<SimExpense[]>([
      { id: '1', name: 'Alquiler (Ejemplo)', amount: 10, frequency: 'Diario' }
  ]);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [p, c, s, st, pay] = await Promise.all([
      db.getProducts(),
      db.getClients(),
      db.getSales(),
      db.getSettings(),
      db.getPayments()
    ]);
    setProducts(p);
    setClients(c);
    setSales(s);
    setSettings(st);
    setPayments(pay);
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

  // Initialize Sim Products safely
  useEffect(() => {
      if (products.length > 0 && simProducts.length === 0) {
          setSimProducts(products.map(p => ({ 
              ...p, 
              simDailyQty: 0 
          })));
      }
  }, [products]);

  // --- SIMPLE SIMULATION HANDLERS ---
  const updateSimQty = (id: string, qty: number) => {
      setSimProducts(prev => prev.map(p => p.id === id ? { ...p, simDailyQty: qty } : p));
  };

  const addSimExpense = () => {
      if (!newExpenseName || !newExpenseAmount) return;
      setSimExpenses(prev => [...prev, {
          id: Date.now().toString(),
          name: newExpenseName,
          amount: parseFloat(newExpenseAmount),
          frequency: 'Diario'
      }]);
      setNewExpenseName('');
      setNewExpenseAmount('');
  };

  const removeSimExpense = (id: string) => {
      setSimExpenses(prev => prev.filter(e => e.id !== id));
  };

  // Simple Calculation Logic
  const simFinancials = useMemo(() => {
      const dailyRevenue = simProducts.reduce((sum, p) => sum + (p.priceWholesale * p.simDailyQty), 0);
      const dailyCost = simProducts.reduce((sum, p) => sum + (p.cost * p.simDailyQty), 0);
      
      const dailyExpenses = simExpenses.reduce((sum, e) => {
          // Normalize everything to Daily for this simple view
          if (e.frequency === 'Mensual') return sum + (e.amount / 30);
          if (e.frequency === 'Semanal') return sum + (e.amount / 7);
          return sum + e.amount;
      }, 0);

      const dailyGrossProfit = dailyRevenue - dailyCost;
      const dailyNetProfit = dailyGrossProfit - dailyExpenses;

      return {
          dailyRevenue,
          dailyCost,
          dailyExpenses,
          dailyNetProfit
      };
  }, [simProducts, simExpenses]);


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
              await db.clearAllSalesData((status) => setResetStatus(status));
              setSales([]);
              setClients(prev => prev.map(c => ({...c, debt: 0})));
              alert('✅ Sistema reiniciado a CERO exitosamente.');
              await loadData();
              setIsResetting(false);
              setResetStatus('');
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
          const itemCost = product ? product.cost * item.quantity : (item.subtotal * 0.7);
          cost += itemCost;
        });
      });
      return revenue - cost;
    };

    // Global Margin Calculation (Estimated)
    const totalSalesVol = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalProfitVol = getProfit(sales);
    const globalMargin = totalSalesVol > 0 ? (totalProfitVol / totalSalesVol) : 0.30; // Default 30% if no data

    // 1. Daily Stats
    const todaySales = sales.filter(s => new Date(s.date) >= startOfToday);
    const todayPayments = payments.filter(p => new Date(p.date) >= startOfToday);
    
    // Total Payments Received Today (Cobros de Deudas)
    const todayDebtCollection = todayPayments.reduce((acc, p) => acc + p.amount, 0);

    // Cash Sales (Mostrador) - Dinero Real
    const todayCashSales = todaySales.filter(s => s.type === 'pos');
    const todayCashSalesRevenue = todayCashSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const todayCashSalesProfit = getProfit(todayCashSales);

    // DINERO EN CAJA HOY = Ventas Mostrador + Cobros de Deuda
    const todayTotalCashInHand = todayCashSalesRevenue + todayDebtCollection;

    // GANANCIA LÍQUIDA HOY = Ganancia Mostrador + (Cobros de Deuda * Margen Estimado)
    // Asumimos que cuando entra un pago, una parte es costo recuperado y otra es ganancia realizada.
    const todayRealizedProfitFromDebt = todayDebtCollection * globalMargin;
    const todayTotalLiquidProfit = todayCashSalesProfit + todayRealizedProfitFromDebt;

    // Credit Sales (Despacho) - Cuentas por Cobrar (Generadas hoy)
    const todayCreditSales = todaySales.filter(s => s.type === 'dispatch');
    const todayCreditRevenue = todayCreditSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const todayCreditProfit = getProfit(todayCreditSales);

    // 2. Monthly Stats
    const monthSales = sales.filter(s => new Date(s.date) >= startOfMonth);
    const monthRevenue = monthSales.reduce((acc, curr) => acc + curr.totalAmount, 0); 
    
    // 3. Projections
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const avgDailyRevenue = monthRevenue / daysPassed;
    const projectedRevenue = monthRevenue + (avgDailyRevenue * (daysInMonth - daysPassed));

    // 4. Assets & Liabilities
    const totalDebt = clients.reduce((sum, c) => sum + c.debt, 0);
    const inventoryValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);
    const inventoryRetailValue = products.reduce((sum, p) => sum + (p.priceRetail * p.stock), 0); // NEW
    const lowStockCount = products.filter(p => p.stock <= 20).length;

    return { 
        todayTotalCashInHand, 
        todayTotalLiquidProfit, 
        todayCreditRevenue,
        todayCreditProfit,
        todayDebtCollection,
        todayCount: todaySales.length,
        monthRevenue, 
        projectedRevenue,
        totalDebt,
        inventoryValue,
        inventoryRetailValue, // Exported
        lowStockCount,
        todaySales,
        todayPayments, // Exported for Modal
        todayCashSales, // Exported for Modal
        todayCreditSales // Exported for Modal
    };
  };

  const financials = calculateFinancials();

  // --- Logic for Daily Profit Breakdown ---
  const getDailyProfitBreakdown = () => {
      const breakdown: any[] = [];

      // 1. POS Items
      const realizedSales = financials.todaySales.filter(s => s.type === 'pos');
      const productBreakdown: Record<string, any> = {};

      realizedSales.forEach(sale => {
          sale.items.forEach(item => {
              const prod = products.find(p => p.id === item.productId);
              const unitCost = prod ? prod.cost : (item.unitPrice * 0.6); 

              if (!productBreakdown[item.productId]) {
                  productBreakdown[item.productId] = {
                      name: item.productName,
                      qty: 0,
                      revenue: 0,
                      totalCost: 0,
                      unitCost: unitCost
                  };
              }
              productBreakdown[item.productId].qty += item.quantity;
              productBreakdown[item.productId].revenue += item.subtotal;
              productBreakdown[item.productId].totalCost += (unitCost * item.quantity);
          });
      });

      Object.values(productBreakdown).forEach(item => {
          breakdown.push({
              name: item.name,
              qty: item.qty,
              unitCost: item.unitCost,
              avgUnitPrice: item.revenue / item.qty,
              revenue: item.revenue,
              profit: item.revenue - item.totalCost,
              type: 'product'
          });
      });

      // 2. Debt Collections (Generic Entry)
      if (financials.todayDebtCollection > 0) {
          const estimatedMargin = financials.todayTotalLiquidProfit - breakdown.reduce((acc, i) => acc + i.profit, 0);
          breakdown.push({
              name: 'Cobros de Deuda (Varios)',
              qty: 1,
              unitCost: 0,
              avgUnitPrice: financials.todayDebtCollection,
              revenue: financials.todayDebtCollection,
              profit: estimatedMargin,
              type: 'collection'
          });
      }

      return breakdown.sort((a,b) => b.profit - a.profit);
  };

  // --- Logic for Pending Profit Detail ---
  const getPendingProfitBreakdown = () => {
      return financials.todayCreditSales.map(sale => {
          let totalCost = 0;
          sale.items.forEach(item => {
              const prod = products.find(p => p.id === item.productId);
              // Si el producto existe usamos su costo, si no, estimamos 70% del precio
              totalCost += prod ? (prod.cost * item.quantity) : (item.subtotal * 0.7);
          });
          return {
              id: sale.id,
              clientName: sale.clientName,
              revenue: sale.totalAmount,
              cost: totalCost,
              profit: sale.totalAmount - totalCost
          };
      }).sort((a, b) => b.profit - a.profit);
  };

  // --- Logic for Total Debt Detail ---
  const getDebtorsList = () => {
      return clients
        .filter(c => c.debt > 0)
        .sort((a, b) => b.debt - a.debt);
  };

  // --- Logic for Inventory (Cost) Detail ---
  const getInventoryList = () => {
      return products
        .map(p => ({
            ...p,
            totalValue: p.cost * p.stock
        }))
        .sort((a, b) => b.totalValue - a.totalValue);
  };

  // --- Logic for Inventory (Retail) Detail ---
  const getInventoryRetailList = () => {
      return products
        .map(p => ({
            ...p,
            totalRetailValue: p.priceRetail * p.stock
        }))
        .sort((a, b) => b.totalRetailValue - a.totalRetailValue);
  };

  const profitBreakdown = getDailyProfitBreakdown();
  const pendingProfitBreakdown = getPendingProfitBreakdown();
  const debtorsList = getDebtorsList();
  const inventoryList = getInventoryList();
  const inventoryRetailList = getInventoryRetailList(); // NEW

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
            { id: 'simulation', label: 'Simulador (Básico)', icon: Calculator },
            { id: 'clients', label: 'Clientes CRM', icon: Users },
            { id: 'inventory', label: 'Inventario', icon: Package },
            { id: 'logs', label: 'Actividad', icon: ScrollText },
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
            
            {/* --- Section 1: The "Big 3" Cards --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* CARD 1: CASH FLOW (CLICKABLE) */}
                 <div 
                    onClick={() => setShowCashFlowDetail(true)}
                    className="bg-gray-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48 group cursor-pointer hover:scale-[1.01] transition-all"
                 >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80}/></div>
                    <div>
                        <div className="flex items-center gap-2 text-bakery-400 mb-1">
                            <Activity size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Dinero en Caja (Hoy)</span>
                        </div>
                        <h3 className="text-4xl font-bold tracking-tight">${financials.todayTotalCashInHand.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">Ventas Contado + Cobros Deuda <ArrowRight size={14}/></p>
                    </div>
                 </div>

                 {/* CARD 2: CREDIT DISPATCHES (CLICKABLE) */}
                 <div 
                    onClick={() => setShowCreditDetail(true)}
                    className="bg-blue-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48 group cursor-pointer hover:scale-[1.01] transition-all"
                 >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Truck size={80}/></div>
                    <div>
                        <div className="flex items-center gap-2 text-blue-200 mb-1">
                            <Truck size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Despachos a Crédito (Hoy)</span>
                        </div>
                        <h3 className="text-4xl font-bold tracking-tight">${financials.todayCreditRevenue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <p className="text-sm text-blue-100 mt-1 flex items-center gap-1">Mercancía entregada por cobrar <ArrowRight size={14}/></p>
                    </div>
                 </div>

                 {/* CARD 3: LIQUID PROFIT (CLICKABLE) */}
                 <div 
                    onClick={() => setShowProfitDetail(true)}
                    className="bg-emerald-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48 group cursor-pointer hover:shadow-2xl hover:scale-[1.01] transition-all"
                 >
                     <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={80}/></div>
                     <div>
                        <div className="flex items-center gap-2 text-emerald-100 mb-1">
                            <Wallet size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Ganancia Líquida (Hoy)</span>
                        </div>
                        <h3 className="text-4xl font-bold tracking-tight">${financials.todayTotalLiquidProfit.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <div className="flex items-center justify-between mt-1">
                             <p className="text-sm text-emerald-100 opacity-90">Realizada (Caja + Abonos)</p>
                             <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-white/30 transition-colors">
                                <PieChart size={12} /> Ver Desglose
                             </span>
                        </div>
                    </div>
                 </div>
            </div>

            {/* --- Section 2: Secondary Stats (Updated to 4 cards) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                    onClick={() => setShowPendingProfitDetail(true)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group h-full"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                                Ganancia Por Cobrar <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                            </p>
                            <h3 className="text-3xl font-bold text-blue-600 tracking-tight">${financials.todayCreditProfit.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400">Estimada en despachos de hoy</p>
                </div>

                <div 
                    onClick={() => setShowTotalDebtDetail(true)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group h-full"
                >
                    <div className="flex justify-between items-start mb-2">
                         <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 flex items-center gap-1 group-hover:text-red-600 transition-colors">
                                Total Cuentas por Cobrar <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                            </p>
                            <h3 className="text-3xl font-bold text-red-600 tracking-tight">${financials.totalDebt.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        </div>
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-100 transition-colors">
                            <Coins size={24} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400">Capital pendiente acumulado</p>
                </div>

                <div 
                    onClick={() => setShowInventoryDetail(true)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group h-full"
                >
                    <div className="flex justify-between items-start mb-2">
                         <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 flex items-center gap-1 group-hover:text-blue-700 transition-colors">
                                Inventario (Costo)
                            </p>
                            <h3 className="text-3xl font-bold text-blue-900 tracking-tight">${financials.inventoryValue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        </div>
                        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl group-hover:bg-blue-200 transition-colors">
                            <Warehouse size={24} />
                        </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 w-fit rounded-md ${financials.lowStockCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {financials.lowStockCount} alertas stock
                    </span>
                </div>

                {/* NEW CARD: INVENTORY RETAIL VALUE */}
                <div 
                    onClick={() => setShowInventoryRetailDetail(true)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group h-full"
                >
                    <div className="flex justify-between items-start mb-2">
                         <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 flex items-center gap-1 group-hover:text-purple-600 transition-colors">
                                Inventario (Venta) <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                            </p>
                            <h3 className="text-3xl font-bold text-purple-600 tracking-tight">${financials.inventoryRetailValue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-100 transition-colors">
                            <Tag size={24} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400">Ingreso potencial bruto</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
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
                <div className="h-64 w-full">
                    <ModernSplineChart sales={sales} days={14} />
                </div>
            </div>
          </div>
        )}

        {/* ... (Rest of tabs: Analytics) ... */}
        {activeTab === 'analytics' && (
            <SalesAnalytics sales={sales} products={products} settings={settings} onRefresh={loadData} />
        )}

        {/* ... (Rest of tabs and content) ... */}
        {/* ... [Kept content for simulation, inventory, clients, logs] ... */}
        {/* --- RESTORED ORIGINAL (SIMPLE) SIMULATION PANEL --- */}
        {activeTab === 'simulation' && (
            <div className="animate-in fade-in duration-500 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">Simulador de Rentabilidad (Básico)</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                         <p className="text-xs text-gray-500 uppercase font-bold">Ventas Diarias Est.</p>
                         <p className="text-2xl font-bold text-blue-600">${simFinancials.dailyRevenue.toFixed(2)}</p>
                     </div>
                     <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                         <p className="text-xs text-gray-500 uppercase font-bold">Costo Mercancía</p>
                         <p className="text-2xl font-bold text-red-400">-${simFinancials.dailyCost.toFixed(2)}</p>
                     </div>
                     <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                         <p className="text-xs text-gray-500 uppercase font-bold">Gastos Operativos</p>
                         <p className="text-2xl font-bold text-orange-400">-${simFinancials.dailyExpenses.toFixed(2)}</p>
                     </div>
                     <div className={`p-4 rounded-xl shadow-sm border ${simFinancials.dailyNetProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                         <p className={`text-xs uppercase font-bold ${simFinancials.dailyNetProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Ganancia Neta Diaria</p>
                         <p className={`text-2xl font-bold ${simFinancials.dailyNetProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>${simFinancials.dailyNetProfit.toFixed(2)}</p>
                     </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Products Table */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-800">Proyección por Producto</h3>
                        </div>
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-sm">
                                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <tr className="text-xs text-gray-500 uppercase text-left">
                                        <th className="p-3">Producto</th>
                                        <th className="p-3 text-center">Venta Diaria (Unds)</th>
                                        <th className="p-3 text-right">Margen Unit.</th>
                                        <th className="p-3 text-right">Ganancia Día</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {simProducts.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="p-3 font-medium text-gray-800">{p.name}</td>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="number" 
                                                    className="w-20 text-center border rounded-lg p-1 font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={p.simDailyQty}
                                                    onChange={(e) => updateSimQty(p.id, parseInt(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="p-3 text-right text-gray-500">${(p.priceWholesale - p.cost).toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold text-green-600">${((p.priceWholesale - p.cost) * p.simDailyQty).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Expenses Section */}
                    <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                        <h3 className="font-bold text-gray-800 mb-4">Gastos Fijos</h3>
                        
                        <div className="space-y-3 mb-4">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Concepto" 
                                    className="flex-1 p-2 border rounded-lg text-sm"
                                    value={newExpenseName}
                                    onChange={e => setNewExpenseName(e.target.value)}
                                />
                                <input 
                                    type="number" 
                                    placeholder="$" 
                                    className="w-20 p-2 border rounded-lg text-sm"
                                    value={newExpenseAmount}
                                    onChange={e => setNewExpenseAmount(e.target.value)}
                                />
                            </div>
                            <button onClick={addSimExpense} className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-bold">Agregar Gasto</button>
                        </div>

                        <div className="space-y-2">
                            {simExpenses.map(e => (
                                <div key={e.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg text-sm">
                                    <span>{e.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">${e.amount}</span>
                                        <button onClick={() => removeSimExpense(e.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'inventory' && (
            // ... content ...
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
      </main>

      {/* --- MODAL 1: CASH FLOW DETAILS --- */}
      {showCashFlowDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-900 text-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Activity size={20} /> Dinero en Caja (Entradas)
                        </h2>
                        <p className="text-xs text-gray-400">Desglose de ingresos físicos de hoy.</p>
                    </div>
                    <button onClick={() => setShowCashFlowDetail(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 sticky top-0 shadow-sm z-10 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3 font-bold">Concepto</th>
                                <th className="px-6 py-3 font-bold text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* Line 1: Summary of POS Sales */}
                            <tr className="bg-orange-50/50">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900">Ventas Mostrador (Global)</p>
                                    <p className="text-xs text-gray-500">{financials.todayCashSales.length} transacciones de contado</p>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">
                                    ${(financials.todayTotalCashInHand - financials.todayDebtCollection).toFixed(2)}
                                </td>
                            </tr>
                            {/* Line 2+: Specific Debt Payments */}
                            {financials.todayPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-4 text-center text-gray-400 italic text-xs">
                                        No se han recibido abonos de clientes hoy.
                                    </td>
                                </tr>
                            ) : (
                                financials.todayPayments.map(pay => {
                                    const clientName = clients.find(c => c.id === pay.clientId)?.businessName || 'Cliente';
                                    return (
                                        <tr key={pay.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-3">
                                                <p className="font-bold text-gray-800">Abono: {clientName}</p>
                                                {pay.note && <p className="text-xs text-gray-500 italic">"{pay.note}"</p>}
                                                <p className="text-[10px] text-gray-400">{new Date(pay.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium text-blue-600">
                                                +${pay.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-between items-center">
                     <span className="font-bold text-gray-500 uppercase text-xs">Total Caja</span>
                     <span className="font-bold text-2xl text-gray-900">${financials.todayTotalCashInHand.toFixed(2)}</span>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 2: CREDIT DISPATCH DETAILS --- */}
      {showCreditDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Truck size={20} /> Despachos a Crédito
                        </h2>
                        <p className="text-xs text-blue-100">Mercancía entregada pendiente de cobro hoy.</p>
                    </div>
                    <button onClick={() => setShowCreditDetail(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 sticky top-0 shadow-sm z-10 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3 font-bold">Cliente / Factura</th>
                                <th className="px-6 py-3 font-bold text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {financials.todayCreditSales.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-8 text-center text-gray-400 italic">
                                        No hay despachos a crédito registrados hoy.
                                    </td>
                                </tr>
                            ) : (
                                financials.todayCreditSales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-800">{sale.clientName}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                <span className="font-mono bg-gray-100 px-1 rounded">#{sale.id.slice(0,6)}</span>
                                                <span>• {sale.items.length} productos</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-blue-600">
                                            ${sale.totalAmount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                 <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-between items-center">
                     <span className="font-bold text-gray-500 uppercase text-xs">Total por Cobrar</span>
                     <span className="font-bold text-2xl text-blue-600">${financials.todayCreditRevenue.toFixed(2)}</span>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 3: PROFIT DETAIL (Existing Updated) --- */}
      {showProfitDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-emerald-600 text-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Wallet size={20} /> Ganancia Líquida (Realizada)
                        </h2>
                        <p className="text-xs text-emerald-100">Incluye mostrador y cobros de deuda recibidos hoy.</p>
                    </div>
                    <button onClick={() => setShowProfitDetail(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="px-6 py-4 font-bold bg-white">Concepto</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Cant/Trans</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Costo Est.</th>
                                <th className="px-6 py-4 font-bold text-right bg-white">Ingreso Total</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-emerald-700">Ganancia Calc.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {profitBreakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400">
                                        No hay movimientos de dinero hoy.
                                    </td>
                                </tr>
                            ) : (
                                profitBreakdown.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-800">
                                            {item.name} 
                                            {item.type === 'collection' && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-2">Abono</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 px-2 py-1 rounded-md font-bold text-gray-700">{item.qty}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            ${(item.type === 'product' ? item.unitCost * item.qty : 0).toFixed(2)}
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

                <div className="p-6 bg-gray-50 text-gray-900 border-t border-gray-200 rounded-b-2xl flex justify-between items-center z-20">
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Total Líquido</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-600">${financials.todayTotalLiquidProfit.toFixed(2)}</p>
                        <p className="text-xs text-emerald-600">Ganancia en Mano</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 4: PENDING PROFIT (NEW) --- */}
      {showPendingProfitDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <TrendingUp size={20} /> Ganancia Por Cobrar (Hoy)
                        </h2>
                        <p className="text-xs text-blue-100">Margen de ganancia estimado en despachos entregados hoy.</p>
                    </div>
                    <button onClick={() => setShowPendingProfitDetail(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="px-6 py-4 font-bold bg-white">Factura / Cliente</th>
                                <th className="px-6 py-4 font-bold text-right bg-white">Venta Total</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-gray-500">Costo Real</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-blue-700">Ganancia Est.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {pendingProfitBreakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-400">
                                        No hay despachos a crédito hoy.
                                    </td>
                                </tr>
                            ) : (
                                pendingProfitBreakdown.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-800">{item.clientName}</p>
                                            <span className="font-mono text-xs text-gray-400">#{item.id.slice(0,6)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-800">
                                            ${item.revenue.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            -${item.cost.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-blue-600 bg-blue-50/30">
                                            +${item.profit.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-gray-50 text-gray-900 border-t border-gray-200 rounded-b-2xl flex justify-between items-center z-20">
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Total Ganancia Estimada</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-blue-600">${financials.todayCreditProfit.toFixed(2)}</p>
                        <p className="text-xs text-blue-500">Pendiente de cobro</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 5: TOTAL DEBT DETAIL (NEW) --- */}
      {showTotalDebtDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-600 text-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Coins size={20} /> Cuentas Por Cobrar
                        </h2>
                        <p className="text-xs text-red-100">Listado de clientes con saldo pendiente.</p>
                    </div>
                    <button onClick={() => setShowTotalDebtDetail(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 sticky top-0 shadow-sm z-10 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3 font-bold">Cliente</th>
                                <th className="px-6 py-3 font-bold text-right">Deuda Actual</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {debtorsList.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-12 text-center text-gray-400 italic">
                                        ¡Excelente! Nadie debe dinero.
                                    </td>
                                </tr>
                            ) : (
                                debtorsList.map(client => (
                                    <tr key={client.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-800">{client.businessName}</p>
                                            <p className="text-xs text-gray-500">{client.name}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-red-600">
                                            ${client.debt.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-between items-center">
                     <span className="font-bold text-gray-500 uppercase text-xs">Deuda Total</span>
                     <span className="font-bold text-2xl text-red-600">${financials.totalDebt.toFixed(2)}</span>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 6: INVENTORY COST DETAIL --- */}
      {showInventoryDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-800 text-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Warehouse size={20} /> Valor de Inventario (Costo)
                        </h2>
                        <p className="text-xs text-blue-200">Valorización de existencias al costo actual.</p>
                    </div>
                    <button onClick={() => setShowInventoryDetail(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="px-6 py-4 font-bold bg-white">Producto</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Existencia</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-gray-500">Costo Unit.</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-blue-800">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {inventoryList.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-400">
                                        Inventario vacío.
                                    </td>
                                </tr>
                            ) : (
                                inventoryList.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-800">
                                            {p.name}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${p.stock < 20 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'}`}>
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            ${p.cost.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-blue-800 bg-blue-50/30">
                                            ${p.totalValue.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-gray-50 text-gray-900 border-t border-gray-200 rounded-b-2xl flex justify-between items-center z-20">
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Valor Total Activos</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-blue-900">${financials.inventoryValue.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 7: INVENTORY RETAIL DETAIL (NEW) --- */}
      {showInventoryRetailDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-600 text-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Tag size={20} /> Inventario (Valor Venta)
                        </h2>
                        <p className="text-xs text-purple-100">Ingreso potencial si se vende todo el stock actual.</p>
                    </div>
                    <button onClick={() => setShowInventoryRetailDetail(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="px-6 py-4 font-bold bg-white">Producto</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Existencia</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-gray-500">Precio Venta</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-purple-700">Total Potencial</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {inventoryRetailList.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-400">
                                        Inventario vacío.
                                    </td>
                                </tr>
                            ) : (
                                inventoryRetailList.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-800">
                                            {p.name}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${p.stock < 20 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'}`}>
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            ${p.priceRetail.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-purple-700 bg-purple-50/30">
                                            ${p.totalRetailValue.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-gray-50 text-gray-900 border-t border-gray-200 rounded-b-2xl flex justify-between items-center z-20">
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Ingreso Bruto Potencial</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-purple-600">${financials.inventoryRetailValue.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* ... Other Modals ... */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in duration-200">
            {/* ... Content of Edit Product ... */}
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{editingProduct.id.includes('-') ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                <button onClick={() => setEditingProduct(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
            </div>
            {/* Reuse existing inputs... just adding placeholder for structure */}
             <div className="grid grid-cols-2 gap-4">
                 {/* ... Inputs ... */}
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
      
      {editingClient && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in duration-200">
             {/* ... Client Edit Form ... */}
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

// --- ModernSplineChart Component ---
const ModernSplineChart: React.FC<{ sales: Sale[], days: number }> = ({ sales, days }) => {
  const chartData = useMemo(() => {
    const data: { date: string, amount: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayStr = d.toDateString();
        const dailyTotal = sales
            .filter(s => new Date(s.date).toDateString() === dayStr)
            .reduce((sum, s) => sum + s.totalAmount, 0);
        data.push({
            date: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
            amount: dailyTotal
        });
    }
    return data;
  }, [sales, days]);

  const maxVal = Math.max(...chartData.map(d => d.amount), 10);
  
  const getX = (index: number) => (index / (chartData.length - 1)) * 100;
  const getY = (val: number) => 100 - ((val / maxVal) * 80) - 10;

  if (chartData.length < 2) return <div className="h-full flex items-center justify-center text-gray-400 text-xs">Insuficientes datos</div>;

  let pathD = `M0,${getY(chartData[0].amount)}`;
  for (let i = 0; i < chartData.length - 1; i++) {
      const x0 = getX(i);
      const y0 = getY(chartData[i].amount);
      const x1 = getX(i + 1);
      const y1 = getY(chartData[i + 1].amount);
      const cp1x = x0 + (x1 - x0) * 0.5;
      const cp1y = y0;
      const cp2x = x1 - (x1 - x0) * 0.5;
      const cp2y = y1;
      pathD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1}`;
  }

  const areaPath = `${pathD} L100,100 L0,100 Z`;

  return (
      <div className="w-full h-full relative group">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                  <linearGradient id="splineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                  </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#splineGradient)" />
              <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
              {chartData.map((d, i) => (
                  <g key={i}>
                      <circle cx={getX(i)} cy={getY(d.amount)} r="2" fill="white" stroke="#f97316" strokeWidth="1" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </g>
              ))}
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400 px-1">
                <span>{chartData[0].date}</span>
                <span>{chartData[chartData.length - 1].date}</span>
          </div>
      </div>
  );
};

export default AdminDashboard;
