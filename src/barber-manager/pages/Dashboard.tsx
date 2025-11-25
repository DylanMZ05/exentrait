import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom"; 
import { barberDb, barberAuth } from "../services/firebaseBarber"; 

/* =========================================================
   ICONOS SVG (Autocontenido)
========================================================= */

const IconAdd = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const IconAlert = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.45-1.74 1.54-3.04L13.54 4.04c-.91-1.3-2.37-1.3-3.28 0L3.54 17.96c-.91 1.3.003 3.04 1.54 3.04z" />
  </svg>
);

const IconAlertModal = () => (
  <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);


/* =========================================================
   TIPADOS Y HELPERS
========================================================= */

// Tipados (Simplificados)
interface Turno {
  id: string;
  hora: string;
  barberId: string;
  barberName: string;
  clientId: string;
  clientName: string;
  servicio: string;
  precio: string;
  estado: string; // "pendiente" | "completado" | "cancelado"
  ventaId?: string;
}
interface Empleado {
  id: string;
  nombre: string;
}
interface Venta {
  monto: number;
  tipo: 'Ingreso' | 'Gasto';
  descripcion: string;
  createdAt: Timestamp;
}
interface Producto {
  nombre: string;
  cantidadActual: number;
  stockBajo: number;
}


const formatCurrency = (amount: number) => {
  return `$ ${Math.abs(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
};

const formatDateToInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const generateTimeSlots = () => {
  const slots = [];
  for (let i = 9; i <= 20; i++) {
    const hour = i < 10 ? `0${i}` : `${i}`;
    slots.push(`${hour}:00`);
    if (i !== 20) slots.push(`${hour}:30`);
  }
  return slots;
};
const TIME_SLOTS = generateTimeSlots(); 


/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);

  // Summary Card States
  const [totalEmpleados, setTotalEmpleados] = useState<number | null>(null);
  const [totalClientes, setTotalClientes] = useState<number | null>(null);
  const [totalIngresosMes, setTotalIngresosMes] = useState<number | null>(null);
  const [totalTurnosHoy, setTotalTurnosHoy] = useState<number | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null); 

  // List States
  const [empleadosList, setEmpleadosList] = useState<Empleado[]>([]); 
  const [todayTurnos, setTodayTurnos] = useState<Turno[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Venta[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Filtro
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  
  const todayDateStr = formatDateToInput(new Date());

  // Modales y confirmación
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    action: () => void;
    confirmText: string;
    isDanger?: boolean;
  }>({ title: "", message: "", action: () => {}, confirmText: "", isDanger: false });

  // Estado del turno para la acción rápida
  const [turnoToAction, setTurnoToAction] = useState<Turno | null>(null);
  const [clientesList, setClientesList] = useState<any[]>([]); // Lista completa de clientes para lógica de fidelidad
  const confirmModalRef = useRef<HTMLDivElement>(null);

  /* =========================================================
     FETCH DATA LOGIC
  ========================================================= */

  const fetchDashboardData = async (userUid: string) => {
    setLoadingLists(true);
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    try {
      // --- 1. Empleados/Clientes/Stock (Carga de listas)
      
      const empSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/empleados`));
      const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Empleado));
      setTotalEmpleados(empList.length);
      setEmpleadosList(empList);

      const cliSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/clientes`));
      const cliList = cliSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTotalClientes(cliSnap.size);
      setClientesList(cliList); 

      const stockSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/stock`));
      let lowStock = 0;
      stockSnap.forEach(doc => {
        const data = doc.data() as Producto;
        if (data.cantidadActual <= data.stockBajo) {
          lowStock++;
        }
      });
      setLowStockCount(lowStock);


      // --- 2. NETO DEL MES (VENTAS)
      const qSales = query(
        collection(barberDb, `barber_users/${userUid}/ventas`),
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('createdAt', '<', Timestamp.fromDate(startOfNextMonth)),
        orderBy('createdAt', 'asc'), 
      );
      const salesSnap = await getDocs(qSales);
      let totalIngresos = 0;
      let totalGastos = 0;
      salesSnap.forEach(doc => {
        const data = doc.data() as Venta;
        if (data.tipo === 'Ingreso') {
          totalIngresos += data.monto;
        } else if (data.tipo === 'Gasto') {
          totalGastos += data.monto;
        }
      });
      setTotalIngresosMes(totalIngresos - totalGastos);


      // --- 3. TURNOS PROGRAMADOS (HOY)
      const qTurnos = query(
        collection(barberDb, `barber_users/${userUid}/turnos`),
        where('fecha', '==', todayDateStr),
        where('estado', '!=', 'cancelado'), // Excluir cancelados
        orderBy('estado'), 
        orderBy('hora')
      );
      const turnosSnap = await getDocs(qTurnos);
      const turnosList = turnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turno));
      setTodayTurnos(turnosList);
      setTotalTurnosHoy(turnosList.length);

      // 🔥 DEBUG: Muestra los turnos que Firebase devolvió para hoy.
      console.log(`[Turnos Hoy: ${todayDateStr}]`, turnosList);


      // --- 4. ACTIVIDAD RECIENTE (ÚLTIMAS VENTAS/GASTOS)
      const qRecent = query(
        collection(barberDb, `barber_users/${userUid}/ventas`),
        orderBy('createdAt', 'desc')
      );
      const recentSnap = await getDocs(qRecent);
      const recentList = recentSnap.docs.slice(0, 8).map(doc => ({ id: doc.id, ...doc.data() } as Venta));
      setRecentTransactions(recentList);

    } catch (error) {
      console.error("Error al cargar datos del Dashboard:", error);
    }
    setLoadingLists(false);
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(barberAuth, (user) => {
      if (user) {
        setUid(user.uid);
        // Carga de datos que se benefician del cache-first pattern
        const empCachedData = localStorage.getItem(`barber_stats_empleados_${user.uid}`);
        if (empCachedData) setTotalEmpleados(Number(empCachedData));
        const cliCachedData = localStorage.getItem(`barber_stats_clientes_${user.uid}`);
        if (cliCachedData) setTotalClientes(Number(cliCachedData));
        
        fetchDashboardData(user.uid);
      } else {
        setUid(null);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, todayDateStr]); 


  /* =========================================================
     GESTIÓN DE MODAL Y CLICK-OUTSIDE
  ========================================================= */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    const modalElement = confirmModalRef.current;
    if (confirmOpen && modalElement && !modalElement.contains(event.target as Node)) {
      setConfirmOpen(false);
      setTurnoToAction(null);
    }
  }, [confirmOpen]);

  useEffect(() => {
    if (confirmOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [confirmOpen, handleClickOutside]);

  /* =========================================================
     ACCIONES RÁPIDAS (Finalizar/Cancelar Turno)
  ========================================================= */

  const triggerConfirm = (title: string, message: string, confirmText: string, isDanger: boolean, action: () => void) => {
    setConfirmConfig({ title, message, confirmText, isDanger, action });
    setConfirmOpen(true);
  };

  const handleQuickFinalize = (turno: Turno) => {
    setTurnoToAction(turno);
    triggerConfirm(
      "Confirmar Asistencia",
      `¿Deseas finalizar el turno de ${turno.clientName} (${turno.servicio})? Esto registrará la venta y sumará puntos de fidelidad.`,
      "Sí, finalizar",
      false, 
      async () => {
        if (!uid || !turnoToAction) return;
        try {
            // 1. CREAR DOCUMENTO DE VENTA
            const ventaRef = await addDoc(collection(barberDb, `barber_users/${uid}/ventas`), {
                monto: Number(turnoToAction.precio),
                descripcion: `Venta - Turno: ${turnoToAction.servicio} de ${turnoToAction.clientName}`,
                tipo: 'Ingreso',
                date: todayDateStr, 
                createdAt: serverTimestamp(),
            });

            // 2. ACTUALIZAR TURNO (Estado y ventaId)
            await updateDoc(doc(barberDb, `barber_users/${uid}/turnos/${turnoToAction.id}`), {
                estado: "completado",
                ventaId: ventaRef.id, 
            });

            // 3. SUMAR PUNTO DE FIDELIDAD
            if (turnoToAction.clientId) {
                const clientRef = doc(barberDb, `barber_users/${uid}/clientes/${turnoToAction.clientId}`);
                await updateDoc(clientRef, { cortes: increment(1) });
            }
            
            setConfirmOpen(false);
            setTurnoToAction(null);
            fetchDashboardData(uid!); // Refrescar el Dashboard
        } catch (e) {
            console.error("Error al finalizar turno rápido", e);
            alert("Error al finalizar turno.");
        }
      }
    );
  };

  const handleQuickCancel = (turno: Turno) => {
    setTurnoToAction(turno);
    triggerConfirm(
      "Cancelar Turno",
      `¿Estás seguro de cancelar el turno de ${turno.clientName} (${turno.servicio})?`,
      "Sí, cancelar",
      true, 
      async () => {
        if (!uid || !turnoToAction) return;
        try {
            // Eliminar el turno
            await deleteDoc(doc(barberDb, `barber_users/${uid}/turnos/${turnoToAction.id}`));
            
            setConfirmOpen(false);
            setTurnoToAction(null);
            fetchDashboardData(uid!); // Refrescar el Dashboard
        } catch (e) {
            console.error("Error al cancelar turno rápido", e);
            alert("Error al cancelar turno.");
        }
      }
    );
  };


  /* =========================================================
     RENDER HELPERS
  ========================================================= */

  const getFilteredTurnos = useMemo(() => {
    // Obtenemos solo los turnos PENDIENTES
    const pendingTurnos = todayTurnos.filter(t => t.estado === 'pendiente');
    
    if (selectedBarberId === 'all') {
      // Ordenamos por hora para la visualización
      return pendingTurnos.sort((a, b) => a.hora.localeCompare(b.hora));
    }
    return pendingTurnos
      .filter(t => t.barberId === selectedBarberId)
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }, [todayTurnos, selectedBarberId]);
  
  const timelineAppointments = useMemo(() => {
    // Usamos los turnos pendientes filtrados y ordenados para la lista de acción rápida
    return getFilteredTurnos;
  }, [getFilteredTurnos]);

  const summaryCards = [
    {
      label: "CLIENTES REGISTRADOS",
      value: totalClientes === null ? "-" : totalClientes, 
      helper: "Registrados en la cartera",
      icon: "👥"
    },
    {
      label: "EMPLEADOS ACTIVOS",
      value: totalEmpleados === null ? "-" : totalEmpleados,
      helper: "Barberos en sistema",
      icon: "💈"
    },
    {
      label: "NETO DEL MES",
      value: totalIngresosMes === null ? "-" : formatCurrency(totalIngresosMes),
      helper: `Acumulado al ${formatDateToInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))}`, // Último día del mes
      icon: "💵",
      color: totalIngresosMes !== null ? (totalIngresosMes >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-900'
    },
    {
      label: "TURNOS PENDIENTES",
      value: totalTurnosHoy === null ? "-" : todayTurnos.filter(t => t.estado === 'pendiente').length, // Solo pendientes
      helper: "Pendientes de confirmar hoy",
      icon: "📅"
    },
  ];


  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div className="space-y-6 animate-fadeIn m-2 pb-16">
      
      {/* Welcome banner and Quick Actions */}
      <div className="w-full rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-8 py-6 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">
            Bienvenido/a a Exentra - Barber Manager
          </h1>
          <p className="text-sm text-slate-200">
            Gestioná tu barbería de manera inteligente y eficiente.
          </p>
        </div>
        <button 
          onClick={() => navigate("/barber-manager/ventas")}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md active:scale-95 whitespace-nowrap"
        >
          <IconAdd />
          Venta Rápida
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Low Stock Card (Fixed Position) */}
        <div 
            className={`bg-white rounded-2xl shadow-sm border px-5 py-4 flex flex-col justify-between 
                        ${lowStockCount === null ? 'border-slate-200' : (lowStockCount > 0 ? 'border-red-400 ring-1 ring-red-400/50' : 'border-emerald-400 ring-1 ring-emerald-400/50')}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-xs font-medium text-slate-500 tracking-wide">
                        INVENTARIO
                    </p>
                    <p className={`mt-2 text-2xl font-semibold ${lowStockCount === null || lowStockCount === 0 ? 'text-slate-900' : 'text-red-600'}`}>
                        {lowStockCount === null ? "-" : lowStockCount}
                    </p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${lowStockCount === null || lowStockCount === 0 ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-600'}`}>
                    <IconAlert />
                </div>
            </div>
            <p className="text-xs text-slate-500">
                {lowStockCount === 0 ? "Todo en orden" : (lowStockCount === null ? "Cargando..." : "Productos requieren reposición")}
            </p>
        </div>
        
        {/* Dynamic Cards */}
        {summaryCards.slice(0, 3).map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 tracking-wide">
                  {card.label}
                </p>
                <p className={`mt-2 text-2xl font-semibold ${card.color || 'text-slate-900'}`}>
                  {card.value}
                </p>
              </div>

              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-lg">
                {card.icon}
              </div>
            </div>

            <p className="text-xs text-slate-500">{card.helper}</p>
          </div>
        ))}

        {/* Turnos Card (Pendientes) */}
        <div
            key={summaryCards[3].label}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4 flex flex-col justify-between"
        >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 tracking-wide">
                  {summaryCards[3].label}
                </p>
                <p className={`mt-2 text-2xl font-semibold ${summaryCards[3].color || 'text-slate-900'}`}>
                  {summaryCards[3].value}
                </p>
              </div>

              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-lg">
                {summaryCards[3].icon}
              </div>
            </div>

            <p className="text-xs text-slate-500">{summaryCards[3].helper}</p>
        </div>
        
      </div>

      {/* Main bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[460px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Actividad reciente (Ventas/Gastos)
              </h3>
            </div>

            <button onClick={() => navigate("/barber-manager/ventas")} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
              Ver todas
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingLists ? (
                <div className="text-center py-12 text-sm text-slate-500">Cargando actividad...</div>
            ) : recentTransactions.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400">No hay transacciones recientes.</div>
            ) : (
                <div className="px-5 py-3 space-y-2">
                    {recentTransactions.map((item, index) => {
                        const isIngreso = item.tipo === 'Ingreso';
                        const color = isIngreso ? 'text-emerald-600' : 'text-red-600';
                        const sign = isIngreso ? '+' : '-';
                        
                        return (
                            <div
                                key={item.createdAt.seconds || index}
                                className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 transition"
                            >
                                <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium ${isIngreso ? 'bg-emerald-100/50 text-emerald-700' : 'bg-red-100/50 text-red-700'}`}>
                                    {isIngreso ? "I" : "G"}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">
                                    {item.descripcion}
                                    </p>
                                    <p className="text-xs text-slate-500">{item.tipo}</p>
                                    <p className="text-[11px] text-slate-400">
                                    {item.createdAt.toDate().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                </div>

                                <div className="text-right">
                                <p className={`text-sm font-semibold ${color}`}>
                                    {sign} {formatCurrency(item.monto)}
                                </p>
                                <p className="text-[11px] text-slate-400">Registrado</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </div>
        </div>

        {/* Upcoming appointments (Quick Action List) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[460px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Acciones Rápidas - Turnos Pendientes
            </h3>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 hidden sm:inline">Filtrar:</span>
              <select
                value={selectedBarberId}
                onChange={(e) => setSelectedBarberId(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 text-xs focus:ring-slate-800"
              >
                <option value="all">General</option>
                {empleadosList.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-3">
            {loadingLists ? (
                 <div className="text-center py-12 text-sm text-slate-500">Cargando turnos...</div>
            ) : timelineAppointments.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400">No hay turnos pendientes para {selectedBarberId === 'all' ? 'hoy' : 'este barbero'}.</div>
            ) : (
                <>
                    {timelineAppointments.map((turno) => (
                        <div key={turno.id} className="border border-slate-100 rounded-xl px-3 py-2 hover:border-slate-200 hover:bg-slate-50 transition flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-medium text-slate-600">
                                    {turno.hora}
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                    {turno.clientName}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {turno.servicio} · {turno.barberName}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleQuickFinalize(turno)}
                                    className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition active:scale-95"
                                    title="Finalizar Turno"
                                >
                                    <IconCheck />
                                </button>
                                <button 
                                    onClick={() => handleQuickCancel(turno)}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition active:scale-95"
                                    title="Cancelar Turno"
                                >
                                    <IconTrash />
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}
          </div>
        </div>
      </div>

      {/* =========================================
          MODAL DE CONFIRMACIÓN CUSTOM
      ========================================= */}
      {confirmOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          onClick={() => setConfirmOpen(false)}
        >
          <div 
            ref={confirmModalRef}
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconAlertModal />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {confirmConfig.title}
            </h3>
            
            <p className="text-sm text-slate-500 mb-6 px-2 leading-relaxed">
              {confirmConfig.message}
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmConfig.action}
                className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm active:scale-95 transition ${
                  confirmConfig.isDanger 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-emerald-600 hover:bg-emerald-700" // Usamos esmeralda para acciones que no son peligro
                }`}
              >
                {confirmConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};