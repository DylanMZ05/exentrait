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
    addDoc,
    increment,
    serverTimestamp, 
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom"; 
import { barberDb, barberAuth } from "../services/firebaseBarber"; 

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

const IconSpinner = ({ color = 'text-white' }) => (
    <div className={`inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white ${color}`}></div>
);


/* =========================================================
    TIPADOS Y HELPERS
========================================================= */

interface Turno {
    id: string;
    hora: string;
    barberId: string;
    barberName: string;
    clientId: string;
    clientName: string;
    servicio: string;
    precio: string;
    fecha: string; 
    estado: "pendiente" | "completado" | "cancelado"; 
    ventaId?: string;
}
interface Empleado {
    id: string;
    nombre: string;
    porcentaje: number; // Vital para el cálculo de liquidación
    internalEmail?: string;
}
interface Venta {
    id: string; 
    monto: number;
    tipo: 'Ingreso' | 'Gasto';
    descripcion: string;
    createdAt: Timestamp;
    barberId?: string; 
    barberName?: string; 
    comisionAplicada?: number | null; // Necesario para la integridad
}
interface Producto {
    nombre: string;
    cantidadActual: number;
    stockBajo: number;
}
interface Servicio {
    id: string;
    nombre: string;
    precio: number;
}
interface Cliente {
    id: string;
    nombre: string;
    telefono?: string;
    visitas?: number;
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

/* =========================================================
    COMPONENTE PRINCIPAL
========================================================= */
export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [userUid, setUserUid] = useState<string | null>(null); 
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

    const ownerUid = localStorage.getItem('barberOwnerId');
    const isEmployeeMode = userUid && ownerUid && userUid !== ownerUid;
    
    // Summary Card States
    const [totalEmpleados, setTotalEmpleados] = useState<number | null>(null);
    const [totalClientes, setTotalClientes] = useState<number | null>(null);
    
    // Estados de Dinero: Dueño (Total Local) vs Empleado (Su Liquidación)
    const [netoMesDueño, setNetoMesDueño] = useState<number | null>(null);
    const [netoMesEmpleado, setNetoMesEmpleado] = useState<number | null>(null);

    const [totalTurnosHoy, setTotalTurnosHoy] = useState<number | null>(null);
    const [lowStockCount, setLowStockCount] = useState<number | null>(null); 

