// src/barber-manager/pages/Clientes.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    doc,
    serverTimestamp, 
    query,
    orderBy,
    Timestamp,
    where, 
    increment,
    writeBatch, // ⭐ Importar writeBatch para la operación de Saldado Total
} from "firebase/firestore";
import { barberDb } from "../services/firebaseBarber";

/* ============================================================
    HELPERS GENERALES
============================================================ */

const formatCurrency = (amount: number) => {
    return `$ ${Math.abs(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
};

const formatPhoneNumber = (phone: string | undefined): string => {
    if (!phone) return 'N/A';
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
};


/* ============================================================
    TIPADOS
============================================================ */
// Definimos los métodos de pago (igual que en Ventas.tsx)
type PaymentMethod = 'Efectivo' | 'Transferencia' | 'QR/Tarjeta';

interface ClienteData {
    id: string;
    nombre: string;
    telefono?: string;
    email?: string;
    notas?: string;
    // ⭐ CAMBIO CLAVE: Usamos 'visitas' como la métrica principal
    visitas: number; 
    deuda: number; // ⭐ NUEVO: Deuda pendiente
    // El campo 'cortes' se elimina o se considera sinónimo de 'visitas' si persiste en la DB
}

interface TransaccionCtaCte {
    id: string;
    monto: number;
    descripcion: string;
    tipo: 'Ingreso' | 'Gasto' | 'Fiado' | 'Saldado'; // Nuevos tipos
    createdAt: Timestamp;
    barberName: string | null;
    metodoPago?: PaymentMethod | 'N/A';
    isSaldado?: boolean;
}

interface Empleado {
    id: string;
    nombre: string;
    porcentaje: number;
}

interface Servicio {
    id: string;
    nombre: string;
    precio: number;
}


/* ============================================================
    ICONOS SVG & HELPERS
============================================================ */
const IconSearch = () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const IconPlus = () => (
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

const IconWhatsApp = () => (
    <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

const IconAccount = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3 .895 3 2s-1.343 2-3 2-3-.895-3-2 1.343-2 3-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18s-4 2-8 2-8-2-8-2v-2c0-2 4-4 8-4s8 2 8 4v2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 13.5V17c0 1.105-.895 2-2 2H4c-1.105 0-2-.895-2-2v-3.5M20 13c1.105 0 2-.895 2-2V7c0-1.105-.895-2-2-2H4c-1.105 0-2 .895-2 2v4c0 1.105.895 2 2 2h16z" />
    </svg>
);

const IconCash = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const IconSpinner = ({ size = 'h-4 w-4', color = 'text-white' }) => (
    <div className={`inline-block animate-spin rounded-full ${size} border-2 ${color}/30 border-t-${color} ${color}`}></div>
);

const IconStar = () => (
    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.691-.921 1.99 0l1.248 3.834a1 1 0 00.95.691h4.043c.969 0 1.371 1.24.588 1.81l-3.27 2.378a1 1 0 00-.364 1.118l1.248 3.834c.3.921-.755 1.688-1.54 1.118l-3.27-2.378a1 1 0 00-1.176 0l-3.27 2.378c-.784.57-1.84-.197-1.54-1.118l1.248-3.834a1 1 0 00-.364-1.118L2.098 9.262c-.783-.57-.381-1.81.588-1.81h4.043a1 1 0 00.95-.691l1.248-3.834z" />
    </svg>
);


/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Clientes: React.FC = () => {
    // CRÍTICO: Usar el UID del Dueño (OwnerUID) para la consulta
    const effectiveBarberieUid = localStorage.getItem('barberOwnerId');


    const [clientes, setClientes] = useState<ClienteData[]>([]);
    const [empleados, setEmpleados] = useState<Empleado[]>([]); 
    const [servicios, setServicios] = useState<Servicio[]>([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modales
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [ctaCteModalOpen, setCtaCteModalOpen] = useState(false);
    const [saldarModalOpen, setSaldarModalOpen] = useState(false); // Saldar Individual
    const [fiadoModalOpen, setFiadoModalOpen] = useState(false); 
    const [deleteCtaCteModalOpen, setDeleteCtaCteModalOpen] = useState(false); 
    const [saldarTodoModalOpen, setSaldarTodoModalOpen] = useState(false); // Saldar TODO

    // ⭐ ESTADOS DE BLOQUEO DE UI
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaldando, setIsSaldando] = useState(false);
    const [isFiando, setIsFiando] = useState(false); 
    const [isDeletingCtaCte, setIsDeletingCtaCte] = useState(false); 
    const [isSaldandoTodo, setIsSaldandoTodo] = useState(false); // ⭐ Bloqueo Saldar Todo
    // ⭐ FIN ESTADOS DE BLOQUEO

    // Estados formularios (Crear/Editar)
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [email, setEmail] = useState("");
    const [notas, setNotas] = useState("");
    // ⭐ Campo de Visitas/Fidelidad
    const [visitas, setVisitas] = useState(0); 

    // Estados para Saldar Deuda (TRANSACCIÓN INDIVIDUAL/TOTAL)
    const [saldarBarberId, setSaldarBarberId] = useState('');
    const [saldarMetodoPago, setSaldarMetodoPago] = useState<PaymentMethod>('Efectivo');
    const [saldarTransaction, setSaldarTransaction] = useState<TransaccionCtaCte | null>(null); // Transacción específica a saldar
    
    // ⭐ Estados para Registrar Fiado
    const [fiadoBarberId, setFiadoBarberId] = useState('');
    const [fiadoServiceId, setFiadoServiceId] = useState('');
    const [fiadoMonto, setFiadoMonto] = useState<string>('');

    const [selectedClient, setSelectedClient] = useState<ClienteData | null>(null);
    const [ctaCteTransacciones, setCtaCteTransacciones] = useState<TransaccionCtaCte[]>([]); 
    const [transactionToDeleteCtaCte, setTransactionToDeleteCtaCte] = useState<TransaccionCtaCte | null>(null); 


    /* ============================================================
        CARGAR DATOS INICIALES
    ============================================================ */
    const loadClientes = useCallback(async () => {
        if (!effectiveBarberieUid) return; 
        
        setLoading(true);
        try {
            // 1. Cargar Clientes
            const qClientes = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/clientes`),
                orderBy("nombre", "asc")
            );
            const snapClientes = await getDocs(qClientes);
            const list: ClienteData[] = [];
            snapClientes.forEach((d) => list.push({ 
                id: d.id, 
                ...d.data(), 
                deuda: d.data().deuda || 0, 
                // ⭐ Usar el campo visitas, con fallback a 0 si no existe (para clientes antiguos)
                visitas: d.data().visitas || d.data().cortes || 0, 
            } as ClienteData));

            setClientes(list);
            localStorage.setItem(`barber_stats_clientes_${effectiveBarberieUid}`, list.length.toString());

            // 2. Cargar Empleados
            const qEmpleados = query(collection(barberDb, `barber_users/${effectiveBarberieUid}/empleados`), orderBy("nombre", "asc"));
            const snapEmpleados = await getDocs(qEmpleados);
            const empleadosList: Empleado[] = snapEmpleados.docs.map(doc => ({ id: doc.id, ...doc.data() } as Empleado));
            setEmpleados(empleadosList);
            
            // 3. Cargar Servicios
            const qServicios = query(collection(barberDb, `barber_users/${effectiveBarberieUid}/servicios`), orderBy("nombre", "asc"));
            const snapServicios = await getDocs(qServicios);
            const serviciosList: Servicio[] = snapServicios.docs.map(doc => ({ id: doc.id, ...doc.data() } as Servicio));
            setServicios(serviciosList);

        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [effectiveBarberieUid]);

    useEffect(() => {
        if (effectiveBarberieUid) loadClientes(); 
    }, [effectiveBarberieUid, loadClientes]);

    /* ============================================================
        GESTIÓN DE CTA. CTE.
    ============================================================ */
    
    // ⭐ Carga transacciones de la Cuenta Corriente
    const loadCtaCteTransacciones = useCallback(async (clientId: string) => {
        if (!effectiveBarberieUid) return [];

        try {
            const qCtaCte = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`),
                where('clienteId', '==', clientId),
                // Solo cargamos Fiado, Saldado (Ingreso) y Gasto
                where('tipo', 'in', ['Fiado', 'Ingreso', 'Gasto']),
                orderBy('createdAt', 'desc')
            );
            
            const snap = await getDocs(qCtaCte);
            const list: TransaccionCtaCte[] = snap.docs
                .map(d => ({ 
                    id: d.id, 
                    ...d.data(), 
                    isSaldado: d.data().isSaldado || false, 
                } as TransaccionCtaCte))
                // Filtramos Ingresos para mostrar solo aquellos que representan pagos de cuenta saldada (para no mezclar con ventas normales si el cliente es fijo)
                .filter(t => t.tipo === 'Fiado' || t.tipo === 'Gasto' || (t.tipo === 'Ingreso' && t.descripcion.startsWith("Cuenta SALDADA TOTAL de")));
                
            return list;

        } catch (e) {
            console.error("Error al cargar Cta. Cte.:", e);
            return [];
        }
    }, [effectiveBarberieUid]);
    
    const openCtaCte = async (client: ClienteData) => {
        setSelectedClient(client);
        setCtaCteModalOpen(true);
        const transacciones = await loadCtaCteTransacciones(client.id);
        setCtaCteTransacciones(transacciones);
    };
    
    // ⭐ Registrar Fiado (Corte/Servicio a Crédito)
    const handleRegistrarFiado = async () => {
        if (!selectedClient || !effectiveBarberieUid || isFiando) return;
        if (!fiadoBarberId || !fiadoMonto || Number(fiadoMonto) <= 0) return alert("Selecciona empleado y monto válido.");

        setIsFiando(true);
        
        try {
            const monto = Number(fiadoMonto);
            const selectedService = servicios.find(s => s.id === fiadoServiceId);
            const selectedBarber = empleados.find(e => e.id === fiadoBarberId);
            const descripcion = selectedService 
                ? `Fiado - ${selectedService.nombre}` 
                : `Fiado - Servicio Manual: ${monto}`;
            
            if (!selectedBarber) throw new Error("Empleado no válido.");

            // 1. Crear la transacción de "Fiado"
            await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`), {
                monto: monto,
                descripcion: descripcion,
                tipo: 'Fiado', // ⭐ Tipo Fiado (para identificar la deuda)
                date: new Date().toISOString().substring(0, 10), 
                barberId: fiadoBarberId, 
                barberName: selectedBarber.nombre,
                servicioId: fiadoServiceId || null,
                comisionAplicada: selectedBarber.porcentaje, 
                clienteId: selectedClient.id,
                clienteNombre: selectedClient.nombre,
                isSaldado: false, // ⭐ Marcar como pendiente
                createdAt: serverTimestamp(),
            });

            // 2. Incrementar la deuda del cliente y la fidelidad (+1 visita)
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                deuda: increment(monto),
                visitas: increment(1), // ⭐ Incrementa el campo VISITAS (Fidelidad)
                updatedAt: serverTimestamp(),
            });

            
            setFiadoModalOpen(false);
            
            // Recargar datos para actualizar la lista y saldos
            await loadClientes();
            // Refrescar modal de CtaCte (si estaba abierto)
            setCtaCteModalOpen(false); // Forzar cierre para actualizar
            
        } catch (e) {
            console.error("Error al registrar fiado:", e);
            alert("Error al registrar el fiado.");
        } finally {
            setIsFiando(false);
            // El resetFormFiado se llama en el padre o manualmente después de cerrar
        }
    };

    // ⭐ Lógica para Saldar la Deuda (Individual)
    const handleSaldarDeuda = async () => {
        if (!selectedClient || !saldarTransaction || !effectiveBarberieUid || isSaldando || saldarTransaction.isSaldado || saldarTransaction.monto <= 0) return;
        if (!saldarBarberId) return alert("Selecciona un empleado responsable del cobro.");

        setIsSaldando(true);
        
        try {
            const montoPagado = saldarTransaction.monto;
            const selectedBarber = empleados.find(e => e.id === saldarBarberId);

            if (!selectedBarber) throw new Error("Empleado no válido.");

            // 1. Crear la transacción de "Saldado" (Ingreso General)
            await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`), {
                monto: montoPagado,
                descripcion: `Pago de Fiado: ${saldarTransaction.descripcion} - Cliente: ${selectedClient.nombre}`,
                tipo: 'Ingreso', // ⭐ Tipo Ingreso (para sumar al neto)
                date: new Date().toISOString().substring(0, 10), 
                barberId: saldarBarberId, 
                barberName: selectedBarber.nombre,
                metodoPago: saldarMetodoPago, 
                comisionAplicada: 0, // NO aplica comisión (ya se registró en Fiado)
                clienteId: selectedClient.id,
                clienteNombre: selectedClient.nombre,
                createdAt: serverTimestamp(),
            });
            
            // 2. Marcar la transacción de Fiado como Saldada
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${saldarTransaction.id}`), {
                isSaldado: true,
            });

            // 3. Restar el monto a la deuda del cliente
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                deuda: increment(-montoPagado),
                updatedAt: serverTimestamp(),
            });

            setSaldarModalOpen(false);
            setSaldarTransaction(null);
            
            // Recargar datos y refrescar CtaCte
            await loadClientes();
            openCtaCte(selectedClient);
            
        } catch (e) {
            console.error("Error al saldar deuda individual:", e);
            alert("Error al registrar el saldado.");
        } finally {
            setIsSaldando(false);
            resetFormSaldar();
        }
    };

    // ⭐ Lógica para Saldar la Deuda TOTAL
    const handleSaldarDeudaTotal = async () => {
        if (!selectedClient || !effectiveBarberieUid || isSaldandoTodo || selectedClient.deuda <= 0) return;
        if (!saldarBarberId) return alert("Selecciona un empleado responsable del cobro.");

        setIsSaldandoTodo(true);
        
        try {
            const deudaTotal = selectedClient.deuda;
            const selectedBarber = empleados.find(e => e.id === saldarBarberId);
            
            if (!selectedBarber) throw new Error("Empleado no válido.");

            // 1. Obtener todas las transacciones de fiado pendientes
            const qFiadosPendientes = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`),
                where('clienteId', '==', selectedClient.id),
                where('tipo', '==', 'Fiado'),
                where('isSaldado', '==', false)
            );
            const snapPendientes = await getDocs(qFiadosPendientes);
            
            if (snapPendientes.empty) {
                throw new Error("No se encontraron fiados pendientes.");
            }

            const batch = writeBatch(barberDb);

            // 2. Marcar todos los fiados pendientes como saldados en el batch
            snapPendientes.docs.forEach(docSnap => {
                const ventaRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${docSnap.id}`);
                batch.update(ventaRef, { isSaldado: true });
            });
            
            // 3. Crear la transacción de "Saldado Total" (Ingreso General)
            const newSaleRef = doc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`));
            batch.set(newSaleRef, {
                monto: deudaTotal,
                descripcion: `Cuenta SALDADA TOTAL de ${selectedClient.nombre}`,
                tipo: 'Ingreso', 
                date: new Date().toISOString().substring(0, 10), 
                barberId: saldarBarberId, 
                barberName: selectedBarber.nombre,
                metodoPago: saldarMetodoPago, 
                comisionAplicada: 0,
                clienteId: selectedClient.id,
                clienteNombre: selectedClient.nombre,
                createdAt: serverTimestamp(),
            });

            // 4. Resetear la deuda del cliente en el batch
            const clientRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`);
            batch.update(clientRef, {
                deuda: 0,
                updatedAt: serverTimestamp(),
            });

            // 5. Ejecutar todas las operaciones
            await batch.commit();

            setSaldarTodoModalOpen(false);
            
            // Recargar datos y refrescar CtaCte
            await loadClientes();
            openCtaCte(selectedClient);
            
        } catch (e) {
            console.error("Error al saldar deuda total:", e);
            alert("Error al registrar el saldado total.");
        } finally {
            setIsSaldandoTodo(false);
            resetFormSaldar();
        }
    };


    // ⭐ Eliminar una transacción de Fiado de la CtaCte
    const handleDeleteCtaCte = async () => {
        if (!selectedClient || !transactionToDeleteCtaCte || !effectiveBarberieUid || isDeletingCtaCte) return;
        
        const montoEliminado = transactionToDeleteCtaCte.monto;
        
        setIsDeletingCtaCte(true);

        try {
            // 1. Eliminar la transacción de la colección 'ventas'
            await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${transactionToDeleteCtaCte.id}`));

            // 2. Restar el monto a la deuda del cliente y restaurar el corte de fidelidad
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                deuda: increment(-montoEliminado),
                visitas: increment(-1), // ⭐ Decrementa el campo VISITAS (Fidelidad)
                updatedAt: serverTimestamp(),
            });

            // 3. Cerrar modales y recargar
            setDeleteCtaCteModalOpen(false);
            setTransactionToDeleteCtaCte(null);
            
            // Recargar clientes y la CtaCte (la CtaCte se actualizará en la apertura del modal)
            await loadClientes(); 
            // Reabrir CtaCte para refrescar la lista de transacciones (lo más simple)
            openCtaCte(selectedClient);

            
        } catch (e) {
            console.error("Error al eliminar transacción de CtaCte:", e);
            alert("Error al eliminar la transacción.");
        } finally {
            setIsDeletingCtaCte(false);
        }
    };

    // ⭐ Lógica para el botón de WhatsApp (Inteligente)
    const getWhatsAppLinkCtaCte = (client: ClienteData) => {
        const cleanNumber = client.telefono ? client.telefono.replace(/\D/g, "") : '';
        const deuda = client.deuda || 0;
        
        // ⭐ CONDICIONAL: Solo si tiene deuda > 0
        if (deuda > 0) {
            const message = `¡Hola ${client.nombre}! Adjunto el resumen de tu cuenta pendiente:\n\nRESUMEN DE CUENTA:\nTe resta pagar ${formatCurrency(deuda)} por los servicios brindados. Por favor, realiza el pago a la brevedad. ¡Gracias!`;
            return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
        }
        
        // Si no tiene deuda, mensaje predeterminado
        return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(`Hola ${client.nombre}, me gustaría coordinar un turno.`)}`;
    };

    // ⭐ Función para actualizar el contador de Visitas directamente desde la UI
    const updateVisitas = async (client: ClienteData, delta: number) => {
        if (!effectiveBarberieUid) return;
        const newVisitas = Math.max(0, client.visitas + delta);
        if (newVisitas === client.visitas) return;

        try {
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${client.id}`), {
                visitas: newVisitas, // ⭐ Actualizar el campo Visitas
                updatedAt: serverTimestamp(),
            });
            loadClientes();
        } catch (e) {
            console.error("Error al actualizar visitas:", e);
            alert("Error al actualizar el contador de fidelidad.");
        }
    };

    /* ============================================================
        CRUD & LÓGICA (existente)
    ============================================================ */
    const handleCreate = async () => {
        if (!nombre.trim()) return alert("El nombre es obligatorio");
        if (!effectiveBarberieUid || isSaving) return;

        setIsSaving(true); // ⭐ Bloquea el botón
        
        try {
            await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/clientes`), {
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                email: email.trim(),
                notas: notas.trim(),
                visitas: 0, // ⭐ Inicializar Visitas
                deuda: 0, // ⭐ Inicializar la deuda
                createdAt: serverTimestamp(),
            });
            setCreateModalOpen(false);
            resetForm();
            loadClientes(); 
        } catch (e) {
            console.error(e);
            alert("Error al crear cliente");
        } finally {
            setIsSaving(false); // ⭐ Desbloquea el botón
        }
    };

    const handleEdit = async () => {
        if (!selectedClient || !effectiveBarberieUid || isSaving) return;
        
        setIsSaving(true); // ⭐ Bloquea el botón
        
        try {
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                email: email.trim(),
                notas: notas.trim(),
                visitas: Number(visitas), // ⭐ Usar el campo visitas
                updatedAt: serverTimestamp(),
            });
            setEditModalOpen(false);
            resetForm();
            loadClientes();
        } catch (e) {
            console.error(e);
            alert("Error al editar");
        } finally {
            setIsSaving(false); // ⭐ Desbloquea el botón
        }
    };

    const handleDelete = async () => {
        if (!selectedClient || !effectiveBarberieUid || isDeleting) return;
        
        setIsDeleting(true); // ⭐ Bloquea el botón
        
        try {
            await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`));
            setDeleteModalOpen(false);
            setSelectedClient(null);
            loadClientes(); 
        } catch (e) {
            console.error(e);
            alert("Error al eliminar");
        } finally {
            setIsDeleting(false); // ⭐ Desbloquea el botón
        }
    };


    /* ============================================================
        HELPERS UI
    ============================================================ */
    const resetForm = () => {
        setNombre("");
        setTelefono("");
        setEmail("");
        setNotas("");
        setVisitas(0); // ⭐ Resetear Visitas
        setSelectedClient(null);
        resetFormSaldar();
        resetFormFiado();
        setCtaCteTransacciones([]);
        setTransactionToDeleteCtaCte(null); // Resetear también
        setSaldarTransaction(null); // Resetear transacción a saldar
    };
    
    const resetFormSaldar = () => {
        setSaldarBarberId(empleados[0]?.id || '');
        setSaldarMetodoPago('Efectivo');
    };
    
    const resetFormFiado = () => {
        const defaultServiceId = servicios[0]?.id || '';
        const defaultServicePrice = servicios.find(s => s.id === defaultServiceId)?.precio.toString() || '';
        
        setFiadoBarberId(empleados[0]?.id || '');
        setFiadoServiceId(defaultServiceId);
        setFiadoMonto(defaultServicePrice);
    };


    const openEdit = (client: ClienteData) => {
        setSelectedClient(client);
        setNombre(client.nombre);
        setTelefono(client.telefono || "");
        setEmail(client.email || "");
        setNotas(client.notas || "");
        setVisitas(client.visitas || 0); // ⭐ Cargar visitas
        setEditModalOpen(true);
    };

    const openDelete = (client: ClienteData) => {
        setSelectedClient(client);
        setDeleteModalOpen(true);
    };

    // ⭐ Función para abrir el modal de saldar una transacción específica
    const openSaldarTransaction = (client: ClienteData, transaction: TransaccionCtaCte) => {
        setSelectedClient(client);
        setSaldarTransaction(transaction); // Establecer la transacción a saldar
        resetFormSaldar();
        setSaldarModalOpen(true);
    };
    
    // ⭐ Función para abrir el modal de saldar TODA la deuda
    const openSaldarTodo = (client: ClienteData) => {
        setSelectedClient(client);
        setSaldarTransaction(null); // Asegurarse de que no haya transacción individual
        resetFormSaldar();
        setSaldarTodoModalOpen(true);
    };

    const openFiado = (client: ClienteData) => {
        setSelectedClient(client);
        resetFormFiado();
        setFiadoModalOpen(true);
    };

    const handleFiadoServiceChange = (serviceId: string) => {
        setFiadoServiceId(serviceId);
        const service = servicios.find(s => s.id === serviceId);
        if (service) {
            setFiadoMonto(service.precio.toString());
        } else {
            setFiadoMonto('');
        }
    };


    /* ============================================================
        FILTRADO
    ============================================================ */
    const filteredClients = clientes.filter(c => 
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.telefono && c.telefono.includes(searchTerm))
    );

    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed";
    const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="space-y-6 animate-fadeIn m-2">
            
            {/* HEADER + BUSCADOR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Cartera de Clientes</h2>
                    <p className="text-sm text-slate-500">
                        {clientes.length} clientes registrados. El contador de **visitas** es la fidelidad.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group flex-1 md:flex-none">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <IconSearch />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 outline-none w-full md:w-64 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={() => { resetForm(); setCreateModalOpen(true); }}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                        <IconPlus />
                        <span className="hidden sm:inline">Nuevo</span>
                    </button>
                </div>
            </div>

            {/* LISTA DE CLIENTES */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                    <p className="mt-2 text-sm text-slate-500">Cargando cartera...</p>
                </div>
            ) : filteredClients.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                    <p className="text-slate-400 mb-2">No se encontraron clientes</p>
                    <button onClick={() => setCreateModalOpen(true)} className="text-sm text-slate-900 font-medium hover:underline">
                        Crear el primero ahora
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClients.map((client) => {
                        const visitasActuales = client.visitas || 0; // ⭐ Usar visitas
                        const deudaActual = client.deuda || 0; // ⭐ Usar el nuevo campo deuda
                        const esGratis = visitasActuales >= 10;
                        const porcentaje = Math.min((visitasActuales / 10) * 100, 100);

                        return (
                            <div key={client.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden ${esGratis ? 'border-yellow-400/50 ring-1 ring-yellow-400/30' : (deudaActual > 0 ? 'border-red-400/50 ring-1 ring-red-400/30' : 'border-slate-200')}`}>
                                
                                {/* Indicador de GRATIS background */}
                                {esGratis && (
                                     <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                                         ¡CORTE GRATIS!
                                     </div>
                                )}
                                
                                {/* Indicador de DEUDA */}
                                {deudaActual > 0 && (
                                     <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                                         DEUDA: {formatCurrency(deudaActual)}
                                     </div>
                                )}

                                <div className="flex justify-between items-start mb-3">
                                    <div className="max-w-[80%]">
                                        <h3 className="font-semibold text-slate-900 truncate">{client.nombre}</h3>
                                        
                                        {/* TELÉFONO + WHATSAPP LINK */}
                                        {client.telefono ? (
                                             <a 
                                                 // ⭐ Modificado para enviar resumen de cuenta si hay deuda
                                                 href={getWhatsAppLinkCtaCte(client)} 
                                                 target="_blank" 
                                                 rel="noreferrer"
                                                 className={`text-sm ${deudaActual > 0 ? 'text-red-500 hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'} flex items-center mt-1 font-medium transition-colors w-fit`}
                                             >
                                                 <IconWhatsApp />
                                                 WhatsApp 
                                                 {deudaActual > 0 && <span className="font-bold ml-1">(Cobrar)</span>}
                                                 <span className="text-slate-400 font-normal ml-1 hidden sm:inline">- {client.telefono}</span>
                                             </a>
                                         ) : (
                                             <p className="text-xs text-slate-400 italic mt-1">Sin teléfono</p>
                                         )}
                                    </div>
                                    
                                    <div className="flex gap-1">
                                        <button onClick={() => openEdit(client)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition">
                                            <IconEdit />
                                        </button>
                                        <button onClick={() => openDelete(client)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition">
                                            <IconTrash />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* ⭐ SECCIÓN CUENTA CORRIENTE Y BOTONES DE ACCIÓN */}
                                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-100">
                                    <div className="flex justify-between items-center">
                                        <button 
                                            onClick={() => openCtaCte(client)}
                                            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            <IconAccount /> Ver Cta. Cte.
                                        </button>
                                        
                                        <button 
                                            onClick={() => openFiado(client)}
                                            className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-200 transition shadow-sm active:scale-95 flex items-center gap-1"
                                        >
                                            <IconCash /> Fiado (+)
                                        </button>
                                    </div>
                                    
                                    {deudaActual > 0 && (
                                         <div className="w-full text-center text-xs text-red-500 font-medium pt-1">
                                             Pendiente: {formatCurrency(deudaActual)}
                                         </div>
                                    )}
                                </div>
                                {/* ⭐ FIN SECCIÓN */}


                                {/* SECCIÓN FIDELIDAD */}
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                            <IconStar /> Fidelidad (Visitas)
                                        </span>
                                        <span className={`text-xs font-bold ${esGratis ? 'text-yellow-600' : 'text-slate-700'}`}>
                                            {visitasActuales} / 10
                                        </span>
                                    </div>
                                    
                                    {/* Barra de progreso */}
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                                        <div 
                                            className={`h-full transition-all duration-500 ease-out rounded-full ${esGratis ? 'bg-yellow-400' : 'bg-slate-800'}`}
                                            style={{ width: `${porcentaje}%` }}
                                        />
                                    </div>

                                    {/* Botones contador */}
                                    <div className="flex items-center justify-between gap-3">
                                        <button 
                                            onClick={() => updateVisitas(client, -1)}
                                            className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium transition"
                                        >
                                            -1
                                        </button>

                                        {esGratis ? (
                                             <button 
                                                 onClick={() => updateVisitas(client, -10)} // Resetear
                                                 className="flex-[2] py-1.5 rounded-lg bg-yellow-400 text-yellow-900 hover:bg-yellow-500 text-xs font-bold transition shadow-sm animate-pulse"
                                             >
                                                 CANJEAR
                                             </button>
                                         ) : (
                                             <div className="flex-[2] text-center text-[10px] text-slate-400 font-medium">
                                                 {10 - visitasActuales} para gratis
                                             </div>
                                         )}

                                        <button 
                                            onClick={() => updateVisitas(client, 1)}
                                            className="flex-1 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition shadow-sm"
                                        >
                                            +1
                                        </button>
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}

            {/* =========================================
                MODAL REGISTRAR FIADO ⭐ EN CTACTE MODAL
            ========================================= */}
            {fiadoModalOpen && selectedClient && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            Registrar Servicio a Fiado
                        </h3>
                        
                        <p className="text-sm text-slate-500 mb-4">
                            **{selectedClient.nombre}** tomará un servicio a crédito. Esto **sumará a su deuda** y a su contador de fidelidad (**+1 visita**).
                        </p>

                        <div className="space-y-4">
                            {/* Seleccionar Servicio */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Servicio a Fiado</label>
                                <select
                                    value={fiadoServiceId}
                                    onChange={(e) => handleFiadoServiceChange(e.target.value)}
                                    className={inputClass + ' cursor-pointer'}
                                    disabled={isFiando}
                                >
                                    <option value="">-- Selecciona un Servicio (opcional) --</option>
                                    {servicios.map((s) => (
                                         <option key={s.id} value={s.id}>{s.nombre} ({formatCurrency(s.precio)})</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Monto del Fiado */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Monto total de la deuda</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">$</span>
                                    <input 
                                        type="number" 
                                        value={fiadoMonto} 
                                        onChange={(e) => setFiadoMonto(e.target.value)} 
                                        className={`${inputClass} pl-6 font-medium text-red-700`}
                                        placeholder="0.00" 
                                        min="1"
                                        disabled={isFiando}
                                    />
                                </div>
                            </div>
                            
                            {/* Empleado que presta el servicio */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Barbero que realiza el Servicio</label>
                                <select
                                    value={fiadoBarberId}
                                    onChange={(e) => setFiadoBarberId(e.target.value)}
                                    className={inputClass + ' cursor-pointer'}
                                    disabled={isFiando}
                                >
                                    <option value="">-- Selecciona un Barbero --</option>
                                    {empleados.map((e) => (
                                         <option key={e.id} value={e.id}>{e.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => { setFiadoModalOpen(false); resetFormFiado(); }}
                                    className={btnSecondary}
                                    disabled={isFiando}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleRegistrarFiado}
                                    className={`${btnPrimary} flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700`}
                                    disabled={isFiando || !fiadoBarberId || Number(fiadoMonto) <= 0}
                                >
                                    {isFiando ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" />
                                             Registrando...
                                         </>
                                     ) : `Confirmar Fiado por ${formatCurrency(Number(fiadoMonto || 0))}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL SALDAR DEUDA (INDIVIDUAL) ⭐ MODIFICADO
            ========================================= */}
            {saldarModalOpen && selectedClient && saldarTransaction && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            Confirmar Pago de Fiado
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                                <p className="text-sm text-emerald-700 font-medium">Fiado a saldar:</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{saldarTransaction.descripcion}</p>
                                <p className="text-3xl font-bold text-emerald-800">{formatCurrency(saldarTransaction.monto)}</p>
                                <p className="text-xs text-emerald-500 mt-1">
                                    Esto registrará un ingreso y **restará {formatCurrency(saldarTransaction.monto)} a la deuda pendiente** del cliente.
                                </p>
                            </div>

                            {/* Empleado que cobra */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Empleado que Recibe el Pago (Obligatorio)</label>
                                <select
                                    value={saldarBarberId}
                                    onChange={(e) => setSaldarBarberId(e.target.value)}
                                    className={inputClass + ' cursor-pointer'}
                                    disabled={isSaldando}
                                >
                                    <option value="">-- Selecciona --</option>
                                    {empleados.map((e) => (
                                         <option key={e.id} value={e.id}>{e.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Método de Pago */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Método de Pago</label>
                                <select
                                    value={saldarMetodoPago}
                                    onChange={(e) => setSaldarMetodoPago(e.target.value as PaymentMethod)}
                                    className={inputClass + ' cursor-pointer'}
                                    disabled={isSaldando}
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="QR/Tarjeta">QR / Tarjeta</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => { setSaldarModalOpen(false); openCtaCte(selectedClient); }}
                                    className={btnSecondary}
                                    disabled={isSaldando}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaldarDeuda}
                                    className={`${btnPrimary} flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700`}
                                    disabled={isSaldando || !saldarBarberId || saldarTransaction.monto <= 0}
                                >
                                    {isSaldando ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" />
                                             Saldando...
                                         </>
                                     ) : `Confirmar Pago de ${formatCurrency(saldarTransaction.monto)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* =========================================
                MODAL SALDAR DEUDA TOTAL CONFIRMATION ⭐ NUEVO
            ========================================= */}
            {saldarTodoModalOpen && selectedClient && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            Saldar **TODA** la Cuenta
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                                <p className="text-sm text-emerald-700 font-medium">Monto Total a ingresar:</p>
                                <p className="text-3xl font-bold text-emerald-800 mt-1">{formatCurrency(selectedClient.deuda)}</p>
                                <p className="text-xs text-emerald-500 mt-1">
                                    Esta acción registrará un único ingreso por el total y marcará **TODOS** los fiados pendientes como pagados, reseteando la deuda.
                                </p>
                            </div>

                            {/* Empleado que cobra */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Empleado que Recibe el Pago (Obligatorio)</label>
                                <select
                                    value={saldarBarberId}
                                    onChange={(e) => setSaldarBarberId(e.target.value)}
                                    className={inputClass + ' cursor-pointer'}
                                    disabled={isSaldandoTodo}
                                >
                                    <option value="">-- Selecciona --</option>
                                    {empleados.map((e) => (
                                         <option key={e.id} value={e.id}>{e.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Método de Pago */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Método de Pago</label>
                                <select
                                    value={saldarMetodoPago}
                                    onChange={(e) => setSaldarMetodoPago(e.target.value as PaymentMethod)}
                                    className={inputClass + ' cursor-pointer'}
                                    disabled={isSaldandoTodo}
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="QR/Tarjeta">QR / Tarjeta</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => { setSaldarTodoModalOpen(false); openCtaCte(selectedClient); }}
                                    className={btnSecondary}
                                    disabled={isSaldandoTodo}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaldarDeudaTotal}
                                    className={`${btnPrimary} flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700`}
                                    disabled={isSaldandoTodo || !saldarBarberId || selectedClient.deuda <= 0}
                                >
                                    {isSaldandoTodo ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" />
                                             Saldando Todo...
                                         </>
                                     ) : `Confirmar Pago Total de ${formatCurrency(selectedClient.deuda)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* =========================================
                MODAL CUENTA CORRIENTE (CtaCte) ⭐ CENTRALIZADO
            ========================================= */}
            {ctaCteModalOpen && selectedClient && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            Cuenta Corriente
                        </h3>
                        <p className="text-sm text-slate-500 border-b border-slate-100 pb-3">
                            Resumen de transacciones a cuenta de: **{selectedClient.nombre}**
                        </p>
                        
                        <div className={`mt-4 p-4 rounded-lg flex justify-between items-center ${selectedClient.deuda > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'} border`}>
                            <span className="text-lg font-bold text-slate-800">Saldo Pendiente:</span>
                            <span className={`text-xl font-extrabold ${selectedClient.deuda > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formatCurrency(selectedClient.deuda)}
                            </span>
                        </div>
                        
                        {/* ⭐ BOTONES DE ACCIÓN SUPERIOR DENTRO DEL MODAL */}
                        <div className="flex gap-3 justify-end pt-4">
                            <button 
                                onClick={() => openFiado(selectedClient)}
                                className="px-3 py-2 text-sm font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition shadow-sm active:scale-95 flex items-center gap-1"
                            >
                                <IconPlus /> Registrar Fiado
                            </button>
                            
                            {selectedClient.deuda > 0 && (
                                <button 
                                    onClick={() => openSaldarTodo(selectedClient)}
                                    className="px-3 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm active:scale-95 flex items-center gap-1"
                                >
                                    <IconCash /> Saldar Deuda TOTAL
                                </button>
                            )}
                        </div>
                        {/* ⭐ FIN BOTONES SUPERIORES */}


                        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            <h4 className="text-xs font-medium text-slate-600 uppercase">Historial de Transacciones (Fiado/Saldado)</h4>
                            {ctaCteTransacciones.length > 0 ? ctaCteTransacciones.map((t, index) => {
                                const isFiado = t.tipo === 'Fiado';
                                const isPayment = t.tipo === 'Ingreso' && t.descripcion.startsWith("Cuenta SALDADA TOTAL de");
                                const color = isFiado ? 'text-red-500' : (isPayment ? 'text-emerald-500' : 'text-slate-500');
                                const sign = isFiado ? "+" : "-";
                                
                                // Determinar si el fiado está pendiente de pago
                                const isFiadoPendiente = isFiado && !t.isSaldado;

                                return (
                                    <div key={t.id || index} className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-900">
                                                {t.descripcion}
                                                {isFiado && t.isSaldado && <span className="ml-2 px-1 text-[10px] bg-emerald-100 text-emerald-700 rounded-md font-bold">PAGADO</span>}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {t.barberName} | {t.createdAt.toDate().toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className={`text-right ${color} flex items-center gap-2`}>
                                            <div>
                                                <p className="text-sm font-bold">
                                                    {sign} {formatCurrency(t.monto)}
                                                </p>
                                                <p className="text-[10px] uppercase">
                                                    {isFiado ? 'Deuda' : (isPayment ? `Pago (${t.metodoPago || 'N/A'})` : t.tipo)}
                                                </p>
                                            </div>
                                            
                                            {/* ⭐ Botón SALDAR INDIVIDUAL */}
                                            {isFiadoPendiente && (
                                                <button
                                                    onClick={() => openSaldarTransaction(selectedClient, t)}
                                                    className="px-2 py-1 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-sm active:scale-95 whitespace-nowrap"
                                                >
                                                    Saldar
                                                </button>
                                            )}

                                            {/* ⭐ Botón de Eliminación solo para Fiado PENDIENTE */}
                                            {isFiadoPendiente && (
                                                <button
                                                    onClick={() => { setTransactionToDeleteCtaCte(t); setDeleteCtaCteModalOpen(true); }}
                                                    className="p-1 text-slate-300 hover:text-red-600 transition rounded-md"
                                                    title="Eliminar registro de fiado"
                                                >
                                                    <IconTrash />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }) : (
                                <p className="text-sm text-slate-400 italic">No hay registros en la Cuenta Corriente.</p>
                            )}
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                            <button 
                                onClick={() => { setCtaCteModalOpen(false); setSelectedClient(null); resetForm(); }}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL CONFIRMAR ELIMINACIÓN CTA CTE ⭐ NUEVO
            ========================================= */}
            {deleteCtaCteModalOpen && transactionToDeleteCtaCte && selectedClient && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fadeIn text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <IconTrash />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Eliminar Fiado</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-4">
                            ¿Estás seguro de eliminar este registro de **FIADO**?
                            Esto **reducirá la deuda** del cliente y restará **1 visita** de fidelidad.
                        </p>
                        
                        <div className="p-3 border border-red-100 rounded-lg text-sm bg-red-50">
                            <p className="font-semibold text-slate-900">{transactionToDeleteCtaCte.descripcion}</p>
                            <p className="text-xs text-red-600 font-bold">Monto: {formatCurrency(transactionToDeleteCtaCte.monto)}</p>
                            <p className="text-xs text-red-600 mt-1">Se restarán $ {formatCurrency(transactionToDeleteCtaCte.monto)} a la deuda de {selectedClient.nombre}.</p>
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                            <button 
                                onClick={() => { setDeleteCtaCteModalOpen(false); setTransactionToDeleteCtaCte(null); }}
                                className={btnSecondary}
                                disabled={isDeletingCtaCte}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDeleteCtaCte}
                                className={`w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm flex items-center justify-center gap-2`}
                                disabled={isDeletingCtaCte}
                            >
                                {isDeletingCtaCte ? (
                                     <>
                                         <IconSpinner size="h-4 w-4" />
                                         Eliminando...
                                     </>
                                 ) : "Sí, Eliminar Fiado"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* =========================================
                MODAL CREAR / EDITAR (existente)
            ========================================= */}
            {(createModalOpen || editModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            {createModalOpen ? "Nuevo Cliente" : "Editar Cliente"}
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre completo</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={nombre} 
                                    onChange={(e) => setNombre(e.target.value)} 
                                    className={inputClass}
                                    placeholder="Ej. Juan Pérez" 
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Teléfono</label>
                                    <input 
                                        type="tel" 
                                        value={telefono} 
                                        onChange={(e) => setTelefono(e.target.value)} 
                                        className={inputClass}
                                        placeholder="Ej. 11 1234 5678" 
                                        disabled={isSaving}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Email (Opcional)</label>
                                    <input 
                                        type="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        className={inputClass}
                                        placeholder="juan@email.com" 
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>

                            {!createModalOpen && (
                                                <div>
                                                     <label className="text-xs font-medium text-slate-600 mb-1 block">Ajuste manual de Visitas (Fidelidad)</label>
                                                     <input 
                                                          type="number" 
                                                          value={visitas} // ⭐ Usar 'visitas'
                                                          onChange={(e) => setVisitas(Number(e.target.value))} // ⭐ Usar 'visitas'
                                                          className={inputClass}
                                                          disabled={isSaving}
                                                          min="0"
                                                     />
                                                </div>
                            )}

                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Notas internas</label>
                                <textarea 
                                    rows={3}
                                    value={notas} 
                                    onChange={(e) => setNotas(e.target.value)} 
                                    className={inputClass}
                                    placeholder="Preferencias del cliente..." 
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => { setCreateModalOpen(false); setEditModalOpen(false); }}
                                    className={btnSecondary}
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={createModalOpen ? handleCreate : handleEdit}
                                    className={`${btnPrimary} flex items-center justify-center gap-2`}
                                    disabled={isSaving} // ⭐ Bloquea el botón al guardar
                                >
                                    {isSaving ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" />
                                             Guardando...
                                         </>
                                     ) : (createModalOpen ? "Guardar Cliente" : "Guardar Cambios")}
                                </button>
                            </div>
                        </div>
                        </div>
                </div>
            )}

            {/* =========================================
                MODAL ELIMINAR (existente)
            ========================================= */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fadeIn text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <IconTrash />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">¿Eliminar cliente?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">
                            Estás a punto de eliminar a <span className="font-semibold text-slate-700">{selectedClient?.nombre}</span>. Esta acción no se puede deshacer.
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteModalOpen(false)}
                                className={btnSecondary}
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDelete}
                                className={`w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm flex items-center justify-center gap-2 ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isDeleting} // ⭐ Bloquea el botón al eliminar
                            >
                                {isDeleting ? (
                                     <>
                                         <IconSpinner size="h-4 w-4" />
                                         Eliminando...
                                     </>
                                 ) : "Sí, eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};