// src/barber-manager/pages/Configuracion.tsx
import React, { useEffect, useState, useCallback } from "react";
import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    query, 
    getDocs, 
    orderBy, 
    serverTimestamp, 
    updateDoc,
    Firestore, 
    // CORRECCIÓN 1: Importar FieldValue y Timestamp
    FieldValue,
    Timestamp,
} from "firebase/firestore";
import {
    createUserWithEmailAndPassword 
} from "firebase/auth";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// ==========================================================
// CONSTANTE GLOBAL: Contraseña Maestra Fija (Admin1234)
// ==========================================================
const DEFAULT_MASTER_PASSWORD = "Admin1234";

// Tipados (Simplificados)
interface Empleado {
    id: string;
    nombre: string;
    porcentaje: number;
    dni: string; 
    activo: boolean; 
    authUid?: string; // Agregamos el campo Auth UID
    internalEmail?: string;
    username?: string;
}

interface BarberConfig {
    barberName: string;
    masterPassword: typeof DEFAULT_MASTER_PASSWORD; // Tipo fijo
    ownerUid: string;
    barberSlug: string; // CRÍTICO: Nuevo campo
    // CORRECCIÓN 2: Permitir FieldValue para serverTimestamp()
    updatedAt?: Timestamp | FieldValue; 
    createdAt?: Timestamp | FieldValue;
}

/* ============================================================
    ICONOS SVG & HELPERS
============================================================ */

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
    // Usamos el DNI del empleado como identificador principal en el login si es posible,
    // pero el email interno es necesario para Firebase Auth.
    const internalEmail = `${username}@${ownerUid}.internal`; 
    return { username, internalEmail };
};

