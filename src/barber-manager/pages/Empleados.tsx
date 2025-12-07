import React, { useEffect, useState, useCallback } from "react";
import {
    collection,
    getDocs,
    deleteDoc,
    updateDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    getDoc,
    setDoc,
    Firestore,
    writeBatch,
} from "firebase/firestore";
// IMPORTANTE: Importamos funciones para manejar la sesión aislada
import { 
    createUserWithEmailAndPassword, 
    getAuth, 
    signOut, 
    setPersistence, 
    inMemoryPersistence 
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { useNavigate } from 'react-router-dom';

// IMPORTANTE: Asegúrate de que 'firebaseConfig' se exporte correctamente desde tu archivo de servicios
import { barberDb, barberAuth, firebaseConfig } from "../services/firebaseBarber";

// ==========================================================
// CONSTANTE GLOBAL: Contraseña Maestra Fija
// ==========================================================
const DEFAULT_MASTER_PASSWORD = "Admin1234";
const DEFAULT_PRIORITY = 999; // Prioridad por defecto para documentos antiguos

// Tipados (Simplificados)
interface Empleado {
    id: string;
    nombre: string;
    porcentaje: number; // Porcentaje de comisión
    activo: boolean;
    dni: string; 
    authUid?: string; 
    internalEmail?: string; 
    username?: string;
    prioridad: number; 
}

interface BarberConfig {
    barberName: string;
    masterPassword: typeof DEFAULT_MASTER_PASSWORD;
    ownerUid: string;
}

/* ============================================================
    CONSTANTES & HELPERS
============================================================ */
// --- Iconos ---
const IconUser = () => (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
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
const IconWarning = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.45-1.74 1.54-3.04L13.54 4.04c-.91-1.3-2.37-1.3-3.28 0L3.54 17.96c-.91 1.3.003 3.04 1.54 3.04z" />
    </svg>
);

const IconSpinner = () => (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
);

const IconArrowUp = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
);

const IconArrowDown = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
);

const IconList = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
    </svg>
);

// --- Helpers de Formato ---
const slugify = (text: string) => {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-') 
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .substring(0, 50);
};

const generateEmployeeCredentials = (ownerUid: string, barberSlug: string, employeeName: string) => {
    const employeeSlug = slugify(employeeName);
    const username = `${barberSlug}-${employeeSlug}`;
    const internalEmail = `${username}@${ownerUid}.internal`; 
    return { username, internalEmail };
};

/**
 * Función CRÍTICA para asegurar que el documento padre del Dueño existe.
 */
const ensureOwnerDocumentExists = async (db: Firestore, uid: string) => {
    const ownerDocRef = doc(db, `barber_users/${uid}`);
    const ownerDocSnap = await getDoc(ownerDocRef);
    if (!ownerDocSnap.exists()) {
        await setDoc(ownerDocRef, { 
            role: 'owner',
            createdAt: serverTimestamp(),
        }, { merge: true });
    }
}


/* ============================================================
    COMPONENTES ANIDADOS
============================================================ */
interface ReorderModalProps {
    employees: Empleado[];
    uid: string;
    onClose: () => void;
    onSaveSuccess: () => Promise<void>;
    setErrorMessage: (msg: string | null) => void;
    isSaving: boolean;
    setIsSaving: (isSaving: boolean) => void;
    btnPrimary: string;
    btnSecondary: string;
}

