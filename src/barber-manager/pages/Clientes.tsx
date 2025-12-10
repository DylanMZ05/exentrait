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
    writeBatch,
    getDoc
} from "firebase/firestore";
// CORRECCIÓN 1: Importación de 'User' como type.
import { onAuthStateChanged, type User, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { barberDb, barberAuth } from "../services/firebaseBarber";

/* ============================================================
    HELPERS GENERALES
============================================================ */

const formatCurrency = (amount: number) => {
    return `$ ${Math.abs(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
};


/* ============================================================
    TIPADOS
============================================================ */
// Interfaz basada en usuariosAuth (Suscripción) - REPLICADO DE Ventas.tsx
interface UsuarioAuth {
    id: string;
    fechaVencimiento: Timestamp;
    email: string;
    activo?: boolean;
}

type PaymentMethod = 'Efectivo' | 'Transferencia' | 'QR/Tarjeta';

interface ClienteData {
    id: string;
    nombre: string;
    telefono?: string;
    email?: string;
    notas?: string;
    visitas: number;
    deuda: number; // Deuda GLOBAL (la suma de todos)
}

interface TransaccionCtaCte {
    id: string;
    monto: number;
    descripcion: string;
    tipo: 'Ingreso' | 'Gasto' | 'Fiado' | 'Saldado';
    createdAt: Timestamp;
    barberName: string | null;
    barberId?: string;
    barberID?: string; // ⭐ CAMPO CLAVE DE LA FOTO (Firebase)
    metodoPago?: PaymentMethod | 'N/A';
    isSaldado?: boolean;
    comisionAplicada?: number;
    clienteId?: string;
}

interface Empleado {
    id: string;
    nombre: string;
    porcentaje: number;
    internalEmail?: string;
    authUid?: string; // ⭐ Coincide con el UID de Auth
    role?: string;
}

interface Servicio {
    id: string;
    nombre: string;
    precio: number;
}

// ⭐ TIPO NUEVO PARA EL MAPA DE DEUDAS
type DebtMap = Record<string, Record<string, number>>; // { clienteId: { barberId: monto } }


/* ============================================================
    ICONOS SVG
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
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
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
    <svg className={`animate-spin ${size} ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const IconStar = () => (
    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.691-.921 1.99 0l1.248 3.834a1 1 0 00.95.691h4.043c.969 0 1.371 1.24.588 1.81l-3.27 2.378a1 1 0 00-.364 1.118l1.248 3.834c.3.921-.755 1.688-1.54 1.118l-3.27-2.378a1 1 0 00-1.176 0l-3.27 2.378c-.784.57-1.84-.197-1.54-1.118l1.248-3.834a1 1 0 00-.364-1.118L2.098 9.262c-.783-.57-.381-1.81.588-1.81h4.043a1 1 0 00.95-.691l1.248-3.834z" />
    </svg>
);

const IconCheck = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const IconFilter = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
);

// ⭐ Icono para Importar Contacto
const IconPhone = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
);


/* =========================================================
    AUTENTICACIÓN Y VERIFICACIÓN DE SUSCRIPCIÓN (REPLICADO DE Ventas.tsx)
========================================================= */

const forceLogout = async (navigate: (path: string) => void) => {
    try {
        await signOut(barberAuth);
    } catch (error) {
        console.error("Error al cerrar sesión de Firebase:", error);
    }
    localStorage.removeItem('barberOwnerId');
    navigate("/auth");
};

