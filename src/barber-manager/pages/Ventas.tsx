// src/barber-manager/pages/Ventas.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    serverTimestamp,
    Timestamp,
    query as firestoreQuery,
    increment,
    FieldValue,
    where, 
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// ⭐ VALOR POR DEFECTO para empleados sin prioridad (debe coincidir con Empleados.tsx)
const DEFAULT_PRIORITY = 999; 

// ⭐ NUEVO TIPADO DE MÉTODOS DE PAGO
type PaymentMethod = 'Efectivo' | 'Transferencia' | 'QR/Tarjeta' | 'N/A'; // N/A para Gastos

// Tipado para la transacción
interface Transaccion {
    id: string;
    monto: number;
    descripcion: string;
    tipo: 'Ingreso' | 'Gasto';
    createdAt: Timestamp;
    updatedAt?: Timestamp | FieldValue;
    date: string;
    barberId: string | null;
    barberName: string | null;
    servicioId: string | null;
    clienteId?: string | null;
    clienteNombre?: string | null;
    comisionAplicada?: number | null; 
    metodoPago?: PaymentMethod;
}

// Tipado para el Servicio
interface Servicio {
    id: string;
    nombre: string;
    precio: number;
}

// Tipado para Empleado
interface Empleado {
    id: string;
    nombre: string;
    porcentaje: number;
    internalEmail?: string;
    prioridad?: number; 
    activo?: boolean;
}

// Tipado para Cliente
interface Cliente {
    id: string;
    nombre: string;
    telefono?: string;
    visitas?: number;
}

// Estructura anidada para la agrupación
interface TransaccionGroup {
    [year: number]: {
        [month: number]: {
            [day: number]: Transaccion[];
        };
    };
}

