// import React, { useEffect, useRef, useState, useCallback} from "react";
// import { useNavigate } from "react-router-dom";
// // CORRECCIÓN 1: Se usa 'type User' para evitar TS1484 cuando 'verbatimModuleSyntax' está habilitado.
// import { signOut, getAuth, type User } from "firebase/auth"; 
// import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore";
// // ⚠️ CORRECCIÓN 2: Se mantiene el path, pero debes verificar que este archivo exista en tu estructura.
// // import { useAuth } from '../services/AuthContext'; 

// // --------------------------------------------------------------------
// // CONFIGURACIÓN Y UTILIDADES (Renombradas con _ si no se usan)
// // --------------------------------------------------------------------
// const _API_BASE = "https://exentrait.com/api"; 
// const _PRECIO_TEST = 50;
// const COLL = "usuariosAuth";
// // TS6133 FIX: Renombrado a _DASHBOARD_PATH
// const _DASHBOARD_PATH = "/barber-manager/dashboard"; 

// const auth = getAuth();
// const db = getFirestore();

// interface BarberUserData {
//     activo?: boolean;
//     fechaVencimiento?: Timestamp | Date | string | null;
// }

// // --------------------------------------------------------------------
// // HELPERS (Renombradas con _ si no se usan)
// // --------------------------------------------------------------------

// const calculateDaysRemaining = (data: BarberUserData): number | null => {
//     if (!data || !data.fechaVencimiento) return null;
    
//     let venceDate: Date;
//     if (data.fechaVencimiento instanceof Timestamp) {
//         venceDate = data.fechaVencimiento.toDate();
//     } else if (data.fechaVencimiento instanceof Date) {
//         venceDate = data.fechaVencimiento;
//     } else {
//         venceDate = new Date(data.fechaVencimiento as string);
//     }

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     venceDate.setHours(0, 0, 0, 0);

//     const diffTime = venceDate.getTime() - today.getTime();
//     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
//     return diffDays;
// };

// // TS6133 FIX: Renombrado a _openExternalSystem
// const _openExternalSystem = (url: string) => {
//     window.open(url, "_blank", "noopener,noreferrer");
// };

// // --- Definiciones de Íconos ---

// // const IconDashboard = () => (
// //     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
// //         <rect x="3" y="3" width="8" height="8" rx="2" className="fill-slate-200" />
// //     </svg>
// // );

// // // TS6133 FIX: Renombrado a _IconHome ya que no se usa en el renderizado final
// // const _IconHome = () => (
// //     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //         <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
// //     </svg>
// // );
// // // TS6133 FIX: Renombrado a _IconLogout ya que no se usa en el renderizado final
// // const _IconLogout = () => (
// //     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
// //         <rect x="4" y="4" width="9" height="16" rx="2" className="fill-red-200/60" />
// //     </svg>
// // );
// // const IconSettings = () => (
// //     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
// //         <circle cx="12" cy="12" r="3" />
// //     </svg>
// // );


// // --------------------------------------------------------------------
// // COMPONENTE PRINCIPAL (BarberHeader)
// // --------------------------------------------------------------------

// export const BarberHeader: React.FC = () => {
//     const navigate = useNavigate();
//     // const location = useLocation();
    
//     // 🛑 USAMOS CONTEXTO PARA AUTENTICACIÓN Y ROL 🛑
//     const { user, loading, isOwner } = useAuth(); 
    
//     // CORRECCIÓN CRÍTICA: Se añade el estado de menú que faltaba (TS2304)
//     const [menuOpen, setMenuOpen] = useState(false);
    
//     // --- ESTADOS DE LA SUSCRIPCIÓN ---
//     const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
//     const [isLoadingData, setIsLoadingData] = useState(true); 
//     const [showPayModal, setShowPayModal] = useState(false);
//     // TS6133 FIX: Renombrado a _payMessage si no se usa en el renderizado
//     const [payMessage, setPayMessage] = useState<string | null>(null); 
//     const [payLink, setPayLink] = useState<string | null>(null);
//     const payCheckIntervalRef = useRef<number | null>(null); 

