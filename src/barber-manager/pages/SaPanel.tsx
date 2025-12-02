// // src/barber-manager/pages/SaPanel.tsx

// import React, { useEffect, useState, useCallback } from "react";
// import { useNavigate } from "react-router-dom";
// // Mantenemos los imports de Auth, pero ya no los usaremos para el guardián
// import { getAuth, onAuthStateChanged, User } from "firebase/auth";
// // Importamos Firestore y funciones necesarias
// import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";

// // Definiciones
// const SECONDS_IN_DAY = 24 * 60 * 60;

// // 🛑 Instancia de Firestore para consultas
// const db = getFirestore();

// interface Account {
//     uid: string;
//     email: string;
//     activo: boolean;
//     fechaVencimiento: Timestamp;
//     daysRemaining: number;
//     barberName?: string;
//     barberSlug?: string;
// }

// // ------------------------------------------------------------------
// // HELPERS
// // ------------------------------------------------------------------

// const calculateDaysRemaining = (vencimiento: Timestamp): number => {
//     const venceDate = vencimiento.toDate();
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     venceDate.setHours(0, 0, 0, 0);

//     const diffTime = venceDate.getTime() - today.getTime();
//     return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
// };

// // ------------------------------------------------------------------
// // COMPONENTE PRINCIPAL
// // ------------------------------------------------------------------

// export const SaPanel: React.FC = () => {
//     const navigate = useNavigate();
    
//     // Obtenemos el usuario solo para mostrar el email en la UI, no para restringir
//     const [currentUser, setCurrentUser] = useState<User | null>(null);

//     // ESTADOS DEL PANEL
//     const [accounts, setAccounts] = useState<Account[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState<string | null>(null);

//     // 1. Obtener el usuario actual (solo para display)
//     useEffect(() => {
//         const auth = getAuth();
//         const unsubscribe = onAuthStateChanged(auth, (user) => {
//             setCurrentUser(user); 
//         });
//         return () => unsubscribe();
//     }, []);


//     // ------------------------------------------------------------------
//     // 2. FUNCIÓN: FETCH DE CUENTAS (MUESTRA TODO)
//     // ------------------------------------------------------------------
//     const fetchAccounts = useCallback(async () => {
        
//         setLoading(true);
//         setError(null);
        
//         try {
//             // 🛑 CONSULTA SIN FILTRO: Trae TODOS los documentos de usuariosAuth (Gym + Barbería)
//             const snap = await getDocs(collection(db, 'usuariosAuth'));
            
//             if (snap.empty) {
//                 setError("No se encontraron cuentas en la colección 'usuariosAuth'.");
//             }

//             const fetchedAccounts: Account[] = snap.docs.map(doc => {
//                 const data = doc.data();
//                 // Verificamos si fechaVencimiento es un Timestamp antes de usar toDate()
//                 const vencimiento = data.fechaVencimiento instanceof Timestamp 
//                     ? data.fechaVencimiento 
//                     : Timestamp.fromDate(new Date()); // Fallback si el campo falta o es incorrecto
                
//                 return {
//                     uid: doc.id,
//                     email: data.email || 'N/A',
//                     activo: data.activo || false,
//                     fechaVencimiento: vencimiento,
//                     daysRemaining: calculateDaysRemaining(vencimiento)
//                 };
//             });
            
//             setAccounts(fetchedAccounts);
//         } catch (e) {
//             console.error("Error fetching accounts (Acceso Público):", e);
//             setError("Error al cargar las cuentas. Asegúrate de que las reglas de Firestore permitan la lectura pública ('allow read: if true;').");
//         } finally {
//             setLoading(false);
//         }
//     }, []);

//     // Ejecutar fetch al montar
//     useEffect(() => {
//         fetchAccounts();
//     }, [fetchAccounts]);
    
//     // ------------------------------------------------------------------
//     // 3. MANEJO DE CAMBIO DE DÍAS (Público Total)
//     // ------------------------------------------------------------------

//     const handleDayChange = useCallback(async (uid: string, daysToAdd: number) => {
        
//         const accountToUpdate = accounts.find(a => a.uid === uid);
//         if (!accountToUpdate) return;
        
//         // 1. Calcular la nueva fecha de vencimiento
//         const currentVencimientoMs = accountToUpdate.fechaVencimiento.toMillis();
//         const newVencimientoMs = currentVencimientoMs + (daysToAdd * SECONDS_IN_DAY * 1000);
//         const newVencimientoDate = new Date(newVencimientoMs);
        
