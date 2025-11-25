import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// Tipado para la transacción
interface Transaccion {
  id: string;
  monto: number;
  descripcion: string;
  tipo: 'Ingreso' | 'Gasto'; // Positivas o Negativas
  createdAt: Timestamp; // Usamos el timestamp de Firestore
  date: string; // 'YYYY-MM-DD'
}

// Tipado para el Servicio (usado para la venta)
interface Servicio {
  id: string;
  nombre: string;
  precio: number;
}

// Estructura anidada para la agrupación
interface TransaccionGroup {
  [year: number]: {
    [month: number]: {
      [day: number]: Transaccion[];
    };
  };
}

/* ============================================================
   ICONOS SVG
============================================================ */

const IconAdd = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconAlert = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.45-1.74 1.54-3.04L13.54 4.04c-.91-1.3-2.37-1.3-3.28 0L3.54 17.96c-.91 1.3.003 3.04 1.54 3.04z" />
  </svg>
);

const IconChevron = ({ isOpen }: { isOpen: boolean }) => (
  <svg 
    className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'transform rotate-90' : 'transform rotate-0'}`} 
    fill="none" viewBox="0 0 24 24" stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

/* ============================================================
   COMPONENTES REUTILIZABLES DE UI
============================================================ */

// Formato de moneda
const formatCurrency = (amount: number) => {
  return `$ ${Math.abs(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
};

// Componente Desplegable (Collapsible) - Versión sin animación para estabilidad
const CollapsibleSection: React.FC<{ 
  title: React.ReactNode; 
  initialOpen: boolean; 
  children: React.ReactNode; 
  summary?: React.ReactNode;
  className?: string;
}> = ({ title, initialOpen, children, summary, className = "bg-white border-slate-200" }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  
  const toggle = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'button' || target.tagName.toLowerCase() === 'a') {
        return;
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`rounded-xl border shadow-sm ${className}`}>
      <div 
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-2">
            <IconChevron isOpen={isOpen} />
            <span className="font-semibold text-slate-800">{title}</span>
        </div>
        {summary && <div className="text-sm font-medium">{summary}</div>}
      </div>
      {/* Despliegue condicional simple e INSTANTÁNEO */}
      {isOpen && (
        <div className="border-t border-slate-100">
            <div className="p-4">
              {children}
            </div>
        </div>
      )}
    </div>
  );
};


/* ============================================================
   FUNCIONES DE DATOS Y LÓGICA
============================================================ */

// Formato de fecha YYYY-MM-DD
const formatDateToInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Agrupa las ventas por Año, Mes y Día
const groupTransaccionesByDate = (transacciones: Transaccion[]): TransaccionGroup => {
  const grouped: TransaccionGroup = {};

  transacciones.forEach(t => {
    const [yearStr, monthStr, dayStr] = t.date.split('-'); 
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = {};
    if (!grouped[year][month][day]) grouped[year][month][day] = [];

    grouped[year][month][day].push(t);
    
    // Ordenamos por createdAt
    grouped[year][month][day].sort((a, b) => 
        (b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0) - 
        (a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0)
    );
  });
  return grouped;
};

// Calcula los totales de un array de transacciones
const calculateTotals = (transacciones: Transaccion[]) => {
  const ingresos = transacciones
    .filter(t => t.tipo === 'Ingreso')
    .reduce((sum, t) => sum + t.monto, 0);

  const gastos = transacciones
    .filter(t => t.tipo === 'Gasto')
    .reduce((sum, t) => sum + t.monto, 0);
  
  const neto = ingresos - gastos;

  return { ingresos, gastos, neto };
};

// Mapeo de Meses para mostrar en UI
const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