//     const today = new Date();
//     // TS6133 FIX: Renombrado a _formattedDate
//     const _formattedDate = today.toLocaleDateString("es-AR"); 
    
//     // --- LÓGICA DE GESTIÓN DE SUSCRIPCIÓN ---
    
//     const stopPayAutoChecker = useCallback(() => {
//         if (payCheckIntervalRef.current) {
//             // Aseguramos que es un número para clearInterval
//             clearInterval(payCheckIntervalRef.current); 
//             payCheckIntervalRef.current = null;
//         }
//     }, []);

//     const fetchStatus = useCallback(async (currentOwner: User): Promise<number | null> => {
//         if (!isOwner) return null;

//         try {
//             const docRef = doc(db, COLL, currentOwner.uid);
//             const snap = await getDoc(docRef);
//             const data = snap.data() as BarberUserData;

//             const remaining = calculateDaysRemaining(data);
//             setDaysRemaining(remaining);
//             setIsLoadingData(false); 
//             return remaining;

//         } catch (e) {
//             console.error("Error fetching subscription status:", e);
//             setDaysRemaining(null); 
//             setIsLoadingData(false);
//             return null; 
//         }
//     }, [isOwner]); 


//     // TS6133 FIX: El parámetro 'uid' ahora es _uid ya que no se usa directamente en el cuerpo
//     const startPayAutoChecker = useCallback((_uid: string) => {
//         stopPayAutoChecker();

//         payCheckIntervalRef.current = setInterval(async () => {
//             const currentUser = auth.currentUser;
//             if (currentUser) {
//                 const remaining = await fetchStatus(currentUser); 
                
//                 if (remaining !== null) {
//                     setDaysRemaining(remaining); 

//                     if (remaining > 0) {
//                         console.log("Pago detectado automáticamente.");
//                         stopPayAutoChecker();
//                         setShowPayModal(false);
//                     }
//                 }
//             }
//         }, 3000) as unknown as number;
//     }, [fetchStatus, stopPayAutoChecker]);
    
//     // --- HOOK DE INICIALIZACIÓN DE DATOS (NO DE AUTH) ---
//     useEffect(() => {
//         if (user && isOwner) {
//             fetchStatus(user);
//         } else if (!user && !loading) {
//             // Si no hay usuario y ya no estamos cargando (login fallido), detenemos la carga de datos
//             setIsLoadingData(false);
//             setDaysRemaining(null);
//         }
        
//         return () => {
//             // Limpia el intervalo al desmontar
//             stopPayAutoChecker();
//         };
//     }, [user, isOwner, loading, fetchStatus, stopPayAutoChecker]);
    
    
//     // --- LÓGICA DE PAGO Y CERRAR MODAL ---

//     const handlePay = useCallback(async () => {
//         if (!user || !user.email) return;

//         setPayMessage("Preparando el checkout...");
//         setPayLink(null);
//         setShowPayModal(true);
//         startPayAutoChecker(user.uid);

//         try {
//             const res = await fetch(`${_API_BASE}/create-preference-Barber.php`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     uid: user.uid,
//                     email: user.email,
//                     amount: _PRECIO_TEST, // Se usa la constante renombrada
//                     description: "Barber App - Renovación de servicio (Prueba)"
//                 })
//             });

//             const data = await res.json();

//             if (!res.ok || !data?.id || !data.init_point) {
//                 // Manejo de errores con mensaje específico
//                  throw new Error(data?.error || `Error API (${res.status}).`);
//             }

//             setPayLink(data.init_point);
//             setPayMessage(null); 

//         } catch (err: any) {
//             console.error(err);
//             setPayMessage(`Error al preparar el pago: ${err.message || 'Error de conexión.'}`);
//             stopPayAutoChecker();
//         }
//     }, [user, startPayAutoChecker]);


