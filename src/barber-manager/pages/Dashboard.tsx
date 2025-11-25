// src/barber-manager/pages/Dashboard.tsx
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
  serverTimestamp, 
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
// TS6133 CORREGIDO: IconList eliminado, ya que no se usa en Dashboard.tsx.

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
  fecha: string; // Añadido para consistencia con la query de fecha
  estado: "pendiente" | "completado" | "cancelado"; // Estado como string literal
  ventaId?: string;
}
interface Empleado {
  id: string;
  nombre: string;
}
interface Venta {
  id: string; // Añadido id para mapeo de docs
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
// Nuevo Tipado para Servicio
interface Servicio {
    id: string;
    nombre: string;
    precio: number;
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

// Se elimina generateTimeSlots y TIME_SLOTS (TS6133).


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
  // TS6133 CORREGIDO: Se ignora la advertencia, ya que se usa para mostrar el contexto del modal.
  const [, setTurnoToAction] = useState<Turno | null>(null); 
  // TS6133 CORREGIDO: Se ignora la advertencia, ya que se usa para almacenar datos en fetchDashboardData.
  const [, setClientesList] = useState<any[]>([]); 
  const confirmModalRef = useRef<HTMLDivElement>(null);

  // ===============================================
  // ESTADOS DEL MODAL DE VENTA RÁPIDA (Copiados de Ventas.tsx)
  // ===============================================
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);

