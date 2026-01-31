
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Client, Product, Sale, AppSettings } from '../types';
import html2canvas from 'html2canvas';
import { 
  User, MapPin, TrendingUp, Calendar, Search, Pencil, 
  FileText, ChevronRight, Star, BrainCircuit, Wallet, CheckCircle, Package,
  Share2, X as XIcon, Store as StoreIcon, Truck, Filter
} from 'lucide-react';

interface ClientCRMProps {
  clients: Client[];
  sales: Sale[];
  products: Product[];
  settings: AppSettings;
  onEditClient: (client: Client) => void;
  onRefreshData: () => Promise<void>;
}

const ClientCRM: React.FC<ClientCRMProps> = ({ clients, sales, products, settings, onEditClient, onRefreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showSaleDetail, setShowSaleDetail] = useState<Sale | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // New State for List Filter
  const [listFilter, setListFilter] = useState<'all' | 'today'>('all');

  // --- Actions ---
  const handlePayment = async () => {
    if (!selectedClientId || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
        alert("Por favor ingresa un monto válido");
        return;
    }

    setIsProcessing(true);
    try {
      await db.registerClientPayment(selectedClientId, amount);
      
      // CRUCIAL: Esperar a que se actualicen los datos globales antes de cerrar
      await onRefreshData(); 
      
      setPaymentAmount('');
      setShowPaymentModal(false);
      alert("✅ Abono registrado correctamente. Verificando en Dashboard...");
    } catch (e) {
      console.error(e);
      alert('Error al registrar pago. Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreOrder = () => {
    alert("🚀 Funcionalidad Pre-Orden:\n\nEn la versión completa, al hacer clic aquí, el sistema llevará automáticamente estos productos sugeridos al 'Carrito de Despacho', ahorrando tiempo al vendedor.");
  };

  // 1. Trigger Print: Set state to render the invoice component
  const handlePrint = (sale: Sale) => {
    setSaleToPrint(sale);
  };

  // 2. Watch state: Wait for render, then print, then cleanup
  useEffect(() => {
    let printTimer: ReturnType<typeof setTimeout>;
    let clearTimer: ReturnType<typeof setTimeout>;

    if (saleToPrint) {
        printTimer = setTimeout(() => {
            window.print();
            clearTimer = setTimeout(() => {
                setSaleToPrint(null);
            }, 1000);
        }, 500);
    }

    return () => {
        clearTimeout(printTimer);
        clearTimeout(clearTimer);
    };
  }, [saleToPrint]);

  const handleSmartShare = async () => {
      // Target the specific inner content div that holds the receipt design
      const element = document.getElementById('receipt-content-inner');
      if (!element) return;

      setIsCapturing(true);

      try {
          // Professional Setting: Scale 6 ensures crisp text even after WhatsApp compression
          // We capture the specific element, bypassing the scroll container
          const canvas = await html2canvas(element, {
              scale: 6,
              backgroundColor: '#ffffff',
              logging: false,
              useCORS: true,
              allowTaint: true,
              windowHeight: element.scrollHeight + 100 // Ensure full height capture
          });

          canvas.toBlob(async (blob) => {
              if (!blob) {
                  setIsCapturing(false);
                  return;
              }

              const docId = showSaleDetail?.id.slice(0,6).toUpperCase();
              const clientName = showSaleDetail?.clientName || 'Cliente';
              const file = new File([blob], `factura-${docId}.png`, { type: "image/png" });

              // Mensaje Simplificado
              const shareTitle = `Factura #${docId}`;
              
              // TEXTO WHATSAPP: Solo dice "Comprobante de pago"
              const shareText = `Comprobante de pago`;

              // 1. Try Native Share (Mobile)
              if (navigator.share && navigator.canShare({ files: [file] })) {
                  try {
                      await navigator.share({
                          files: [file],
                          title: shareTitle,
                          text: shareText
                      });
                  } catch (e) {
                      console.log('User cancelled share');
                  }
              } 
              // 2. Try Clipboard (Desktop)
              else if (navigator.clipboard && navigator.clipboard.write) {
                   try {
                       await navigator.clipboard.write([
                           new ClipboardItem({ [blob.type]: blob })
                       ]);
                       alert('¡Imagen copiada!\n\nVe a WhatsApp y pega la imagen (Ctrl+V).\n\nMensaje sugerido:\n' + shareText);
                   } catch (e) {
                       // Fallback to download
                       const link = document.createElement('a');
                       link.href = canvas.toDataURL('image/png');
                       link.download = `factura-${docId}.png`;
                       link.click();
                   }
              } 
              // 3. Fallback Download
              else {
                  const link = document.createElement('a');
                  link.href = canvas.toDataURL('image/png');
                  link.download = `factura-${docId}.png`;
                  link.click();
              }
              setIsCapturing(false);
          });
      } catch (error) {
          console.error("Error capturing receipt", error);
          alert("No se pudo generar la imagen.");
          setIsCapturing(false);
      }
  };

  // --- Logic & Data Processing ---
  
  // 1. Get Today's Client IDs
  const todayStr = new Date().toDateString();
  const todaySalesMap = sales.reduce((acc, sale) => {
      if (sale.type === 'dispatch' && new Date(sale.date).toDateString() === todayStr && sale.clientId) {
          acc[sale.clientId] = (acc[sale.clientId] || 0) + sale.totalAmount;
      }
      return acc;
  }, {} as Record<string, number>);
  
  const clientsWithSalesToday = Object.keys(todaySalesMap);

  // 2. Filter Clients based on Tab and Search
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.businessName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (listFilter === 'today') {
        return matchesSearch && clientsWithSalesToday.includes(c.id);
    }
    return matchesSearch;
  });

  const totalClientsDebt = clients.reduce((acc, client) => acc + client.debt, 0);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const clientSales = sales.filter(s => s.clientId === selectedClientId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Stats Calculation
  const totalSpent = clientSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const avgOrder = clientSales.length ? totalSpent / clientSales.length : 0;
  
  // --- AI: Prediction Logic ---
  const getLastPurchaseDate = () => clientSales.length > 0 ? new Date(clientSales[0].date) : null;
  const lastPurchase = getLastPurchaseDate();
  
  let predictionWhen = "Datos insuficientes.";
  let statusColor = "bg-gray-100 text-gray-600";
  let statusText = "Nuevo";
  let frequencyDays = 0;
  let probability = 0;

  if (clientSales.length > 2) {
      const firstSale = new Date(clientSales[clientSales.length - 1].date);
      const daysDiff = (new Date().getTime() - firstSale.getTime()) / (1000 * 3600 * 24);
      frequencyDays = daysDiff / clientSales.length;

      if (totalSpent > 500) {
        statusColor = "bg-purple-100 text-purple-700 border border-purple-200";
        statusText = "VIP";
      } else if (frequencyDays < 7) {
        statusColor = "bg-emerald-100 text-emerald-700 border border-emerald-200";
        statusText = "Frecuente";
      } else {
        statusColor = "bg-blue-100 text-blue-700 border border-blue-200";
        statusText = "Regular";
      }

      const daysSinceLast = lastPurchase ? (new Date().getTime() - lastPurchase.getTime()) / (1000 * 3600 * 24) : 0;
      const daysUntilNext = frequencyDays - daysSinceLast;
      
      // Calculate Probability based on cycle
      if (daysUntilNext < -frequencyDays) probability = 10; // Very late
      else if (daysUntilNext < 0) probability = 90; // Overdue slightly
      else if (daysUntilNext < 1) probability = 95; // Due today
      else probability = Math.max(10, 100 - (daysUntilNext * 10));

      if (daysUntilNext < -2) {
        predictionWhen = `⚠️ Retrasado (${frequencyDays.toFixed(0)} días ciclo)`;
      } else if (daysUntilNext <= 1) {
        predictionWhen = `🎯 Probable compra HOY`;
      } else {
        predictionWhen = `En aprox. ${daysUntilNext.toFixed(0)} días`;
      }
  }

  // AI Product Prediction
  const productStats: Record<string, { count: number, totalQty: number, name: string }> = {};
  clientSales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productStats[item.productId]) productStats[item.productId] = { count: 0, totalQty: 0, name: item.productName };
      productStats[item.productId].count += 1;
      productStats[item.productId].totalQty += item.quantity;
    });
  });

  const predictedItems = Object.entries(productStats)
    .map(([id, stats]) => ({
      id, name: stats.name, avgQty: Math.round(stats.totalQty / stats.count), probability: stats.count / clientSales.length
    }))
    .filter(item => item.probability > 0.4)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500 font-sans">
      
      {/* WRAPPER FOR PRINT HIDING */}
      <div className="print:hidden flex w-full h-full gap-6">

        {/* Left List */}
        <div className={`w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col ${selectedClientId ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 mb-1 text-lg">Cartera de Clientes</h2>
                
                {/* Tabs Filter */}
                <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                    <button 
                        onClick={() => setListFilter('all')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Todos
                    </button>
                    <button 
                        onClick={() => setListFilter('today')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${listFilter === 'today' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Truck size={14}/>
                        Despachos Hoy
                        {clientsWithSalesToday.length > 0 && (
                            <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{clientsWithSalesToday.length}</span>
                        )}
                    </button>
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-bakery-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bakery-400 text-sm transition-all text-gray-900 shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {listFilter === 'today' && filteredClients.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                        <Truck size={32} className="mx-auto mb-2 opacity-20"/>
                        <p className="text-sm">No hay despachos registrados hoy.</p>
                    </div>
                )}

                {filteredClients.map(client => {
                    const boughtToday = todaySalesMap[client.id];
                    return (
                        <div 
                            key={client.id}
                            onClick={() => setSelectedClientId(client.id)}
                            className={`p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-50 group border ${selectedClientId === client.id ? 'bg-orange-50 border-orange-200 shadow-sm' : 'border-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold transition-colors ${selectedClientId === client.id ? 'text-bakery-800' : 'text-gray-800 group-hover:text-bakery-700'}`}>{client.businessName}</span>
                                {listFilter === 'today' && boughtToday ? (
                                    <span className="bg-green-100 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        <CheckCircle size={10}/>
                                        ${boughtToday.toFixed(0)}
                                    </span>
                                ) : (
                                    client.debt > 0 && (
                                        <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] px-2 py-0.5 rounded-full font-bold">Deuda</span>
                                    )
                                )}
                            </div>
                            <p className="text-sm text-gray-500 mb-1">{client.name}</p>
                            {listFilter === 'today' && (
                                <p className="text-[10px] text-blue-600 font-medium mt-1">Clic para ver nota y compartir</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Right Detail Panel */}
        <div className={`w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col ${!selectedClientId ? 'hidden lg:flex' : 'flex'}`}>
            {selectedClient ? (
                <>
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <button onClick={() => setSelectedClientId(null)} className="lg:hidden text-gray-500 mb-2 flex items-center gap-1 text-sm font-medium"><ChevronRight className="rotate-180" size={16}/> Volver a la lista</button>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-bold text-gray-900">{selectedClient.businessName}</h2>
                                <span className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>
                                    {statusText}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                            <MapPin size={14}/> {selectedClient.address}
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setShowPaymentModal(true)}
                                className="flex-1 sm:flex-none bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                            >
                                <Wallet size={18} /> Abonar
                            </button>
                            <button 
                                onClick={() => onEditClient(selectedClient)}
                                className="bg-white border border-gray-200 text-gray-600 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                            >
                                <Pencil size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-50/30">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Compras Totales</p>
                                <p className="text-2xl font-bold text-gray-900">${totalSpent.toFixed(0)}</p>
                            </div>
                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Ticket Promedio</p>
                                <p className="text-2xl font-bold text-gray-900">${avgOrder.toFixed(0)}</p>
                            </div>
                            <div className={`p-5 border shadow-sm rounded-2xl ${selectedClient.debt > 0 ? 'bg-white border-red-200 ring-2 ring-red-50' : 'bg-white border-gray-100'}`}>
                                <p className={`text-xs font-bold uppercase mb-1 ${selectedClient.debt > 0 ? 'text-red-500' : 'text-gray-400'}`}>Deuda Actual</p>
                                <p className={`text-2xl font-bold ${selectedClient.debt > 0 ? 'text-red-600' : 'text-gray-900'}`}>${selectedClient.debt.toFixed(0)}</p>
                            </div>
                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Crédito Disp.</p>
                                <p className="text-2xl font-bold text-gray-900">${(selectedClient.creditLimit - selectedClient.debt).toFixed(0)}</p>
                            </div>
                        </div>

                        {/* --- AI INTELLIGENCE SECTION --- */}
                         <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm mb-8 relative overflow-hidden group">
                             {/* Decorative Background */}
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                 <BrainCircuit size={120} className="text-indigo-600"/>
                             </div>
                             
                             <div className="flex items-center gap-3 mb-6 relative z-10">
                                 <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                                     <BrainCircuit size={20} />
                                 </div>
                                 <div>
                                     <h3 className="font-bold text-gray-900 text-lg leading-tight">Análisis Predictivo</h3>
                                     <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Powered by El Trigal AI</p>
                                 </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                 {/* Behavioral Analysis */}
                                 <div className="space-y-6">
                                     <div className="flex items-start gap-4">
                                         <div className="p-3 bg-white rounded-xl border border-indigo-50 shadow-sm text-indigo-600">
                                             <Calendar size={24} />
                                         </div>
                                         <div>
                                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Ciclo de Compra Promedio</p>
                                             <p className="text-xl font-bold text-gray-900">
                                                 {frequencyDays > 0 ? `Cada ${frequencyDays.toFixed(1)} días` : 'Calculando...'}
                                             </p>
                                             <p className="text-xs text-gray-500 leading-snug mt-1 max-w-[220px]">
                                                 Basado en la frecuencia de las últimas {Math.min(clientSales.length, 10)} transacciones.
                                             </p>
                                         </div>
                                     </div>

                                     <div className="flex items-start gap-4">
                                         <div className="p-3 bg-white rounded-xl border border-indigo-50 shadow-sm text-pink-600">
                                             <Star size={24} />
                                         </div>
                                         <div>
                                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Próxima Visita Estimada</p>
                                             <p className="text-xl font-bold text-gray-900">{predictionWhen}</p>
                                             {frequencyDays > 0 && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 w-[70%] rounded-full animate-pulse" style={{ width: `${probability}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-bold">{probability.toFixed(0)}% Prob.</span>
                                                </div>
                                             )}
                                         </div>
                                     </div>
                                 </div>

                                 {/* Suggested Products (Right Col) */}
                                 <div className="bg-white/60 rounded-xl border border-indigo-50 p-4">
                                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                                         <Package size={12}/> Productos Sugeridos (Smart Refill)
                                     </p>
                                     <div className="space-y-2">
                                         {predictedItems.length === 0 ? (
                                             <p className="text-xs text-gray-400 italic">Sin suficientes datos para predecir.</p>
                                         ) : (
                                             predictedItems.map((item, idx) => (
                                                 <div key={item.id} className="flex justify-between items-center text-sm group/item">
                                                     <div className="flex items-center gap-2">
                                                         <span className="w-5 h-5 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm">
                                                             {idx + 1}
                                                         </span>
                                                         <span className="text-gray-700 font-medium group-hover/item:text-indigo-700 transition-colors">{item.name}</span>
                                                     </div>
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-xs text-gray-400">~{item.avgQty} un</span>
                                                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                     </div>
                                                 </div>
                                             ))
                                         )}
                                     </div>
                                     <button 
                                         onClick={handlePreOrder}
                                         className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1"
                                     >
                                        <Truck size={12} /> Cargar Pedido Sugerido
                                     </button>
                                 </div>
                             </div>
                         </div>

                         {/* Recent History */}
                         <div>
                             <h3 className="font-bold text-gray-900 text-lg mb-4">Historial de Compras</h3>
                             <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                                 {clientSales.length === 0 ? (
                                     <div className="p-8 text-center text-gray-400">
                                         <FileText size={32} className="mx-auto mb-2 opacity-20"/>
                                         <p>Este cliente aún no tiene compras registradas.</p>
                                     </div>
                                 ) : (
                                     <table className="w-full text-left text-sm">
                                         <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase font-bold">
                                             <tr>
                                                 <th className="px-6 py-4">Fecha</th>
                                                 <th className="px-6 py-4">ID</th>
                                                 <th className="px-6 py-4 text-center">Items</th>
                                                 <th className="px-6 py-4 text-right">Total</th>
                                                 <th className="px-6 py-4"></th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-gray-50">
                                             {clientSales.map(sale => (
                                                 <tr key={sale.id} className="hover:bg-gray-50/50">
                                                     <td className="px-6 py-4 font-medium text-gray-800">
                                                         {new Date(sale.date).toLocaleDateString()}
                                                     </td>
                                                     <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                                         #{sale.id.slice(0,6)}
                                                     </td>
                                                     <td className="px-6 py-4 text-center">
                                                         {sale.items.length}
                                                     </td>
                                                     <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                         ${sale.totalAmount.toFixed(2)}
                                                     </td>
                                                     <td className="px-6 py-4 text-right">
                                                         <button 
                                                             onClick={() => setShowSaleDetail(sale)}
                                                             className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                                         >
                                                             Ver Recibo
                                                         </button>
                                                     </td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 )}
                             </div>
                         </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <User size={48} className="opacity-20" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Selecciona un Cliente</h3>
                    <p className="text-sm max-w-xs mx-auto">Elige un cliente de la lista para ver su perfil CRM, historial y predicciones de IA.</p>
                </div>
            )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in duration-200">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold">Registrar Abono</h3>
                     <button onClick={() => setShowPaymentModal(false)}><XIcon size={20} className="text-gray-400"/></button>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
                     <p className="text-xs text-gray-500 uppercase font-bold mb-1">Deuda Actual</p>
                     <p className="text-2xl font-bold text-red-600">${selectedClient.debt.toFixed(2)}</p>
                 </div>
                 <div className="mb-4">
                     <label className="block text-sm font-bold text-gray-700 mb-2">Monto a Abonar ($)</label>
                     <input 
                        type="number" 
                        autoFocus
                        className="w-full text-3xl font-bold p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                     />
                 </div>
                 <button 
                    onClick={handlePayment}
                    disabled={!paymentAmount || isProcessing}
                    className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:bg-gray-300"
                 >
                     {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
                 </button>
             </div>
        </div>
      )}

      {/* Receipt Modal (Unchanged from original structure) */}
      {showSaleDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
             <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                 <div className="bg-gray-900 text-white p-5 rounded-t-3xl flex justify-between items-center flex-none">
                     <h3 className="font-bold flex items-center gap-2"><FileText size={18}/> Detalle de Compra</h3>
                     <button onClick={() => setShowSaleDetail(null)} className="p-1 hover:bg-white/10 rounded-full"><XIcon size={20}/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                     <div id="receipt-content-inner" className="bg-white shadow-sm p-4 rounded-xl text-sm border border-gray-200">
                         <div className="text-center border-b border-gray-100 pb-4 mb-4">
                             <h2 className="font-bold text-lg text-gray-900">{settings.businessName}</h2>
                             <p className="text-xs text-gray-500">{settings.address}</p>
                             <p className="text-xs text-gray-500">Rif: {settings.rif}</p>
                         </div>
                         <div className="flex justify-between mb-2">
                             <span className="text-gray-500 text-xs">Fecha:</span>
                             <span className="font-bold text-gray-800 text-xs">{new Date(showSaleDetail.date).toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between mb-2">
                             <span className="text-gray-500 text-xs">Cliente:</span>
                             <span className="font-bold text-gray-800 text-xs">{showSaleDetail.clientName || 'Contado'}</span>
                         </div>
                         <div className="flex justify-between mb-4">
                             <span className="text-gray-500 text-xs">Factura #:</span>
                             <span className="font-mono font-bold text-gray-800 text-xs">#{showSaleDetail.id.slice(0,8)}</span>
                         </div>
                         <table className="w-full mb-4">
                             <thead>
                                 <tr className="text-[10px] text-gray-400 uppercase border-b border-gray-100">
                                     <th className="text-left pb-2">Desc</th>
                                     <th className="text-center pb-2">Cant</th>
                                     <th className="text-right pb-2">Total</th>
                                 </tr>
                             </thead>
                             <tbody className="text-xs">
                                 {showSaleDetail.items.map((item, i) => (
                                     <tr key={i} className="border-b border-gray-50 last:border-0">
                                         <td className="py-2">{item.productName}</td>
                                         <td className="py-2 text-center text-gray-500">{item.quantity}</td>
                                         <td className="py-2 text-right font-bold">${item.subtotal.toFixed(2)}</td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                         <div className="flex justify-between items-center pt-2 border-t border-gray-100 mb-6">
                             <span className="font-bold text-lg">Total</span>
                             <span className="font-bold text-lg text-bakery-600">${showSaleDetail.totalAmount.toFixed(2)}</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-dashed border-gray-200 text-center">
                             <p className="font-bold text-gray-900">¡Gracias por su compra!</p>
                             <p className="text-xs text-gray-500 mt-1">Vuelva pronto</p>
                         </div>
                     </div>
                 </div>
                 <div className="p-4 bg-white border-t border-gray-100 rounded-b-3xl flex-none space-y-3">
                     <button 
                        onClick={handleSmartShare}
                        disabled={isCapturing}
                        className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                     >
                         {isCapturing ? 'Generando...' : (<><Share2 size={18} /> Compartir Imagen</>)}
                     </button>
                     <button onClick={() => handlePrint(showSaleDetail)} className="w-full text-gray-500 hover:text-gray-900 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                         <StoreIcon size={16}/> Imprimir Recibo Formal
                     </button>
                 </div>
             </div>
        </div>
      )}

      {/* Hidden Print Template */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[10000]">
           {saleToPrint && (
               <div className="p-10 text-black font-mono text-sm max-w-[80mm] mx-auto">
                   <div className="text-center mb-6">
                       <h1 className="font-bold text-xl uppercase mb-2">{settings.businessName}</h1>
                       <p>{settings.address}</p>
                       <p>RIF: {settings.rif}</p>
                       <p>Tel: {settings.phone}</p>
                   </div>
                   <div className="mb-4 border-b border-black pb-2 border-dashed">
                       <p>FACTURA #: {saleToPrint.id.slice(0,8).toUpperCase()}</p>
                       <p>FECHA: {new Date(saleToPrint.date).toLocaleString()}</p>
                       <p>CLIENTE: {saleToPrint.clientName || 'Contado'}</p>
                   </div>
                   <table className="w-full mb-4">
                       <thead>
                           <tr className="text-left border-b border-black border-dashed">
                               <th className="pb-1">Cant</th>
                               <th className="pb-1">Articulo</th>
                               <th className="pb-1 text-right">Total</th>
                           </tr>
                       </thead>
                       <tbody>
                           {saleToPrint.items.map((item, i) => (
                               <tr key={i}>
                                   <td className="py-1 align-top">{item.quantity}</td>
                                   <td className="py-1 align-top">{item.productName}</td>
                                   <td className="py-1 text-right align-top">${item.subtotal.toFixed(2)}</td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
                   <div className="border-t border-black border-dashed pt-2 mb-8">
                       <div className="flex justify-between font-bold text-lg">
                           <span>TOTAL USD</span>
                           <span>${saleToPrint.totalAmount.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between text-sm mt-1">
                           <span>TOTAL BS (Tasa {settings.exchangeRate})</span>
                           <span>Bs. {(saleToPrint.totalAmount * settings.exchangeRate).toFixed(2)}</span>
                       </div>
                   </div>
                   <div className="mt-8 text-center pt-4 border-t border-black border-dashed">
                       <p className="font-bold">¡Gracias por su compra!</p>
                       <p>Vuelva pronto</p>
                   </div>
               </div>
           )}
      </div>
    </div>
  );
};

export default ClientCRM;