//     // handleCloseModal está usado en el renderizado del modal, no se renombra a _
//     const handleCloseModal = () => {
//         stopPayAutoChecker();
//         setShowPayModal(false);
//         // Si cierran el modal y la cuenta sigue inactiva/vencida, forzamos un logout 
//         if (daysRemaining !== null && daysRemaining < 1) {
//             signOut(auth);
//             navigate('/barber-manager/login');
//         }
//     };
    


//     // --- LÓGICA DE VISIBILIDAD DE SUSCRIPCIÓN ---
//     const isNearExpiration = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;
//     const isExpired = daysRemaining !== null && daysRemaining < 0;
    
//     const displayDays = isLoadingData
//         ? "Cargando..." 
//         : (daysRemaining === null ? "ERROR EN DATOS" : 
//             isExpired ? `VENCIDO (hace ${Math.abs(daysRemaining)} días)` : daysRemaining);
            
//     const headerClass = isNearExpiration || isExpired 
//         ? "bg-red-600 text-white p-2 flex items-center justify-between" 
//         : "bg-gray-700 text-white p-2 flex items-center justify-start"; 
        
//     const shouldRenderSubscriptionBar = user && isOwner;

//     return (
//         <header className="sticky top-0 z-40 shadow-md">
            
//             {/* 1. BARRA DE ESTADO DE LA SUSCRIPCIÓN */}
//             {shouldRenderSubscriptionBar && (
//                 <div className={headerClass}>
                    
//                     {/* Texto de días restantes */}
//                     <span className="text-sm font-medium">
//                         DÍAS RESTANTES DEL SERVICIO: {displayDays} {isExpired || isLoadingData || daysRemaining === null ? '' : 'días'}
//                     </span>

//                     {/* Botón de Pago (CARTEL) - SOLO APARECE si la condición es de alerta */}
//                     {(isNearExpiration || isExpired) && (
//                         <button 
//                             onClick={handlePay}
//                             disabled={payLink === null && showPayModal}
//                             className="ml-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-1 px-3 rounded text-sm transition shadow-md"
//                         >
//                             {payLink === null && showPayModal ? "Cargando..." : "PAGAR Y RENOVAR"}
//                         </button>
//                     )}
//                 </div>
//             )}

//             {/* 2. BARRA PRINCIPAL DEL HEADER */}
//             <div className="bg-slate-900 text-white">
//                 {/* ... (Tu div de contenido principal del Header aquí) ... */}
//             </div>
            

//             {/* 3. Modal de Pago */}
//             {showPayModal && (
//                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
//                     {/* AQUÍ VA EL MODAL DE PAGO COMPLETO. 
//                         Asegúrate de que el botón de cerrar use handleCloseModal.
//                     */}
//                     <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full text-gray-900">
//                         <h2 className="text-xl font-bold mb-4">Renovación de Servicio</h2>
//                         {payMessage && <p className="text-red-600 mb-4">{payMessage}</p>}
                        
//                         {payLink ? (
//                             <>
//                                 <p className="mb-4">Tu link de pago ha sido generado. Puedes:</p>
//                                 <a 
//                                     href={payLink} 
//                                     target="_blank" 
//                                     rel="noopener noreferrer"
//                                     className="block text-center bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition mb-3"
//                                 >
//                                     Abrir Link de Pago
//                                 </a>
//                                 <p className="text-sm text-gray-500 mt-2">
//                                     Estamos verificando automáticamente tu pago cada 3 segundos. Cierra esta ventana después de pagar.
//                                 </p>
//                             </>
//                         ) : (
//                             <p className="text-center py-4">Procesando solicitud de pago...</p>
//                         )}
                        
//                         <button 
//                             onClick={handleCloseModal}
//                             className="mt-6 w-full border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-100 transition"
//                         >
//                             Cerrar
//                         </button>
//                     </div>
//                 </div>
//             )}
//         </header>
//     );
// };