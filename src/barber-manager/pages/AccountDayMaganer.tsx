import React, { useState, useEffect, useCallback } from 'react';
// Importaciones de Firestore
import { barberDb } from '../services/firebaseBarber';
import { collection, query, getDocs, updateDoc, doc, Timestamp, serverTimestamp, writeBatch } from 'firebase/firestore'; 

// Importaciones de Autenticación (Simuladas en este ejemplo, se asume que un hook o contexto te da el email)
// Si usas Firebase Auth, deberías usar `import { getAuth } from 'firebase/auth';` y un hook como useAuthState.


// =================================================================
// 1. DEFINICIÓN DE TIPOS (INTERFACES)
// =================================================================

// Tipo para el Timestamp de Firestore cuando se deserializa
type FirestoreTimestamp = {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
};

// Tipo para un objeto que explícitamente tiene 'seconds'
type SecondsObject = { seconds: number };

// Tipo de fecha amplio que incluye Date, el tipo de Firestore y el objeto con seconds
type DateLike = Date | FirestoreTimestamp | SecondsObject | undefined | null;


// Interfaz para la información del usuario combinada (Auth + Firestore data)
interface UserPaymentInfo {
    uid: string;
    email: string;
    activo: boolean; 
    fechaVencimiento?: DateLike;
    lastPaymentDate?: DateLike; 
    lastPaymentStatus?: string;
    docId: string; 
}

// =================================================================
// 2. CONSTANTES Y UTILIDADES
// =================================================================

// 🛑 Email de la cuenta con acceso de administrador
const TARGET_EMAIL = "exentrait.company@gmail.com";

/**
 * Normaliza el valor de la fecha a un objeto Date (usando el método toDate si es un Timestamp).
 * * Corrección de TS2339: Se asegura que si se trata como un objeto con 'seconds', se cumplan las condiciones.
 */
const normalizeDate = (dateValue: DateLike): Date | null => {
    if (!dateValue) return null;
    
    // Si ya es un objeto Date
    if (dateValue instanceof Date) return dateValue;

    // Si tiene el método toDate (típico de Timestamp de Firestore)
    if (typeof dateValue === 'object' && 'toDate' in dateValue && typeof (dateValue as FirestoreTimestamp).toDate === 'function') {
        return (dateValue as FirestoreTimestamp).toDate(); 
    }
    
    // Si tiene la propiedad 'seconds' y es un número (caso de desestructuración del Timestamp)
    if (typeof dateValue === 'object' && 'seconds' in dateValue && typeof (dateValue as SecondsObject).seconds === 'number') {
        // Corrección del error TS: ahora TypeScript sabe que 'seconds' existe y es un número.
        return new Date((dateValue as SecondsObject).seconds * 1000); 
    }
    
    return null;
};

// =================================================================
// 3. SERVICIOS DE FIREBASE (¡IMPLEMENTACIÓN REAL!)
// =================================================================

/**
 * Consulta la colección usuariosAuth para obtener todos los dueños/clientes.
 */
export const listAuthUsersFromFirestore = async (): Promise<UserPaymentInfo[]> => {
    try {
        const usersRef = collection(barberDb, 'usuariosAuth');
        const q = query(usersRef); 
        
        const querySnapshot = await getDocs(q);
        
        const users: UserPaymentInfo[] = querySnapshot.docs
            .map(doc => {
                const data = doc.data();
                const baseDate = data.fechaVencimiento || data.lastPaymentDate; 

                return {
                    docId: doc.id,
                    uid: doc.id, 
                    email: data.email || 'N/A', 
                    activo: data.activo === true,
                    lastPaymentDate: baseDate,
                    fechaVencimiento: baseDate,
                    lastPaymentStatus: data.lastPaymentStatus || 'N/A',
                };
            })
            // Filtro de cuentas internas/servicio
            .filter(user => user.email !== 'N/A' && !user.email.includes('.internal') && !user.email.includes('gserviceaccount.com'));
        
        return users;
        
    } catch (error) {
        console.error("Error al obtener usuarios de Firestore:", error);
        throw new Error("Fallo en la consulta de Firestore. Revisa las reglas de seguridad o si el administrador está logueado.");
    }
};