const checkSubscriptionStatus = async (barberieUid: string, navigate: (path: string) => void, db: typeof barberDb): Promise<boolean> => {
    try {
        const ownerRef = doc(db, `usuariosAuth/${barberieUid}`);
        const ownerSnap = await getDoc(ownerRef);

        if (!ownerSnap.exists()) {
            console.error("Documento de suscripción (usuariosAuth) no encontrado.");
            await forceLogout(navigate);
            return false;
        }

        const ownerData = ownerSnap.data() as UsuarioAuth;
        
        if (ownerData.activo === false) {
             console.warn("Usuario marcado como inactivo en DB.");
             await forceLogout(navigate);
             return false;
        }

        if (!ownerData.fechaVencimiento) {
             console.error("Fecha de vencimiento no encontrada en el documento.");
             await forceLogout(navigate);
             return false;
        }

        const expirationDate = ownerData.fechaVencimiento.toDate();
        
        const deadlineDate = new Date(expirationDate);
        deadlineDate.setDate(deadlineDate.getDate() + 1);
        deadlineDate.setHours(0, 0, 0, 0);

        const currentTime = new Date().getTime();

        if (currentTime >= deadlineDate.getTime()) {
            console.warn("Suscripción expirada por fecha.");
            await forceLogout(navigate);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error al verificar la suscripción:", error);
        await forceLogout(navigate);
        return false;
    }
};


/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Clientes: React.FC = () => {
    const navigate = useNavigate();
    // CORRECCIÓN 2: Se elimina la declaración redundante `const auth = getAuth();`
    
    // ⭐ DETECCIÓN DE ROL (REPLICADO DE Ventas.tsx)
    const user = barberAuth.currentUser;
    const uid = user?.uid;

    const ownerUid = localStorage.getItem('barberOwnerId');
    // Si el usuario logueado (uid) es diferente del owner guardado en local (ownerUid) -> Modo Empleado
    const isEmployeeMode = uid && ownerUid && uid !== ownerUid;
    // El UID efectivo para las consultas a Firestore es SIEMPRE el del Dueño
    const effectiveBarberieUid = ownerUid || uid;

    // ESTADOS DE AUTENTICACIÓN
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [isSubscriptionChecked, setIsSubscriptionChecked] = useState(false);
    const [isOwner, setIsOwner] = useState(false);


    const [clientes, setClientes] = useState<ClienteData[]>([]);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // ⭐ NUEVO: Mapa de deudas detalladas (ClienteID -> { BarberID -> Monto })
    const [deudaPorBarbero, setDeudaPorBarbero] = useState<DebtMap>({});

    // Modales
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [ctaCteModalOpen, setCtaCteModalOpen] = useState(false);
    const [saldarModalOpen, setSaldarModalOpen] = useState(false);
    const [fiadoModalOpen, setFiadoModalOpen] = useState(false);
    // CORRECCIÓN 3: La variable se utiliza
    const [deleteCtaCteModalOpen, setDeleteCtaCteModalOpen] = useState(false);
    const [saldarTodoModalOpen, setSaldarTodoModalOpen] = useState(false);

    // Estados de Bloqueo
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaldando, setIsSaldando] = useState(false);
    const [isFiando, setIsFiando] = useState(false);
    const [isDeletingCtaCte, setIsDeletingCtaCte] = useState(false);
    const [isSaldandoTodo, setIsSaldandoTodo] = useState(false);

    // Estados formularios
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [email, setEmail] = useState("");
    const [notas, setNotas] = useState("");
    const [visitas, setVisitas] = useState(0);

    // Estados para Saldar
    const [saldarBarberId, setSaldarBarberId] = useState('');
    const [saldarMetodoPago, setSaldarMetodoPago] = useState<PaymentMethod>('Efectivo');
    const [saldarTransaction, setSaldarTransaction] = useState<TransaccionCtaCte | null>(null);
    
    // Estados para Fiado
    const [fiadoBarberId, setFiadoBarberId] = useState('');
    const [fiadoServiceId, setFiadoServiceId] = useState('');
    const [fiadoMonto, setFiadoMonto] = useState<string>('');

    // Estados para Edición Manual de Saldo (Solo Dueño)
    const [isEditingBalance, setIsEditingBalance] = useState(false);
    const [manualBalanceValue, setManualBalanceValue] = useState<string>('');

    const [selectedClient, setSelectedClient] = useState<ClienteData | null>(null);
    const [ctaCteTransacciones, setCtaCteTransacciones] = useState<TransaccionCtaCte[]>([]);
    const [transactionToDeleteCtaCte, setTransactionToDeleteCtaCte] = useState<TransaccionCtaCte | null>(null);

    // ⭐ Estado para filtrar por empleado en el modal (Select)
    const [filterEmployeeId, setFilterEmployeeId] = useState<string>('todos');

    // ⭐ IDENTIFICAR EMPLEADO LOGUEADO (REPLICADO DE Ventas.tsx)
    const loggedInEmployee = useMemo(() => {
        if (!currentUser) return undefined;
        const authIdentifier = currentUser.email;
        const cleanedAuthId = authIdentifier ? authIdentifier.trim().toLowerCase() : '';

        // 1. Coincidencia por UID de Auth (más seguro)
        let employee = empleados.find(e => e.id === currentUser.uid || e.authUid === currentUser.uid);

        // 2. Fallback por email
        if (!employee && cleanedAuthId) {
             employee = empleados.find(e => e.internalEmail?.trim().toLowerCase() === cleanedAuthId);
        }
        return employee;
    }, [empleados, currentUser]);


    // ⭐ FILTRADO DINÁMICO DE TRANSACCIONES (Visual - Modal)
    const visibleTransactions = useMemo(() => {
        if (filterEmployeeId === 'todos') {
            return ctaCteTransacciones;
        }
        return ctaCteTransacciones.filter(t => {
            const txOwnerId = t.barberID || t.barberId;
            return txOwnerId === filterEmployeeId;
        });
    }, [ctaCteTransacciones, filterEmployeeId]);


    // ⭐ CALCULAR SALDO VISIBLE (Basado en el filtro seleccionado - Modal)
    const displayedBalance = useMemo(() => {
        if (!selectedClient) return 0;
        // Usa visibleTransactions que ya aplica el filtro de empleado
        return visibleTransactions.reduce((acc, t) => {
            if (t.tipo === 'Fiado' && !t.isSaldado) {
                return acc + t.monto;
            }
            return acc;
        }, 0);

    }, [visibleTransactions, selectedClient]);


    /* ============================================================
        LÓGICA DE CONTACTOS ⭐ NUEVO
    ============================================================ */
    // Comprobar si la API de Contactos está disponible (típico de navegadores modernos en móvil)
    const isContactPickerAvailable = 'contacts' in navigator && 'ContactsManager' in window;

    const handleImportContact = async () => {
        if (!isContactPickerAvailable) {
            alert("La importación de contactos no está disponible en este dispositivo/navegador.");
            return;
        }

        try {
            // Campos que queremos obtener
            const properties = ['name', 'tel'];
            // Opciones: solo queremos un contacto a la vez
            const options = { multiple: false };

            // Casting de navigator para acceder a la API de contactos
            const contacts = await (navigator as any).contacts.select(properties, options);

            if (contacts && contacts.length > 0) {
                const contact = contacts[0];
                const name = contact.name && contact.name.length > 0 ? contact.name[0] : '';
                // Obtener el primer número de teléfono
                const phone = contact.tel && contact.tel.length > 0 ? contact.tel[0] : '';

                if (name) {
                    setNombre(name);
                }
                if (phone) {
                    // Limpiar el número de teléfono, quitando caracteres no numéricos excepto el '+' inicial
                    setTelefono(phone.replace(/[^0-9+]/g, ''));
                }
            }
        } catch (error) {
            // La cancelación o denegación de permisos entran aquí
            console.error("Error al importar contacto o permiso denegado:", error);
            // Solo mostrar una alerta si es un error inesperado (la cancelación es esperada)
            // if (error && (error as any).name !== 'AbortError') { 
            //     alert("No se pudo importar el contacto o el permiso fue denegado.");
            // }
        }
    };


    /* ============================================================
        CARGAR DATOS INICIALES Y DEUDA DETALLADA
    ============================================================ */
    
    // ⭐ FUNCIONES DE CARGA REPLICADAS
    const loadDeudasDetalladas = useCallback(async () => {
        if (!effectiveBarberieUid) return;
        
        try {
            const q = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`),
                where('tipo', '==', 'Fiado'),
                where('isSaldado', '==', false)
            );
            
            const snap = await getDocs(q);
            const mapaDeudas: DebtMap = {};

            snap.forEach(doc => {
                const data = doc.data();
                const clientId = data.clienteId;
                const barberId = data.barberID || data.barberId;
                const monto = data.monto || 0;

                if (!clientId || !barberId) return;

                if (!mapaDeudas[clientId]) {
                    mapaDeudas[clientId] = {};
                }
                
                if (!mapaDeudas[clientId][barberId]) {
                    mapaDeudas[clientId][barberId] = 0;
                }

                mapaDeudas[clientId][barberId] += monto;
            });

            setDeudaPorBarbero(mapaDeudas);

        } catch (error) {
            console.error("Error calculando desglose de deudas:", error);
        }
    }, [effectiveBarberieUid]);


    const loadClientes = useCallback(async () => {
        if (!effectiveBarberieUid) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // 1. Cargar Clientes
            const qClientes = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/clientes`),
                orderBy("nombre", "asc")
            );
            const snapClientes = await getDocs(qClientes);
            const list: ClienteData[] = [];
            
            snapClientes.forEach((d) => {
                const data = d.data();
                const visitasReales = data.visitas ?? data.cortes ?? 0;
                
                list.push({
                    id: d.id,
                    ...data,
                    deuda: data.deuda || 0,
                    visitas: visitasReales,
                } as ClienteData);
            });

            setClientes(list);

            // 2. Cargar Auxiliares
            const qEmpleados = query(collection(barberDb, `barber_users/${effectiveBarberieUid}/empleados`), orderBy("nombre", "asc"));
            const snapEmpleados = await getDocs(qEmpleados);
            const empleadosList: Empleado[] = snapEmpleados.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Empleado));
            setEmpleados(empleadosList);
            
            const qServicios = query(collection(barberDb, `barber_users/${effectiveBarberieUid}/servicios`), orderBy("nombre", "asc"));
            const snapServicios = await getDocs(qServicios);
            const serviciosList: Servicio[] = snapServicios.docs.map(doc => ({ id: doc.id, ...doc.data() } as Servicio));
            setServicios(serviciosList);

            // 3. CARGAR EL MAPA DE DEUDAS
            await loadDeudasDetalladas();

        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [effectiveBarberieUid, loadDeudasDetalladas]);


    // ⭐ FLUJO DE AUTENTICACIÓN Y CARGA INICIAL (REPLICADO DE Ventas.tsx)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(barberAuth, async (user) => {
            setCurrentUser(user);
            setAuthInitialized(true);
            
            const localOwnerUid = localStorage.getItem('barberOwnerId');
            const currentEffectiveUid = localOwnerUid || user?.uid;

            if (user) {
                // 1. Detección de Rol
                setIsOwner(user.uid === localOwnerUid);

                // 2. Verificación de Suscripción
                if (currentEffectiveUid) {
                    const isSubscriptionValid = await checkSubscriptionStatus(currentEffectiveUid, navigate, barberDb);
                    
                    if (!isSubscriptionValid) {
                         setLoading(false);
                         setIsSubscriptionChecked(true);
                         return; // Detener si la suscripción no es válida
                    }
                    
                    loadClientes(); // Cargar datos si es válido
                    setIsSubscriptionChecked(true); // Marcar como chequeado
                } else {
                    setLoading(false);
                    setIsSubscriptionChecked(true);
                }

            } else {
                // Si no hay usuario (deslogueado), simplemente se detiene la carga
                setLoading(false);
                setIsSubscriptionChecked(true);
            }
        });

        return () => unsubscribe();
    }, [navigate, loadClientes]);

    // ⭐ EFFECT PARA INICIALIZAR EL FILTRO DE LA VISTA PRINCIPAL
    useEffect(() => {
        // Solo inicializamos el filtro si estamos en modo empleado, ya tenemos el loggedInEmployee 
        // y el filtro actual sigue siendo 'todos' (el valor por defecto).
        if (isEmployeeMode && loggedInEmployee && filterEmployeeId === 'todos') {
            setFilterEmployeeId(loggedInEmployee.id);
        }
    }, [isEmployeeMode, loggedInEmployee, filterEmployeeId]);


    /* ============================================================
        GESTIÓN DE CTA. CTE.
    ============================================================ */
    
    const loadCtaCteTransacciones = useCallback(async (clientId: string) => {
        if (!effectiveBarberieUid || !authInitialized) return [];

        try {
            const qCtaCte = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`),
                where('clienteId', '==', clientId),
                // Solo cargamos Fiados, Pagos (Ingreso que salda) y Gastos
                where('tipo', 'in', ['Fiado', 'Ingreso', 'Gasto']),
                orderBy('createdAt', 'desc')
            );
            
            const snap = await getDocs(qCtaCte);

            const list: TransaccionCtaCte[] = snap.docs
                .map(d => {
                    const data = d.data();
                    const normalizedId = data.barberID || data.barberId || null;

                    return {
                        id: d.id,
                        ...data,
                        barberId: normalizedId,
                        barberID: data.barberID,
                        isSaldado: data.isSaldado || false,
                    } as TransaccionCtaCte;
                })
                .filter(t => {
                    // Solo mostramos transacciones relevantes para el CtaCte
                    const isPayment = t.tipo === 'Ingreso' && (t.descripcion.startsWith("Cuenta SALDADA TOTAL de") || t.descripcion.startsWith("Pago de Fiado"));
                    const isValidCtaCteType = t.tipo === 'Fiado' || t.tipo === 'Gasto' || isPayment;
                    
                    if (!isValidCtaCteType) return false;
                    
                    return true;
                });
            
            return list;

        } catch (e) {
            console.error("Error al cargar Cta. Cte.:", e);
            return [];
        }
    }, [effectiveBarberieUid, authInitialized]);
    
    const openCtaCte = async (client: ClienteData) => {
        setSelectedClient(client);
        setManualBalanceValue(client.deuda.toString());
        setIsEditingBalance(false);
        
        // REGLA DEL EMPLEADO: PRESELECCIONAR EMPLEADO LOGUEADO SI ES MODO EMPLEADO (PARA EL MODAL)
        if (isEmployeeMode && loggedInEmployee) {
             setFilterEmployeeId(loggedInEmployee.id);
        } else {
             setFilterEmployeeId('todos');
        }
        
        setCtaCteModalOpen(true);
        if (authInitialized) {
            const transacciones = await loadCtaCteTransacciones(client.id);
            setCtaCteTransacciones(transacciones);
        }
    };

    // Actualizar Saldo Manualmente (Solo Dueño)
    const handleUpdateManualBalance = async () => {
        if (!selectedClient || !effectiveBarberieUid || !isOwner) return;
        
        const newBalance = Number(manualBalanceValue);
        if (isNaN(newBalance)) return alert("Ingresa un número válido");

        try {
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                deuda: newBalance,
                updatedAt: serverTimestamp(),
            });
            
            setIsEditingBalance(false);
            await loadClientes();
            alert("✅ Saldo corregido manualmente.");
        } catch (e) {
            console.error("Error al actualizar saldo manual:", e);
            alert("Error al actualizar saldo.");
        }
    };
    
    // Registrar Fiado
    const handleRegistrarFiado = async () => {
        if (!selectedClient || !effectiveBarberieUid || isFiando) return;
        
        const finalBarberId = isEmployeeMode && loggedInEmployee ? loggedInEmployee.id : fiadoBarberId;
        
        if (!finalBarberId || !fiadoMonto || Number(fiadoMonto) <= 0) return alert("Selecciona empleado y monto válido.");

        setIsFiando(true);
        
        try {
            const monto = Number(fiadoMonto);
            const selectedService = servicios.find(s => s.id === fiadoServiceId);
            const selectedBarber = empleados.find(e => e.id === finalBarberId);
            const descripcion = selectedService
                ? `Fiado - ${selectedService.nombre}`
                : `Fiado - Servicio Manual: ${monto}`;
            
            if (!selectedBarber) throw new Error("Empleado no válido.");

            await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`), {
                monto: monto,
                descripcion: descripcion,
                tipo: 'Fiado',
                date: new Date().toISOString().substring(0, 10),
                barberId: finalBarberId,
                barberID: finalBarberId,
                barberName: selectedBarber.nombre,
                servicioId: fiadoServiceId || null,
                comisionAplicada: selectedBarber.porcentaje,
                clienteId: selectedClient.id,
                clienteNombre: selectedClient.nombre,
                isSaldado: false,
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                deuda: increment(monto),
                visitas: increment(1),
                updatedAt: serverTimestamp(),
            });

            setFiadoModalOpen(false);
            await loadClientes();
            
            if (ctaCteModalOpen && selectedClient) {
                 const transacciones = await loadCtaCteTransacciones(selectedClient.id);
                 setCtaCteTransacciones(transacciones);
            }
            
        } catch (e) {
            console.error("Error al registrar fiado:", e);
            alert("Error al registrar el fiado.");
        } finally {
            setIsFiando(false);
        }
    };

    // Saldar Deuda (Individual)
    const handleSaldarDeuda = async () => {
        if (!selectedClient || !saldarTransaction || !effectiveBarberieUid || isSaldando || saldarTransaction.isSaldado || saldarTransaction.monto <= 0) return;
        
        const collectorBarberId = (!isOwner && loggedInEmployee) ? loggedInEmployee.id : saldarBarberId;

        if (!collectorBarberId) return alert("Error de identificación del empleado.");

        setIsSaldando(true);
        
        try {
            const montoPagado = saldarTransaction.monto;
            
            const creditToBarberId = saldarTransaction.barberId || collectorBarberId;

            const selectedBarber = empleados.find(e => e.id === creditToBarberId);
            if (!selectedBarber) throw new Error("Empleado original o cobrador no válido.");

            // Crear el Ingreso
            await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`), {
                monto: montoPagado,
                descripcion: `Pago de Fiado: ${saldarTransaction.descripcion} - Cliente: ${selectedClient.nombre}`,
                tipo: 'Ingreso',
                date: new Date().toISOString().substring(0, 10),
                barberId: creditToBarberId,
                barberID: creditToBarberId,
                barberName: selectedBarber.nombre,
                metodoPago: saldarMetodoPago,
                comisionAplicada: selectedBarber.porcentaje,
                clienteId: selectedClient.id,
                clienteNombre: selectedClient.nombre,
                createdAt: serverTimestamp(),
            });
            
            // Marcar transacción original como saldada
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${saldarTransaction.id}`), {
                isSaldado: true,
            });

            // Restar deuda global
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                deuda: increment(-montoPagado),
                updatedAt: serverTimestamp(),
            });

            setSaldarModalOpen(false);
            setSaldarTransaction(null);
            await loadClientes();
            if (authInitialized) {
                 const transacciones = await loadCtaCteTransacciones(selectedClient.id);
                 setCtaCteTransacciones(transacciones);
            }
            
        } catch (e) {
            console.error("Error al saldar deuda individual:", e);
            alert("Error al registrar el saldado.");
        } finally {
            setIsSaldando(false);
            resetFormSaldar();
        }
    };

    // Saldar Deuda TOTAL (Inteligente y Filtrada)
    const handleSaldarDeudaTotal = async () => {
        if (!selectedClient || !effectiveBarberieUid || isSaldandoTodo) return;
        
        const collectorBarberId = (!isOwner && loggedInEmployee) ? loggedInEmployee.id : saldarBarberId;
        if (!collectorBarberId) return alert("Selecciona un empleado responsable.");

        setIsSaldandoTodo(true);
        
        try {
            const montoASaldar = displayedBalance;

            if (montoASaldar <= 0) {
                 if (!window.confirm("El saldo visible es $0. ¿Deseas continuar?")) {
                     setIsSaldandoTodo(false);
                     return;
                 }
            }

            const selectedBarber = empleados.find(e => e.id === collectorBarberId);
            if (!selectedBarber) throw new Error("Empleado no válido.");

            // Consultar fiados pendientes EN FIREBASE
            const qFiadosPendientes = query(
                collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`),
                where('clienteId', '==', selectedClient.id),
                where('tipo', '==', 'Fiado'),
                where('isSaldado', '==', false)
            );
            
            const snapPendientes = await getDocs(qFiadosPendientes);
            
            const batch = writeBatch(barberDb);
            let totalRealSaldado = 0;

            let targetFilterId: string | null = null;
            
            if (filterEmployeeId !== 'todos') {
                 targetFilterId = filterEmployeeId;
            }

            if (!snapPendientes.empty) {
                snapPendientes.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    const docBarberId = data.barberID || data.barberId;
                    
                    if (!targetFilterId || docBarberId === targetFilterId) {
                        const ventaRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${docSnap.id}`);
                        batch.update(ventaRef, { isSaldado: true });
                        totalRealSaldado += data.monto;
                    }
                });
            }
            
            // Crear Ingreso por el total calculado
            if (totalRealSaldado > 0) {
                const newSaleRef = doc(collection(barberDb, `barber_users/${effectiveBarberieUid}/ventas`));
                batch.set(newSaleRef, {
                    monto: totalRealSaldado,
                    descripcion: `Cuenta SALDADA TOTAL de ${selectedClient.nombre}`,
                    tipo: 'Ingreso',
                    date: new Date().toISOString().substring(0, 10),
                    barberId: collectorBarberId,
                    barberID: collectorBarberId,
                    barberName: selectedBarber.nombre,
                    metodoPago: saldarMetodoPago,
                    comisionAplicada: selectedBarber.porcentaje,
                    clienteId: selectedClient.id,
                    clienteNombre: selectedClient.nombre,
                    createdAt: serverTimestamp(),
                });
            }

            // Actualizar deuda global del cliente (restando solo lo pagado)
            const clientRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`);
            
            batch.update(clientRef, {
                deuda: increment(-totalRealSaldado),
                updatedAt: serverTimestamp(),
            });

            await batch.commit();

            setSaldarTodoModalOpen(false);
            await loadClientes();
            if (authInitialized) {
                 const transacciones = await loadCtaCteTransacciones(selectedClient.id);
                 setCtaCteTransacciones(transacciones);
            }
            
        } catch (e) {
            console.error("Error al saldar deuda total:", e);
            alert("Error al registrar el saldado total.");
        } finally {
            setIsSaldandoTodo(false);
            resetFormSaldar();
        }
    };


    // Eliminar transacción Fiado
    // CORRECCIÓN 4: La función se utiliza correctamente, eliminando el error TS6133
    const handleDeleteCtaCte = async () => {
        if (!selectedClient || !transactionToDeleteCtaCte || !effectiveBarberieUid || isDeletingCtaCte) return;
        
        if (transactionToDeleteCtaCte.isSaldado) {
             alert("⛔ ACCIÓN DENEGADA:\n\nEste fiado YA FUE COBRADO. Si lo eliminas ahora, generarás un desfasaje contable.\n\nSOLUCIÓN: Usa el lápiz de edición junto al Saldo Pendiente para corregir el monto final manualmente si es necesario.");
             setDeleteCtaCteModalOpen(false);
             return;
        }

        const montoEliminado = transactionToDeleteCtaCte.monto;
        
        setIsDeletingCtaCte(true);

        try {
            await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/ventas/${transactionToDeleteCtaCte.id}`));

            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                deuda: increment(-montoEliminado),
                visitas: increment(-1),
                updatedAt: serverTimestamp(),
            });

            setDeleteCtaCteModalOpen(false);
            setTransactionToDeleteCtaCte(null);
            
            await loadClientes();
            if (authInitialized) {
                 const transacciones = await loadCtaCteTransacciones(selectedClient.id);
                 setCtaCteTransacciones(transacciones);
            }

        } catch (e) {
            console.error("Error al eliminar transacción de CtaCte:", e);
            alert("Error al eliminar la transacción.");
        } finally {
            setIsDeletingCtaCte(false);
        }
    };
    
    const getWhatsAppLinkCtaCte = (client: ClienteData, deudaVisible: number) => {
        const cleanNumber = client.telefono ? client.telefono.replace(/\D/g, "") : '';
        const deuda = deudaVisible > 0 ? deudaVisible : 0;
        
        if (deuda > 0) {
             const message = `¡Hola ${client.nombre}! Adjunto el resumen de tu cuenta pendiente:\n\nRESUMEN DE CUENTA:\nTe resta pagar ${formatCurrency(deuda)} por los servicios brindados. Por favor, realiza el pago a la brevedad. ¡Gracias!`;
             return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
        }
        
        return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(`Hola ${client.nombre}, me gustaría coordinar un turno.`)}`;
    };

    const updateVisitas = async (client: ClienteData, delta: number) => {
        if (!effectiveBarberieUid) return;
        const newVisitas = Math.max(0, client.visitas + delta);
        if (newVisitas === client.visitas) return;

        try {
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${client.id}`), {
                visitas: newVisitas,
                updatedAt: serverTimestamp(),
            });
            loadClientes();
        } catch (e) {
            console.error("Error al actualizar visitas:", e);
            alert("Error al actualizar el contador de fidelidad.");
        }
    };

    const handleCanjear = async (client: ClienteData, e?: React.MouseEvent) => {
        if (e) {
             e.preventDefault();
             e.stopPropagation();
        }
        
        if (!effectiveBarberieUid) return;
        
        if (!window.confirm(`¿Canjear corte GRATIS para ${client.nombre}? Se reiniciarán las visitas a 0.`)) return;

        setClientes(prev => prev.map(c => c.id === client.id ? { ...c, visitas: 0 } : c));

        try {
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${client.id}`), {
                visitas: 0,
                updatedAt: serverTimestamp(),
            });
            await loadClientes();
        } catch (e) {
            console.error("Error al canjear visitas:", e);
            alert("Error al procesar el canje.");
            loadClientes();
        }
    };

    /* ============================================================
        CRUD & LÓGICA (existente)
    ============================================================ */
    const handleCreate = async () => {
        if (!nombre.trim()) return alert("El nombre es obligatorio");
        if (!effectiveBarberieUid || isSaving) return;

        setIsSaving(true);
        
        try {
            await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/clientes`), {
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                email: email.trim(),
                notas: notas.trim(),
                visitas: 0,
                deuda: 0,
                createdAt: serverTimestamp(),
            });
            setCreateModalOpen(false);
            resetForm();
            loadClientes();
        } catch (e) {
            console.error(e);
            alert("Error al crear cliente");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = async () => {
        if (!selectedClient || !effectiveBarberieUid || isSaving) return;
        
        setIsSaving(true);
        
        try {
            await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`), {
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                email: email.trim(),
                notas: notas.trim(),
                visitas: Number(visitas),
                updatedAt: serverTimestamp(),
            });
            setEditModalOpen(false);
            resetForm();
            loadClientes();
        } catch (e) {
            console.error(e);
            alert("Error al editar");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedClient || !effectiveBarberieUid || isDeleting) return;
        
        setIsDeleting(true);
        
        try {
            await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/clientes/${selectedClient.id}`));
            setDeleteModalOpen(false);
            setSelectedClient(null);
            loadClientes();
        } catch (e) {
            console.error(e);
            alert("Error al eliminar");
        } finally {
            setIsDeleting(false);
        }
    };


    /* ============================================================
        HELPERS UI
    ============================================================ */
    // ⭐ MODIFICADO: Solo limpieza de estados no relacionados con el filtro de la vista principal.
    const resetForm = () => {
        setNombre("");
        setTelefono("");
        setEmail("");
        setNotas("");
        setVisitas(0);
        setSelectedClient(null);
        setCtaCteTransacciones([]);
        setTransactionToDeleteCtaCte(null);
        setSaldarTransaction(null);
        setIsEditingBalance(false);
    };
    
    const resetFormSaldar = () => {
        if (isEmployeeMode && loggedInEmployee) {
             setSaldarBarberId(loggedInEmployee.id);
        } else {
             setSaldarBarberId(empleados[0]?.id || '');
        }
        setSaldarMetodoPago('Efectivo');
    };
    
    const resetFormFiado = () => {
        const defaultServiceId = servicios[0]?.id || '';
        const defaultServicePrice = servicios.find(s => s.id === defaultServiceId)?.precio.toString() || '';
        
        if (isEmployeeMode && loggedInEmployee) {
             setFiadoBarberId(loggedInEmployee.id);
        } else {
             setFiadoBarberId(empleados[0]?.id || '');
        }

        setFiadoServiceId(defaultServiceId);
        setFiadoMonto(defaultServicePrice);
    };

    // ⭐ FUNCIÓN DE CIERRE LIMPIA DEL MODAL CTA CTE (IMPLEMENTADA)
    const closeCtaCte = () => {
        setCtaCteModalOpen(false);
        resetForm(); 
    };


    const openEdit = (client: ClienteData) => {
        setSelectedClient(client);
        setNombre(client.nombre);
        setTelefono(client.telefono || "");
        setEmail(client.email || "");
        setNotas(client.notas || "");
        setVisitas(client.visitas || 0);
        setEditModalOpen(true);
    };

    const openDelete = (client: ClienteData) => {
        setSelectedClient(client);
        setDeleteModalOpen(true);
    };

    const openSaldarTransaction = (client: ClienteData, transaction: TransaccionCtaCte) => {
        setSelectedClient(client);
        setSaldarTransaction(transaction);
        resetFormSaldar();
        setSaldarModalOpen(true);
    };
    
    const openSaldarTodo = (client: ClienteData) => {
        setSelectedClient(client);
        setSaldarTransaction(null);
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
        FILTRADO UI
    ============================================================ */
    const filteredClients = clientes.filter(c =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.telefono && c.telefono.includes(searchTerm))
    );

    const isFilteredView = filterEmployeeId !== 'todos';

    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed";
    const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed";

    // PANTALLA DE CARGA DE AUTENTICACIÓN (REPLICADO DE Ventas.tsx)
    if (!isSubscriptionChecked) {
        return (
            <div className="flex justify-center items-center h-screen">
                <IconSpinner color="text-slate-700" size="h-8 w-8" />
                <span className="text-slate-700 ml-2">Verificando usuario y suscripción...</span>
            </div>
        );
    }
    
    // Si la autenticación está verificada pero no hay UID efectivo 
    if (!effectiveBarberieUid) {
        return (
             <div className="text-center py-12">
                 <h2 className="text-xl font-semibold text-red-600">Acceso Denegado</h2>
                 <p className="text-sm text-slate-500 mt-2">No se pudo identificar una barbería válida para el usuario.</p>
             </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn m-2">
            
            {/* HEADER + BUSCADOR + FILTRO DE EMPLEADOS */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Cartera de Clientes</h2>
                        <p className="text-sm text-slate-500">
                            {clientes.length} clientes registrados.
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        {/* BUSCADOR */}
                        <div className="relative group flex-1 md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <IconSearch />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 outline-none w-full transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* ⭐ FILTRO DE EMPLEADOS (OCULTAR PARA EMPLEADOS) */}
                        {!isEmployeeMode ? (
                            <div className="relative flex-1 md:w-48">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <IconFilter />
                                </div>
                                <select
                                    value={filterEmployeeId}
                                    onChange={(e) => setFilterEmployeeId(e.target.value)}
                                    className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 outline-none w-full appearance-none cursor-pointer text-slate-700 font-medium"
                                >
                                    <option value="todos">Todos los empleados</option>
                                    {empleados.map(e => (
                                         <option key={e.id} value={e.id}>{e.nombre} {e.id === uid && '(Tú)'}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        ) : (
                            // Mostrar una etiqueta fija o un placeholder
                            <>
                                
                            </>
                        )}
                        
                        {/* BOTÓN NUEVO CLIENTE */}
                        <button
                            onClick={() => { resetForm(); setCreateModalOpen(true); }}
                            className="flex items-center justify-center cursor-pointer gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap"
                        >
                            <IconPlus />
                            <span className="hidden sm:inline">Nuevo</span>
                        </button>
                    </div>
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
                        const visitasActuales = client.visitas || 0;
                        
                        let deudaVisible = client.deuda || 0;
                        if (isFilteredView) {
                            const deudasCliente = deudaPorBarbero[client.id] || {};
                            deudaVisible = deudasCliente[filterEmployeeId] || 0;
                        }

                        const esGratis = visitasActuales >= 10;
                        const porcentaje = Math.min((visitasActuales / 10) * 100, 100);

                        return (
                            <div key={client.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden ${esGratis ? 'border-yellow-400/50 ring-1 ring-yellow-400/30' : (deudaVisible > 0 ? 'border-red-400/50 ring-1 ring-red-400/30' : 'border-slate-200')}`}>
                                
                                {esGratis && (
                                    <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                                         ¡CORTE GRATIS!
                                    </div>
                                )}
                                
                                {deudaVisible > 0 && (
                                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10 flex items-center gap-1">
                                         DEUDA: {formatCurrency(deudaVisible)}
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-3">
                                    <div className="max-w-[80%]">
                                        <h3 className="font-semibold text-slate-900 truncate">{client.nombre}</h3>
                                        
                                        {client.telefono ? (
                                            <a
                                                href={getWhatsAppLinkCtaCte(client, deudaVisible)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`text-sm ${deudaVisible > 0 ? 'text-red-500 hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'} flex items-center mt-1 font-medium transition-colors w-fit`}
                                            >
                                                <IconWhatsApp />
                                                WhatsApp
                                                {deudaVisible > 0 && <span className="font-bold ml-1">(Cobrar)</span>}
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
                                            className="px-3 py-1.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition shadow-sm active:scale-95 flex items-center gap-1"
                                        >
                                            <IconCash /> Fiado (+)
                                        </button>
                                    </div>
                                    
                                    {deudaVisible > 0 && (
                                            <div className="w-full text-center text-xs text-red-500 font-medium pt-1">
                                                {isFilteredView ? 'Pendiente con Empleado:' : 'Pendiente Global:'} {formatCurrency(deudaVisible)}
                                            </div>
                                    )}
                                </div>


                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                            <IconStar /> Fidelidad (Visitas)
                                        </span>
                                        <span className={`text-xs font-bold ${esGratis ? 'text-yellow-600' : 'text-slate-700'}`}>
                                            {visitasActuales} / 10
                                        </span>
                                    </div>
                                    
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                                        <div
                                            className={`h-full transition-all duration-500 ease-out rounded-full ${esGratis ? 'bg-yellow-400' : 'bg-slate-800'}`}
                                            style={{ width: `${porcentaje}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            onClick={() => updateVisitas(client, -1)}
                                            className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium transition"
                                        >
                                            -1
                                        </button>

                                        {esGratis ? (
                                            <button
                                                onClick={(e) => handleCanjear(client, e)}
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
                MODAL REGISTRAR FIADO
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
                            
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Barbero que realiza el Servicio</label>
                                <select
                                    value={isEmployeeMode && loggedInEmployee ? loggedInEmployee.id : fiadoBarberId}
                                    onChange={(e) => setFiadoBarberId(e.target.value)}
                                    className={inputClass + ' cursor-pointer'}
                                    disabled={isFiando || !!isEmployeeMode}
                                >
                                    <option value="">-- Selecciona un Barbero --</option>
                                    {empleados.map((e) => (
                                         <option key={e.id} value={e.id}>{e.nombre} {e.id === uid && '(Tú)'}</option>
                                    ))}
                                </select>
                                {isEmployeeMode && (
                                     <p className="text-xs text-slate-500 mt-1">Asignado automáticamente a ti.</p>
                                )}
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
                                    disabled={isFiando || (!isEmployeeMode && !fiadoBarberId) || Number(fiadoMonto) <= 0}
                                >
                                    {isFiando ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" color="text-white" />
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
                MODAL SALDAR DEUDA (INDIVIDUAL)
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
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Empleado que Recibe el Pago</label>
                                {isOwner ? (
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
                                ) : (
                                    // MODO EMPLEADO: No puede cambiar el cobrador
                                    <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium border border-slate-200">
                                         {loggedInEmployee?.nombre || "Usuario Actual (Tú)"}
                                    </div>
                                )}
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
                                    disabled={isSaldando || (isOwner && !saldarBarberId) || saldarTransaction.monto <= 0}
                                >
                                    {isSaldando ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" color="text-white" />
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
                MODAL SALDAR DEUDA TOTAL CONFIRMATION
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
                                <p className="text-3xl font-bold text-emerald-800 mt-1">{formatCurrency(displayedBalance)}</p>
                                <p className="text-xs text-emerald-500 mt-1">
                                    Esta acción marcará como pagados los fiados pendientes {filterEmployeeId !== 'todos' ? 'DEL EMPLEADO SELECCIONADO' : 'DE TODOS LOS EMPLEADOS'}.
                                </p>
                            </div>

                            {/* Empleado que cobra */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Empleado que Recibe el Pago</label>
                                {isOwner ? (
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
                                ) : (
                                    // MODO EMPLEADO: No puede cambiar el cobrador
                                    <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium border border-slate-200">
                                         {loggedInEmployee?.nombre || "Usuario Actual (Tú)"}
                                    </div>
                                )}
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
                                    disabled={isSaldandoTodo || (isOwner && !saldarBarberId)}
                                >
                                    {isSaldandoTodo ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" color="text-white" />
                                             Saldando Todo...
                                         </>
                                    ) : `Confirmar Pago Total de ${formatCurrency(displayedBalance)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* =========================================
                MODAL CUENTA CORRIENTE (CtaCte)
            ========================================= */}
            {ctaCteModalOpen && selectedClient && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-fadeIn max-h-[90vh] overflow-y-auto">
                        
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold text-slate-900">
                                Cuenta Corriente
                            </h3>
                            
                            {filterEmployeeId !== 'todos' && (
                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-medium border border-blue-100">
                                     Filtro: <b>{empleados.find(e => e.id === filterEmployeeId)?.nombre}</b>
                                </span>
                            )}
                        </div>
                        
                        <p className="text-sm text-slate-500 border-b border-slate-100 pb-3">
                            Resumen de transacciones a cuenta de: **{selectedClient.nombre}**
                        </p>
                        
                        <div className={`mt-4 p-4 rounded-lg flex justify-between items-center ${displayedBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'} border`}>
                            <span className="text-lg font-bold text-slate-800">Saldo Pendiente:</span>
                            
                            <div className="flex items-center gap-2">
                                {isEditingBalance && isOwner && filterEmployeeId === 'todos' ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={manualBalanceValue}
                                            onChange={(e) => setManualBalanceValue(e.target.value)}
                                            className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-bold text-slate-900"
                                            autoFocus
                                        />
                                        <button onClick={handleUpdateManualBalance} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                                            <IconCheck />
                                        </button>
                                        <button onClick={() => setIsEditingBalance(false)} className="text-xs text-slate-500 underline">
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group">
                                        <span className={`text-xl font-extrabold ${displayedBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {formatCurrency(displayedBalance)}
                                        </span>
                                        {isOwner && filterEmployeeId === 'todos' && (
                                            <button
                                                onClick={() => { setIsEditingBalance(true); setManualBalanceValue(selectedClient.deuda.toString()); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
                                                title="Corregir saldo manualmente"
                                            >
                                                <IconEdit />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* BOTONES DE ACCIÓN SUPERIOR DENTRO DEL MODAL */}
                        <div className="flex gap-3 justify-end pt-4">
                            <button
                                onClick={() => openFiado(selectedClient)}
                                className="px-3 py-2 text-sm font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition shadow-sm active:scale-95 flex items-center gap-1"
                            >
                                <IconPlus /> Registrar Fiado
                            </button>
                            
                            <button
                                onClick={() => openSaldarTodo(selectedClient)}
                                className="px-3 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm active:scale-95 flex items-center gap-1"
                            >
                                <IconCash /> Saldar Deuda TOTAL
                            </button>
                        </div>


                        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            <h4 className="text-xs font-medium text-slate-600 uppercase">Historial de Transacciones (Fiado/Saldado)</h4>
                            
                            {visibleTransactions.length > 0 ? visibleTransactions.map((t, index) => {
                                const isFiado = t.tipo === 'Fiado';
                                const isPayment = t.tipo === 'Ingreso' && (t.descripcion.startsWith("Cuenta SALDADA TOTAL de") || t.descripcion.startsWith("Pago de Fiado"));
                                
                                const isSaldado = t.isSaldado;
                                
                                let colorClass = 'text-slate-500';
                                let statusLabel = null;

                                if (isFiado) {
                                    if (isSaldado) {
                                        colorClass = 'text-emerald-600';
                                        statusLabel = <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded font-bold">COBRADO</span>;
                                    } else {
                                        colorClass = 'text-slate-500';
                                        statusLabel = <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 border border-slate-200 rounded font-bold">PENDIENTE</span>;
                                    }
                                } else if (isPayment) {
                                    colorClass = 'text-emerald-500';
                                }

                                const sign = isFiado ? "+" : "-";
                                const isFiadoPendiente = isFiado && !isSaldado;

                                return (
                                    <div key={t.id || index} className="flex justify-between items-center border-b border-slate-5 pb-2">
                                        <div className="flex-1">
                                            <p className={`text-sm font-medium text-slate-900`}>
                                                {t.descripcion}
                                                {statusLabel}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {t.barberName} | {t.createdAt.toDate().toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className={`text-right ${colorClass} flex items-center gap-2`}>
                                            <div>
                                                <p className={`text-sm font-bold`}>
                                                    {sign} {formatCurrency(t.monto)}
                                                </p>
                                                <p className="text-[10px] uppercase">
                                                    {isFiado ? (isSaldado ? 'Cobrado' : 'A cobrar') : (isPayment ? `Pago (${t.metodoPago || 'N/A'})` : t.tipo)}
                                                </p>
                                            </div>
                                            
                                            {isFiadoPendiente && (
                                                <button
                                                    onClick={() => openSaldarTransaction(selectedClient, t)}
                                                    className="px-2 py-1 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-sm active:scale-95 whitespace-nowrap"
                                                >
                                                    Saldar
                                                </button>
                                            )}

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
                                <p className="text-sm text-slate-400 italic">No hay registros visibles en la Cuenta Corriente con este filtro.</p>
                            )}
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                            <button
                                onClick={closeCtaCte} // ⭐ Función de cierre limpia
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL ELIMINAR TRANSACCIÓN CTA CTE
            ========================================= */}
            {deleteCtaCteModalOpen && transactionToDeleteCtaCte && selectedClient && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fadeIn text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <IconTrash />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">¿Eliminar Fiado Pendiente?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">
                            Estás a punto de eliminar el fiado: **{transactionToDeleteCtaCte.descripcion}** por **{formatCurrency(transactionToDeleteCtaCte.monto)}**. Esto reducirá la deuda y las visitas de **{selectedClient.nombre}**.
                        </p>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setDeleteCtaCteModalOpen(false); setTransactionToDeleteCtaCte(null); }}
                                className={btnSecondary}
                                disabled={isDeletingCtaCte}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteCtaCte} // CORRECCIÓN 4: Uso de la función
                                className={`w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm flex items-center justify-center gap-2 ${isDeletingCtaCte ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isDeletingCtaCte}
                            >
                                {isDeletingCtaCte ? (
                                    <>
                                        <IconSpinner size="h-4 w-4" color="text-white" />
                                        Eliminando...
                                    </>
                                ) : "Sí, eliminar Fiado"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL CREAR / EDITAR CLIENTE
            ========================================= */}
            {(createModalOpen || editModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            {createModalOpen ? "Nuevo Cliente" : "Editar Cliente"}
                        </h3>
                        
                        <div className="space-y-4">
                            
                            {/* ⭐ BOTÓN DE IMPORTAR CONTACTO (AÑADIDO AL JSX) */}
                            {createModalOpen && isContactPickerAvailable && (
                                <button 
                                    onClick={handleImportContact}
                                    type="button"
                                    className="w-full md:hidden py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium text-sm flex items-center justify-center gap-2 mb-4"
                                >
                                    <IconPhone /> Importar desde Contactos
                                </button>
                            )}

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
                                            value={visitas}
                                            onChange={(e) => setVisitas(Number(e.target.value))}
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
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                         <>
                                             <IconSpinner size="h-4 w-4" color="text-white" />
                                             Guardando...
                                         </>
                                    ) : (createModalOpen ? "Guardar Cliente" : "Guardar Cambios")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <>
                                        <IconSpinner size="h-4 w-4" color="text-white" />
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