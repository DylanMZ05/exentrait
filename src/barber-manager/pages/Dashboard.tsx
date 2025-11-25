import React, { useEffect, useState, useMemo } from "react";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom"; // Para el botón de Venta Rápida
import { barberDb, barberAuth } from "../services/firebaseBarber";

// Tipados (Simplificados)
interface Turno {
  id: string;
  hora: string;
  barberId: string;
  barberName: string;
  clientName: string;
  servicio: string;
  estado: string; // "pendiente" | "completado"
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


/* =========================================================
   HELPER: Formatear moneda y Fechas
========================================================= */
const formatCurrency = (amount: number) => {
  return `$ ${Math.abs(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
};

const formatDateToInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generar horarios (mismo helper que en Turnos.tsx)
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
   ICONOS SVG
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
  const [lowStockCount, setLowStockCount] = useState<number | null>(null); // NUEVO

  // List States
  const [empleadosList, setEmpleadosList] = useState<Empleado[]>([]); // Necesario para filtros
  const [todayTurnos, setTodayTurnos] = useState<Turno[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Venta[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Filtro
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  
  const todayDateStr = formatDateToInput(new Date());

  /* =========================================================
     FETCH DATA LOGIC
  ========================================================= */

  // Lógica principal de carga de datos del Dashboard
  const fetchDashboardData = async (userUid: string) => {
    setLoadingLists(true);
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    try {
      // --- 1. Empleados/Clientes (Cache-First para conteo)
      
      // EMPLEADOS
      const empCacheKey = `barber_stats_empleados_${userUid}`;
      const empSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/empleados`));
      const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Empleado));
      setTotalEmpleados(empList.length);
      setEmpleadosList(empList);
      localStorage.setItem(empCacheKey, empList.length.toString());

      // CLIENTES
      const cliCacheKey = `barber_stats_clientes_${userUid}`;
      const cliSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/clientes`));
      setTotalClientes(cliSnap.size);
      localStorage.setItem(cliCacheKey, cliSnap.size.toString());


      // --- 2. INGRESOS DEL MES (VENTAS)
      // Nota: Si hay errores de índice, es probable que estas queries fallen
      const qSales = query(
        collection(barberDb, `barber_users/${userUid}/ventas`),
        where('createdAt', '>=', startOfMonth),
        where('createdAt', '<', startOfNextMonth)
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


      // --- 3. PRODUCTOS EN STOCK BAJO (STOCK)
      const stockSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/stock`));
      let lowStock = 0;
      stockSnap.forEach(doc => {
        const data = doc.data() as Producto;
        if (data.cantidadActual <= data.stockBajo) {
          lowStock++;
        }
      });
      setLowStockCount(lowStock);


      // --- 4. TURNOS PROGRAMADOS (HOY)
      const qTurnos = query(
        collection(barberDb, `barber_users/${userUid}/turnos`),
        where('fecha', '==', todayDateStr),
        where('estado', '!=', 'cancelado'),
        orderBy('estado'), // Para ordenar completados al final
        orderBy('hora')
      );
      const turnosSnap = await getDocs(qTurnos);
      const turnosList = turnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turno));
      setTodayTurnos(turnosList);
      setTotalTurnosHoy(turnosList.length);


      // --- 5. ACTIVIDAD RECIENTE (ÚLTIMAS VENTAS/GASTOS)
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
        // Carga de datos que se benefician del cache-first pattern (empleados, clientes)
        const empCachedData = localStorage.getItem(`barber_stats_empleados_${user.uid}`);
        if (empCachedData) setTotalEmpleados(Number(empCachedData));
        
        const cliCachedData = localStorage.getItem(`barber_stats_clientes_${user.uid}`);
        if (cliCachedData) setTotalClientes(Number(cliCachedData));
        
        // Cargar todos los datos dinámicos
        fetchDashboardData(user.uid);
      } else {
        setUid(null);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, todayDateStr]); 


  /* =========================================================
     RENDER HELPERS
  ========================================================= */

  const getFilteredTurnos = useMemo(() => {
    if (selectedBarberId === 'all') {
      return todayTurnos;
    }
    return todayTurnos.filter(t => t.barberId === selectedBarberId);
  }, [todayTurnos, selectedBarberId]);
  
  // Combina slots de tiempo libres y ocupados para el renderizado
  const timelineAppointments = useMemo(() => {
    const appointments: any[] = [];
    const filteredTurnosMap = new Map(getFilteredTurnos.map(t => [t.hora, t]));

    TIME_SLOTS.forEach(time => {
      const turno = filteredTurnosMap.get(time);
      if (turno) {
        appointments.push({
          ...turno,
          hour: time,
          type: 'reserved',
        });
      } else {
        appointments.push({
          id: time,
          hour: time,
          type: 'free',
        });
      }
    });
    return appointments;
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
      label: "TURNOS HOY",
      value: totalTurnosHoy === null ? "-" : totalTurnosHoy,
      helper: "Turnos agendados para el día",
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
        
        {/* Dynamic Cards (excluding the first slot) */}
        {summaryCards.slice(0, 3).map((card, index) => (
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

        {/* Turnos Card (last slot) */}
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
                Actividad reciente (Ventas)
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
                <div className="text-center py-12 text-sm text-slate-400">No hay ventas recientes.</div>
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

        {/* Upcoming appointments */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[460px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Próximos turnos ({todayDateStr})
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
            ) : getFilteredTurnos.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400">No hay turnos para {selectedBarberId === 'all' ? 'hoy' : 'este barbero'}.</div>
            ) : (
                <>
                    {timelineAppointments.map((slot) => {
                        const isReserved = slot.type === 'reserved';
                        const isCompleted = slot.estado === "completado";
                        
                        return (
                            <div key={slot.hour} className="space-y-1">
                                <p className={`text-[11px] font-medium ${isReserved ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {slot.hour}
                                </p>
                                <div className={`border rounded-xl px-3 py-2 transition ${isReserved ? 'border-emerald-200 hover:bg-emerald-50/30' : 'border-slate-100 hover:bg-slate-50'}`}>
                                    {isReserved ? (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {slot.clientName}
                                                </p>
                                                <p className={`text-xs ${isCompleted ? 'text-emerald-500 font-medium' : 'text-slate-500'}`}>
                                                    {isCompleted ? 'COMPLETADO' : 'PENDIENTE'}
                                                </p>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {slot.servicio} · Barber:{" "}
                                                <span className="font-medium text-slate-800">
                                                    {slot.barberName}
                                                </span>
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-400">
                                            LIBRE
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};