/**
 * Actualiza la fecha de pago en Firestore.
 */
export const updatePaymentDaysInFirestore = async (uid: string, newDate: Date): Promise<void> => {
    try {
        const userDocRef = doc(barberDb, 'usuariosAuth', uid);
        
        await updateDoc(userDocRef, {
            lastPaymentDate: Timestamp.fromDate(newDate),
            fechaVencimiento: Timestamp.fromDate(newDate), 
            activo: newDate.getTime() > Date.now(), 
            lastPaymentStatus: 'approved (Manual)', 
            updatedAt: Timestamp.now(),
        });
        
    } catch (error) {
        console.error("Error al actualizar días en Firestore:", error);
        throw new Error("Fallo al actualizar Firestore. Revisa las reglas de seguridad y la conexión.");
    }
};


// =================================================================
// 4. LÓGICA DE MIGRACIÓN 100% CLIENTE
// =================================================================

/**
 * Lee la colección 'barber_users' y crea/actualiza documentos en 'usuariosAuth' si faltan.
 * Crea documentos marcados como VENCIDOS.
 */
const handleMassMigrationClientSide = async (existingAccounts: string[]): Promise<{ message: string }> => {
    
    const sourceCollectionRef = collection(barberDb, 'barber_users');
    
    // 1. Leer TODOS los documentos de barber_users (⚠️ PUEDE SER LENTO Y ESTAR BLOQUEADO POR REGLAS)
    const sourceSnapshot = await getDocs(query(sourceCollectionRef)); 

    let usersMigrated = 0;
    const batch = writeBatch(barberDb);
    
    const vencidoAyer = new Date(Date.now() - 24 * 60 * 60 * 1000); 

    // 2. Procesar documentos
    sourceSnapshot.forEach(docSnapshot => {
        const uid = docSnapshot.id; 
        const sourceData = docSnapshot.data();
        
        if (!existingAccounts.includes(uid)) {
            
            const targetDocRef = doc(barberDb, 'usuariosAuth', uid);
            const email = sourceData.email || `${uid}@barber-no-email.com`; 

            const initialData = {
                uid: uid,
                email: email.toLowerCase(),
                activo: false, 
                lastPaymentDate: null, 
                fechaVencimiento: Timestamp.fromDate(vencidoAyer), 
                creadoEn: serverTimestamp(),
                origen: "migration-client-side-vencido"
            };
            
            batch.set(targetDocRef, initialData, { merge: true });
            usersMigrated++;
        }
    });

    // 3. Ejecutar el batch de escritura
    if (usersMigrated > 0) {
        await batch.commit();
    }

    return { message: `Migración exitosa. ${usersMigrated} nuevos documentos creados en usuariosAuth y marcados como VENCIDOS.` };
}


// =================================================================
// 5. COMPONENTE DE LOGIN (Administrador)
// =================================================================