  // Estados del formulario de venta
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formMonto, setFormMonto] = useState<string>("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formTipo, setFormTipo] = useState<'Ingreso' | 'Gasto'>('Ingreso');
  const [formDate, setFormDate] = useState<string>(formatDateToInput(new Date()));
  const [ventaType, setVentaType] = useState<'servicio' | 'manual'>('servicio'); 
  const [selectedServiceId, setSelectedServiceId] = useState<string>(''); 
  // ===============================================

  /* =========================================================
    FETCH DATA LOGIC
  ========================================================= */

  const fetchDashboardData = async (userUid: string) => {
    setLoadingLists(true);
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    try {
      // --- 1. Empleados/Clientes/Stock/Servicios (Carga de listas)
      
      const empSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/empleados`));
      const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Empleado));
      setTotalEmpleados(empList.length);
      setEmpleadosList(empList);

      const cliSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/clientes`));
      const cliList = cliSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTotalClientes(cliSnap.size);
      setClientesList(cliList); // Usado internamente para almacenar la lista

      const stockSnap = await getDocs(collection(barberDb, `barber_users/${userUid}/stock`));
      let lowStock = 0;
      stockSnap.forEach(doc => {
        const data = doc.data() as Producto;
        if (data.cantidadActual <= data.stockBajo) {
          lowStock++;
        }
      });
      setLowStockCount(lowStock);
      
      // CARGAR SERVICIOS (NECESARIO PARA EL POPUP DE VENTA)
      const qServicios = query(collection(barberDb, `barber_users/${userUid}/servicios`), orderBy("nombre", "asc"));
      const snapServicios = await getDocs(qServicios);
      const serviciosList: Servicio[] = [];
      snapServicios.forEach((d) => serviciosList.push({ id: d.id, ...d.data() } as Servicio));
      setServicios(serviciosList);


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
      // Casting a 'Venta'
      const recentList = recentSnap.docs.slice(0, 8).map(doc => ({ id: doc.id, ...doc.data() } as unknown as Venta)); 
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
    LÓGICA DEL POPUP DE VENTA (Copiada de Ventas.tsx)
  ========================================================= */

  const resetForm = useCallback(() => {
    setCurrentId(null);
    setFormMonto("");
    setFormDescripcion("");
    setFormTipo('Ingreso');
    setFormDate(formatDateToInput(new Date())); 
    
    // Configuración de servicio por defecto (si hay servicios)
    setVentaType('servicio');
    const defaultServiceId = servicios[0]?.id || '';
    setSelectedServiceId(defaultServiceId);

    // Actualizar campos iniciales del formulario si hay servicio por defecto
    const defaultService = servicios.find(s => s.id === defaultServiceId);
    if (defaultService) {
        setFormDescripcion(`Venta de Servicio: ${defaultService.nombre}`);
        setFormMonto(defaultService.precio.toString());
    } else {
        setVentaType('manual'); // Si no hay servicios, forzar manual
    }
  }, [servicios]);

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    // No reseteamos aquí para mantener los datos si se cancela la edición, 
    // pero sí lo hacemos al abrir uno nuevo.
  }, []);

  // Manejo de clicks fuera del modal
  const handleClickOutsideModal = useCallback((event: MouseEvent) => {
    if (modalOpen && modalRef.current && !modalRef.current.contains(event.target as Node)) {
      closeModal();
    }
  }, [modalOpen, closeModal]);

  useEffect(() => {
    if (modalOpen) {
      document.addEventListener('mousedown', handleClickOutsideModal);
    } else {
      document.removeEventListener('mousedown', handleClickOutsideModal);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideModal);
  }, [modalOpen, handleClickOutsideModal]);

  // Sincronizar formulario con selección de servicio
  useEffect(() => {
    if (ventaType === 'servicio' && selectedServiceId) {
        const service = servicios.find(s => s.id === selectedServiceId);
        if (service) {
            setFormDescripcion(`Venta de Servicio: ${service.nombre}`);
            setFormMonto(service.precio.toString());
            setFormTipo('Ingreso');
        }
    } else if (ventaType === 'manual') {
        // Al cambiar a manual, mantener tipo, limpiar descripción/monto si es nueva venta
        if (!currentId) {
            setFormDescripcion('');
            setFormMonto('');
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventaType, selectedServiceId, servicios]);


  const handleSave = async () => {
    if (!uid || !formMonto || !formDescripcion.trim() || !formDate) return alert("Completa todos los campos.");

    const montoNum = Number(formMonto);
    if (isNaN(montoNum) || montoNum <= 0) return alert("El monto debe ser un número positivo.");

    try {
      const data = {
        monto: montoNum, 
        descripcion: formDescripcion.trim(),
        tipo: formTipo,
        date: formDate, 
        servicioId: ventaType === 'servicio' && selectedServiceId ? selectedServiceId : null,
        updatedAt: serverTimestamp(),
      };

      // Aquí solo añadimos, ya que en el Dashboard solo se hace Venta Rápida (no edición)
      await addDoc(collection(barberDb, `barber_users/${uid}/ventas`), {
          ...data,
          createdAt: serverTimestamp(),
      });

      closeModal();
      fetchDashboardData(uid!); // Recargar datos del dashboard
    } catch (e) {
      console.error(e);
      alert("Error al registrar la transacción.");
    }
  };


  /* =========================================================
    OTROS HELPERS DEL DASHBOARD
  ========================================================= */

  const handleClickOutsideConfirm = useCallback((event: MouseEvent) => { // Renombrado para evitar conflicto con handleClickOutsideModal
    const modalElement = confirmModalRef.current; // Usar confirmModalRef
    if (confirmOpen && modalElement && !modalElement.contains(event.target as Node)) {
      setConfirmOpen(false);
      setTurnoToAction(null);
    }
  }, [confirmOpen]);

  useEffect(() => {
    if (confirmOpen) {
      document.addEventListener('mousedown', handleClickOutsideConfirm);
    } else {
      document.removeEventListener('mousedown', handleClickOutsideConfirm);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideConfirm);
  }, [confirmOpen, handleClickOutsideConfirm]);
  
  const triggerConfirm = (title: string, message: string, confirmText: string, isDanger: boolean, action: () => void) => {
    setConfirmConfig({ title, message, confirmText, isDanger, action });
    setConfirmOpen(true);
  };
  
  // ... (handleQuickFinalize, handleQuickCancel, getFilteredTurnos, timelineAppointments)

  const handleQuickFinalize = (turno: Turno) => {
    setTurnoToAction(turno); // Se mantiene para que el modal muestre la información
    triggerConfirm(
      "Confirmar Asistencia",
      `¿Deseas finalizar el turno de ${turno.clientName} (${turno.servicio})? Esto registrará la venta y sumará puntos de fidelidad.`,
      "Sí, finalizar",
      false, 
      async () => {
        // USAMOS EL OBJETO 'turno' DEL CLOSURE EN LUGAR DE 'turnoToAction' (estado)
        if (!uid || !turno.id) return; 
        try {
            // 1. CREAR DOCUMENTO DE VENTA
            const ventaRef = await addDoc(collection(barberDb, `barber_users/${uid}/ventas`), {
                monto: Number(turno.precio), // Usando turno.precio
                descripcion: `Venta - Turno: ${turno.servicio} de ${turno.clientName}`,
                tipo: 'Ingreso',
                date: todayDateStr, 
                createdAt: serverTimestamp(), 
            });

            // 2. ACTUALIZAR TURNO (Estado y ventaId)
            await updateDoc(doc(barberDb, `barber_users/${uid}/turnos/${turno.id}`), { // Usando turno.id
                estado: "completado",
                ventaId: ventaRef.id, 
            });

            // 3. SUMAR PUNTO DE FIDELIDAD
            if (turno.clientId) { // Usando turno.clientId
                const clientRef = doc(barberDb, `barber_users/${uid}/clientes/${turno.clientId}`);
                await updateDoc(clientRef, { cortes: increment(1) });
            }
            
            setConfirmOpen(false);
            setTurnoToAction(null);
            fetchDashboardData(uid!); 
        } catch (e) {
            console.error("Error al finalizar turno rápido", e);
            alert("Error al finalizar turno.");
        }
      }
    );
  };

  const handleQuickCancel = (turno: Turno) => {
    setTurnoToAction(turno); // Se mantiene para que el modal muestre la información
    triggerConfirm(
      "Cancelar Turno",
      `¿Estás seguro de cancelar el turno de ${turno.clientName} (${turno.servicio})?`,
      "Sí, cancelar",
      true, 
      async () => {
        // *** FIX CLAVE: USAMOS EL OBJETO 'turno' DEL CLOSURE EN LUGAR DE 'turnoToAction' (estado) ***
        if (!uid || !turno.id) return; 
        try {
            // Eliminar el turno - USANDO 'turno.id'
            await deleteDoc(doc(barberDb, `barber_users/${uid}/turnos/${turno.id}`));
            
            setConfirmOpen(false);
            setTurnoToAction(null);
            fetchDashboardData(uid!); 
        } catch (e) {
            console.error("Error al cancelar turno rápido", e); // Si hay un error de Firebase, aparecerá aquí.
            alert("Error al cancelar turno.");
        }
      }
    );
  };

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

  // Se define la data de las 5 tarjetas con su span de columna para la cuadrícula de 6 columnas (lg:grid-cols-6)
  const finalSummaryCards = [
    // 1. TURNOS PENDIENTES (3/6)
    {
      label: "TURNOS PENDIENTES",
      path: "/barber-manager/turnos", // Ruta añadida
      value: totalTurnosHoy === null ? "-" : todayTurnos.filter(t => t.estado === 'pendiente').length, // Solo pendientes
      helper: "Pendientes de confirmar hoy",
      icon: "📅",
      colSpan: 3, // 50%
    },
    // 2. NETO DEL MES (3/6)
    {
      label: "NETO DEL MES",
      path: "/barber-manager/ventas", // Ruta añadida
      value: totalIngresosMes === null ? "-" : formatCurrency(totalIngresosMes),
      helper: `Acumulado al ${formatDateToInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))}`, // Último día del mes
      icon: "💵",
      color: totalIngresosMes !== null ? (totalIngresosMes >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-900',
      colSpan: 3, // 50%
    },
    // 3. INVENTARIO (LOW STOCK) (2/6)
    {
        isInventory: true, // Indicador para lógica de renderizado especial
        label: "INVENTARIO",
        path: "/barber-manager/stock", // Ruta añadida
        value: lowStockCount === null ? "-" : lowStockCount,
        helper: lowStockCount === 0 ? "Todo en orden" : (lowStockCount === null ? "Cargando..." : "Productos requieren reposición"),
        lowStock: lowStockCount,
        colSpan: 2, // 33.3%
    },
    // 4. CLIENTES REGISTRADOS (2/6)
    {
      label: "CLIENTES REGISTRADOS",
      path: "/barber-manager/clientes", // Ruta añadida
      value: totalClientes === null ? "-" : totalClientes, 
      helper: "Registrados en la cartera",
      icon: "👥",
      colSpan: 2, // 33.3%
    },
    // 5. EMPLEADOS ACTIVOS (2/6)
    {
      label: "EMPLEADOS ACTIVOS",
      path: "/barber-manager/empleados", // Ruta añadida
      value: totalEmpleados === null ? "-" : totalEmpleados,
      helper: "Barberos en sistema",
      icon: "💈",
      colSpan: 2, // 33.3%
    },
  ];

  const navigateToSection = (path: string) => {
    navigate(path);
  }


  /* =========================================================
    RENDER
  ========================================================= */
  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
  const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm";
  const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm";


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
          onClick={openModal} // LLAMAR AL POPUP EN LUGAR DE NAVEGAR
          className="flex items-center cursor-pointer gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md active:scale-95 whitespace-nowrap"
        >
          <IconAdd />
          Venta Rápida
        </button>
      </div>

      {/* Summary cards */}
      {/* CUADRÍCULA AJUSTADA A 6 COLUMNAS PARA ESCRITORIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        
        {finalSummaryCards.map((card, index) => {
            
            // Clase de ancho de columna para desktop
            const colSpanClass = card.colSpan ? `lg:col-span-${card.colSpan}` : 'lg:col-span-1';
            
            const cardClasses = `bg-white rounded-2xl shadow-sm border px-5 py-4 flex flex-col justify-between transition-all cursor-pointer hover:shadow-lg
                                 ${colSpanClass}`;

            // Lógica específica para la tarjeta de Inventario (Low Stock)
            if (card.isInventory) {
                return (
                    <div 
                        key={index}
                        onClick={() => navigateToSection(card.path)} // Navegación
                        className={`${cardClasses} ${card.lowStock === null ? 'border-slate-200' : (card.lowStock > 0 ? 'border-red-400 ring-1 ring-red-400/50' : 'border-emerald-400 ring-1 ring-emerald-400/50')}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs font-medium text-slate-500 tracking-wide">
                                    {card.label}
                                </p>
                                <p className={`mt-2 text-2xl font-semibold ${card.lowStock === null || card.lowStock === 0 ? 'text-slate-900' : 'text-red-600'}`}>
                                    {card.value}
                                </p>
                            </div>
                            <div className={`w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg ${card.lowStock === null || card.lowStock === 0 ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-600'}`}>
                                <IconAlert />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">
                            {card.helper}
                        </p>
                    </div>
                );
            }

            // Renderizado de las tarjetas dinámicas restantes
            return (
                <div
                    key={card.label}
                    onClick={() => navigateToSection(card.path)} // Navegación
                    className={`${cardClasses} border-slate-200`}
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
            );
        })}
        
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

            <button onClick={() => navigate("/barber-manager/ventas")} className="text-xs font-medium cursor-pointer text-emerald-600 hover:text-emerald-700">
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
                                // Se usa index como fallback si createdAt no es único o no tiene seconds
                                key={item.id || index} 
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
                className="px-2 py-1 rounded-md border cursor-pointer border-slate-200 text-slate-700 text-xs focus:ring-slate-800"
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
                                    className="p-2 cursor-pointer bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition active:scale-95"
                                    title="Finalizar Turno"
                                >
                                    <IconCheck />
                                </button>
                                <button 
                                    onClick={() => handleQuickCancel(turno)}
                                    className="p-2 cursor-pointer bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition active:scale-95"
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
          MODAL DE VENTA RÁPIDA (Copiado de Ventas.tsx)
      ========================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div 
            ref={modalRef}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()} // Detener propagación para click-outside
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Nueva Venta Rápida
            </h3>
            
            <div className="space-y-4">
              
              {/* Tipo de Transacción (Ingreso/Gasto) */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de Monto</label>
                <div className="flex space-x-4">
                  <button 
                    onClick={() => setFormTipo('Ingreso')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border-2 cursor-pointer ${
                      formTipo === 'Ingreso' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Ingreso (+)
                  </button>
                  <button 
                    onClick={() => setFormTipo('Gasto')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border-2 cursor-pointer ${
                      formTipo === 'Gasto' 
                        ? 'bg-red-50 border-red-500 text-red-800' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Gasto (-)
                  </button>
                </div>
              </div>
              
              {/* Selector de Venta (Servicio vs Manual) */}
              {formTipo === 'Ingreso' && (
                <div className="border-t border-slate-100 pt-4">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Origen del Ingreso</label>
                    <div className="flex space-x-4 mb-3">
                        <button 
                            onClick={() => { setVentaType('servicio'); setSelectedServiceId(servicios[0]?.id || ''); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border-2 cursor-pointer ${
                                ventaType === 'servicio' 
                                    ? 'bg-slate-800 border-slate-900 text-white' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            disabled={servicios.length === 0}
                        >
                            Venta de Servicio
                        </button>
                        <button 
                            onClick={() => { setVentaType('manual'); setSelectedServiceId(''); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border-2 cursor-pointer ${
                                ventaType === 'manual' 
                                    ? 'bg-slate-800 border-slate-900 text-white' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            Venta/Ingreso Manual
                        </button>
                    </div>

                    {/* Selector de Servicio (solo si es tipo Ingreso y Venta de Servicio) */}
                    {ventaType === 'servicio' && servicios.length > 0 && (
                        <div>
                            <select
                                value={selectedServiceId}
                                onChange={(e) => setSelectedServiceId(e.target.value)}
                                className={inputClass + ' cursor-pointer'}
                            >
                                {servicios.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.nombre} - {formatCurrency(s.precio)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {ventaType === 'servicio' && servicios.length === 0 && (
                        <p className="text-xs text-red-500 mt-1">No hay servicios registrados. Usa el modo manual.</p>
                    )}
                </div>
              )}
              
              {/* Fecha de Registro */}
              <div className="border-t border-slate-100 pt-4">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Fecha de Transacción</label>
                <input 
                  type="date" 
                  value={formDate} 
                  onChange={(e) => setFormDate(e.target.value)} 
                  className={inputClass + ' cursor-pointer'}
                  max={formatDateToInput(new Date())} // No permitir fechas futuras
                />
              </div>

              {/* Monto (solo editable en modo manual o gasto) */}
              {(ventaType === 'manual' || formTipo === 'Gasto') ? (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Monto</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">$</span>
                    <input 
                      type="number" 
                      value={formMonto} 
                      onChange={(e) => setFormMonto(e.target.value)} 
                      className={`${inputClass} pl-6 font-medium ${formTipo === 'Ingreso' ? 'text-emerald-700' : 'text-red-700'}`}
                      placeholder="0.00" 
                      min="0"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500">Monto del servicio</p>
                    <p className={`font-bold text-lg ${formTipo === 'Ingreso' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatCurrency(Number(formMonto || 0))}
                    </p>
                </div>
              )}

              {/* Descripción (siempre editable, pero auto-rellenable) */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Descripción</label>
                <textarea 
                  rows={2}
                  value={formDescripcion} 
                  onChange={(e) => setFormDescripcion(e.target.value)} 
                  className={inputClass}
                  placeholder={formTipo === 'Ingreso' ? "Venta o Ingreso Extra" : "Compra de productos para stock"} 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={closeModal}
                  className={btnSecondary + ' cursor-pointer'}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className={btnPrimary + ' cursor-pointer'}
                >
                  Registrar Transacción
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* =========================================
          MODAL DE CONFIRMACIÓN CUSTOM (Mantener la lógica si es necesario)
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
                className="flex-1 py-2.5 bg-white border cursor-pointer border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmConfig.action}
                className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm active:scale-95 transition cursor-pointer ${
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