// Tipado para datos de liquidación
interface LiquidacionItem {
    barberId: string;
    totalVentas: number;
    comision: number;
    porcentaje: number;
    nombre: string;
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
    <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

const IconCash = () => (
    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const IconSpinner = ({ color = 'text-blue-600' }) => (
    <svg className={`animate-spin h-8 w-8 ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// ⭐ Iconos de Método de Pago (REINTRODUCIDO)
const PaymentMethodIcon: React.FC<{ method: PaymentMethod | undefined }> = ({ method }) => {
    switch (method) {
        case 'Efectivo':
            return <span className="text-sm">💵</span>;
        case 'Transferencia':
            return <span className="text-sm">💳</span>;
        case 'QR/Tarjeta':
            return <span className="text-sm">📲</span>;
        default:
            return <span className="text-sm">💸</span>;
    }
};


/* ============================================================
    COMPONENTES REUTILIZABLES DE UI
============================================================ */
const formatCurrency = (amount: number) => {
    return `$ ${Math.abs(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
};

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
        // Evitar que el clic en botones o selects dentro de la cabecera colapse la sección
        if (target.tagName.toLowerCase() === 'button' || target.tagName.toLowerCase() === 'a' || target.tagName.toLowerCase() === 'select') {
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
const formatDateToInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDateNDaysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDateToInput(d);
};


const groupTransaccionesByDate = (transacciones: Transaccion[]): TransaccionGroup => {
    const grouped: TransaccionGroup = {};

    transacciones.forEach(t => {
        if (!t.date || typeof t.date !== 'string') return;
        
        const [yearStr, monthStr, dayStr] = t.date.split('-'); 
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);

        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = {};
        if (!grouped[year][month][day]) grouped[year][month][day] = [];

        grouped[year][month][day].push(t);
        
        grouped[year][month][day].sort((a, b) => 
            (b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0) - 
            (a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0)
        );
    });
    return grouped;
};

// Modificado para calcular las comisiones como un gasto operativo,
// incluyendo la lógica de fallback para transacciones antiguas y la exclusión del Dueño.
const calculateTotals = (transacciones: Transaccion[], currentOwnerUid: string | undefined, empleadosList: Empleado[], isEmployeeView: boolean) => { 
    
    let gastos = transacciones
        .filter(t => t.tipo === 'Gasto')
        .reduce((sum, t) => sum + t.monto, 0);
    
    let comisionesGanadas = transacciones
        .filter(t => t.tipo === 'Ingreso' && t.barberId)
        .reduce((sum, t) => {
            
            let porcentajeFijo = t.comisionAplicada ?? 0;
            
            if (porcentajeFijo === 0 && !t.comisionAplicada) {
                const empleado = empleadosList.find(e => e.id === t.barberId);
                porcentajeFijo = empleado ? empleado.porcentaje : 0; 
            }
            
            const porcentaje = porcentajeFijo / 100;
            return sum + (t.monto * porcentaje);
        }, 0); 
        
    let ingresosCalculados = 0;
    let netoCalculado = 0;
    let comisionesPagadas = 0;

    if (isEmployeeView) {
        ingresosCalculados = comisionesGanadas;
        netoCalculado = ingresosCalculados - gastos;
        comisionesPagadas = 0;

    } else {
        ingresosCalculados = transacciones
            .filter(t => t.tipo === 'Ingreso')
            .reduce((sum, t) => sum + t.monto, 0);
            
        comisionesPagadas = transacciones
            .filter(t => t.tipo === 'Ingreso' && t.barberId && t.barberId !== currentOwnerUid)
            .reduce((sum, t) => {
                let porcentajeFijo = t.comisionAplicada ?? 0;
                if (porcentajeFijo === 0 && !t.comisionAplicada) {
                    const empleado = empleadosList.find(e => e.id === t.barberId);
                    porcentajeFijo = empleado ? empleado.porcentaje : 0;
                }
                if (porcentajeFijo >= 100) return sum;
                return sum + (t.monto * (porcentajeFijo / 100));
            }, 0); 
            
        netoCalculado = ingresosCalculados - gastos - comisionesPagadas;
        
        comisionesGanadas = comisionesPagadas;
    }

    return { ingresos: ingresosCalculados, gastos, comisiones: comisionesPagadas, neto: netoCalculado };
};

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

    const ownerUid = localStorage.getItem('barberOwnerId');
    const isEmployeeMode = uid && ownerUid && uid !== ownerUid;
    const effectiveBarberieUid = ownerUid || uid;

    const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaccion | null>(null);
    
    // ⭐ ESTADOS DE BLOQUEO DE UI
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteModalRef = useRef<HTMLDivElement>(null);

    // Filtros de Periodo (por Mes/Día o Rango)
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedDay, setSelectedDay] = useState(today.getDate());
    
    // ⭐ MODIFICACIÓN: Nuevo filtro 'range'
    const [filterByMode, setFilterByMode] = useState<'day' | 'month' | 'range'>('day'); 
    
    // ⭐ NUEVOS ESTADOS PARA FILTRO POR RANGO
    const [startDate, setStartDate] = useState(getDateNDaysAgo(6));
    const [endDate, setEndDate] = useState(formatDateToInput(today));
    
    const [filterBarberId, setFilterBarberId] = useState<string>('all');
    // ⭐ NUEVO ESTADO PARA FILTRAR POR MÉTODO DE PAGO
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | 'all'>('all');
    
    // Estados del formulario
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [formMonto, setFormMonto] = useState<string>("");
    const [formDescripcion, setFormDescripcion] = useState("");
    const [formTipo, setFormTipo] = useState<'Ingreso' | 'Gasto'>('Ingreso');
    const [formDate, setFormDate] = useState<string>(formatDateToInput(new Date()));
    
    const [ventaType, setVentaType] = useState<'servicio' | 'manual'>('servicio');
    const [selectedServiceId, setSelectedServiceId] = useState<string>(''); 

    // Empleado Asignado
    const [selectedBarberId, setSelectedBarberId] = useState<string>('');
    // ⭐ NUEVO ESTADO DE PAGO PARA EL FORMULARIO
    const [formMetodoPago, setFormMetodoPago] = useState<PaymentMethod>('Efectivo');

    // Cliente Asignado y Creación Rápida
    const [selectedClienteId, setSelectedClienteId] = useState<string>('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientPhone, setNewClientPhone] = useState("");

    // Vista
    const [viewMode, setViewMode] = useState<'ventas' | 'liquidaciones'>('ventas');
    
    // Identificar Empleado Logueado
    const loggedInEmployee = useMemo(() => {
        const authIdentifier = user?.email; 
        const cleanedAuthId = authIdentifier ? authIdentifier.trim().toLowerCase() : '';
        
        let employee = empleados.find(e => e.id === uid);
        if (!employee && cleanedAuthId) {
             employee = empleados.find(e => e.internalEmail?.trim().toLowerCase() === cleanedAuthId);
        }
        if (!employee && cleanedAuthId) {
             employee = empleados.find(e => e.internalEmail?.toLowerCase().includes(cleanedAuthId));
        }
        return employee;
    }, [empleados, uid, user?.email]);
    
    const loggedInEmployeeName = loggedInEmployee?.nombre || user?.email || 'Barbero Desconocido';

    useEffect(() => {
        if (isEmployeeMode && loggedInEmployee && filterBarberId === 'all') {
            setFilterBarberId(loggedInEmployee.id);
        }
    }, [isEmployeeMode, loggedInEmployee, filterBarberId]);
    
    // ⭐ CÁLCULO DE LISTA ORDENADA PARA EL MODAL DE VENTA
    const sortedBarbers = useMemo(() => {
        const activeBarbers = empleados.filter(e => e.activo !== false); // Filtra los activos
        
        if (isEmployeeMode && uid) {
            const myId = uid;
            const myEmployee = activeBarbers.find(e => e.id === myId);
            const others = activeBarbers.filter(e => e.id !== myId);
            
            // Ordena a los demás por prioridad (si el campo existe)
            others.sort((a, b) => (a.prioridad || DEFAULT_PRIORITY) - (b.prioridad || DEFAULT_PRIORITY));
            
            // Coloca al empleado actual de primero si existe
            return myEmployee ? [myEmployee, ...others] : others;
        }

        // Modo Dueño: Ordena estrictamente por prioridad (la más baja es primero)
        return activeBarbers.sort((a, b) => (a.prioridad || DEFAULT_PRIORITY) - (b.prioridad || DEFAULT_PRIORITY));

    }, [empleados, isEmployeeMode, uid]);


    /* ============================================================
        CARGA DE DATOS
    ============================================================ */
    const loadTransacciones = useCallback(async () => {
        if (!effectiveBarberieUid) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const _uid = effectiveBarberieUid;

        try {
            // Cargar Empleados (incluyendo prioridad)
            const qEmpleados = firestoreQuery(collection(barberDb, `barber_users/${_uid}/empleados`), orderBy("nombre", "asc")); 
            const snapEmpleados = await getDocs(qEmpleados);
            const empleadosList: Empleado[] = [];
            snapEmpleados.forEach((d) => empleadosList.push({ id: d.id, ...d.data() } as Empleado));
            setEmpleados(empleadosList);
            
            // Cargar Clientes
            const qClientes = firestoreQuery(collection(barberDb, `barber_users/${_uid}/clientes`), orderBy("nombre", "asc"));
            const snapClientes = await getDocs(qClientes);
            const clientesList: Cliente[] = [];
            snapClientes.forEach((d) => clientesList.push({ id: d.id, ...d.data() } as Cliente));
            setClientes(clientesList);

            // Cargar Ventas
            let ventasQuery: any[] = [];
            ventasQuery.push(orderBy("date", "desc"));

            const qVentas = firestoreQuery(
                collection(barberDb, `barber_users/${_uid}/ventas`),
                ...ventasQuery
            );
            
            const snapVentas = await getDocs(qVentas);
            const list: Transaccion[] = [];
            snapVentas.forEach((d) => {
                const data = d.data();
                const date = data.date || formatDateToInput(data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date());
                list.push({ 
                    id: d.id, 
                    ...data, 
                    date,
                    barberId: data.barberId || null, 
                    barberName: data.barberName || null, 
                    clienteId: data.clienteId || null,
                    clienteNombre: data.clienteNombre || null,
                    comisionAplicada: data.comisionAplicada || null, // Carga el porcentaje fijo
                    metodoPago: data.metodoPago || (data.tipo === 'Ingreso' ? 'Efectivo' : 'N/A'), // ⭐ Carga el método de pago (con fallback)
                } as Transaccion)
            });
            setTransacciones(list);
            
            // Cargar Servicios
            const qServicios = firestoreQuery(collection(barberDb, `barber_users/${_uid}/servicios`), orderBy("nombre", "asc"));
            const snapServicios = await getDocs(qServicios);
            const serviciosList: Servicio[] = [];
            snapServicios.forEach((d) => serviciosList.push({ id: d.id, ...d.data() } as Servicio));
            setServicios(serviciosList);

        } catch (err) {
            console.error("Error cargando datos:", err);
        }
        setLoading(false);
    }, [effectiveBarberieUid]); 

    useEffect(() => {
        if (effectiveBarberieUid) {
            loadTransacciones();
        }
    }, [effectiveBarberieUid, loadTransacciones]);


    // ============================================================
    // LÓGICA DE FILTRADO Y RESÚMENES
    // ============================================================

    const allFilteredTransacciones = useMemo(() => {
        let currentFiltered = transacciones;

        if (filterByMode === 'month') {
            currentFiltered = currentFiltered.filter(t => {
                const tYear = Number(t.date.substring(0, 4));
                const tMonth = Number(t.date.substring(5, 7));
                return tYear === selectedYear && (selectedMonth === 0 || tMonth === selectedMonth);
            });
        } else if (filterByMode === 'day') {
             currentFiltered = currentFiltered.filter(t => {
                 const tYear = Number(t.date.substring(0, 4));
                 const tMonth = Number(t.date.substring(5, 7));
                 const tDay = Number(t.date.substring(8, 10)); 
                 return tYear === selectedYear && tMonth === selectedMonth && tDay === selectedDay;
             });
        } else if (filterByMode === 'range') {
             // ⭐ FILTRO POR RANGO DE FECHAS
             const start = startDate;
             const end = endDate;

             currentFiltered = currentFiltered.filter(t => {
                 // t.date tiene formato 'YYYY-MM-DD' y es comparable directamente
                 return t.date >= start && t.date <= end;
             });
        }
        
        return currentFiltered;

    }, [transacciones, selectedYear, selectedMonth, selectedDay, filterByMode, startDate, endDate]); 

    const finalDisplayedTransacciones = useMemo(() => {
        let filtered = allFilteredTransacciones;
        
        if (isEmployeeMode) {
             filtered = filtered.filter(t => t.barberId === loggedInEmployee?.id);
        }
        
        // ⭐ Filtro de Barbero: SOLO APLICA EN MODO 'ventas' Y SI NO ES EMPLEADO
        if (viewMode === 'ventas' && !isEmployeeMode && filterBarberId !== 'all') {
             filtered = filtered.filter(t => t.barberId === filterBarberId);
        }

        // ⭐ Filtro de Método de Pago: SOLO APLICA EN MODO 'ventas'
        if (viewMode === 'ventas' && filterPaymentMethod !== 'all') {
             filtered = filtered.filter(t => 
                (t.tipo === 'Gasto' && filterPaymentMethod === 'N/A') || 
                (t.tipo === 'Ingreso' && t.metodoPago === filterPaymentMethod)
             );
        }
        
        return filtered;
    }, [allFilteredTransacciones, filterBarberId, isEmployeeMode, loggedInEmployee?.id, filterPaymentMethod, viewMode]);


    const groupedTransacciones = useMemo(() => {
        // En vista 'liquidaciones', no agrupamos, en vista 'ventas' sí.
        const transaccionesToGroup = viewMode === 'ventas' ? finalDisplayedTransacciones : [];
        return groupTransaccionesByDate(transaccionesToGroup);
    }, [finalDisplayedTransacciones, viewMode]);
    
    const availableYears = useMemo(() => {
        const years = new Set(transacciones.map(t => Number(t.date.substring(0, 4))));
        return Array.from(years).sort((a, b) => b - a);
    }, [transacciones]);

    
    const liquidacionDataOwner = useMemo(() => {
        if (isEmployeeMode) return [];

        const liquidaciones: { [barberId: string]: LiquidacionItem } = {};
        
        empleados.forEach(emp => {
            liquidaciones[emp.id] = {
                barberId: emp.id,
                totalVentas: 0,
                comision: 0,
                porcentaje: emp.porcentaje,
                nombre: emp.nombre
            };
        });

        allFilteredTransacciones.filter(t => t.tipo === 'Ingreso' && t.barberId)
            .forEach(t => {
                const monto = t.monto;
                const empId = t.barberId!;
                
                let porcentajeFijo = t.comisionAplicada ?? 0;
                
                if (porcentajeFijo === 0 && !t.comisionAplicada) { 
                    const empleado = empleados.find(e => e.id === empId);
                    porcentajeFijo = empleado ? empleado.porcentaje : 0; 
                }
                
                if (liquidaciones[empId]) {
                    liquidaciones[empId].totalVentas += monto;
                    liquidaciones[empId].comision += monto * (porcentajeFijo / 100); 
                }
            });

        return Object.values(liquidaciones)
            .filter(data => data.totalVentas > 0)
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

    }, [allFilteredTransacciones, empleados, isEmployeeMode]);
    
    const employeeLiquidacion = useMemo(() => {
        if (!isEmployeeMode || !uid || !loggedInEmployee) return null;
        
        const employeeSales = allFilteredTransacciones.filter(t => t.barberId === loggedInEmployee.id && t.tipo === 'Ingreso');
        const employeeExpenses = allFilteredTransacciones.filter(t => t.barberId === loggedInEmployee.id && t.tipo === 'Gasto');
        
        const totalVentas = employeeSales.reduce((sum, t) => sum + t.monto, 0);
        const totalGastos = employeeExpenses.reduce((sum, t) => sum + t.monto, 0);
        
        const comisionGanada = employeeSales.reduce((sum, t) => {
            let porcentajeFijo = t.comisionAplicada ?? 0;
            
            if (porcentajeFijo === 0 && !t.comisionAplicada) {
                porcentajeFijo = loggedInEmployee.porcentaje;
            }
            
            const porcentaje = porcentajeFijo / 100;
            return sum + (t.monto * porcentaje);
        }, 0);
        
        const porcentaje = loggedInEmployee.porcentaje;
        const neto = comisionGanada - totalGastos; 
        
        return {
            totalVentas,
            totalGastos,
            comisionGanada,
            porcentaje,
            neto,
            nombre: loggedInEmployee.nombre
        };

    }, [allFilteredTransacciones, isEmployeeMode, uid, loggedInEmployee]);


    const totalSummary = useMemo(() => {
        return calculateTotals(allFilteredTransacciones, effectiveBarberieUid, empleados, !!isEmployeeMode); 

    }, [allFilteredTransacciones, isEmployeeMode, effectiveBarberieUid, empleados]);

    /* ============================================================
        GESTIÓN DE MODAL Y FORMULARIO
    ============================================================ */
    const resetForm = useCallback((servicesList: Servicio[], employeesList: Empleado[]) => {
        setCurrentId(null);
        setFormMonto("");
        setFormDescripcion("");
        setFormTipo('Ingreso');
        setFormDate(formatDateToInput(new Date())); 
        setFormMetodoPago('Efectivo'); 
        
        // ⭐ CAMBIO CLAVE: Priorizar 'servicio' si hay servicios.
        const hasServices = servicesList.length > 0;
        setVentaType(hasServices ? 'servicio' : 'manual');
        
        const defaultServiceId = servicesList[0]?.id || '';
        setSelectedServiceId(defaultServiceId);

        // ⭐ Lógica de preselección usando sortedBarbers
        const firstBarber = sortedBarbers[0];
        const me = sortedBarbers.find(e => e.id === uid);

        if (isEmployeeMode && me) {
             setSelectedBarberId(me.id); // Si soy empleado, me preselecciono
        } else if (firstBarber) {
             setSelectedBarberId(firstBarber.id); // Si soy dueño o no soy empleado, selecciono el primero de la lista ordenada
        } else {
             setSelectedBarberId('');
        }
        
        // Reset Cliente y Creación
        setSelectedClienteId('');
        setIsCreatingClient(false);
        setNewClientName("");
        setNewClientPhone("");

        const defaultService = servicesList.find(s => s.id === defaultServiceId);
        if (hasServices && defaultService) {
            setFormDescripcion(`Venta de Servicio: ${defaultService.nombre}`);
            setFormMonto(defaultService.precio.toString());
        }
        
        setIsEditing(false);
    }, [servicios, empleados, uid, isEmployeeMode, sortedBarbers]);

    const openModal = (transaccion?: Transaccion) => {
        if (transaccion) {
            setIsEditing(true);
            setCurrentId(transaccion.id);
            setFormMonto(Math.abs(transaccion.monto).toString());
            setFormDescripcion(transaccion.descripcion);
            setFormTipo(transaccion.tipo);
            setFormDate(transaccion.date || formatDateToInput(transaccion.createdAt.toDate()));
            setFormMetodoPago(transaccion.metodoPago && transaccion.tipo === 'Ingreso' ? transaccion.metodoPago : 'Efectivo'); 
            
            setVentaType('manual'); 
            setSelectedServiceId('');
            
            setSelectedBarberId(transaccion.barberId || uid || sortedBarbers[0]?.id || ''); 
            
            // Cargar cliente si existe
            setSelectedClienteId(transaccion.clienteId || '');
            setIsCreatingClient(false); 

        } else {
            resetForm(servicios, empleados);
        }
        setModalOpen(true);
    };

    const closeModal = useCallback(() => {
        setModalOpen(false);
        resetForm(servicios, empleados); 
    }, [servicios, empleados, resetForm]);

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

    useEffect(() => {
        if (ventaType === 'servicio' && selectedServiceId) {
            const service = servicios.find(s => s.id === selectedServiceId);
            if (service) {
                setFormDescripcion(`Venta de Servicio: ${service.nombre}`);
                setFormMonto(service.precio.toString());
                setFormTipo('Ingreso');
            }
        } else if (ventaType === 'manual' && !isEditing) {
            if (formTipo === 'Ingreso') {
                if (formMonto === '0' || formMonto === '') {
                    setFormMonto('');
                }
            }
        }
    }, [ventaType, selectedServiceId, servicios, formTipo, isEditing, formMonto]);


    /* ============================================================
        CRUD HANDLERS
    ============================================================ */
    const handleSave = async () => {
        if (isSaving) return; // Previene doble click
        
        if (!uid || !formMonto || !formDescripcion.trim() || !formDate) {
            console.error("Completa todos los campos.");
            return;
        }
        
        if (formTipo === 'Ingreso' && (!selectedBarberId || !formMetodoPago)) {
            console.error("Debes seleccionar un empleado y método de pago para esta venta.");
            return;
        }

        if (formTipo === 'Ingreso' && isCreatingClient && !newClientName.trim()) {
            console.error("Por favor ingresa el nombre del nuevo cliente.");
            return;
        }

        const montoNum = Number(formMonto);
        if (isNaN(montoNum) || montoNum <= 0) {
            console.error("El monto debe ser un número positivo.");
            return;
        }
        
        let barberIdToSave: string | null = null;
        let barberNameToSave: string | null = null;
        let comisionAplicadaToSave: number | null = null;
        
        let clienteIdToSave: string | null = null;
        let clienteNameToSave: string | null = null;

        if (formTipo === 'Ingreso') {
            const selectedBarber = empleados.find(e => e.id === selectedBarberId);
            if (!selectedBarber) {
                console.error("Empleado seleccionado no válido.");
                return;
            }
            
            barberIdToSave = selectedBarberId;
            barberNameToSave = selectedBarber.nombre;
            comisionAplicadaToSave = selectedBarber.porcentaje;

            // --- LÓGICA DE CLIENTE ---
            if (isCreatingClient) {
                try {
                    const newClientData = {
                        nombre: newClientName.trim(),
                        telefono: newClientPhone.trim(),
                        visitas: 0, 
                        ultimaVisita: serverTimestamp(),
                        createdAt: serverTimestamp(),
                    };
                    
                    const docRef = await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/clientes`), newClientData);
                    clienteIdToSave = docRef.id;
                    clienteNameToSave = newClientName.trim();
                } catch (error) {
                    console.error("Error creando cliente rápido:", error);
                    return; 
                }
            } else if (selectedClienteId) {
                const selectedCliente = clientes.find(c => c.id === selectedClienteId);
                if (selectedCliente) {
                    clienteIdToSave = selectedCliente.id;
                    clienteNameToSave = selectedCliente.nombre;
                }
            }
        }
        
        setIsSaving(true); // ⭐ BLOQUEAR EL BOTÓN
        
        try {
            const data: Partial<Transaccion> = {
                monto: montoNum, 
                descripcion: formDescripcion.trim(),
                tipo: formTipo,
                date: formDate, 
                servicioId: (ventaType === 'servicio' && selectedServiceId && formTipo === 'Ingreso' && !isEditing) ? selectedServiceId : null, 
                barberId: barberIdToSave, 
                barberName: barberNameToSave, 
                comisionAplicada: formTipo === 'Ingreso' ? comisionAplicadaToSave : null, 
                metodoPago: formTipo === 'Ingreso' ? formMetodoPago : 'N/A',
                clienteId: clienteIdToSave,
                clienteNombre: clienteNameToSave,
                updatedAt: serverTimestamp(), 
            };
            
            if (isEditing && currentId) {
                await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${currentId}`), data);
            } else {
                // NUEVA TRANSACCIÓN
                await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`), {
                    ...data,
                    createdAt: serverTimestamp(),
                });

                // --- ⭐ LÓGICA DE FIDELIDAD (+1 Visita) ---
                if (clienteIdToSave) {
                    try {
                        const clientRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${clienteIdToSave}`);
                        await updateDoc(clientRef, {
                            visitas: increment(1), 
                            ultimaVisita: serverTimestamp()
                        });
                    } catch (fidelityError) {
                        console.error("Error actualizando fidelidad:", fidelityError);
                    }
                }
                // --- ⭐ FIN LÓGICA FIDELIDAD ⭐ ---
            }

            closeModal();
            loadTransacciones(); 
        } catch (e) {
            console.error(e);
            console.error("Error al guardar la transacción.");
        } finally {
             setIsSaving(false); // ⭐ DESBLOQUEAR EL BOTÓN
        }
    };

    const triggerDelete = (transaccion: Transaccion) => {
        if (isEmployeeMode && uid && transaccion.barberId !== uid) {
             console.error("No tienes permiso para eliminar esta transacción.");
             return;
        }
        setTransactionToDelete(transaccion);
        setDeleteConfirmOpen(true);
    };
    
    const handleDelete = async () => {
        if (!effectiveBarberieUid || !transactionToDelete || isDeleting) return; // Previene doble click
        
        setIsDeleting(true); // ⭐ BLOQUEAR EL BOTÓN
        
        try {
            await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${transactionToDelete.id}`));
            setDeleteConfirmOpen(false);
            setTransactionToDelete(null);
            loadTransacciones();
        } catch (e) {
            console.error(e);
            console.error("Error al eliminar la transacción.");
        } finally {
            setIsDeleting(false); // ⭐ DESBLOQUEAR EL BOTÓN
        }
    };

    // Estilos Comunes
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
    const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed";


    /* ============================================================
        RENDER
    ============================================================ */

    const renderTransaccion = (t: Transaccion) => {
        const isIngreso = t.tipo === 'Ingreso';
        const amountSign = isIngreso ? '+' : '-';
        const amountColor = isIngreso ? 'text-emerald-600' : 'text-red-600';
        
        const canEditDelete = !isEmployeeMode || (isEmployeeMode && t.barberId === uid);

        let displayAmount = t.monto;
        let displayAmountColor = amountColor;
        let displayComisionInfo = false;

        if (isEmployeeMode && isIngreso && loggedInEmployee) {
            let porcentajeFijo = t.comisionAplicada ?? 0;
            
            if (porcentajeFijo === 0 && !t.comisionAplicada) {
                porcentajeFijo = loggedInEmployee.porcentaje;
            }
            
            const porcentaje = porcentajeFijo / 100;
            
            displayAmount = t.monto * porcentaje;
            displayAmountColor = 'text-emerald-700';
            displayComisionInfo = true;
        }

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
                        <div className="flex flex-wrap gap-2 items-center mt-0.5">
                             {t.createdAt && (
                                 <p className="text-xs text-slate-400">
                                     {t.createdAt instanceof Timestamp ? t.createdAt.toDate().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }) : "Cargando..."}
                                 </p>
                            )}
                            {/* Mostrar Cliente si existe */}
                            {t.clienteNombre && (
                                 <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                                     Cliente: {t.clienteNombre}
                                 </span>
                            )}
                            {/* ⭐ MOSTRAR MÉTODO DE PAGO */}
                            {t.metodoPago && t.tipo === 'Ingreso' && (
                                 <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                     <PaymentMethodIcon method={t.metodoPago} /> {t.metodoPago}
                                 </span>
                            )}
                        </div>
                        
                        {t.barberName && t.tipo === 'Ingreso' && (
                            <p className="text-xs text-slate-500 italic mt-0.5">
                                Barbero: {t.barberName}
                                {displayComisionInfo && t.comisionAplicada && ` (${t.comisionAplicada}%)`}
                            </p>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${displayAmountColor}`}>
                        {amountSign} {formatCurrency(displayAmount)}
                    </span>
                    
                    {canEditDelete && (
                        <>
                            <button 
                                onClick={() => openModal(t)}
                                className="p-1 text-slate-400 hover:text-slate-800 transition rounded-md cursor-pointer"
                                aria-label="Editar"
                                disabled={isSaving || isDeleting}
                            >
                                <IconEdit />
                            </button>
                            <button 
                                onClick={() => triggerDelete(t)}
                                className="p-1 text-slate-300 hover:text-red-600 transition rounded-md cursor-pointer"
                                aria-label="Eliminar"
                                disabled={isSaving || isDeleting}
                            >
                                <IconTrash />
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fadeIn m-2">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                    <h2 className="text-xl font-semibold text-slate-900">
                        {isEmployeeMode ? 'Resumen de Mis Liquidaciones' : 'Historial de Ventas y Gastos'}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {isEmployeeMode 
                            ? `Vista de tus ventas y comisiones, ${loggedInEmployeeName}.`
                            : 'Resumen de transacciones registradas de la barbería.'
                        }
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm md:w-80 space-y-2">
                    {!isEmployeeMode && (
                        <>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Ingresos Brutos:</span>
                                <span className="font-semibold text-emerald-600">{formatCurrency(totalSummary.ingresos)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Gastos Generales:</span>
                                <span className="font-semibold text-red-600">{formatCurrency(totalSummary.gastos)}</span>
                            </div>
                            {/* MOSTRAR COMISIONES DESCONTADAS (SOLO EMPLEADOS) */}
                            <div className="flex justify-between text-sm border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Comisiones Descontadas:</span>
                                <span className="font-semibold text-red-600">{formatCurrency(totalSummary.comisiones)}</span>
                            </div>
                            {/* FIN MOSTRAR COMISIONES DESCONTADAS */}
                            <div className="pt-2 flex justify-between text-lg">
                                <span className="font-bold text-slate-900">NETO REAL:</span>
                                <span className={`font-bold ${totalSummary.neto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                     {formatCurrency(totalSummary.neto)}
                                </span>
                            </div>
                        </>
                    )}

                    {isEmployeeMode && employeeLiquidacion && (
                        <>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Ventas Brutas ({employeeLiquidacion.porcentaje}%):</span>
                                <span className="font-semibold text-slate-600">{formatCurrency(employeeLiquidacion.totalVentas)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Comisión Ganada:</span>
                                <span className="font-semibold text-emerald-600">{formatCurrency(employeeLiquidacion.comisionGanada)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Gastos Propios:</span>
                                <span className="font-semibold text-red-600">{formatCurrency(employeeLiquidacion.totalGastos)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-between text-lg">
                                <span className="font-bold text-slate-900">NETO LIQUIDABLE:</span>
                                <span className={`font-bold ${employeeLiquidacion.neto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                     {formatCurrency(employeeLiquidacion.neto)}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                <button 
                    onClick={() => openModal()}
                    className="flex items-center justify-center cursor-pointer gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap md:w-48"
                    disabled={isSaving || isDeleting}
                >
                    <IconAdd />
                    Nueva Venta Rápida
                </button>
            </div>
            
            {/* FILTROS */}
            <div className="flex mb-4 gap-4 items-center flex-wrap sm:flex-row">
                
                {/* Botones de Vista (Ventas / Liquidaciones) */}
                <button
                    onClick={() => {setViewMode('ventas'); setFilterBarberId('all'); setFilterPaymentMethod('all'); setFilterByMode('day'); }} // Resetear filtros
                    className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        viewMode === 'ventas' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    Historial de Ventas
                </button>

                {!isEmployeeMode && (
                    <button
                        onClick={() => {setViewMode('liquidaciones'); setFilterBarberId('all'); setFilterPaymentMethod('all'); setFilterByMode('month'); }} // Resetear filtros y forzar a month
                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                            viewMode === 'liquidaciones' ? 'bg-emerald-700 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <IconCash /> Liquidaciones
                    </button>
                )}
                
                {/* Controles de Periodo */}
                <div className="flex items-center gap-2 text-sm mt-2 sm:mt-0 ml-0 sm:ml-4 flex-wrap">
                    <span className="text-slate-600">Periodo:</span>
                    
                    <div className="flex bg-white rounded-lg border border-slate-300 overflow-hidden">
                        <button
                            onClick={() => {
                                setFilterByMode('day');
                                setSelectedDay(today.getDate());
                                setSelectedMonth(today.getMonth() + 1);
                                setSelectedYear(today.getFullYear());
                            }}
                            className={`py-1.5 px-3 text-xs font-medium transition-colors cursor-pointer ${
                                filterByMode === 'day' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            DÍA
                        </button>
                        <button
                            onClick={() => { 
                                setFilterByMode('month'); 
                                setSelectedDay(0); 
                                setSelectedMonth(today.getMonth() + 1);
                            }} 
                            className={`py-1.5 px-3 text-xs font-medium transition-colors cursor-pointer ${
                                filterByMode === 'month' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            MES
                        </button>
                        {/* ⭐ NUEVO BOTÓN DE RANGO PERSONALIZADO */}
                        <button
                            onClick={() => { 
                                setFilterByMode('range'); 
                            }} 
                            className={`py-1.5 px-3 text-xs font-medium transition-colors cursor-pointer ${
                                filterByMode === 'range' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            RANGO
                        </button>
                    </div>
                    
                    {/* Controles de selección basados en el modo */}
                    {filterByMode === 'month' && (
                        <>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(Number(e.target.value))} 
                                className="p-2 border border-slate-300 rounded-lg cursor-pointer min-w-[120px]"
                            >
                                <option value={0}>Todo el Año</option>
                                {monthNames.map((name, index) => (
                                    <option key={index} value={index + 1}>{name}</option>
                                ))}
                            </select>
                            
                            <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))} 
                                className="p-2 border border-slate-300 rounded-lg cursor-pointer min-w-[70px]"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </>
                    )}
                    
                    {filterByMode === 'day' && (
                        <input
                            type="date"
                            value={formatDateToInput(new Date(selectedYear, selectedMonth - 1, selectedDay))}
                            onChange={(e) => {
                                const [year, month, day] = e.target.value.split('-').map(Number);
                                setSelectedYear(year);
                                setSelectedMonth(month);
                                setSelectedDay(day);
                            }}
                            max={formatDateToInput(new Date())}
                            className="p-1.5 border border-slate-300 rounded-lg cursor-pointer text-sm"
                        />
                    )}

                    {/* ⭐ CONTROLES DE RANGO PERSONALIZADO */}
                    {filterByMode === 'range' && (
                        <div className="flex gap-2 items-center text-xs">
                             <span className="text-slate-500">Desde:</span>
                             <input
                                 type="date"
                                 value={startDate}
                                 onChange={(e) => setStartDate(e.target.value)}
                                 max={endDate}
                                 className="p-1.5 border border-slate-300 rounded-lg cursor-pointer"
                             />
                             <span className="text-slate-500">Hasta:</span>
                             <input
                                 type="date"
                                 value={endDate}
                                 onChange={(e) => setEndDate(e.target.value)}
                                 max={formatDateToInput(today)}
                                 min={startDate}
                                 className="p-1.5 border border-slate-300 rounded-lg cursor-pointer"
                             />
                        </div>
                    )}
                </div>
            </div>
            
            <div className="space-y-3">
                
                {/* ⭐ FILTROS ADICIONALES (SOLO EN VISTA DE VENTAS) */}
                {viewMode === 'ventas' && (
                    <div className='flex items-center gap-4 text-sm flex-wrap'>
                        
                        {/* Filtro Barbero (Solo Dueño) */}
                        {!isEmployeeMode && empleados.length > 0 && (
                            <>
                                <span className="text-slate-600 font-medium">Filtrar por Barbero:</span>
                                <select
                                    value={filterBarberId}
                                    onChange={(e) => setFilterBarberId(e.target.value)}
                                    className="p-2 border border-slate-300 rounded-lg cursor-pointer text-sm min-w-[150px]"
                                >
                                    <option value="all">Todas las ventas (General)</option>
                                    {empleados.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.nombre} {e.id === uid ? '(Dueño)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}

                        {/* Filtro por Método de Pago */}
                        <span className="text-slate-600 font-medium">Método de Pago:</span>
                        <select
                            value={filterPaymentMethod}
                            onChange={(e) => setFilterPaymentMethod(e.target.value as PaymentMethod | 'all')}
                            className="p-2 border border-slate-300 rounded-lg cursor-pointer text-sm min-w-[150px]"
                        >
                            <option value="all">Todos los Métodos</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="QR/Tarjeta">QR / Tarjeta</option>
                            <option value="N/A">Gastos (-)</option>
                        </select>
                    </div>
                )}
                {/* ⭐ FIN FILTROS ADICIONALES */}

                {/* VISTA DE CONTENIDO */}
                {viewMode === 'liquidaciones' && !isEmployeeMode ? (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">
                            Resumen de Comisiones por Empleado
                        </h3>
                        
                        {loading ? (
                            <div className="text-center py-12">
                                <IconSpinner color="text-blue-600" />
                                <p className="mt-2 text-sm text-slate-500">Cargando transacciones...</p>
                            </div>
                        ) : empleados.length === 0 ? (
                             <p className="text-sm text-red-500 font-medium">
                                 ERROR: No hay empleados registrados.
                             </p>
                        ) : liquidacionDataOwner.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">
                                No hay ventas con comisión registradas para el periodo seleccionado.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {liquidacionDataOwner.map((data, index) => (
                                    <div key={index} className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                        <p className="text-sm font-semibold text-slate-900">{data.nombre}</p>
                                        {/* Muestra el porcentaje actual para fines informativos */}
                                        <p className="text-xs text-slate-500 mt-1">Comisión actual: {data.porcentaje}%</p>
                                        
                                        <div className="mt-3 pt-3 border-t border-emerald-100">
                                            <div className="flex justify-between text-sm">
                                                <span>Ventas Totales:</span>
                                                <span className="font-medium text-slate-700">{formatCurrency(data.totalVentas)}</span>
                                            </div>
                                            <div className="flex justify-between text-lg mt-1 font-bold text-emerald-800">
                                                <span>A Liquidar (Comisión Fija):</span>
                                                <span>{formatCurrency(data.comision)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    loading ? (
                        <div className="text-center py-12 flex justify-center items-center min-h-[300px]">
                            <IconSpinner color="text-blue-600" />
                            <p className="mt-2 text-sm text-slate-500">Cargando transacciones...</p>
                        </div>
                    ) : finalDisplayedTransacciones.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <p className="text-slate-400 mb-2">
                                No se encontraron transacciones para el periodo seleccionado.
                            </p>
                            <button onClick={() => openModal()} className="text-sm cursor-pointer text-slate-900 font-medium hover:underline">
                                Registrar una nueva ahora
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(groupedTransacciones).sort(([yearA], [yearB]) => Number(yearB) - Number(yearA)).map(([year, months]) => {
                                
                                const monthsObj = months as TransaccionGroup[number];
                                const yearTransacciones = Object.values(monthsObj)
                                     .flatMap(m => Object.values(m) as Transaccion[][]) 
                                     .flat() as Transaccion[]; 
                                
                                const yearTotals = calculateTotals(yearTransacciones, effectiveBarberieUid, empleados, !!isEmployeeMode);
                                
                                const yearSummary = (
                                     <span className={`text-base font-bold ${yearTotals.neto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                         {isEmployeeMode ? 'Neto Liquidable' : 'Neto Real'}: {formatCurrency(yearTotals.neto)}
                                     </span>
                                );

                                return (
                                    <CollapsibleSection key={year} title={`Año ${year}`} initialOpen={filterByMode !== 'range' && filterByMode !== 'day' ? true : false} summary={yearSummary}>
                                        <div className="space-y-3">
                                            {Object.entries(monthsObj).sort(([monthA], [monthB]) => Number(monthB) - Number(monthA)).map(([month, days]) => {
                                                
                                                const monthTransacciones = Object.values(days).flat() as Transaccion[]; 
                                                const monthTotals = calculateTotals(monthTransacciones, effectiveBarberieUid, empleados, !!isEmployeeMode);
                                                
                                                const monthSummary = (
                                                     <span className={`text-sm font-semibold ${monthTotals.neto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                         {formatCurrency(monthTotals.neto)}
                                                     </span>
                                                 );

                                                return (
                                                    <CollapsibleSection 
                                                        key={`${year}-${month}`} 
                                                        title={monthNames[Number(month) - 1]} 
                                                        initialOpen={filterByMode === 'month' && Number(month) === selectedMonth} 
                                                        summary={monthSummary}
                                                        className="bg-slate-50 border-slate-100"
                                                    >
                                                        <div className="space-y-2">
                                                            {Object.entries(days as { [key: string]: Transaccion[] }).sort(([dayA], [dayB]) => Number(dayB) - Number(dayA)).map(([day, dailyTransacciones]) => {
                                                                
                                                                const dayTotals = calculateTotals(dailyTransacciones, effectiveBarberieUid, empleados, !!isEmployeeMode);
                                                                
                                                                const daySummary = (
                                                                     <span className={`text-xs font-medium ${dayTotals.neto >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                         {formatCurrency(dayTotals.neto)}
                                                                     </span>
                                                                 );

                                                                return (
                                                                    <CollapsibleSection 
                                                                        key={`${year}-${month}-${day}`} 
                                                                        title={`Día ${day}`} 
                                                                        initialOpen={filterByMode === 'day' && Number(day) === selectedDay && Number(month) === selectedMonth} 
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
                    )
                )}

                {/* MODAL CREAR / EDITAR */}
                {modalOpen && (
                     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                          <div 
                               ref={modalRef} 
                               className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn max-h-[90vh] overflow-y-auto" 
                               onClick={(e) => e.stopPropagation()}
                          >
                               <h3 className="text-lg font-semibold text-slate-900 mb-4">
                                    {isEditing ? "Editar Transacción" : "Nueva Venta Rápida"}
                               </h3>
                               
                               <div className="space-y-4">
                                    
                                    {/* Tipo de Transacción */}
                                    <div>
                                         <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de Monto</label>
                                         <div className="flex space-x-4">
                                              <button 
                                                   onClick={() => {
                                                        setFormTipo('Ingreso');
                                                        setVentaType(servicios.length > 0 ? 'servicio' : 'manual');
                                                        const firstBarber = sortedBarbers[0];
                                                        setSelectedBarberId(firstBarber?.id || ''); 
                                                   }}
                                                   disabled={isEditing && currentId !== null || isSaving}
                                                   className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border-2 cursor-pointer ${
                                                        formTipo === 'Ingreso' 
                                                             ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                                                             : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                   }`}
                                              >
                                                   Ingreso (+)
                                              </button>
                                              <button 
                                                   onClick={() => {
                                                        setFormTipo('Gasto');
                                                        setVentaType('manual');
                                                        setSelectedBarberId('');
                                                        setSelectedClienteId(''); 
                                                        setIsCreatingClient(false);
                                                   }}
                                                   disabled={isEditing && currentId !== null || isSaving}
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
                                    
                                    {/* Barbero Asignado */}
                                    {formTipo === 'Ingreso' && (
                                         <div className="border-t border-slate-100 pt-4">
                                             <label className="text-xs font-medium text-slate-600 mb-1 block">
                                                  Barbero Asignado (Obligatorio)
                                             </label>
                                             
                                             {sortedBarbers.length > 0 ? ( 
                                                  <select
                                                       value={selectedBarberId}
                                                       onChange={(e) => setSelectedBarberId(e.target.value)}
                                                       className={inputClass + ' cursor-pointer'}
                                                       disabled={isSaving}
                                                  >
                                                       <option value="">-- Selecciona un Barbero --</option>
                                                       {sortedBarbers.map((e) => ( 
                                                            <option key={e.id} value={e.id}>
                                                                 {e.nombre} {e.id === uid && '(Yo)'}
                                                            </option>
                                                       ))}
                                                  </select>
                                              ) : (
                                                   <div className="text-xs text-red-500 mt-1 p-2 bg-red-50 rounded">
                                                        ADVERTENCIA: No hay empleados activos.
                                                   </div>
                                               )}
                                         </div>
                                    )}

                                    {/* ⭐ NUEVO: Método de Pago (Solo para Ingresos) */}
                                    {formTipo === 'Ingreso' && (
                                         <div className="pt-0">
                                              <label className="text-xs font-medium text-slate-600 mb-1 block">Método de Pago</label>
                                              <select
                                                   value={formMetodoPago}
                                                   onChange={(e) => setFormMetodoPago(e.target.value as PaymentMethod)}
                                                   className={inputClass + ' cursor-pointer'}
                                                   disabled={isSaving}
                                              >
                                                   <option value="Efectivo">Efectivo</option>
                                                   <option value="Transferencia">Transferencia</option>
                                                   <option value="QR/Tarjeta">QR / Tarjeta</option>
                                              </select>
                                         </div>
                                    )}
                                    {/* ⭐ FIN NUEVO BLOQUE */}

                                    {/* --- SECCIÓN CLIENTE (CON OPCIÓN CREAR RÁPIDO) --- */}
                                    {formTipo === 'Ingreso' && (
                                         <div className="border-t border-slate-100 pt-4">
                                             <div className="flex justify-between items-center mb-1">
                                                  <label className="text-xs font-medium text-slate-600">
                                                       Asignar Cliente (Opcional)
                                                  </label>
                                                  <button 
                                                        type="button"
                                                        onClick={() => setIsCreatingClient(!isCreatingClient)}
                                                        className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                                        disabled={isSaving}
                                                  >
                                                       {isCreatingClient ? "← Seleccionar Existente" : "+ Nuevo Cliente"}
                                                  </button>
                                             </div>
                                             
                                             {isCreatingClient ? (
                                                  // MODO CREAR CLIENTE
                                                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-2 animate-fadeIn">
                                                       <p className="text-xs font-bold text-blue-700 mb-1">Nuevo Cliente Rápido</p>
                                                       <input
                                                             type="text"
                                                             placeholder="Nombre del Cliente"
                                                             value={newClientName}
                                                             onChange={(e) => setNewClientName(e.target.value)}
                                                             className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:border-blue-400"
                                                             autoFocus
                                                             disabled={isSaving}
                                                       />
                                                       <input
                                                             type="tel"
                                                             placeholder="Teléfono (Opcional)"
                                                             value={newClientPhone}
                                                             onChange={(e) => setNewClientPhone(e.target.value)}
                                                             className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:border-blue-400"
                                                             disabled={isSaving}
                                                       />
                                                       <p className="text-[10px] text-blue-600 mt-1">
                                                             * Se creará y se sumará su primera visita.
                                                       </p>
                                                  </div>
                                             ) : (
                                                  // MODO SELECCIONAR CLIENTE
                                                  <>
                                                        {clientes.length > 0 ? (
                                                             <select
                                                                  value={selectedClienteId}
                                                                  onChange={(e) => setSelectedClienteId(e.target.value)}
                                                                  className={inputClass + ' cursor-pointer border-blue-200 bg-blue-50/30'}
                                                                  disabled={isSaving}
                                                             >
                                                                  <option value="">-- Cliente Anónimo / Sin Cuenta --</option>
                                                                  {clientes.map((c) => (
                                                                       <option key={c.id} value={c.id}>
                                                                            {c.nombre} {c.visitas ? `(${c.visitas} visitas)` : ''}
                                                                       </option>
                                                                  ))}
                                                             </select>
                                                        ) : (
                                                             <p className="text-xs text-slate-400 italic mb-2">No tienes clientes registrados aún.</p>
                                                        )}
                                                  </>
                                             )}

                                             {(selectedClienteId || isCreatingClient) && (
                                                  <p className="text-[10px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                                                        <span>⭐</span> Se sumará 1 turno al historial del cliente.
                                                  </p>
                                             )}
                                         </div>
                                    )}

                                    {/* Selector de Venta (Servicio vs Manual) */}
                                    {formTipo === 'Ingreso' && !isEditing && (
                                         <div className="border-t border-slate-100 pt-4">
                                             <label className="text-xs font-medium text-slate-600 mb-1 block">Origen del Ingreso</label>
                                             <div className="flex space-x-4 mb-3">
                                                  <button 
                                                       onClick={() => { setVentaType('servicio'); setSelectedServiceId(servicios[0]?.id || ''); }}
                                                       className={ventaType === 'servicio' ? 'flex-1 py-2 text-sm font-medium rounded-md transition-colors bg-slate-900 text-white shadow' : 'flex-1 py-2 text-sm font-medium rounded-md transition-colors text-slate-500 hover:bg-slate-100'}
                                                       disabled={servicios.length === 0 || isSaving}
                                                  >
                                                       Venta de Servicio
                                                  </button>
                                                  <button 
                                                       onClick={() => { setVentaType('manual'); setSelectedServiceId(''); }}
                                                       className={ventaType === 'manual' ? 'flex-1 py-2 text-sm font-medium rounded-md transition-colors bg-slate-900 text-white shadow' : 'flex-1 py-2 text-sm font-medium rounded-md transition-colors text-slate-500 hover:bg-slate-100'}
                                                       disabled={isSaving}
                                                  >
                                                       Venta/Ingreso Manual
                                                  </button>
                                             </div>

                                             {ventaType === 'servicio' && servicios.length > 0 && (
                                                  <div>
                                                       <select
                                                            value={selectedServiceId}
                                                            onChange={(e) => setSelectedServiceId(e.target.value)}
                                                            className={inputClass + ' cursor-pointer'}
                                                            disabled={isSaving}
                                                       >
                                                            <option value="">-- Selecciona un Servicio --</option>
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
                                    
                                    {/* Fecha */}
                                    <div className="border-t border-slate-100 pt-4">
                                         <label className="text-xs font-medium text-slate-600 mb-1 block">Fecha de Transacción</label>
                                         <input 
                                              type="date" 
                                              value={formDate} 
                                              onChange={(e) => setFormDate(e.target.value)} 
                                              className={inputClass + ' cursor-pointer'}
                                              max={formatDateToInput(new Date())} 
                                              disabled={isSaving}
                                         />
                                    </div>

                                    {/* Monto */}
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
                                                       disabled={isSaving}
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

                                    {/* Descripción */}
                                    <div>
                                         <label className="text-xs font-medium text-slate-600 mb-1 block">Descripción</label>
                                         <textarea 
                                              rows={2}
                                              value={formDescripcion} 
                                              onChange={(e) => setFormDescripcion(e.target.value)} 
                                              className={inputClass}
                                              placeholder={formTipo === 'Ingreso' ? "Venta de corte y barba" : "Compra de navajas"} 
                                              disabled={isSaving}
                                         />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                         <button 
                                              onClick={closeModal}
                                              className={btnSecondary}
                                              disabled={isSaving}
                                         >
                                              Cancelar
                                         </button>
                                         <button 
                                              onClick={handleSave}
                                              className={btnPrimary}
                                              disabled={formTipo === 'Ingreso' && !selectedBarberId || isSaving}
                                         >
                                              {isSaving ? (
                                                    <>
                                                        <IconSpinner color="text-white" />
                                                        Guardando...
                                                    </>
                                               ) : (isEditing ? "Guardar Cambios" : "Registrar Transacción")}
                                         </button>
                                    </div>
                               </div>
                          </div>
                     </div>
                )}

                {/* MODAL ELIMINAR */}
                {deleteConfirmOpen && transactionToDelete && (
                     <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                          <div 
                               ref={deleteModalRef} 
                               className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-scaleIn space-y-4"
                               onClick={(e) => e.stopPropagation()}
                          >
                               <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-red-100 text-red-600">
                                         <IconAlert />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">Confirmar Eliminación</h3>
                               </div>
                               
                               <p className="text-sm text-slate-700">
                                    ¿Estás seguro de que deseas eliminar esta transacción? Esta acción es irreversible.
                               </p>

                               <div className="p-3 border border-slate-100 rounded-lg text-sm bg-slate-50">
                                    <p className="font-semibold">{transactionToDelete.descripcion}</p>
                                    <p className={`text-xs ${transactionToDelete.tipo === 'Ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                                         {transactionToDelete.tipo}: {formatCurrency(transactionToDelete.monto)}
                                    </p>
                                    <p className="text-xs text-slate-400">Fecha: {transactionToDelete.date}</p>
                                    {transactionToDelete.barberName && (
                                         <p className="text-xs text-slate-400">Barbero: {transactionToDelete.barberName}</p>
                                    )}
                               </div>

                               <div className="flex gap-3 pt-2">
                                    <button 
                                         onClick={() => setDeleteConfirmOpen(false)} 
                                         className={btnSecondary}
                                         disabled={isDeleting}
                                    >
                                         Cancelar
                                    </button>
                                    <button 
                                         onClick={handleDelete} 
                                         className={btnPrimary.replace('bg-slate-900', 'bg-red-600 hover:bg-red-700')}
                                         disabled={isDeleting}
                                    >
                                         {isDeleting ? (
                                              <>
                                                   <IconSpinner color="text-white" />
                                                   Eliminando...
                                              </>
                                         ) : "Sí, Eliminar"}
                                    </button>
                               </div>
                          </div>
                     </div>
                )}

            </div>
        </div>
    );
};