/* ============================================================
   COMPONENTE PRINCIPAL DE VENTAS
============================================================ */
export const Ventas: React.FC = () => {
  const user = barberAuth.currentUser;
  const uid = user?.uid;

  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]); // Nuevo estado para servicios
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaccion | null>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);


  // Estados del formulario
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formMonto, setFormMonto] = useState<string>("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formTipo, setFormTipo] = useState<'Ingreso' | 'Gasto'>('Ingreso');
  const [formDate, setFormDate] = useState<string>(formatDateToInput(new Date()));
  
  // Lógica de Servicios: DEFAULT ES 'servicio'
  const [ventaType, setVentaType] = useState<'servicio' | 'manual'>('servicio'); 
  const [selectedServiceId, setSelectedServiceId] = useState<string>(''); 

  /* ============================================================
     CARGA DE DATOS Y SERVICIOS
  ============================================================ */
  const loadTransacciones = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      // Cargar Ventas
      const qVentas = query(
        collection(barberDb, `barber_users/${uid}/ventas`),
        orderBy("date", "desc"),
      );
      const snapVentas = await getDocs(qVentas);
      const list: Transaccion[] = [];
      snapVentas.forEach((d) => {
        const data = d.data();
        // Usar 'date' si existe o formatear 'createdAt' como fallback
        const date = data.date || formatDateToInput(data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date());
        list.push({ id: d.id, ...data, date } as Transaccion)
      });
      setTransacciones(list);
      
      // Cargar Servicios
      const qServicios = query(collection(barberDb, `barber_users/${uid}/servicios`), orderBy("nombre", "asc"));
      const snapServicios = await getDocs(qServicios);
      const serviciosList: Servicio[] = [];
      snapServicios.forEach((d) => serviciosList.push({ id: d.id, ...d.data() } as Servicio));
      setServicios(serviciosList);

    } catch (err) {
      console.error("Error cargando datos:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (uid) loadTransacciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);


  // Agrupación y totales
  const groupedTransacciones = useMemo(() => {
    return groupTransaccionesByDate(transacciones);
  }, [transacciones]);
  
  const totalSummary = useMemo(() => calculateTotals(transacciones), [transacciones]);

  /* ============================================================
     GESTIÓN DE MODAL Y FORMULARIO
  ============================================================ */
  const resetForm = (servicesList: Servicio[]) => {
    setCurrentId(null);
    setFormMonto("");
    setFormDescripcion("");
    setFormTipo('Ingreso');
    setFormDate(formatDateToInput(new Date())); 
    
    // Configuración de servicio por defecto (si hay servicios)
    setVentaType('servicio');
    const defaultServiceId = servicesList[0]?.id || '';
    setSelectedServiceId(defaultServiceId);

    // Actualizar campos iniciales del formulario si hay servicio por defecto
    const defaultService = servicesList.find(s => s.id === defaultServiceId);
    if (defaultService) {
        setFormDescripcion(`Venta de Servicio: ${defaultService.nombre}`);
        setFormMonto(defaultService.precio.toString());
    } else {
        setVentaType('manual'); // Si no hay servicios, forzar manual
    }

    setIsEditing(false);
  };

  const openModal = (transaccion?: Transaccion) => {
    // Si se edita, se carga manual y se anula la lógica del servicio por defecto
    if (transaccion) {
      setIsEditing(true);
      setCurrentId(transaccion.id);
      setFormMonto(Math.abs(transaccion.monto).toString());
      setFormDescripcion(transaccion.descripcion);
      setFormTipo(transaccion.tipo);
      setFormDate(transaccion.date || formatDateToInput(transaccion.createdAt.toDate()));
      
      setVentaType('manual'); // Si editamos, es manual por si el servicio ya no existe
      setSelectedServiceId('');
    } else {
      // Si es nuevo, usar la lógica de servicio por defecto
      resetForm(servicios);
    }
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    resetForm(servicios); // Resetear usando la lista actual de servicios
  }, [servicios]); // Depender de servicios para el reset

  const handleClickOutsideMain = useCallback((event: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      closeModal();
    }
  }, [closeModal]);
  
  const handleClickOutsideDelete = useCallback((event: MouseEvent) => {
    if (deleteModalRef.current && !deleteModalRef.current.contains(event.target as Node)) {
      setDeleteConfirmOpen(false);
      setTransactionToDelete(null);
    }
  }, []);

  useEffect(() => {
    if (modalOpen) {
      document.addEventListener('mousedown', handleClickOutsideMain);
    } else {
      document.removeEventListener('mousedown', handleClickOutsideMain);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideMain);
  }, [modalOpen, handleClickOutsideMain]);

  useEffect(() => {
    if (deleteConfirmOpen) {
      document.addEventListener('mousedown', handleClickOutsideDelete);
    } else {
      document.removeEventListener('mousedown', handleClickOutsideDelete);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideDelete);
  }, [deleteConfirmOpen, handleClickOutsideDelete]);

  // Efecto para sincronizar el formulario cuando el servicio cambia
  useEffect(() => {
    if (ventaType === 'servicio' && selectedServiceId) {
        const service = servicios.find(s => s.id === selectedServiceId);
        if (service) {
            setFormDescripcion(`Venta de Servicio: ${service.nombre}`);
            setFormMonto(service.precio.toString());
            setFormTipo('Ingreso');
        }
    } else if (ventaType === 'manual' && !isEditing) {
        // En modo manual (al cambiar de servicio), limpiamos campos si no estamos editando
        setFormDescripcion('');
        setFormMonto('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventaType, selectedServiceId, servicios]); // isEditing ya no es dependencia, solo modifica el reset.


  /* ============================================================
     CRUD HANDLERS
  ============================================================ */
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
        servicioId: ventaType === 'servicio' && selectedServiceId ? selectedServiceId : null, // Guardar ID de servicio si aplica
        updatedAt: serverTimestamp(),
      };

      if (isEditing && currentId) {
        await updateDoc(doc(barberDb, `barber_users/${uid}/ventas/${currentId}`), data);
      } else {
        await addDoc(collection(barberDb, `barber_users/${uid}/ventas`), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      closeModal();
      loadTransacciones(); // Recargar datos
    } catch (e) {
      console.error(e);
      alert("Error al guardar la transacción.");
    }
  };

  const triggerDelete = (transaccion: Transaccion) => {
    setTransactionToDelete(transaccion);
    setDeleteConfirmOpen(true);
  };
  
  const handleDelete = async () => {
    if (!uid || !transactionToDelete) return; 
    
    try {
      await deleteDoc(doc(barberDb, `barber_users/${uid}/ventas/${transactionToDelete.id}`));
      setDeleteConfirmOpen(false);
      setTransactionToDelete(null);
      loadTransacciones();
    } catch (e) {
      console.error(e);
      alert("Error al eliminar la transacción.");
    }
  };

  // Estilos Comunes
  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
  const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm";
  const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm";


  /* ============================================================
     RENDER
  ============================================================ */

  // Función auxiliar para renderizar una transacción individual
  const renderTransaccion = (t: Transaccion) => {
    const isIngreso = t.tipo === 'Ingreso';
    const amountSign = isIngreso ? '+' : '-';
    const amountColor = isIngreso ? 'text-emerald-600' : 'text-red-600';
    
    return (
      <div 
        key={t.id} 
        className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors px-2 rounded-md"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isIngreso ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {isIngreso ? 'I' : 'G'}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{t.descripcion}</p>
            {t.createdAt && (
                <p className="text-xs text-slate-400">
                    {t.createdAt instanceof Timestamp 
                        ? t.createdAt.toDate().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })
                        : "Cargando..."}
                </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${amountColor}`}>
            {amountSign} {formatCurrency(t.monto)}
          </span>
          <button 
            onClick={() => openModal(t)}
            className="p-1 text-slate-400 hover:text-slate-800 transition rounded-md"
            aria-label="Editar"
          >
            <IconEdit />
          </button>
          <button 
            onClick={() => triggerDelete(t)} // Usa el nuevo trigger
            className="p-1 text-slate-300 hover:text-red-600 transition rounded-md"
            aria-label="Eliminar"
          >
            <IconTrash />
          </button>
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-6 animate-fadeIn m-2">
      
      {/* HEADER + RESUMEN TOTAL */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">Historial de Ventas y Gastos</h2>
          <p className="text-sm text-slate-500">
            Resumen de transacciones registradas.
          </p>
        </div>

        {/* Totales Generales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm md:w-80 space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ingresos Totales:</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(totalSummary.ingresos)}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-slate-500">Gastos Totales:</span>
                <span className="font-semibold text-red-600">{formatCurrency(totalSummary.gastos)}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between text-lg">
                <span className="font-bold text-slate-900">NETO TOTAL:</span>
                <span className={`font-bold ${totalSummary.neto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(totalSummary.neto)}
                </span>
            </div>
        </div>

        <button 
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap md:w-48"
        >
          <IconAdd />
          Nueva Transacción
        </button>
      </div>

      {/* LISTA DE TRANSACCIONES AGRUPADAS */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="mt-2 text-sm text-slate-500">Cargando transacciones...</p>
        </div>
      ) : transacciones.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
          <p className="text-slate-400 mb-2">No se encontraron transacciones en la base de datos.</p>
          <button onClick={() => openModal()} className="text-sm text-slate-900 font-medium hover:underline">
            Registrar la primera ahora
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Agrupación por AÑO */}
          {Object.entries(groupedTransacciones).sort(([yearA], [yearB]) => Number(yearB) - Number(yearA)).map(([year, months]) => {
            
            const yearTransacciones = Object.values(months).flatMap(Object.values).flat();
            const yearTotals = calculateTotals(yearTransacciones);
            
            const yearSummary = (
                <span className={`text-base font-bold ${yearTotals.neto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    Neto: {formatCurrency(yearTotals.neto)}
                </span>
            );

            return (
              <CollapsibleSection key={year} title={`Año ${year}`} initialOpen={true} summary={yearSummary}>
                <div className="space-y-3">
                  {/* Agrupación por MES */}
                  {Object.entries(months).sort(([monthA], [monthB]) => Number(monthB) - Number(monthA)).map(([month, days]) => {
                    
                    const monthTransacciones = Object.values(days).flat();
                    const monthTotals = calculateTotals(monthTransacciones);
                    
                    const monthSummary = (
                        <span className={`text-sm font-semibold ${monthTotals.neto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                           {formatCurrency(monthTotals.neto)}
                        </span>
                    );

                    return (
                      <CollapsibleSection 
                        key={`${year}-${month}`} 
                        title={monthNames[Number(month) - 1]} 
                        initialOpen={false} // Cerrado por defecto
                        summary={monthSummary}
                        className="bg-slate-50 border-slate-100"
                      >
                        <div className="space-y-2">
                          {/* Agrupación por DÍA */}
                          {Object.entries(days).sort(([dayA], [dayB]) => Number(dayB) - Number(dayA)).map(([day, dailyTransacciones]) => {
                            
                            const dayTotals = calculateTotals(dailyTransacciones);

                            const daySummary = (
                                <span className={`text-xs font-medium ${dayTotals.neto >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {formatCurrency(dayTotals.neto)}
                                </span>
                            );

                            return (
                              <CollapsibleSection 
                                key={`${year}-${month}-${day}`} 
                                title={`Día ${day}`} 
                                initialOpen={false} // Cerrado por defecto
                                summary={daySummary}
                                className="bg-white border-slate-100/70"
                              >
                                {dailyTransacciones.map(renderTransaccion)}
                              </CollapsibleSection>
                            );
                          })}
                        </div>
                      </CollapsibleSection>
                    );
                  })}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      )}

      {/* =========================================
          MODAL CREAR / EDITAR
      ========================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div 
            ref={modalRef}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()} // Detener propagación para click-outside
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {isEditing ? "Editar Transacción" : "Nueva Transacción"}
            </h3>
            
            <div className="space-y-4">
              
              {/* Tipo de Transacción (Ingreso/Gasto) */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de Monto</label>
                <div className="flex space-x-4">
                  <button 
                    onClick={() => setFormTipo('Ingreso')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border-2 ${
                      formTipo === 'Ingreso' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Ingreso (+)
                  </button>
                  <button 
                    onClick={() => setFormTipo('Gasto')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border-2 ${
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
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border-2 ${
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
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border-2 ${
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
                                className={inputClass}
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
                  className={inputClass}
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
                  className={btnSecondary}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className={btnPrimary}
                >
                  {isEditing ? "Guardar Cambios" : "Registrar Transacción"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN (Custom UX)
      ========================================= */}
      {deleteConfirmOpen && transactionToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div 
            ref={deleteModalRef}
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <IconAlert />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">¿Eliminar Transacción?</h3>
            <p className="text-sm text-slate-500 mt-2 mb-6">
              Estás a punto de eliminar la transacción: 
              <span className="font-semibold text-slate-700 block mt-1">
                {transactionToDelete.descripcion} ({formatCurrency(transactionToDelete.monto)})
              </span>
              Esta acción es irreversible y afectará tu neto total.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmOpen(false)}
                className={btnSecondary}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};