//         const newFechaVencimiento = Timestamp.fromDate(newVencimientoDate);
//         const newActivo = newVencimientoMs > Date.now();

//         // 2. Actualizar en Firestore
//         try {
//             const docRef = doc(db, 'usuariosAuth', uid);
//             await updateDoc(docRef, {
//                 fechaVencimiento: newFechaVencimiento,
//                 activo: newActivo,
//             });
            
//             // 3. Actualizar el estado local
//             setAccounts(prev => prev.map(a => 
//                 a.uid === uid ? { 
//                     ...a, 
//                     fechaVencimiento: newFechaVencimiento, 
//                     activo: newActivo,
//                     daysRemaining: calculateDaysRemaining(newFechaVencimiento)
//                 } : a
//             ));
            
//         } catch (e) {
//             console.error("Error updating subscription (Acceso Público):", e);
//             setError(`Error al actualizar ${accountToUpdate.email}. Asegúrate de que las reglas de Firestore permitan la escritura pública ('allow write: if true;').`);
//         }
//     }, [accounts]);


//     // ------------------------------------------------------------------
//     // 4. RENDERIZADO
//     // ------------------------------------------------------------------
    
//     if (loading) {
//         return <div className="p-8 text-center text-lg">Cargando cuentas de suscripción...</div>;
//     }
    
//     // --- RENDERIZADO DEL PANEL PRINCIPAL ---

//     return (
//         <div className="max-w-7xl mx-auto p-6 bg-white shadow-lg min-h-screen">
//             <h1 className="text-3xl font-bold text-gray-800 mb-6">🛠️ Panel de Depuración de Suscripciones (Público)</h1>
            
//             {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">{error}</div>}
            
//             <p className="mb-4 text-sm text-red-600 font-bold">
//                 ⚠️ ADVERTENCIA: Este panel está en modo **PÚBLICO TOTAL** para depuración.
//             </p>
//             <p className="mb-4 text-sm text-gray-600">
//                 Sesión actual: **{currentUser ? currentUser.email : 'NINGUNA (ANÓNIMO)'}**. Se están mostrando **TODAS** las cuentas de la colección `usuariosAuth` (Barbería y otras apps).
//             </p>

//             <div className="overflow-x-auto">
//                 <table className="min-w-full divide-y divide-gray-200">
//                     <thead className="bg-gray-50">
//                         <tr>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vence en</th>
//                             <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
//                         </tr>
//                     </thead>
//                     <tbody className="bg-white divide-y divide-gray-200">
//                         {accounts.map((account) => (
//                             <tr key={account.uid} className={account.daysRemaining <= 7 && account.daysRemaining >= 0 ? "bg-yellow-50" : account.daysRemaining < 0 ? "bg-red-50" : ""}>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
//                                     {account.email}
//                                 </td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm">
//                                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${account.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
//                                         {account.activo ? 'Activo' : 'Inactivo'}
//                                     </span>
//                                 </td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                                     <span className={account.daysRemaining <= 7 ? "font-bold text-red-600" : ""}>
//                                         {account.daysRemaining} días
//                                     </span> 
//                                     <br />
//                                     <span className="text-xs">({account.fechaVencimiento.toDate().toLocaleDateString()})</span>
//                                 </td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-center">
//                                     <button 
//                                         onClick={() => handleDayChange(account.uid, -30)} 
//                                         className="text-red-500 hover:text-red-700 px-2 py-1 text-xl font-bold"
//                                     >
//                                         -30
//                                     </button>
//                                     <button 
//                                         onClick={() => handleDayChange(account.uid, -7)} 
//                                         className="text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold"
//                                     >
//                                         -7
//                                     </button>
//                                     <button 
//                                         onClick={() => handleDayChange(account.uid, 7)} 
//                                         className="text-green-500 hover:text-green-700 px-2 py-1 text-lg font-bold"
//                                     >
//                                         +7
//                                     </button>
//                                     <button 
//                                         onClick={() => handleDayChange(account.uid, 30)} 
//                                         className="text-green-500 hover:text-green-700 px-2 py-1 text-xl font-bold"
//                                     >
//                                         +30
//                                     </button>
//                                 </td>
//                             </tr>
//                         ))}
//                     </tbody>
//                 </table>
//             </div>
//             <div className="mt-8 text-center">
//                 <button 
//                     onClick={fetchAccounts}
//                     className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
//                 >
//                     Recargar Cuentas
//                 </button>
//             </div>
//         </div>
//     );
// };