const ReorderEmpleadosModal: React.FC<ReorderModalProps> = ({ 
    employees, 
    uid, 
    onClose, 
    onSaveSuccess, 
    setErrorMessage, 
    isSaving, 
    setIsSaving,
    btnPrimary,
    btnSecondary
}) => {
    // Solo mostramos y reordenamos a los empleados activos
    const initialActiveEmployees = employees
        .filter(emp => emp.activo)
        .sort((a, b) => a.prioridad - b.prioridad);

    const [reorderedList, setReorderedList] = useState<Empleado[]>(initialActiveEmployees);
    
    // Función para mover un empleado en la lista local
    const handleReorder = useCallback((index: number, direction: 'up' | 'down') => {
        setReorderedList(prevList => {
            const newList = [...prevList];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            
            if (newIndex >= 0 && newIndex < newList.length) {
                // Intercambio de posiciones en el array
                [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
                return newList;
            }
            return prevList;
        });
    }, []);

    // Función para guardar el nuevo orden en Firestore
    const saveNewOrder = async () => {
        if (!uid || isSaving) return;
        setIsSaving(true);
        setErrorMessage(null);

        try {
            const batch = writeBatch(barberDb);
            
            // Asignar nuevas prioridades basadas en el índice del array (1, 2, 3...)
            reorderedList.forEach((empleado, index) => {
                const newPriority = index + 1;
                
                // Solo actualizamos si la prioridad realmente ha cambiado
                if (empleado.prioridad !== newPriority) {
                    const docRef = doc(barberDb, `barber_users/${uid}/empleados/${empleado.id}`);
                    batch.update(docRef, { 
                        prioridad: newPriority, 
                        updatedAt: serverTimestamp() 
                    });
                }
            });

            await batch.commit();
            await onSaveSuccess();
            onClose();

        } catch (err) {
            console.error("Error al guardar nuevo orden:", err);
            setErrorMessage("Error al guardar el nuevo orden de prioridad.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-fadeIn">
                <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <IconList />
                    Ordenar Empleados
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                    Define el orden en que aparecerán los empleados activos en los menús desplegables de registro de ventas (1 es el primero).
                </p>

                {/* Lista de Empleados Reordenables */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-80 overflow-y-auto space-y-2">
                    {reorderedList.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No hay empleados activos para ordenar.</p>
                    ) : (
                        reorderedList.map((emp, index) => (
                            <div 
                                key={emp.id} 
                                className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm border border-slate-100"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800 w-5 text-center">{index + 1}.</span>
                                    <span className="text-sm text-slate-700">{emp.nombre}</span>
                                </div>
                                <div className="flex gap-2">
                                    {/* Botón Subir */}
                                    <button 
                                        onClick={() => handleReorder(index, 'up')}
                                        disabled={index === 0 || isSaving}
                                        className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                        title="Mover arriba"
                                    >
                                        <IconArrowUp />
                                    </button>
                                    {/* Botón Bajar */}
                                    <button 
                                        onClick={() => handleReorder(index, 'down')}
                                        disabled={index === reorderedList.length - 1 || isSaving}
                                        className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                        title="Mover abajo"
                                    >
                                        <IconArrowDown />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex gap-3 pt-6">
                    <button 
                        type="button"
                        onClick={onClose}
                        className={btnSecondary}
                        disabled={isSaving}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button"
                        onClick={saveNewOrder}
                        className={btnPrimary}
                        disabled={isSaving || reorderedList.length === 0}
                    >
                        {isSaving ? (
                            <>
                                <IconSpinner />
                                Guardando Orden...
                            </>
                        ) : "Guardar Nuevo Orden"}
                    </button>
                </div>
            </div>
        </div>
    );
};


/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Empleados: React.FC = () => {
    const navigate = useNavigate();
    const owner = barberAuth.currentUser;
    const uid = owner?.uid;

    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<BarberConfig | null>(null);

    // Estados del modal
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    // ⭐ NUEVO ESTADO PARA EL MODAL DE ORDENACIÓN
    const [reorderModalOpen, setReorderModalOpen] = useState(false);
    
    // ⭐ Estado para controlar bloqueo de UI durante guardado/eliminación/movimiento
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Estados del formulario
    const [formNombre, setFormNombre] = useState("");
    const [formPorcentaje, setFormPorcentaje] = useState(0);
    const [formActivo, setFormActivo] = useState(true);
    const [formDni, setFormDni] = useState(""); 
    const [formPrioridad, setFormPrioridad] = useState(DEFAULT_PRIORITY); 

    // Mensajes
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    /* ============================================================
    CARGA DE DATOS
    ============================================================ */
    const loadData = useCallback(async () => {
        if (!uid) return;
        setLoading(true);
        setErrorMessage(null);

        try {
            // 1. Cargar Configuración
            const configRef = doc(barberDb, `barber_config/${uid}`);
            const configSnap = await getDoc(configRef);
            if (configSnap.exists()) {
                setConfig(configSnap.data() as BarberConfig);
            } else {
                setConfig(null); 
            }

            // 2. Cargar Lista de Empleados (por nombre, y luego migrar/ordenar en frontend)
            const empleadosRef = collection(barberDb, `barber_users/${uid}/empleados`);
            const q = query(empleadosRef, orderBy("nombre", "asc"));
            const snap = await getDocs(q);
            
            const list: Empleado[] = [];
            const batch = writeBatch(barberDb);
            let needsMigration = false;
            let migratedCount = 0; // ⭐ Contador manual para evitar el error TS2339

            // Revisión de documentos y preparación de migración
            snap.forEach((d) => {
                const data = d.data();
                // Si falta el campo 'prioridad', lo marcamos para migración en Firestore
                if (data.prioridad === undefined) {
                    needsMigration = true;
                    migratedCount++; // ⭐ Contar la mutación
                    // Preparamos la actualización para darle una prioridad por defecto
                    batch.update(d.ref, {
                        prioridad: DEFAULT_PRIORITY,
                        updatedAt: serverTimestamp()
                    });
                }
            });

            // Si hay documentos sin prioridad, ejecutamos la migración automática
            if (needsMigration) {
                // ⭐ CORRECCIÓN TS2339: Usamos el contador manual en el console.log
                console.log(`Migrando ${migratedCount} documentos sin prioridad...`);
                await batch.commit();
                // Forzamos una recarga para leer los datos migrados
                return loadData(); 
            }

            // Construcción y Ordenación de la lista (después de asegurar que todos tienen prioridad)
            snap.forEach((d) => {
                const data = d.data();
                list.push({ 
                    id: d.id, 
                    prioridad: data.prioridad === undefined ? DEFAULT_PRIORITY : data.prioridad, 
                    ...data 
                } as Empleado);
            });

            // ⭐ Ordenamos la lista en el Frontend por prioridad, ya que Firestore necesita índice para el orden
            list.sort((a, b) => {
                if (a.prioridad < b.prioridad) return -1;
                if (a.prioridad > b.prioridad) return 1;
                return a.nombre.localeCompare(b.nombre);
            });

            setEmpleados(list);
            
        } catch (err) {
            console.error(err);
            setErrorMessage("Error al cargar empleados.");
        } finally {
            setLoading(false);
        }
    }, [uid]); 

    useEffect(() => {
        if (uid) loadData();
    }, [uid, loadData]);

    /* ============================================================
    HANDLERS Y CRUD
    ============================================================ */
    const resetForm = () => {
        setFormNombre("");
        setFormPorcentaje(0);
        setFormActivo(true);
        setSelectedEmpleado(null);
        setFormDni(""); 
        setFormPrioridad(DEFAULT_PRIORITY); 
        setErrorMessage(null);
    };

    const openModal = (empleado?: Empleado) => {
        if (empleado) {
            setIsEditing(true);
            setSelectedEmpleado(empleado);
            setFormNombre(empleado.nombre);
            setFormPorcentaje(empleado.porcentaje);
            setFormActivo(empleado.activo);
            setFormDni(empleado.dni); 
            setFormPrioridad(empleado.prioridad);
        } else {
            setIsEditing(false);
            resetForm();
            // Nueva prioridad: la prioridad más baja + 1
            const maxPriority = empleados.length > 0 
                ? Math.max(...empleados.map(e => e.prioridad)) 
                : 0;
            setFormPrioridad(maxPriority + 1);
        }
        setModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSaving) return; 

        if (!uid || !config || config.masterPassword !== DEFAULT_MASTER_PASSWORD) {
            setErrorMessage(`Debe configurar el Nombre de la Barbería en Configuración.`);
            return;
        }
        if (!formNombre.trim()) {
            setErrorMessage("El nombre es obligatorio.");
            return;
        }
        if (!formDni.trim() || formDni.trim().length < 6) {
            setErrorMessage("El DNI es obligatorio y debe tener al menos 6 dígitos.");
            return;
        }
        if (formPrioridad < 1) { 
            setErrorMessage("La prioridad debe ser un número positivo (1 o más).");
            return;
        }
        
        const dniToCheck = formDni.trim();
        if (empleados.some(emp => emp.dni === dniToCheck && emp.id !== selectedEmpleado?.id)) {
            setErrorMessage("El DNI ingresado ya está registrado por otro empleado.");
            return;
        }

        setErrorMessage(null);
        setIsSaving(true); 
        const barberSlug = slugify(config.barberName);
        
        try {
            await ensureOwnerDocumentExists(barberDb, uid);

            const newEmployeeName = formNombre.trim();
            const newEmployeeDni = formDni.trim();
            
            const baseData = {
                nombre: newEmployeeName,
                porcentaje: Number(formPorcentaje),
                activo: formActivo,
                dni: newEmployeeDni, 
                prioridad: Number(formPrioridad), 
                updatedAt: serverTimestamp(),
                role: "employee", 
            };

            if (isEditing && selectedEmpleado) {
                // --- 1. EDICIÓN (Solo Firestore) ---
                await updateDoc(doc(barberDb, `barber_users/${uid}/empleados/${selectedEmpleado.id}`), baseData);
            } else {
                // --- 2. CREACIÓN (Auth + Firestore) ---
                
                const { internalEmail, username } = generateEmployeeCredentials(uid, barberSlug, newEmployeeName);
                
                let empleadoId = "";
                
                const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
                const secondaryAuth = getAuth(secondaryApp);

                try {
                    await setPersistence(secondaryAuth, inMemoryPersistence);
                    const authCred = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, DEFAULT_MASTER_PASSWORD);
                    empleadoId = authCred.user.uid;
                    await signOut(secondaryAuth);
                } catch (authErr: any) {
                    console.error("Error Auth Secundaria:", authErr);
                    if (authErr.code === "auth/email-already-in-use") {
                        throw new Error("Ya existe un empleado con ese email interno. Intenta variar el nombre.");
                    }
                    throw authErr;
                } finally {
                    await deleteApp(secondaryApp);
                }

                if (empleadoId) {
                    await setDoc(doc(barberDb, `barber_users/${uid}/empleados/${empleadoId}`), {
                        ...baseData,
                        createdAt: serverTimestamp(),
                        authUid: empleadoId, 
                        internalEmail: internalEmail, 
                        username: username,
                    });
                }
            }

            setModalOpen(false);
            loadData(); 
        } catch (err: any) {
            console.error("Error general:", err);
            let message = "Error desconocido al guardar.";
            if (typeof err === 'object' && err.message) message = err.message;
            setErrorMessage(message);
        } finally {
            setIsSaving(false); 
        }
    };
    
    const handleDelete = async () => {
        if (!uid || !selectedEmpleado || isDeleting) return; 
        
        setIsDeleting(true); 
        
        try {
            await deleteDoc(doc(barberDb, `barber_users/${uid}/empleados/${selectedEmpleado.id}`));
            setDeleteConfirmOpen(false);
            setSelectedEmpleado(null);
            loadData();
        } catch (err) {
            console.error("Error al eliminar:", err);
            setErrorMessage("Error al eliminar empleado.");
        } finally {
            setIsDeleting(false); 
        }
    };


    /* ============================================================
    RENDER
    ============================================================ */
    const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
    const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
    const btnTertiary = "py-2.5 px-4 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 active:scale-[0.98] transition font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";


    return (
        <div className="space-y-6 animate-fadeIn m-2 pb-16">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col">
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                        <IconUser />
                        Gestión de Empleados
                    </h2>
                    <p className="text-sm text-slate-500">
                        {empleados.length} empleados registrados. La prioridad define el orden en las ventas.
                    </p>
                </div>

                <div className="flex gap-3">
                    {/* ⭐ NUEVO BOTÓN PARA ORDENAR */}
                    <button 
                        onClick={() => setReorderModalOpen(true)}
                        className={btnTertiary}
                        disabled={loading || !empleados.some(e => e.activo)}
                    >
                        <IconList />
                        Ordenar Empleados
                    </button>

                    <button 
                        onClick={() => openModal()}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                        <IconAdd />
                        Nuevo Empleado
                    </button>
                </div>
            </div>
            
            {errorMessage && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{errorMessage}</div>}

            {/* ADVERTENCIA CRÍTICA */}
            {!config?.barberName || config?.masterPassword !== DEFAULT_MASTER_PASSWORD ? (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <IconWarning />
                        <p className="text-sm text-orange-800">
                            Acceso Bloqueado: Debe ir a Configuración y definir el Nombre de su Negocio para poder crear cuentas de empleados.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/barber-manager/configuracion")}
                        className="mt-2 w-full py-2 bg-red-500 text-white border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-900 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                        Ir a Configuración &rarr;
                    </button>
                </div>
            ) : (
                /* TABLA DE EMPLEADOS */
                loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                        <p className="mt-2 text-sm text-slate-500">Cargando empleados...</p>
                    </div>
                ) : empleados.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <p className="text-slate-400 mb-2">No tienes empleados registrados aún.</p>
                        <button onClick={() => openModal()} className="text-sm text-slate-900 font-medium hover:underline cursor-pointer">
                            Crear el primero ahora
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Prioridad</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">DNI / Login</th> 
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Comisión</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {empleados.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                            <span className={`font-semibold ${emp.prioridad === DEFAULT_PRIORITY ? 'text-orange-500' : 'text-slate-900'}`}>
                                                {emp.prioridad === DEFAULT_PRIORITY ? 'N/A' : emp.prioridad}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{emp.nombre}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                                            <code className="bg-slate-100 px-1 rounded text-xs select-all">
                                                {emp.dni}
                                            </code>
                                        </td> 
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{emp.porcentaje}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                {emp.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button 
                                                onClick={() => openModal(emp)} 
                                                className="text-slate-600 hover:text-slate-900 mr-3 cursor-pointer"
                                                title="Editar"
                                            >
                                                <IconEdit />
                                            </button>
                                            <button 
                                                onClick={() => { setSelectedEmpleado(emp); setDeleteConfirmOpen(true); }}
                                                className="text-red-400 hover:text-red-700 cursor-pointer"
                                                title="Eliminar"
                                            >
                                                <IconTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* MODAL CREAR / EDITAR */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            {isEditing ? "Editar Empleado" : "Nuevo Empleado"}
                        </h3>
                        
                        <form onSubmit={handleSave} className="space-y-4">
                            {/* Nombre */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre Completo</label>
                                <input 
                                    type="text" 
                                    value={formNombre} 
                                    onChange={(e) => setFormNombre(e.target.value)} 
                                    className={inputClass}
                                    placeholder="Ej. Lean Martinez"
                                    required
                                    disabled={isSaving}
                                />
                            </div>

                            {/* DNI */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Documento de Identidad (DNI) - Login</label>
                                <input 
                                    type="text" 
                                    value={formDni} 
                                    onChange={(e) => setFormDni(e.target.value)} 
                                    className={inputClass}
                                    placeholder="Ej. 34567890"
                                    required
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Credenciales Solo para Referencia */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <p className="text-xs font-medium text-slate-600">Contraseña de Acceso</p>
                                <code className="font-mono text-sm text-slate-800 break-words block mt-1 font-bold">
                                    {DEFAULT_MASTER_PASSWORD}
                                </code>
                                <p className="text-xs text-slate-500 mt-2">
                                    El empleado iniciará sesión usando su DNI y esta contraseña.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Porcentaje de Comisión */}
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Porcentaje de Comisión (%)</label>
                                    <input 
                                        type="number" 
                                        value={formPorcentaje} 
                                        onChange={(e) => setFormPorcentaje(Number(e.target.value))} 
                                        className={inputClass}
                                        min="0"
                                        max="100"
                                        disabled={isSaving}
                                    />
                                </div>
                                {/* ⭐ Prioridad */}
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Prioridad (1 es el primero)</label>
                                    <input 
                                        type="number" 
                                        value={formPrioridad} 
                                        onChange={(e) => setFormPrioridad(Number(e.target.value))} 
                                        className={inputClass}
                                        min="1"
                                        required
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                            
                            {/* Estado */}
                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    id="activo-check"
                                    checked={formActivo}
                                    onChange={(e) => setFormActivo(e.target.checked)} 
                                    className="h-4 w-4 text-slate-800 border-gray-300 rounded cursor-pointer"
                                    disabled={isSaving}
                                />
                                <label htmlFor="activo-check" className="ml-2 text-sm font-medium text-slate-700 cursor-pointer">Empleado Activo</label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className={btnSecondary}
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className={btnPrimary}
                                    disabled={isSaving} 
                                >
                                    {isSaving ? (
                                        <>
                                            <IconSpinner />
                                            Guardando...
                                        </>
                                    ) : (isEditing ? "Guardar Cambios" : "Crear Empleado")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL ELIMINAR */}
            {deleteConfirmOpen && selectedEmpleado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fadeIn text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <IconTrash />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">¿Eliminar empleado?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">
                            Estás a punto de eliminar a <span className="font-semibold text-slate-700">{selectedEmpleado.nombre}</span>. **Advertencia: La cuenta de acceso de Firebase Auth NO se elimina automáticamente.**
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirmOpen(false)}
                                className={btnSecondary}
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDelete}
                                className={`w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm cursor-pointer flex items-center justify-center gap-2`}
                                disabled={isDeleting} 
                            >
                                {isDeleting ? (
                                    <>
                                        <IconSpinner />
                                        Eliminando...
                                    </>
                                ) : "Sí, eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ⭐ MODAL DE REORDENACIÓN DE EMPLEADOS */}
            {reorderModalOpen && (
                <ReorderEmpleadosModal
                    employees={empleados}
                    uid={uid!}
                    onClose={() => setReorderModalOpen(false)}
                    onSaveSuccess={loadData}
                    setErrorMessage={setErrorMessage}
                    isSaving={isSaving}
                    setIsSaving={setIsSaving}
                    btnPrimary={btnPrimary}
                    btnSecondary={btnSecondary}
                />
            )}

        </div>
    );
};