interface AdminLoginProps {
    onLogin: (email: string) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); // Contraseña no usada/simulada

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email === TARGET_EMAIL) {
            // En una aplicación real, aquí se llamaría a Firebase Auth
            // y se verificaría la contraseña. Para este ejercicio, solo verificamos el email.
            onLogin(email);
        } else {
            alert('Acceso denegado. Solo la cuenta de administrador puede ingresar.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
                <h2 className="text-2xl font-bold mb-6 text-indigo-700 text-center">🔐 Acceso de Administrador</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="email@dominio.com"
                        />
                    </div>
                    {/* El campo de contraseña es para simular un login real, aunque su valor no se use en este demo */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="********"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Ingresar
                    </button>
                </form>
            </div>
        </div>
    );
}

// =================================================================
// 6. COMPONENTE PRINCIPAL (TSX con Tailwind)
// =================================================================

const AccountDayManager: React.FC = () => {
    // 🛑 ESTADO DE LOGIN: Almacena el email del usuario "logueado"
    const [loggedEmail, setLoggedEmail] = useState<string | null>(null);
    
    const [accounts, setAccounts] = useState<UserPaymentInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isMigrating, setIsMigrating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Input de días por fila (usa el UID como clave)
    const [daysInputPerUser, setDaysInputPerUser] = useState<Record<string, number>>({});


    // --- Carga Inicial de Cuentas ---
    const loadAccounts = useCallback(async () => {
        if (!loggedEmail) return; // No cargar si no está logueado

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const allUsers = await listAuthUsersFromFirestore(); 
            setAccounts(allUsers);
        } catch (err) {
            console.error("Error al cargar cuentas:", err);
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [loggedEmail]);

    useEffect(() => {
        // Simular la verificación de autenticación al cargar el componente
        // En una app real, esto sería reemplazado por `onAuthStateChanged`
        // const auth = getAuth();
        // const unsubscribe = onAuthStateChanged(auth, (user) => {
        //     if (user && user.email === TARGET_EMAIL) {
        //         setLoggedEmail(user.email);
        //     } else {
        //         setLoggedEmail(null);
        //     }
        // });
        // return unsubscribe;
        
        // Carga de cuentas solo si ya está logueado
        if (loggedEmail === TARGET_EMAIL) {
            loadAccounts();
        } else {
            setIsLoading(false); // Detener el loading si no está logueado
        }
    }, [loggedEmail, loadAccounts]);

    // --- Lógica de Migración y Modificación (Mantenidas) ---
    // ... (El resto de la lógica de handleMassMigration y handleDirectModification es idéntica) ...
    
    const handleMassMigration = async () => {
        // 🚨 NOTA: window.confirm() debe ser reemplazado por un modal no bloqueante en prod.
        if (!window.confirm("ATENCIÓN: Esto creará documentos en usuariosAuth para TODAS las cuentas de barber_users que no los tengan. Esto marcará las cuentas como VENCIDAS (0 días) para forzar el pago/activación. ¿Deseas continuar?")) return;

        setIsMigrating(true);
        setError(null);
        setSuccessMessage(null);
        
        try {
            const existingUids = accounts.map(a => a.uid);
            const result = await handleMassMigrationClientSide(existingUids);
            
            setSuccessMessage(result.message);
            await loadAccounts(); 
        } catch (err: any) {
            console.error("Error durante la migración cliente-a-cliente:", err);
            setError(`Error de Migración: ${err.message}. Revisa las Reglas de Seguridad para permitir la lectura de 'barber_users'.`);
        } finally {
            setIsMigrating(false);
        }
    }


    // 🛑 LÓGICA DE MODIFICACIÓN DIRECTA
    const handleDirectModification = async (uid: string, days: number): Promise<void> => {
        
        // No permite modificar si el input de días es 0 (solo aplica para el botón "Aplicar")
        if (days === 0) return;

        const account = accounts.find(acc => acc.uid === uid);
        const baseDate = normalizeDate(account?.fechaVencimiento || account?.lastPaymentDate); 
        
        if (!account || !baseDate) {
            setError("Error: No se encontró la cuenta o la fecha de pago base válida.");
            return;
        }

        // 1. Calcular la nueva fecha
        const newDate = new Date(baseDate.getTime());
        newDate.setTime(newDate.getTime() + days * 24 * 60 * 60 * 1000); 
        
        const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        const baseDateStr = baseDate.toLocaleDateString('es-ES', dateOptions);
        const newDateStr = newDate.toLocaleDateString('es-ES', dateOptions);

        // 🚨 NOTA: window.confirm() DEBE ser reemplazado
        const confirmation = window.confirm(
            `Confirmar modificación para ${account.email}:\n\n` +
            `Días a modificar: ${days > 0 ? '+' : ''}${days}\n` +
            `Fecha Base: ${baseDateStr}\n` +
            `NUEVA Fecha de Vencimiento: ${newDateStr}\n\n`
        );

        if (!confirmation) return;
        
        // 2. Llamar a la función REAL de actualización
        setIsLoading(true);
        try {
            await updatePaymentDaysInFirestore(account.uid, newDate); 
            
            // 🚨 NOTA: window.alert() DEBE ser reemplazado
            alert(`✅ Días modificados con éxito (${days} días aplicados). Nueva fecha: ${newDateStr}.`);
            
            await loadAccounts(); 
            
        } catch (err) {
            console.error("Error al actualizar días:", err);
            // 🚨 NOTA: window.alert() DEBE ser reemplazado
            alert("❌ Error al guardar la modificación. Consulta la consola.");
        } finally {
            setIsLoading(false);
            setDaysInputPerUser(prev => ({ ...prev, [uid]: 0 })); // Limpiar el input local
        }
    };


    // --- Renderizado Condicional del Login ---
    if (loggedEmail !== TARGET_EMAIL) {
        return <AdminLogin onLogin={setLoggedEmail} />;
    }
    // Si la carga ocurre después del login:
    if (isLoading) {
        return <div className="p-6 bg-white rounded-xl shadow-lg"><p className="text-center text-gray-500 font-semibold">Cargando cuentas de dueños...</p></div>;
    }

    // Componente de Fila para Mobile (separado para mejor legibilidad)
    const AccountCard = ({ account }: { account: UserPaymentInfo }) => {
        const isTargetAccount = account.email === TARGET_EMAIL;
        const lastPaymentDateStr = normalizeDate(account.fechaVencimiento)?.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';
        
        const currentDaysInput = daysInputPerUser[account.uid] || 0;
        const currentDaysInputValue = currentDaysInput === 0 ? '' : currentDaysInput;
        const isInputValid = currentDaysInput !== 0;
        
        const statusClass = account.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

        return (
            <div className={`p-4 mb-3 border rounded-lg shadow-md ${isTargetAccount ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
                
                {/* 1. INFORMACIÓN PRINCIPAL */}
                <div className="flex justify-between items-start mb-3 border-b pb-2">
                    <div>
                        <p className="font-bold text-sm text-gray-900 break-all">
                            {account.email}
                            {isTargetAccount && <span className="text-blue-600 ml-2 text-xs font-bold">(ADMIN)</span>}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            Vence: {lastPaymentDateStr}
                        </p>
                    </div>
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
                        {account.activo ? 'ACTIVO' : 'VENCIDO'}
                    </span>
                </div>

                {/* 2. CONTROL DE DÍAS */}
                <div className="flex flex-col space-y-3">
                    <p className="text-xs font-semibold text-gray-700">Ajuste Rápido (±1 día)</p>
                    <div className="flex justify-between space-x-2">
                            {/* BOTÓN RESTAR 1 DÍA */}
                        <button 
                            onClick={() => handleDirectModification(account.uid, -1)} 
                            className="flex-1 py-2 px-3 text-sm rounded-lg font-semibold text-white transition shadow-sm bg-red-600 hover:bg-red-700">
                            -1 DÍA
                        </button>
                        
                        {/* BOTÓN SUMAR 1 DÍA */}
                        <button 
                            onClick={() => handleDirectModification(account.uid, 1)} 
                            className="flex-1 py-2 px-3 text-sm rounded-lg font-semibold text-white transition shadow-sm bg-green-600 hover:bg-green-700">
                            +1 DÍA
                        </button>
                    </div>

                    <p className="text-xs font-semibold text-gray-700 pt-2 border-t">Ajuste Personalizado</p>
                    <div className="flex items-center space-x-2">
                        {/* INPUT DE DÍAS */}
                        <input
                            type="number"
                            value={currentDaysInputValue}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setDaysInputPerUser(prev => ({ ...prev, [account.uid]: val }));
                            }}
                            min="-365"
                            max="365"
                            className="w-20 text-center border border-gray-300 rounded-md py-1 text-sm font-medium"
                            placeholder="Días"
                        />
                        
                        {/* BOTÓN APLICAR DÍAS */}
                        <button 
                            onClick={() => handleDirectModification(account.uid, currentDaysInput)} 
                            disabled={!isInputValid}
                            className={`flex-1 py-1 px-3 rounded-lg font-semibold text-white transition shadow-lg text-sm 
                                    ${isInputValid ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 disabled:cursor-not-allowed'}`}>
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-full">
            <h3 className="text-xl sm:text-2xl font-extrabold mb-4 text-indigo-700 border-b-2 border-indigo-100 pb-3">
                💰 Control Manual de Vencimientos
                {loggedEmail && <button onClick={() => setLoggedEmail(null)} className="ml-4 text-xs font-medium text-red-500 hover:text-red-700"> [Cerrar Sesión] </button>}
            </h3>
            
            {/* Mensajes de Estado */}
            <div className="space-y-3 mb-6">
                {error && <p className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md font-bold" dangerouslySetInnerHTML={{__html: error}}></p>}
                {successMessage && <p className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg shadow-md font-bold">{successMessage}</p>}
                
                {/* Botón de Migración Masiva CLIENTE */}
                <button
                    onClick={handleMassMigration}
                    disabled={isMigrating}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-semibold text-white transition shadow-lg text-sm
                                 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isMigrating ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Leyendo barber_users y Migrando...
                        </>
                    ) : (
                        <span>🔄 Ejecutar Migración Masiva (CLIENTE - 0 días)</span>
                    )}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                    * **MODO DE EMERGENCIA:** Lee `barber_users` y crea documentos **`usuariosAuth`** faltantes, marcándolos como **VENCIDOS**.
                </p>
            </div>
            
            {/* 🛑 VISTA MOBILE: Tarjetas (visible solo en pantallas pequeñas) */}
            <div className="sm:hidden">
                {accounts.map(account => (
                    <AccountCard key={account.uid} account={account} />
                ))}
            </div>

            {/* 🛑 VISTA DESKTOP: Tabla (oculta en pantallas pequeñas) */}
            <div className="hidden sm:block overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-indigo-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-5/12">Email / Identificador</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-2/12">Fecha Vencimiento</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-1/12">Estado</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider w-4/12">Control de Días</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {accounts.map(account => {
                            const isTargetAccount = account.email === TARGET_EMAIL;
                            const lastPaymentDateStr = normalizeDate(account.fechaVencimiento)?.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';
                            
                            const currentDaysInput = daysInputPerUser[account.uid] || 0;
                            const currentDaysInputValue = currentDaysInput === 0 ? '' : currentDaysInput;
                            const isInputValid = currentDaysInput !== 0;

                            return (
                                <tr key={account.uid} className={isTargetAccount ? 'bg-yellow-50 hover:bg-yellow-100 transition' : 'hover:bg-gray-50'}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                        {account.email} 
                                        {isTargetAccount && <span className="text-blue-600 ml-2 text-xs font-bold">(ADMIN)</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lastPaymentDateStr}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${account.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {account.activo ? 'ACTIVO' : 'VENCIDO'}
                                        </span>
                                    </td>
                                    {/* CELDAS DE ACCIÓN MODIFICADAS (Input por fila) */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            
                                            {/* BOTÓN RESTAR 1 DÍA */}
                                            <button 
                                                onClick={() => handleDirectModification(account.uid, -1)} 
                                                className="py-1 px-2 text-sm rounded-lg font-semibold text-white transition shadow-sm bg-red-600 hover:bg-red-700">
                                                -1
                                            </button>
                                            
                                            {/* BOTÓN SUMAR 1 DÍA */}
                                            <button 
                                                onClick={() => handleDirectModification(account.uid, 1)} 
                                                className="py-1 px-2 text-sm rounded-lg font-semibold text-white transition shadow-sm bg-green-600 hover:bg-green-700">
                                                +1
                                            </button>
                                            
                                            {/* INPUT DE DÍAS */}
                                            <input
                                                type="number"
                                                value={currentDaysInputValue}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setDaysInputPerUser(prev => ({ ...prev, [account.uid]: val }));
                                                }}
                                                min="-365"
                                                max="365"
                                                className="w-16 text-center border border-gray-300 rounded-md py-1 text-sm font-medium"
                                                placeholder="Días"
                                            />
                                            
                                            {/* BOTÓN APLICAR DÍAS (Suma/Resta el valor del input) */}
                                            <button 
                                                onClick={() => handleDirectModification(account.uid, currentDaysInput)} 
                                                disabled={!isInputValid}
                                                className={`py-1 px-3 rounded-lg font-semibold text-white transition shadow-lg text-sm 
                                                                ${isInputValid ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 disabled:cursor-not-allowed'}`}>
                                                Aplicar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <p className="mt-4 text-xs text-gray-500">
                * Esta lista solo muestra las cuentas que tienen un documento en la colección **`usuariosAuth`**.
            </p>
        </div>
    );
};

export default AccountDayManager;