    // List States
    const [empleadosList, setEmpleadosList] = useState<Empleado[]>([]); 
    const [clientesList, setClientesList] = useState<Cliente[]>([]); 
    const [todayTurnos, setTodayTurnos] = useState<Turno[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<Venta[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);

    // Filtro
    const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
    
    const todayDateStr = formatDateToInput(new Date());

    // Modales y confirmación
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false); // ⭐ Nuevo estado de bloqueo
    const [isSaving, setIsSaving] = useState(false); // ⭐ Estado para Venta Rápida
    
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        message: string;
        action: () => Promise<void>; // La acción ahora debe ser asíncrona
        confirmText: string;
        isDanger?: boolean;
    }>({ title: "", message: "", action: async () => {}, confirmText: "", isDanger: false });
    
    const [, setTurnoToAction] = useState<Turno | null>(null); 
    const confirmModalRef = useRef<HTMLDivElement>(null);

    // ESTADOS DEL MODAL DE VENTA RÁPIDA (Replicados de Ventas.tsx)
    const [modalOpen, setModalOpen] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [formMonto, setFormMonto] = useState<string>("");
    const [formDescripcion, setFormDescripcion] = useState("");
    const [formTipo, setFormTipo] = useState<'Ingreso' | 'Gasto'>('Ingreso');
    const [formDate, setFormDate] = useState<string>(formatDateToInput(new Date()));
    const [ventaType, setVentaType] = useState<'servicio' | 'manual'>('servicio'); 
    const [selectedServiceId, setSelectedServiceId] = useState<string>(''); 
    const [formBarberId, setFormBarberId] = useState('');

    // Estados para Cliente en Modal
    const [selectedClienteId, setSelectedClienteId] = useState<string>('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientPhone, setNewClientPhone] = useState("");

    /* =========================================================
        FETCH DATA LOGIC
    ========================================================= */

    const fetchDashboardData = async (activeBarberieUid: string, currentUid: string, currentEmail: string | null) => {
        setLoadingLists(true);
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        try {
            // 1. CARGA DE LISTAS
            const empSnap = await getDocs(collection(barberDb, `barber_users/${activeBarberieUid}/empleados`));
            const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Empleado));
            setTotalEmpleados(empList.length);
            setEmpleadosList(empList);
            
            // Identificar al empleado actual (para saber su %)
            let loggedEmployee: Empleado | undefined;
            if (currentUid && currentUid !== activeBarberieUid) {
                 loggedEmployee = empList.find(e => e.id === currentUid);
                 // Fallback por email si el ID auth no coincide directo
                 if (!loggedEmployee && currentEmail) {
                     const cleanedEmail = currentEmail.trim().toLowerCase();
                     loggedEmployee = empList.find(e => e.internalEmail?.trim().toLowerCase() === cleanedEmail);
                 }
            }

            // Preseleccionar barbero en el modal
            if (loggedEmployee) {
                 setFormBarberId(loggedEmployee.id);
            } else if (empList.length > 0) {
                 setFormBarberId(empList[0].id);
            }

            const cliSnap = await getDocs(collection(barberDb, `barber_users/${activeBarberieUid}/clientes`));
            const cliList = cliSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
            setTotalClientes(cliSnap.size);
            setClientesList(cliList);

            const stockSnap = await getDocs(collection(barberDb, `barber_users/${activeBarberieUid}/stock`));
            let lowStock = 0;
            stockSnap.forEach(doc => {
                const data = doc.data() as Producto;
                if (data.cantidadActual <= data.stockBajo) {
                    lowStock++;
                }
            });
            setLowStockCount(lowStock);
            
            const qServicios = query(collection(barberDb, `barber_users/${activeBarberieUid}/servicios`), orderBy("nombre", "asc"));
            const snapServicios = await getDocs(qServicios);
            const serviciosList: Servicio[] = [];
            snapServicios.forEach((d) => serviciosList.push({ id: d.id, ...d.data() } as Servicio));
            setServicios(serviciosList);


            // 2. CÁLCULO DE DINERO (NETO Y LIQUIDACIÓN)
            const salesFilters = [
                 where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
                 where('createdAt', '<', Timestamp.fromDate(startOfNextMonth)),
                 orderBy('createdAt', 'asc'), 
             ];
            
            const qSales = query(
                collection(barberDb, `barber_users/${activeBarberieUid}/ventas`),
                ...salesFilters
            );
            
            const salesSnap = await getDocs(qSales);
            
            let ownerIngresos = 0;
            let ownerGastos = 0;
            
            let employeeComisionAcumulada = 0;
            let employeeGastosAcumulados = 0;

            salesSnap.forEach(doc => {
                const data = doc.data() as Venta;
                
                // --- Cálculo Global (Para el Dueño: Todo el dinero que entra/sale) ---
                if (data.tipo === 'Ingreso') ownerIngresos += data.monto;
                else if (data.tipo === 'Gasto') ownerGastos += data.monto;

                // --- Cálculo Individual (Para el Empleado: Su % de ganancia) ---
                if (loggedEmployee && data.barberId === loggedEmployee.id) {
                     if (data.tipo === 'Ingreso') {
                         // Sumamos solo SU PARTE (Venta * Porcentaje / 100). Usamos el porcentaje de su perfil (ya que la venta no tiene el campo comisionAplicada)
                         const comision = data.monto * (loggedEmployee.porcentaje / 100);
                         employeeComisionAcumulada += comision;
                     } else if (data.tipo === 'Gasto') {
                         // Restamos sus gastos propios completos
                         employeeGastosAcumulados += data.monto;
                     }
                }
            });

            setNetoMesDueño(ownerIngresos - ownerGastos);
            // El empleado ve: (Sus Comisiones) - (Sus Gastos)
            setNetoMesEmpleado(loggedEmployee ? (employeeComisionAcumulada - employeeGastosAcumulados) : 0);


            // 3. TURNOS PROGRAMADOS (HOY)
            const turnosFilters = [
                 where('fecha', '==', todayDateStr),
                 where('estado', '!=', 'cancelado'),
                 orderBy('estado'), 
                 orderBy('hora')
             ];

            const qTurnos = query(
                collection(barberDb, `barber_users/${activeBarberieUid}/turnos`),
                ...turnosFilters
            );
            
            const turnosSnap = await getDocs(qTurnos);
            const turnosList = turnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turno));
            setTodayTurnos(turnosList);
            
            // Filtrar contador de turnos
            if (loggedEmployee) {
                 const misTurnos = turnosList.filter(t => t.barberId === loggedEmployee?.id);
                 setTotalTurnosHoy(misTurnos.length);
            } else {
                 setTotalTurnosHoy(turnosList.length);
            }


            // 4. ACTIVIDAD RECIENTE
            const qRecent = query(
                collection(barberDb, `barber_users/${activeBarberieUid}/ventas`),
                orderBy('createdAt', 'desc')
            );
            const recentSnap = await getDocs(qRecent);
            let recentList = recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Venta)); 
            
            // Si es empleado, filtrar para que solo vea sus movimientos
            if (loggedEmployee) {
                 recentList = recentList.filter(v => v.barberId === loggedEmployee?.id);
            }
            
            setRecentTransactions(recentList.slice(0, 8));

        } catch (error) {
            console.error("Error al cargar datos del Dashboard:", error);
        }
        setLoadingLists(false);
    };


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(barberAuth, (user) => {
             if (user) {
                 setUserUid(user.uid);
                 setCurrentUserEmail(user.email);
                 
                 const effectiveBarberieUid = localStorage.getItem('barberOwnerId') || user.uid;
                 
                 if (effectiveBarberieUid) {
                     fetchDashboardData(effectiveBarberieUid, user.uid, user.email);
                 } else {
                     setLoadingLists(false);
                 }

             } else {
                 setUserUid(null);
                 setCurrentUserEmail(null);
                 setLoadingLists(false);
             }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userUid, todayDateStr]); 


    /* =========================================================
        LÓGICA DEL POPUP DE VENTA (Reset y Apertura)
    ========================================================= */

    const resetForm = useCallback(() => {
        setCurrentId(null);
        setFormMonto("");
        setFormDescripcion("");
        setFormTipo('Ingreso');
        setFormDate(formatDateToInput(new Date())); 
        
        setVentaType('servicio');
        const defaultServiceId = servicios[0]?.id || '';
        setSelectedServiceId(defaultServiceId);

        // Reset Cliente
        setSelectedClienteId('');
        setIsCreatingClient(false);
        setNewClientName("");
        setNewClientPhone("");

        const defaultService = servicios.find(s => s.id === defaultServiceId);
        if (defaultService) {
             setFormDescripcion(`Venta de Servicio: ${defaultService.nombre}`);
             setFormMonto(defaultService.precio.toString());
        } else {
             setVentaType('manual');
        }
        
        // Si es empleado, forzar su ID. Si es dueño, el primero.
        if (isEmployeeMode && userUid) {
             const me = empleadosList.find(e => e.id === userUid);
             if (me) setFormBarberId(me.id);
        } else if (empleadosList.length > 0) {
             setFormBarberId(empleadosList[0].id);
        } else {
             setFormBarberId('');
        }
        
    }, [servicios, empleadosList, isEmployeeMode, userUid]);

    const openModal = () => {
        resetForm();
        setModalOpen(true);
    };

    const closeModal = useCallback(() => {
        setModalOpen(false);
    }, []);

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

    // Sincronización Servicio -> Formulario
    useEffect(() => {
         if (ventaType === 'servicio' && selectedServiceId) {
             const service = servicios.find(s => s.id === selectedServiceId);
             if (service) {
                 setFormDescripcion(`Venta de Servicio: ${service.nombre}`);
                 setFormMonto(service.precio.toString());
                 setFormTipo('Ingreso');
             }
         } else if (ventaType === 'manual') {
             if (!currentId) {
                 setFormDescripcion('');
                 setFormMonto('');
             }
         }
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ventaType, selectedServiceId, servicios]);


    // GUARDAR VENTA (Idéntico a Ventas.tsx con Fidelidad)
    const handleSave = async () => {
        const effectiveUid = localStorage.getItem('barberOwnerId') || userUid;
        if (!effectiveUid || isSaving) return; // Bloquea si ya está guardando
        
        if (!formMonto || !formDescripcion.trim() || !formDate) return alert("Completa todos los campos.");
        
        if (formTipo === 'Ingreso' && !formBarberId) {
             return alert("Debe seleccionar un Barbero para registrar una Venta.");
        }

        if (isCreatingClient && !newClientName.trim()) {
             return alert("Por favor ingresa el nombre del nuevo cliente.");
        }
        
        const montoNum = Number(formMonto);
        if (isNaN(montoNum) || montoNum <= 0) return alert("El monto debe ser un número positivo.");
        
        setIsSaving(true); // ⭐ BLOQUEA EL BOTÓN
        
        try {
             const selectedBarber = empleadosList.find(e => e.id === formBarberId);
             
             let clienteIdToSave: string | null = null;
             let clienteNameToSave: string | null = null;

             // 1. GESTIÓN DEL CLIENTE
             if (formTipo === 'Ingreso') {
                 if (isCreatingClient) {
                      const newClientData = {
                          nombre: newClientName.trim(),
                          telefono: newClientPhone.trim(),
                          visitas: 0,
                          ultimaVisita: serverTimestamp(),
                          createdAt: serverTimestamp(),
                      };
                      const docRef = await addDoc(collection(barberDb, `barber_users/${effectiveUid}/clientes`), newClientData);
                      clienteIdToSave = docRef.id;
                      clienteNameToSave = newClientName.trim();
                 } else if (selectedClienteId) {
                      const selectedCliente = clientesList.find(c => c.id === selectedClienteId);
                      if (selectedCliente) {
                          clienteIdToSave = selectedCliente.id;
                          clienteNameToSave = selectedCliente.nombre;
                      }
                 }
             }

             // 2. CREAR LA VENTA
             const data = {
                 monto: montoNum, 
                 descripcion: formDescripcion.trim(),
                 tipo: formTipo,
                 date: formDate, 
                 servicioId: ventaType === 'servicio' && selectedServiceId ? selectedServiceId : null,
                 barberId: formTipo === 'Ingreso' ? formBarberId : null,
                 barberName: formTipo === 'Ingreso' && selectedBarber ? selectedBarber.nombre : null,
                 // Fijación de comisión (importante para liquidación)
                 comisionAplicada: formTipo === 'Ingreso' && selectedBarber ? selectedBarber.porcentaje : null,
                 // Guardar datos del cliente
                 clienteId: clienteIdToSave,
                 clienteNombre: clienteNameToSave,
                 updatedAt: serverTimestamp(),
             };

             await addDoc(collection(barberDb, `barber_users/${effectiveUid}/ventas`), {
                  ...data,
                  createdAt: serverTimestamp(),
             });

             // 3. SUMAR FIDELIDAD (+1 Visita)
             if (clienteIdToSave) {
                 const clientRef = doc(barberDb, `barber_users/${effectiveUid}/clientes/${clienteIdToSave}`);
                 await updateDoc(clientRef, { 
                      visitas: increment(1),
                      ultimaVisita: serverTimestamp() 
                 });
             }

             closeModal();
             // Refrescar el Dashboard después de guardar
             fetchDashboardData(effectiveUid!, userUid!, currentUserEmail); 
        } catch (e) {
             console.error(e);
             alert("Error al registrar la transacción.");
        } finally {
             setIsSaving(false); // ⭐ DESBLOQUEA EL BOTÓN
        }
    };


    /* =========================================================
        OTROS HELPERS (Confirmaciones y Acciones Rápidas)
    ========================================================= */

    const executeConfirmAction = async () => {
        if (isConfirmingAction) return;

        setIsConfirmingAction(true); // ⭐ BLOQUEA EL BOTÓN DE CONFIRMACIÓN
        
        try {
            await confirmConfig.action(); // Ejecuta la acción (Finalizar o Cancelar)
            setConfirmOpen(false);
        } catch (e) {
            console.error("Error al ejecutar acción confirmada:", e);
            alert("Ocurrió un error al procesar la acción.");
        } finally {
            setIsConfirmingAction(false); // ⭐ DESBLOQUEA EL BOTÓN DE CONFIRMACIÓN
        }
    };

    const handleClickOutsideConfirm = useCallback((event: MouseEvent) => { 
         const modalElement = confirmModalRef.current; 
         if (confirmOpen && modalElement && !modalElement.contains(event.target as Node)) {
             setConfirmOpen(false);
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
    
    const triggerConfirm = (title: string, message: string, confirmText: string, isDanger: boolean, action: () => Promise<void>) => {
         setConfirmConfig({ title, message, confirmText, isDanger, action });
         setConfirmOpen(true);
    };
    
    const handleQuickFinalize = (turno: Turno) => {
         setTurnoToAction(turno); 
         
         const action = async () => {
             const effectiveUid = localStorage.getItem('barberOwnerId') || userUid;
             if (!effectiveUid || !turno.id) return; 
             
             // Lógica de finalización (similar a handleSave pero con datos del turno)
             const selectedEmployee = empleadosList.find(e => e.id === turno.barberId);
             
             const ventaRef = await addDoc(collection(barberDb, `barber_users/${effectiveUid}/ventas`), {
                 monto: Number(turno.precio), 
                 descripcion: `Venta - Turno: ${turno.servicio} de ${turno.clientName}`,
                 tipo: 'Ingreso',
                 date: todayDateStr, 
                 barberId: turno.barberId, 
                 barberName: turno.barberName, 
                 // Fijación de comisión usando el perfil actual del barbero
                 comisionAplicada: selectedEmployee ? selectedEmployee.porcentaje : 0, 
                 clienteId: turno.clientId || null,
                 clienteNombre: turno.clientName || null,
                 createdAt: serverTimestamp(), 
             });

             await updateDoc(doc(barberDb, `barber_users/${effectiveUid}/turnos/${turno.id}`), { 
                 estado: "completado",
                 ventaId: ventaRef.id, 
             });

             if (turno.clientId) { 
                 const clientRef = doc(barberDb, `barber_users/${effectiveUid}/clientes/${turno.clientId}`);
                 await updateDoc(clientRef, { 
                      visitas: increment(1),
                      ultimaVisita: serverTimestamp() 
                 });
             }
             
             fetchDashboardData(effectiveUid!, userUid!, currentUserEmail); 
         };

         triggerConfirm(
             "Confirmar Asistencia",
             `¿Deseas finalizar el turno de ${turno.clientName} (${turno.servicio})? Esto registrará la venta y sumará puntos de fidelidad.`,
             "Sí, finalizar",
             false, 
             action
         );
    };

    const handleQuickCancel = (turno: Turno) => {
         setTurnoToAction(turno); 
         
         const action = async () => {
             const effectiveUid = localStorage.getItem('barberOwnerId') || userUid;
             if (!effectiveUid || !turno.id) return; 
             
             await updateDoc(doc(barberDb, `barber_users/${effectiveUid}/turnos/${turno.id}`), { 
                 estado: "cancelado",
             });
             
             fetchDashboardData(effectiveUid!, userUid!, currentUserEmail); 
         };

         triggerConfirm(
             "Cancelar Turno",
             `¿Estás seguro de cancelar el turno de ${turno.clientName} (${turno.servicio})?`,
             "Sí, cancelar",
             true, 
             action
         );
    };

    const getFilteredTurnos = useMemo(() => {
         const pendingTurnos = todayTurnos.filter(t => t.estado === 'pendiente');
         
         if (isEmployeeMode) {
             return pendingTurnos.filter(t => t.barberId === userUid).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
         }

         if (selectedBarberId === 'all') {
             return pendingTurnos.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
         }
         return pendingTurnos
             .filter(t => t.barberId === selectedBarberId)
             .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    }, [todayTurnos, selectedBarberId, isEmployeeMode, userUid]);
    
    const timelineAppointments = useMemo(() => {
         return getFilteredTurnos;
    }, [getFilteredTurnos]);

    // --- CONFIGURACIÓN DE TARJETAS (Visible Property) ---
    const displayNeto = isEmployeeMode ? netoMesEmpleado : netoMesDueño;
    const labelNeto = isEmployeeMode ? "MI LIQUIDACIÓN (MES)" : "NETO DEL MES";
    const helperNeto = isEmployeeMode ? "Comisiones estimadas - Gastos" : `Acumulado al ${formatDateToInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))}`;

    const allCards = [
         {
             label: "TURNOS PENDIENTES",
             path: "/barber-manager/turnos", 
             value: totalTurnosHoy === null ? "-" : todayTurnos.filter(t => t.estado === 'pendiente').length, 
             helper: "Pendientes de confirmar hoy",
             icon: "📅",
             colSpan: 3, 
             visible: true 
         },
         {
             label: labelNeto,
             path: "/barber-manager/ventas", 
             value: displayNeto === null ? "-" : formatCurrency(displayNeto),
             helper: helperNeto,
             icon: "💵",
             color: displayNeto !== null ? (displayNeto >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-900',
             colSpan: 3, 
             visible: true 
         },
         {
             isInventory: true, 
             label: "INVENTARIO",
             path: "/barber-manager/stock", 
             value: lowStockCount === null ? "-" : lowStockCount,
             helper: lowStockCount === 0 ? "Todo en orden" : (lowStockCount === null ? "Cargando..." : "Productos requieren reposición"),
             lowStock: lowStockCount,
             colSpan: 2, 
             visible: true 
         },
         {
             label: "CLIENTES REGISTRADOS",
             path: "/barber-manager/clientes", 
             value: totalClientes === null ? "-" : totalClientes, 
             helper: "Registrados en la cartera",
             icon: "👥",
             colSpan: 2, 
             visible: true 
         },
         {
             label: "EMPLEADOS ACTIVOS",
             path: "/barber-manager/empleados", 
             value: totalEmpleados === null ? "-" : totalEmpleados,
             helper: "Barberos en sistema",
             icon: "💈",
             colSpan: 2, 
             visible: !isEmployeeMode // CRÍTICO: SOLO VISIBLE SI NO ES EMPLEADO
         },
     ];

    const finalSummaryCards = allCards.filter(c => c.visible);


    /* =========================================================
        RENDER
    ========================================================= */
    const navigateToSection = (path: string) => {
         navigate(path);
    }
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm";
    const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm";


    return (
        <div className="space-y-6 animate-fadeIn m-2 pb-16">
            
            {/* Welcome banner */}
            <div className="w-full rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-8 py-6 shadow-sm flex justify-between items-center">
                 <div>
                     <h1 className="text-2xl font-semibold text-white mb-1">
                         Bienvenido/a {userUid ? (isEmployeeMode ? 'Barbero' : 'Dueño') : 'Usuario'} - Hair Salon Manager
                     </h1>
                     <p className="text-sm text-slate-200">
                         Gestioná tu barbería/peluquería de manera inteligente y eficiente.
                     </p>
                 </div>
                 <button 
                     onClick={openModal} 
                     className="flex items-center cursor-pointer gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md active:scale-95 whitespace-nowrap"
                 >
                     <IconAdd />
                     Venta Rápida
                 </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                 {finalSummaryCards.map((card, index) => {
                     const colSpanClass = card.colSpan ? `lg:col-span-${card.colSpan}` : 'lg:col-span-1';
                     const cardClasses = `bg-white rounded-2xl shadow-sm border px-5 py-4 flex flex-col justify-between transition-all cursor-pointer hover:shadow-lg ${colSpanClass}`;

                     if (card.isInventory) {
                          return (
                              <div 
                                  key={index}
                                  onClick={() => navigateToSection(card.path)} 
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

                     return (
                         <div
                             key={card.label}
                             onClick={() => navigateToSection(card.path)} 
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
                                 {isEmployeeMode ? 'Mi Actividad Reciente' : 'Actividad reciente (Ventas/Gastos)'}
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

                 {/* Upcoming appointments */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[460px]">
                     <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                         <h3 className="text-sm font-semibold text-slate-900">
                             Acciones Rápidas - Turnos Pendientes
                         </h3>
                         
                         {!isEmployeeMode && (
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
                         )}
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-3">
                         {loadingLists ? (
                              <div className="text-center py-12 text-sm text-slate-500">Cargando turnos...</div>
                         ) : timelineAppointments.length === 0 ? (
                              <div className="text-center py-12 text-sm text-slate-400">No hay turnos pendientes para {selectedBarberId === 'all' && !isEmployeeMode ? 'hoy' : 'este barbero'}.</div>
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

            {/* MODAL DE VENTA RÁPIDA (POTENCIADO, IGUAL A VENTAS.TSX) */}
            {modalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                     <div 
                         ref={modalRef}
                         className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn max-h-[90vh] overflow-y-auto"
                         onClick={(e) => e.stopPropagation()} 
                     >
                         <h3 className="text-lg font-semibold text-slate-900 mb-4">
                             Nueva Venta Rápida
                         </h3>
                         
                         <div className="space-y-4">
                             
                             {/* Tipo de Transacción */}
                             <div>
                                 <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de Monto</label>
                                 <div className="flex space-x-4">
                                     <button 
                                         onClick={() => {
                                             setFormTipo('Ingreso');
                                             if (!isEmployeeMode && empleadosList.length > 0) setFormBarberId(empleadosList[0].id);
                                             setVentaType(servicios.length > 0 ? 'servicio' : 'manual');
                                         }}
                                         disabled={isSaving}
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
                                             if (!isEmployeeMode) setFormBarberId(''); 
                                             setSelectedClienteId(''); 
                                             setIsCreatingClient(false);
                                         }}
                                         disabled={isSaving}
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
                             
                             {/* Selector de Empleado */}
                             {formTipo === 'Ingreso' && empleadosList.length > 0 && (
                                     <div className="border-t border-slate-100 pt-4">
                                         <label className="text-xs font-medium text-slate-600 mb-1 block">Barbero Asignado (Obligatorio)</label>
                                         <select
                                             value={formBarberId}
                                             onChange={(e) => setFormBarberId(e.target.value)}
                                             className={inputClass + ' cursor-pointer ' + (isEmployeeMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : '')} 
                                             disabled={isSaving || !!isEmployeeMode}
                                         >
                                             <option value="">-- Selecciona un Barbero --</option>
                                             {empleadosList.map((e) => (
                                                 <option key={e.id} value={e.id}>
                                                     {e.nombre} {e.id === userUid && '(Yo)'}
                                                 </option>
                                             ))}
                                         </select>
                                         {!formBarberId && <p className="text-xs text-red-500 mt-1">
                                             Debe asignar esta venta a un empleado para el cálculo de comisiones.
                                         </p>}
                                     </div>
                                 )}

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
                                                 {clientesList.length > 0 ? (
                                                     <select
                                                         value={selectedClienteId}
                                                         onChange={(e) => setSelectedClienteId(e.target.value)}
                                                         className={inputClass + ' cursor-pointer border-blue-200 bg-blue-50/30'}
                                                         disabled={isSaving}
                                                     >
                                                         <option value="">-- Cliente Anónimo / Sin Cuenta --</option>
                                                         {clientesList.map((c) => (
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
                                             disabled={servicios.length === 0 || isSaving}
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
                             
                             {/* Fecha de Registro */}
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
                                     className={btnSecondary + ' cursor-pointer'}
                                     disabled={isSaving}
                                 >
                                     Cancelar
                                 </button>
                                 <button 
                                     onClick={handleSave}
                                     className={`${btnPrimary} cursor-pointer flex items-center justify-center gap-2`}
                                     disabled={formTipo === 'Ingreso' && !formBarberId || isSaving}
                                 >
                                     {isSaving ? (
                                         <>
                                             <IconSpinner />
                                             Guardando...
                                         </>
                                     ) : "Registrar Transacción"}
                                 </button>
                             </div>
                         </div>
                     </div>
                 </div>
            )}

            {/* MODAL DE CONFIRMACIÓN CUSTOM */}
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
                                 className={`${btnSecondary} font-medium text-sm`}
                                 disabled={isConfirmingAction}
                             >
                                 Cancelar
                             </button>
                             <button 
                                 onClick={executeConfirmAction} 
                                 className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm active:scale-95 transition flex items-center justify-center gap-2 ${confirmConfig.isDanger ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"}`}
                                 disabled={isConfirmingAction} // ⭐ Bloquea el botón de confirmación
                             >
                                 {isConfirmingAction ? (
                                     <>
                                         <IconSpinner />
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