const IconSettings = () => (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.526.323.864.555 1.066 1.066z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const IconSpinner = () => (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
);

/**
 * Función CRÍTICA para asegurar que el documento padre del Dueño exista.
 */
const ensureOwnerDocumentExists = async (db: Firestore, uid: string) => {
    const ownerDocRef = doc(db, `barber_users/${uid}`);
    const ownerDocSnap = await getDoc(ownerDocRef);
    if (!ownerDocSnap.exists()) {
        await setDoc(ownerDocRef, { 
            role: 'owner',
            createdAt: serverTimestamp(), // Ahora es válido
        }, { merge: true });
    }
}


/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Configuracion: React.FC = () => {
    const owner = barberAuth.currentUser;
    const uid = owner?.uid;

    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<BarberConfig | null>(null);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);

    // ⭐ ESTADO DE BLOQUEO DE BOTÓN
    const [isSynchronizing, setIsSynchronizing] = useState(false);

    // Estados del formulario
    const [barberNameInput, setBarberNameInput] = useState("");
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    /* =========================================================
    CARGA DE DATOS INICIAL
    ========================================================= */
    const loadData = useCallback(async () => {
        if (!uid) return;
        setLoading(true);
        setErrorMessage(null);

        try {
            // Aseguramos que el documento del dueño exista (para evitar errores de Firestore)
            await ensureOwnerDocumentExists(barberDb, uid);

            const configRef = doc(barberDb, `barber_config/${uid}`);
            const configSnap = await getDoc(configRef);
            const defaultName = "Mi Nueva Barbería";
            const defaultSlug = slugify(defaultName);


            if (configSnap.exists()) {
                const data = configSnap.data() as BarberConfig;
                setConfig(data);
                setBarberNameInput(data.barberName || "");
                // Asegurar que el slug se establece, si falta, usar el default
                if (!data.barberSlug) {
                    await setDoc(configRef, { barberSlug: slugify(data.barberName) }, { merge: true });
                }
            } else {
                const defaultConfig: BarberConfig = {
                    barberName: defaultName,
                    masterPassword: DEFAULT_MASTER_PASSWORD,
                    ownerUid: uid,
                    barberSlug: defaultSlug, // CRÍTICO: Establecer el slug por defecto
                };
                setConfig(defaultConfig);
                setBarberNameInput(defaultName);
                // Guardar la configuración inicial en la base de datos
                await setDoc(configRef, { ...defaultConfig, createdAt: serverTimestamp() }, { merge: true });
            }

            const empSnap = await getDocs(query(collection(barberDb, `barber_users/${uid}/empleados`), orderBy("nombre", "asc")));
            const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Empleado));
            setEmpleados(empList);
            
        } catch (error) {
            console.error("Error al cargar configuración:", error);
            setErrorMessage("Error al cargar la configuración. Intente de nuevo."); 
        } finally {
            setLoading(false);
        }
    }, [uid]);

    useEffect(() => {
        if (uid) loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid]);

    /* =========================================================
    GUARDAR CONFIGURACIÓN Y SINCRONIZAR CUENTAS DE EMPLEADOS
    ========================================================= */
    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        
        setErrorMessage(null); 
        setStatusMessage(null);
        
        if (!uid || !barberNameInput.trim()) {
            setErrorMessage("El nombre de la barbería es obligatorio.");
            return;
        }
        
        setIsSynchronizing(true); // ⭐ BLOQUEA EL BOTÓN
        
        try {
            const newBarberName = barberNameInput.trim();
            const barberSlug = slugify(newBarberName); // Generar el nuevo slug

            // 1. Guardar la configuración en Firestore con la contraseña fija y el SLUG
            const newConfig: Partial<BarberConfig> = {
                barberName: newBarberName,
                masterPassword: DEFAULT_MASTER_PASSWORD, 
                ownerUid: uid,
                barberSlug: barberSlug, // CRÍTICO: Guardar el Slug
                updatedAt: serverTimestamp(), 
            };
            await setDoc(doc(barberDb, `barber_config/${uid}`), newConfig, { merge: true });
            
            // Sincronización del estado local
            setConfig(prev => {
                const updatedConfig = { 
                    ...(prev as BarberConfig), 
                    ...newConfig, 
                    barberSlug,
                };
                // Forzamos a que updatedAt sea el tipo del objeto actual para que no falle el merge de tipos
                delete updatedConfig.updatedAt; 
                return updatedConfig as BarberConfig;
            });


            // 2. Sincronizar (crear Auth si falta) y actualizar datos de empleados en Firestore
            let employeesUpdatedCount = 0;
            const updates: Promise<any>[] = [];

            for (const empleado of empleados) {
                // Regeneramos credenciales con el NUEVO SLUG
                const { internalEmail, username } = generateEmployeeCredentials(uid, barberSlug, empleado.nombre);
                
                // Si falta el Auth UID, intentamos crearlo y sincronizar
                if (!empleado.authUid) {
                    try {
                        const authCred = await createUserWithEmailAndPassword(barberAuth, internalEmail, DEFAULT_MASTER_PASSWORD);
                        const empleadoId = authCred.user.uid;

                        updates.push(
                            updateDoc(doc(barberDb, `barber_users/${uid}/empleados/${empleado.id}`), {
                                authUid: empleadoId,
                                internalEmail: internalEmail,
                                username: username,
                                updatedAt: serverTimestamp(),
                            })
                        );
                        employeesUpdatedCount++;

                    } catch (authError: any) {
                        if (authError.code === 'auth/email-already-in-use' || authError.code === 'auth/email-already-exists') {
                            // Si el Auth ya existe, solo sincronizamos los campos en Firestore
                            updates.push(
                                updateDoc(doc(barberDb, `barber_users/${uid}/empleados/${empleado.id}`), {
                                    internalEmail: internalEmail,
                                    username: username,
                                    updatedAt: serverTimestamp(),
                                })
                            );
                            employeesUpdatedCount++;
                        } else {
                            console.warn(`Error al crear cuenta para ${empleado.nombre}:`, authError);
                            setErrorMessage(`Error crítico al crear cuenta para ${empleado.nombre}. Revise la consola.`);
                        }
                    }
                } else {
                    // Sincronizar datos de Firestore si el nombre de la barbería cambió
                    updates.push(
                        updateDoc(doc(barberDb, `barber_users/${uid}/empleados/${empleado.id}`), {
                            internalEmail: internalEmail,
                            username: username,
                            updatedAt: serverTimestamp(),
                        })
                    );
                    employeesUpdatedCount++;
                }
            }
            
            await Promise.all(updates); 

            setStatusMessage(`Configuración guardada. ${employeesUpdatedCount} cuentas de empleados sincronizadas. El Slug de la Barbería es "${barberSlug}".`);
            
            loadData(); 
            
        } catch (error) {
            console.error("Error al guardar configuración:", error);
            setErrorMessage("Error al guardar la configuración o al sincronizar usuarios. Vuelva a intentar.");
        } finally {
            setIsSynchronizing(false); // ⭐ DESBLOQUEA EL BOTÓN
        }
    };


    /* =========================================================
    RENDER HELPERS
    ========================================================= */

    const getBarberSlug = config?.barberSlug || slugify(barberNameInput || 'pending'); // Usamos el nuevo campo


    
    // Estilos Comunes
    const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

    /* =========================================================
    RENDER PRINCIPAL
    ========================================================= */
    return (
        <div className="space-y-8 animate-fadeIn m-2 max-w-4xl">
            
            {/* HEADER */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <IconSettings />
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Configuración de Barbería</h2>
                    <p className="text-sm text-slate-500">
                        Define el nombre del negocio y sincroniza la contraseña de acceso para empleados.
                    </p>
                </div>
            </div>
            
            <hr />

            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                    <p className="mt-2 text-sm text-slate-500">Cargando datos...</p>
                </div>
            ) : (
                <form onSubmit={handleSaveConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* COLUMNA 1 & 2: FORMULARIO */}
                    <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-2xl shadow-md border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900">Configuración del Negocio</h3>

                        {/* Nombre de la Barbería */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre del Negocio (Define el prefijo del usuario)</label>
                            <input 
                                type="text" 
                                value={barberNameInput} 
                                onChange={(e) => setBarberNameInput(e.target.value)} 
                                className={inputClass}
                                placeholder="Ej. Mi Negocio 123"
                                disabled={isSynchronizing} // ⭐ Bloquea la entrada
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Slug único generado: <code className="font-mono text-slate-700">{slugify(barberNameInput || "ejemplo")}</code>
                            </p>
                        </div>
                        
                        {/* SLUG DE ACCESO (NUEVO) */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <label className="text-xs font-medium text-slate-600 mb-1 block">IDENTIFICADOR DE LA BARBERÍA (Para el Login del Empleado)</label>
                            <code className="text-base font-bold text-slate-800 select-all">
                                {getBarberSlug}
                            </code>
                            <p className="mt-1 text-xs text-slate-500">
                                Los empleados necesitan este Slug + su DNI + la Contraseña Maestra para iniciar sesión.
                            </p>
                        </div>

                        {/* Contraseña Maestra (Mostrada como texto fijo) */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Contraseña Maestra para Empleados</label>
                            <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                                <code className="text-base font-bold text-slate-800 select-all">
                                    {DEFAULT_MASTER_PASSWORD}
                                </code>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                Esta contraseña es fija (Admin1234) y se usa para el inicio de sesión de todos los empleados.
                            </p>
                        </div>
                        
                        {/* Mensajes */}
                        {errorMessage && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{errorMessage}</div>}
                        {statusMessage && <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-200" dangerouslySetInnerHTML={{__html: statusMessage}}></div>}

                        {/* Botón de Guardar */}
                        <button 
                            type="submit" 
                            className={`${btnPrimary} flex items-center justify-center gap-2`}
                            disabled={isSynchronizing} // ⭐ Deshabilita durante la operación
                        >
                            {isSynchronizing ? (
                                <>
                                    <IconSpinner />
                                    Guardando y Sincronizando...
                                </>
                            ) : "Guardar Configuración y Sincronizar Usuarios"}
                        </button>
                    </div>
                </form>
            )}

        </div>
    );
};