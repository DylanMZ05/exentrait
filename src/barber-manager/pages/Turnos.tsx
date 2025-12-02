// src/barber-manager/pages/Turnos.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    serverTimestamp,
    increment, // Importar la función increment de Firestore
    QueryConstraint,
    orderBy,
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// ICONOS SVG (Autocontenido)
const IconCalendar = () => (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const IconPlus = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

const IconCheck = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const IconClock = () => (
    <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const IconTrash = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const IconUndo = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
);

const IconAlert = () => (
    <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const IconList = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
);

const IconChevronLeft = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
);

const IconChevronRight = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);

const IconSpinner = ({ color = 'text-white' }) => (
    <div className={`inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white ${color}`}></div>
);


/* ============================================================
    HELPER: MANEJO DE FECHAS
============================================================ */
const changeDay = (dateString: string, days: number): string => { 
    const date = new Date(dateString + 'T00:00:00'); 
    date.setDate(date.getDate() + days);
    return formatDateToInput(date);
};

const formatDateToInput = (date: Date): string => { 
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const generateTimeSlots = () => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        slots.push(`${hour}:00`);
        slots.push(`${hour}:30`);
    }
    return slots;
};
const TIME_SLOTS = generateTimeSlots(); 

/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Turnos: React.FC = () => {
    const user = barberAuth.currentUser;
    const userUid = user?.uid;

    const ownerUid = localStorage.getItem('barberOwnerId');
    const effectiveBarberieUid = ownerUid || userUid;


    // Estados de datos
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [clientes, setClientes] = useState<any[]>([]);
    const [serviciosList, setServiciosList] = useState<any[]>([]);
    const [turnos, setTurnos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

    // Modal Crear / Editar
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // Modal Confirmación Custom
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false); // ⭐ Bloqueo para Modal de Turno (Guardar)
    const [isConfirming, setIsConfirming] = useState(false); // ⭐ Bloqueo para Modal de Confirmación (Eliminar/Completar/Deshacer)
    
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string; message: string; action: () => Promise<void>; confirmText: string; isDanger?: boolean;
    }>({ title: "", message: "", action: async () => {}, confirmText: "", isDanger: false });

    // Formulario Turno
    const [formBarberId, setFormBarberId] = useState("");
    const [formTime, setFormTime] = useState("");
    const [formClientId, setFormClientId] = useState("");
    
    // Lógica Servicio (Manual vs Catálogo)
    const [isManualService, setIsManualService] = useState(false);
    const [formService, setFormService] = useState("");
    const [formPrice, setFormPrice] = useState("0");

    const [formStatus, setFormStatus] = useState("pendiente");
    const [currentTurnoId, setCurrentTurnoId] = useState<string | null>(null);

    // Formulario Creación Rápida de Cliente
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientPhone, setNewClientPhone] = useState("");

    /* ============================================================
        NAVEGACIÓN DE DÍAS
    ============================================================ */
    const goToPreviousDay = () => { setSelectedDate(changeDay(selectedDate, -1)); };
    const goToNextDay = () => { setSelectedDate(changeDay(selectedDate, 1)); };
    const goToToday = () => { setSelectedDate(new Date().toISOString().split("T")[0]); };


    /* ============================================================
        CARGA DE DATOS (RECURSOS DE LA BARBERÍA) - VISTA UNIFICADA
    ============================================================ */
    const loadResources = useCallback(async () => {
        if (!effectiveBarberieUid) return;

        setLoading(true);
        const uidBarberia = effectiveBarberieUid;

        try {
            // 1. Cargar Empleados (necesario para las columnas)
            const empSnap = await getDocs(collection(barberDb, `barber_users/${uidBarberia}/empleados`));
            const empList: any[] = [];
            empSnap.forEach((d) => empList.push({ id: d.id, ...d.data() }));
            setEmpleados(empList);

            // 2. Cargar Clientes 
            const cliSnap = await getDocs(query(collection(barberDb, `barber_users/${uidBarberia}/clientes`)));
            const cliList: any[] = [];
            cliSnap.forEach((d) => cliList.push({ id: d.id, ...d.data() }));
            cliList.sort((a, b) => a.nombre.localeCompare(b.nombre));
            setClientes(cliList);

            // 3. Cargar Servicios 
            const servSnap = await getDocs(query(collection(barberDb, `barber_users/${uidBarberia}/servicios`)));
            const servList: any[] = [];
            servSnap.forEach((d) => servList.push({ id: d.id, ...d.data() }));
            servList.sort((a, b) => a.nombre.localeCompare(b.nombre));
            setServiciosList(servList);
            
        } catch (error) {
            console.error("Error cargando recursos de la barbería", error);
        }
    }, [effectiveBarberieUid]);

    /* ============================================================
        CARGA DE TURNOS (Siempre fresco) - VISTA UNIFICADA
    ============================================================ */
    const loadTurnos = useCallback(async () => {
        if (!effectiveBarberieUid) return;
        setLoading(true);
        try {
            
            let turnosFilters: QueryConstraint[] = [];
            
            // FILTRO DE FECHA (siempre va)
            turnosFilters.push(where("fecha", "==", selectedDate));
            
            // FILTRO DE RANGO (ESTADO)
            turnosFilters.push(where("estado", "!=", 'cancelado'));

            // ORDENAMIENTO (Vista de Dueño/Universal - Usa el índice simple fecha, estado, hora)
            turnosFilters.push(orderBy("fecha"));
            turnosFilters.push(orderBy("estado")); 
            turnosFilters.push(orderBy("hora"));


            const q = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/turnos`),
                ...turnosFilters
            );
            
            const snap = await getDocs(q);
            const list: any[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
            setTurnos(list);
        } catch (error) {
            console.error("Error cargando turnos", error);
        }
        setLoading(false); 
    }, [effectiveBarberieUid, selectedDate]);


    useEffect(() => {
        // Ejecutamos ambas cargas al inicio o cuando cambian las dependencias críticas
        if (effectiveBarberieUid) {
            loadResources();
            loadTurnos(); 
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveBarberieUid, selectedDate, userUid]);

    /* ============================================================
        HANDLERS APERTURA MODAL (Ajustado para Asignación Universal)
    ============================================================ */
    const openNewTurno = (barberId: string, time: string) => {
        
        setIsEditing(false);
        setCurrentTurnoId(null);
        
        // CRÍTICO: Asignar el barbero CLICADO como valor por defecto.
        setFormBarberId(barberId);
        setFormTime(time);
        setFormClientId("");
        
        // Default logic para servicios
        if (serviciosList.length > 0) {
            setIsManualService(false);
            setFormService(serviciosList[0].nombre);
            setFormPrice(serviciosList[0].precio);
        } else {
            setIsManualService(true);
            setFormService("Corte Clásico");
            setFormPrice("5000");
        }

        setFormStatus("pendiente");
        setIsCreatingClient(false);
        setNewClientName("");
        setNewClientPhone("");
        setModalOpen(true);
    };

    const openEditTurno = (turno: any) => {
        setIsEditing(true);
        setCurrentTurnoId(turno.id);
        setFormBarberId(turno.barberId);
        setFormTime(turno.hora);
        setFormClientId(turno.clientId);
        setFormService(turno.servicio);
        setFormPrice(turno.precio);
        setFormStatus(turno.estado);
        
        const existsInCatalog = serviciosList.some((s: { nombre: any; }) => s.nombre === turno.servicio);
        setIsManualService(!existsInCatalog);

        setIsCreatingClient(false);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setCurrentTurnoId(null);
    };

    /* ============================================================
        HELPER: CONFIRMACIÓN PERSONALIZADA
    ============================================================ */
    const executeConfirmAction = async () => {
        if (isConfirming) return;
        
        setIsConfirming(true); // ⭐ BLOQUEA el botón de confirmación
        
        try {
            await confirmConfig.action(); 
            setConfirmOpen(false);
        } catch (e) {
            console.error("Error al ejecutar acción confirmada:", e);
            alert("Ocurrió un error al procesar la acción.");
        } finally {
            setIsConfirming(false); // ⭐ DESBLOQUEA el botón de confirmación
        }
    };
    
    const triggerConfirm = (title: string, message: string, confirmText: string, isDanger: boolean, action: () => Promise<void>) => {
        setConfirmConfig({ title, message, confirmText, isDanger, action });
        setConfirmOpen(true);
    };

    /* ============================================================
        LOGICA DE GUARDADO
    ============================================================ */
    const handleSave = async () => {
        if (!effectiveBarberieUid || isSaving) return;

        let finalClientId = formClientId;
        let finalClientName = "";
        
        // Validaciones previas
        if (!formBarberId) return alert("Selecciona un barbero.");
        if (!formTime) return alert("Selecciona una hora.");
        if (isCreatingClient && !newClientName.trim()) return alert("El nombre del cliente es obligatorio.");
        if (!formService) return alert("Ingresa el servicio.");
        if (Number(formPrice) <= 0) return alert("El precio debe ser positivo.");
        if (!formClientId && !isCreatingClient) return alert("Selecciona un cliente o crea uno nuevo.");

        // 1. GESTIÓN DEL CLIENTE
        if (isCreatingClient) {
            try {
                const docRef = await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/clientes`), {
                    nombre: newClientName.trim(),
                    telefono: newClientPhone.trim(),
                    cortes: 0,
                    createdAt: serverTimestamp(),
                });
                
                finalClientId = docRef.id;
                finalClientName = newClientName.trim();

                // Actualizar lista local para el selector futuro (optimización)
                const newClientObj = { id: finalClientId, nombre: finalClientName, telefono: newClientPhone.trim() };
                setClientes(prev => [...prev, newClientObj].sort((a, b) => a.nombre.localeCompare(b.nombre)));

            } catch (e) {
                console.error("Error creando cliente rápido", e);
                return alert("Error al crear el cliente.");
            }
        } else {
            finalClientName = clientes.find((c: { id: string; }) => c.id === formClientId)?.nombre || "Cliente";
        }

        const barberName = empleados.find((e: { id: string; }) => e.id === formBarberId)?.nombre || "Barbero";

        setIsSaving(true); // ⭐ BLOQUEA EL BOTÓN
        
        // 2. GUARDAR TURNO
        try {
            const turnoData = {
                barberId: formBarberId,
                barberName,
                clientId: finalClientId,
                clientName: finalClientName,
                fecha: selectedDate,
                hora: formTime,
                servicio: formService,
                precio: Number(formPrice), // Asegurar que sea número
                estado: formStatus,
                updatedAt: serverTimestamp(),
            };

            if (isEditing && currentTurnoId) {
                await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/turnos/${currentTurnoId}`), turnoData);
            } else {
                await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/turnos`), {
                    ...turnoData,
                    createdAt: serverTimestamp(),
                });
            }
            
            closeModal();
            loadTurnos();
        } catch (e) {
            console.error(e);
            alert("Error al guardar turno");
        } finally {
            setIsSaving(false); // ⭐ DESBLOQUEA EL BOTÓN
        }
    };

    /* ============================================================
        ACCIONES DE FLUJO (Con Confirmación Custom)
    ============================================================ */
    const requestFinalizar = () => {
        const action = async () => {
            if (!effectiveBarberieUid || !currentTurnoId || !formClientId) return;

            const barberData = empleados.find((e: { id: string; }) => e.id === formBarberId);
            const clientName = clientes.find((c: { id: string; }) => c.id === formClientId)?.nombre || 'Cliente';
            const price = Number(formPrice);
            
            try {
                // 1. Registrar Venta
                const ventaRef = await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`), {
                    monto: price,
                    descripcion: `Venta - Turno: ${formService} de ${clientName}`,
                    tipo: 'Ingreso',
                    date: formatDateToInput(new Date()),
                    createdAt: serverTimestamp(),
                    barberId: formBarberId,
                    barberName: barberData?.nombre || 'Desconocido', 
                    comisionAplicada: barberData?.porcentaje || 0, // Fija la comisión actual
                    clienteId: formClientId,
                    clienteNombre: clientName,
                });

                // 2. Marcar Turno Completado
                await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/turnos/${currentTurnoId}`), {
                    estado: "completado",
                    ventaId: ventaRef.id,
                });

                // 3. Sumar Fidelidad
                const clientRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${formClientId}`);
                await updateDoc(clientRef, { cortes: increment(1) });
                
                closeModal();
                loadTurnos();
            } catch (e) {
                console.error("Error al finalizar:", e);
                alert("Error al finalizar y registrar venta.");
                throw e; 
            }
        };

        triggerConfirm(
            "¿Finalizar Turno?",
            "Esto marcará el turno como completado, sumará 1 punto de fidelidad y registrará la venta.",
            "Sí, finalizar",
            false, 
            action as () => Promise<void>
        );
    };

    const requestDeshacer = () => {
        const action = async () => {
            if (!effectiveBarberieUid || !currentTurnoId || !formClientId) return;
            
            const currentTurno = turnos.find((t: { id: string | null; }) => t.id === currentTurnoId);
            if (!currentTurno?.ventaId) return alert("Error: Turno no tiene ID de venta asociado.");

            try {
                // 1. Eliminar Venta
                await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${currentTurno.ventaId}`));

                // 2. Deshacer estado del Turno
                await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/turnos/${currentTurnoId}`), {
                    estado: "pendiente",
                    ventaId: null,
                });

                // 3. Restar Fidelidad
                const clientRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${formClientId}`);
                await updateDoc(clientRef, { cortes: increment(-1) });
                
                closeModal();
                loadTurnos();
            } catch (e) {
                console.error("Error al deshacer:", e);
                alert("Error al deshacer la acción.");
                throw e;
            }
        };

        triggerConfirm(
            "¿Deshacer completado?",
            "El turno volverá a pendiente. Se eliminará la venta y se restará el punto de fidelidad sumado.",
            "Confirmar deshacer",
            true, // Warning
            action as () => Promise<void>
        );
    };

    const requestEliminar = () => {
        const action = async () => {
            if (!effectiveBarberieUid || !currentTurnoId) return;
            try {
                await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/turnos/${currentTurnoId}`));
                closeModal();
                loadTurnos();
            } catch (e) {
                console.error("Error al eliminar:", e);
                alert("Error al eliminar turno.");
                throw e;
            }
        };

        triggerConfirm(
            "¿Eliminar turno?",
            "Esta acción borrará el turno permanentemente. No se puede deshacer.",
            "Sí, eliminar",
            true, // Danger
            action as () => Promise<void>
        );
    };

    /* ============================================================
        RENDER
    ============================================================ */
    const getTurnoInSlot = (barberId: string, time: string) => {
        return turnos.find((t: { barberId: string; hora: string; estado: string; }) => t.barberId === barberId && t.hora === time && t.estado !== "cancelado");
    };
    
    // FILTRO DE COLUMNAS (Siempre mostramos todos los empleados)
    const empleadosToDisplay = useMemo(() => {
        return empleados; 
    }, [empleados]);


    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm";
    // Botones con estado de carga
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

    return (
        <div className="space-y-6 animate-fadeIn pb-20 m-2">
            
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                        <IconCalendar />
                        Agenda Diaria
                    </h2>
                    <p className="text-sm text-slate-500">Gestiona los turnos de tus barberos</p>
                </div>

                {/* NAVEGACIÓN DE FECHAS */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={goToPreviousDay} 
                        className="p-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition"
                        aria-label="Día anterior"
                    >
                        <IconChevronLeft />
                    </button>
                    
                    <input 
                        type="date" 
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none shadow-sm font-medium w-36 text-center"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />

                    <button 
                        onClick={goToNextDay} 
                        className="p-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition"
                        aria-label="Día siguiente"
                    >
                        <IconChevronRight />
                    </button>
                    
                    {selectedDate !== formatDateToInput(new Date()) && (
                        <button 
                            onClick={goToToday} 
                            className="ml-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
                        >
                            Hoy
                        </button>
                    )}

                </div>
            </div>

            {/* GRILLA DE TURNOS */}
            <div className="overflow-x-auto pb-4">
                <div className="min-w-[800px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    
                    <div className="flex border-b border-slate-200 bg-slate-50">
                        <div className="w-16 flex-shrink-0 border-r border-slate-200 p-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Hora
                        </div>
                        {empleadosToDisplay.length === 0 ? (
                            <div className="flex-1 p-4 text-center text-sm text-slate-500 italic">
                                {loading ? "Cargando empleados..." : "No hay empleados."}
                            </div>
                        ) : (
                            // ENCABEZADOS DE COLUMNA: Renderizado de la lista completa
                            empleadosToDisplay.map((emp: { id: string; nombre: string; }) => (
                                <div key={emp.id} className="flex-1 p-3 text-center border-r border-slate-200 last:border-r-0">
                                    <span className="block font-semibold text-slate-800 text-sm">{emp.nombre}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                            <p className="mt-2 text-sm text-slate-500">Cargando turnos para {selectedDate}...</p>
                        </div>
                    ) : empleadosToDisplay.length > 0 && (
                        <div className="divide-y divide-slate-100">
                            {TIME_SLOTS.map(time => (
                                <div key={time} className="flex h-20 group">
                                    <div className="w-16 flex-shrink-0 flex items-center justify-center border-r border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-500 group-hover:bg-slate-100 transition-colors">
                                        {time}
                                    </div>

                                    {/* CELDAS DE TURNO: Renderiza todas las columnas */}
                                    {empleadosToDisplay.map((emp: { id: string; }) => {
                                        const turno = getTurnoInSlot(emp.id, time);
                                        const isCompleted = turno?.estado === "completado";

                                        return (
                                            <div 
                                                key={`${emp.id}-${time}`} 
                                                className="flex-1 border-r border-slate-200 last:border-r-0 relative p-1 transition-colors hover:bg-slate-50"
                                            >
                                                {turno ? (
                                                    <div 
                                                        onClick={() => openEditTurno(turno)}
                                                        className={`w-full h-full rounded-lg border px-3 py-1.5 cursor-pointer shadow-sm hover:shadow-md transition-all flex flex-col justify-center
                                                            ${isCompleted 
                                                                ? "bg-emerald-50 border-emerald-200" 
                                                                : "bg-white border-slate-200 border-l-4 border-l-slate-800"
                                                            }`}
                                                    >
                                                        <p className={`text-sm font-bold truncate ${isCompleted ? "text-emerald-800" : "text-slate-900"}`}>
                                                            {turno.clientName}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 truncate">{turno.servicio}</p>
                                                        {isCompleted && (
                                                            <span className="absolute top-1 right-2 text-emerald-600">
                                                                <IconCheck />
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div 
                                                        onClick={() => openNewTurno(emp.id, time)}
                                                        className="w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer"
                                                    >
                                                        <span className="bg-slate-100 text-slate-400 p-1.5 rounded-full hover:bg-slate-200 hover:text-slate-600 transition">
                                                            <IconPlus />
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL FORMULARIO */}
            {modalOpen && (
              <div 
                className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={closeModal}
              >
                <div 
                  className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {isEditing ? "Gestionar Turno" : "Nuevo Turno"}
                    </h3>
                    <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 flex items-center">
                      <IconClock /> {formTime}
                    </div>
                  </div>

                  <div className="space-y-4">
                    
                    {/* === SECCIÓN CLIENTE === */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-medium text-slate-600">Cliente</label>
                        {!isEditing && (
                          <button 
                            onClick={() => setIsCreatingClient(!isCreatingClient)}
                            className="text-xs text-slate-900 font-bold hover:underline flex items-center gap-1"
                            disabled={isSaving}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCreatingClient ? "M6 18L18 6M6 6l12 12" : "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"} />
                            </svg> {isCreatingClient ? 'Cancelar nuevo' : 'Crear nuevo'}
                          </button>
                        )}
                      </div>

                      {isCreatingClient ? (
                        <div className="space-y-2 animate-fadeIn">
                          <input type="text" placeholder="Nombre (Obligatorio)" className={inputClass} value={newClientName} onChange={(e) => setNewClientName(e.target.value)} autoFocus disabled={isSaving} />
                          <input type="tel" placeholder="Teléfono (Opcional)" className={inputClass} value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} disabled={isSaving} />
                        </div>
                      ) : (
                        <select className={inputClass} value={formClientId} onChange={(e) => setFormClientId(e.target.value)} disabled={isEditing && formStatus === "completado" || isSaving}>
                          <option value="">-- Seleccionar --</option>
                          {clientes.map((c: { id: string; nombre: string; telefono: string | undefined; }) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} {c.telefono ? `(${c.telefono})` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* === SECCIÓN SERVICIO Y PRECIO (Dual Mode) === */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-medium text-slate-600">Servicio</label>
                        <button 
                          onClick={() => setIsManualService(!isManualService)}
                          className="text-[10px] text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md transition"
                          disabled={isSaving}
                        >
                          {isManualService ? <><IconList /> Ver Catálogo</> : "Ingresar Manual"}
                        </button>
                      </div>

                      {isManualService ? (
                        <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                          <div>
                            <input type="text" placeholder="Servicio" className={inputClass} value={formService} onChange={(e) => setFormService(e.target.value)} disabled={isEditing && formStatus === "completado" || isSaving} />
                          </div>
                          <div>
                            <input type="number" placeholder="$ Precio" className={inputClass} value={formPrice} onChange={(e) => setFormPrice(e.target.value)} disabled={isEditing && formStatus === "completado" || isSaving} />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                          <div className="relative">
                            <select className={inputClass} value={formService} onChange={(e) => { const selectedName = e.target.value; const serviceObj = serviciosList.find((s: { nombre: any; }) => s.nombre === selectedName); setFormService(selectedName); if (serviceObj) setFormPrice(serviceObj.precio.toString()); }} disabled={isEditing && formStatus === "completado" || isSaving}>
                              <option value="">-- Seleccionar Servicio --</option>
                              {serviciosList.length === 0 && <option value="">Sin servicios cargados</option>}
                              {serviciosList.map((s: { id: React.Key | null | undefined; nombre: any; precio: any; }) => (<option key={s.id} value={s.nombre}>{s.nombre}</option>))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                          </div>
                          <div>
                            <input type="number" className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 cursor-not-allowed" value={formPrice} readOnly disabled />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BARBERO */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Barbero asignado</label>
                      <select className={inputClass} value={formBarberId} onChange={(e) => setFormBarberId(e.target.value)} disabled={isEditing && formStatus === "completado" || isSaving}>
                        {empleados.map((e: { id: string | number | readonly string[] | undefined; nombre: string | number | readonly string[] | undefined; }) => (
                          <option key={e.id as string} value={e.id as string}>{e.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* FOOTER ACCIONES */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 mt-2">
                      
                      {/* 1. COMPLETAR */}
                      {isEditing && formStatus !== "completado" && (
                        <button onClick={requestFinalizar} className="w-full py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 active:scale-[0.98] transition font-bold text-sm flex items-center justify-center gap-2 shadow-sm" disabled={isSaving}>
                          <IconCheck /> Completar y Sumar Puntos
                        </button>
                      )}

                      {/* 2. DESHACER */}
                      {isEditing && formStatus === "completado" && (
                        <button onClick={requestDeshacer} className="w-full py-2.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-200 active:scale-[0.98] transition font-bold text-sm flex items-center justify-center gap-2 shadow-sm" disabled={isSaving}>
                          <IconUndo /> Deshacer completado
                        </button>
                      )}

                      <div className="flex gap-3">
                        {/* 3. ELIMINAR */}
                        {isEditing && formStatus !== "completado" && (
                          <button onClick={requestEliminar} className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition" title="Eliminar turno" disabled={isSaving}>
                            <IconTrash />
                          </button>
                        )}

                        <button onClick={closeModal} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm" disabled={isSaving}>
                          Cerrar
                        </button>
                        
                        {/* 4. GUARDAR / AGENDAR */}
                        {formStatus !== "completado" && (
                          <button onClick={handleSave} className={btnPrimary} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <IconSpinner color="text-white" />
                                    Guardando...
                                </>
                            ) : (isCreatingClient ? "Crear y Agendar" : (isEditing ? "Guardar" : "Agendar"))}
                          </button>
                        )}
                      </div>

                      {isEditing && formStatus === "completado" && (
                        <p className="text-center text-xs text-emerald-600 font-medium mt-1">
                          ✅ Turno completado. Para editarlo o eliminarlo, primero debes deshacerlo.
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* MODAL DE CONFIRMACIÓN PERSONALIZADO */}
            {confirmOpen && (
              <div 
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={() => setConfirmOpen(false)}
              >
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconAlert />
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
                      disabled={isConfirming}
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={executeConfirmAction} 
                      className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm active:scale-95 transition flex items-center justify-center gap-2 ${
                        confirmConfig.isDanger 
                            ? "bg-red-600 hover:bg-red-700" 
                            : "bg-slate-900 hover:bg-slate-800"
                      }`}
                      disabled={isConfirming} // ⭐ Bloquea el botón al confirmar
                    >
                      {isConfirming ? (
                          <>
                              <IconSpinner color="text-white" />
                              Cargando...
                          </>
                      ) : confirmConfig.confirmText}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    );
};