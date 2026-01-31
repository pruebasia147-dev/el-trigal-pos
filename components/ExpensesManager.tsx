
import React, { useState } from 'react';
import { db } from '../services/db';
import { Expense } from '../types';
import { 
  ShoppingBasket, DollarSign, Calendar, Tag, Trash2, Plus, 
  Wallet, Building2, AlertTriangle, TrendingDown, Store
} from 'lucide-react';

interface ExpensesManagerProps {
  expenses: Expense[];
  onRefresh: () => Promise<void>;
  cashInHand: number; // Para validar si hay dinero en caja
}

const ExpensesManager: React.FC<ExpensesManagerProps> = ({ expenses, onRefresh, cashInHand }) => {
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Materia Prima');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');

  // Stats
  const today = new Date().toDateString();
  const todayExpenses = expenses.filter(e => new Date(e.date).toDateString() === today);
  const totalToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const cashOutflow = todayExpenses.filter(e => e.paymentMethod === 'cash').reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const numAmount = parseFloat(amount);
    
    // Validación de Caja Física
    if (paymentMethod === 'cash' && numAmount > cashInHand) {
        if (!confirm(`⚠️ ALERTA DE CAJA:\n\nEstás intentando registrar una salida de efectivo por $${numAmount}, pero el sistema calcula que solo hay $${cashInHand.toFixed(2)} en caja hoy.\n\n¿Deseas continuar de todas formas?`)) {
            return;
        }
    }

    setIsSubmitting(true);
    try {
        const newExpense: Expense = {
            id: '', // DB generates or ignores
            date: new Date().toISOString(),
            category,
            description,
            amount: numAmount,
            paymentMethod,
            registeredBy: 'Admin' 
        };
        await db.addExpense(newExpense);
        await onRefresh();
        setShowModal(false);
        resetForm();
        alert('Gasto registrado correctamente.');
    } catch (error) {
        console.error(error);
        alert('Error al guardar el gasto.');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
      if (confirm('¿Eliminar este registro de gasto? Esto devolverá el monto a los cálculos de ganancia.')) {
          await db.deleteExpense(id);
          await onRefresh();
      }
  };

  const resetForm = () => {
      setDescription('');
      setAmount('');
      setCategory('Materia Prima');
      setPaymentMethod('cash');
  };

  const getCategoryColor = (cat: string) => {
      switch (cat) {
          case 'Materia Prima': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'Nómina': return 'bg-purple-100 text-purple-700 border-purple-200';
          case 'Servicios': return 'bg-orange-100 text-orange-700 border-orange-200';
          case 'Mantenimiento': return 'bg-gray-100 text-gray-700 border-gray-200';
          default: return 'bg-gray-50 text-gray-600 border-gray-200';
      }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      
      {/* Header Section with Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingBasket size={24} className="text-red-500"/>
                  Compras y Gastos
              </h2>
              <p className="text-gray-500 text-sm">Control de salidas de dinero y costos operativos.</p>
          </div>
          <button 
              onClick={() => setShowModal(true)}
              className="bg-red-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95"
          >
              <Plus size={20} /> Registrar Gasto
          </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Gastado (Hoy)</p>
                  <p className="text-3xl font-bold text-gray-900">${totalToday.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <TrendingDown size={24} />
              </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Salida de Efectivo</p>
                  <p className="text-2xl font-bold text-orange-600">${cashOutflow.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">Resta de Caja Física</p>
              </div>
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                  <Wallet size={24} />
              </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Materia Prima</p>
                  <p className="text-2xl font-bold text-blue-600">
                      ${todayExpenses.filter(e => e.category === 'Materia Prima').reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                  </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Store size={24} />
              </div>
          </div>
      </div>

      {/* Expenses Table */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-700">Historial de Egresos</h3>
              <span className="text-xs font-bold bg-white border border-gray-200 px-2 py-1 rounded text-gray-500">
                  {expenses.length} registros
              </span>
          </div>
          <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-sm">
                  <thead className="bg-white sticky top-0 shadow-sm z-10 text-gray-500 text-xs uppercase">
                      <tr>
                          <th className="px-6 py-4 font-bold">Fecha / Hora</th>
                          <th className="px-6 py-4 font-bold">Descripción</th>
                          <th className="px-6 py-4 font-bold text-center">Categoría</th>
                          <th className="px-6 py-4 font-bold text-center">Pago</th>
                          <th className="px-6 py-4 font-bold text-right">Monto</th>
                          <th className="px-6 py-4 font-bold text-center">Acción</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {expenses.length === 0 ? (
                          <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                  <ShoppingBasket size={32} className="mx-auto mb-2 opacity-20"/>
                                  <p>No se han registrado gastos aún.</p>
                              </td>
                          </tr>
                      ) : (
                          expenses.map(expense => (
                              <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4">
                                      <p className="font-bold text-gray-800">{new Date(expense.date).toLocaleDateString()}</p>
                                      <p className="text-xs text-gray-400">{new Date(expense.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                      <p className="font-medium text-gray-900">{expense.description}</p>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${getCategoryColor(expense.category)}`}>
                                          {expense.category}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <div className="flex items-center justify-center gap-1 text-xs font-bold text-gray-600">
                                          {expense.paymentMethod === 'cash' ? <Wallet size={14}/> : <Building2 size={14}/>}
                                          {expense.paymentMethod === 'cash' ? 'Efectivo' : 'Banco'}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-red-600">
                                      -${expense.amount.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button 
                                          onClick={() => handleDelete(expense.id)}
                                          className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-full transition-colors"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Modal Form */}
      {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in duration-200">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                      <h3 className="font-bold text-lg text-gray-800">Registrar Nuevo Gasto</h3>
                      <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><Trash2 size={20} className="rotate-45"/></button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Monto ($)</label>
                          <input 
                              type="number" 
                              required
                              min="0.01"
                              step="0.01"
                              className="w-full text-2xl font-bold p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                              placeholder="0.00"
                              value={amount}
                              onChange={e => setAmount(e.target.value)}
                              autoFocus
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Concepto / Descripción</label>
                          <input 
                              type="text" 
                              required
                              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
                              placeholder="Ej: Saco de harina, Pago de luz..."
                              value={description}
                              onChange={e => setDescription(e.target.value)}
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                              <select 
                                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white"
                                  value={category}
                                  onChange={e => setCategory(e.target.value as any)}
                              >
                                  <option value="Materia Prima">Materia Prima</option>
                                  <option value="Servicios">Servicios</option>
                                  <option value="Nómina">Nómina</option>
                                  <option value="Mantenimiento">Mantenimiento</option>
                                  <option value="Varios">Varios</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Origen del Dinero</label>
                              <div className="flex bg-gray-100 p-1 rounded-xl">
                                  <button
                                      type="button"
                                      onClick={() => setPaymentMethod('cash')}
                                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${paymentMethod === 'cash' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                                  >
                                      <Wallet size={14}/> Caja
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setPaymentMethod('bank')}
                                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${paymentMethod === 'bank' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}
                                  >
                                      <Building2 size={14}/> Banco
                                  </button>
                              </div>
                          </div>
                      </div>

                      {paymentMethod === 'cash' && (
                          <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg flex items-start gap-2">
                              <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0"/>
                              <p className="text-xs text-orange-700">Este monto se descontará del <b>Dinero en Caja</b> del día de hoy.</p>
                          </div>
                      )}

                      <div className="pt-2">
                          <button 
                              type="submit"
                              disabled={isSubmitting}
                              className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:bg-gray-300"
                          >
                              {isSubmitting ? 'Guardando...' : 'Confirmar Gasto'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExpensesManager;
