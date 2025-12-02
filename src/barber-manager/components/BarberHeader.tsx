import React, { useEffect, useRef, useState, useCallback} from "react";
import { useNavigate } from "react-router-dom";
// Importaciones necesarias para Firebase Auth y Firestore
import { signOut, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth"; 
// 🛑 CORREGIDO: Importamos la instancia ÚNICA de Firestore
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { barberAuth, barberDb } from '../services/firebaseBarber'; // <-- USAMOS barberDb

// --------------------------------------------------------------------
// CONFIGURACIÓN Y UTILIDADES (Asegúrate de que estas rutas/valores sean correctos)
// --------------------------------------------------------------------
const COLL = "usuariosAuth";
const SUPER_ADMIN_EMAIL = "exentrait.company@gmail.com"; 

// Tipo para el Timestamp de Firestore cuando se deserializa
type FirestoreTimestamp = {
    seconds: number;
    nanoseconds: number;
    toDate?: () => Date; 
};

interface BarberUserData {
    activo?: boolean;
    fechaVencimiento?: any | null; 
}

// --------------------------------------------------------------------
// HELPERS (Lógica de Suscripción - Cálculo de Fecha)
// --------------------------------------------------------------------

const calculateDaysRemaining = (data: BarberUserData): number | null => {
    
    const value = data.fechaVencimiento;
    
    if (!value) {
        console.error("[DEBUG: CALCULO] FALLO: Valor de fecha nulo o indefinido.");
        return null;
    }
    
    let venceDate: Date | null = null;
    
    // 🛑 1. Extracción y Conversión Robusta a Date
    try {
        if (value instanceof Timestamp) {
            venceDate = value.toDate();
            // console.log(`[DEBUG: CALCULO] Tipo: Nativo Timestamp. toDate(): ${venceDate.toLocaleDateString()}`);
        } else if (typeof value === 'object' && value !== null && 'seconds' in value) {
            const flatTimestamp = value as FirestoreTimestamp;
            venceDate = new Date(flatTimestamp.seconds * 1000);
            // console.log(`[DEBUG: CALCULO] Tipo: Objeto Plano. Reconstruido: ${venceDate.toLocaleDateString()}`);
        } else if (value instanceof Date) {
             venceDate = value;
        } else {
             venceDate = new Date(value);
        }
    } catch (e) {
        console.error("[DEBUG: CALCULO] ERROR en la conversión de fecha. Valor crudo:", value, e);
        return null;
    }

    if (!venceDate || isNaN(venceDate.getTime())) {
        console.error("[DEBUG: CALCULO] FALLO CRÍTICO: Conversión a Date no válida.");
        return null;
    }
    
    // 🛑 2. Cálculo de Días por Diferencia de Días
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const expirationDate = new Date(venceDate.getTime());
    expirationDate.setHours(0, 0, 0, 0);

    const ONE_DAY_MS = 1000 * 60 * 60 * 24;
    
    const diffTime = expirationDate.getTime() - today.getTime();
    
    const diffDays = Math.ceil(diffTime / ONE_DAY_MS); 
    
    // console.log(`[DEBUG: CALCULO] Fecha Vencimiento (Local): ${expirationDate.toLocaleDateString()}`);
    // console.log(`[DEBUG: CALCULO] Hoy (Local): ${today.toLocaleDateString()}`);
    // console.log(`[DEBUG: CALCULO] Días Restantes (FINAL): ${diffDays}`);
    
    return diffDays;
};

// --------------------------------------------------------------------
// DEFINICIONES DE ICONOS (Omitidas por brevedad)
// --------------------------------------------------------------------

const IconBox = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-800">
        {children}
    </span>
);
const IconDashboard = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2" className="fill-slate-200" />
        <rect x="13" y="3" width="8" height="5" rx="2" className="fill-slate-400" />
        <rect x="13" y="10" width="8" height="11" rx="2" className="fill-slate-300" />
        <rect x="3" y="13" width="8" height="8" rx="2" className="fill-slate-500" />
    </svg>
);
const IconClients = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"> <circle cx="12" cy="7" r="4" className="stroke-slate-200"/> <path d="M12 14s-4 2-4 5h8c0-3-4-5-4-5z" className="stroke-slate-400"/></svg>);
const IconCalendar = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"> <rect x="3" y="4" width="18" height="18" rx="2" ry="2" className="stroke-slate-400 fill-slate-200/50" /> <line x1="16" y1="2" x2="16" y2="6" className="stroke-slate-400"/> <line x1="8" y1="2" x2="8" y2="6" className="stroke-slate-400"/> <line x1="3" y1="10" x2="21" y2="10" className="stroke-slate-400"/> </svg>);
const IconEmployees = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"> <path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" className="stroke-slate-400"/> <circle cx="10" cy="7" r="4" className="stroke-slate-300 fill-slate-300/30"/> </svg>);
const IconServices = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"> <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" className="stroke-slate-400" strokeWidth="1.6" strokeLinecap="round" /> </svg>);
const IconSales = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"> <path d="M3 3v18h18M18 17V9.5a2.5 2.5 0 00-5 0V17" className="stroke-slate-400"/> </svg>);
const IconStock = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"> <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" className="stroke-slate-400" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/> </svg>);
const IconLogout = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"> <rect x="4" y="4" width="9" height="16" rx="2" className="fill-red-200/60 stroke-red-400" /> <path d="M17 16l4-4-4-4M21 12H9" className="stroke-red-400"/> </svg>);
const IconHome = () => ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" className="stroke-slate-200"/> </svg>);
const IconSettings = () => ( <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.526.323.864.555 1.066 1.066z" /> </svg>);
const IconSuperAdmin = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2m0-4h-2m2 4h4m4-4h2m4 4v.01m-4-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


/* ================================
    COMPONENTE PRINCIPAL
================================ */
export const BarberHeader: React.FC = () => {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [user, setUser] = useState<User | null>();
    // 🛑 ESTADO REAL DE DÍAS RESTANTES
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null); 
    const [isLoadingData, setIsLoadingData] = useState(false);


    const today = new Date();
    const formattedDate = today.toLocaleDateString("es-AR");

    // Lógica para determinar el rol actual
    const userUid = user?.uid;
    const ownerUid = localStorage.getItem('barberOwnerId');
    // Si el usuario actual es el dueño (userUid === ownerUid) O si tiene un email no interno.
    const isOwnerMode = userUid === ownerUid || user?.email?.includes('.internal') === false; 
    
    // 🛑 LÓGICA DE SUPERADMIN
    const IS_SUPER_ADMIN = user?.email === SUPER_ADMIN_EMAIL;

    // --------------------------------------------------------
    // ✅ FUNCIÓN PARA OBTENER DÍAS REALES DE FIRESTORE
    // --------------------------------------------------------
    const fetchSubscriptionStatus = useCallback(async (currentUid: string) => {
        if (!currentUid) {
            setDaysRemaining(null);
            setIsLoadingData(false);
            return;
        }

        setIsLoadingData(true);
        try {
            // 🛑 1. DETERMINAR EL UID CORRECTO PARA EL FETCH
            let fetchUid = currentUid;
            const storedOwnerId = localStorage.getItem('barberOwnerId');

            // Lógica: Si hay un OwnerId guardado (significa que es Dueño o Empleado), usamos ese OwnerId.
            if (!IS_SUPER_ADMIN && storedOwnerId) {
                fetchUid = storedOwnerId;
            }
            
            // console.log(`[DEBUG: FETCH] UID final para la consulta en ${COLL}: ${fetchUid}`);

            // 🛑 CORRECCIÓN CLAVE: Usamos barberDb
            const docRef = doc(barberDb, COLL, fetchUid); 
            const snap = await getDoc(docRef);
            
            if (snap.exists()) {
                const data = snap.data() as BarberUserData;
                
                // 🛑 Verificar el campo de fechaVencimiento antes de calcular
                // console.log("[DEBUG: FETCH] Datos del documento:", data);
                if (data.fechaVencimiento) {
                    // console.log(`[DEBUG: FETCH] fechaVencimiento (RAW):`, data.fechaVencimiento);
                    const remaining = calculateDaysRemaining(data);
                    setDaysRemaining(remaining);
                } else {
                    console.error("[DEBUG: FETCH] FALLO: El campo 'fechaVencimiento' no existe en el documento.");
                    setDaysRemaining(null);
                }
            } else {
                // console.log(`[DEBUG: FETCH] Documento no encontrado para UID: ${fetchUid}`);
                setDaysRemaining(null);
            }
        } catch (e) {
            console.error("[DEBUG: FETCH] Error al obtener el estado de suscripción:", e);
            setDaysRemaining(null); 
        } finally {
            setIsLoadingData(false);
        }
    }, [IS_SUPER_ADMIN]);

    // --------------------------------------------------------
    // ✅ HOOK DE INICIALIZACIÓN (AUTH + FETCH DE DATOS)
    // --------------------------------------------------------
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(barberAuth, (currentUser) => {
            setUser(currentUser);
            
            if (currentUser) { 
                // Llamar siempre con el UID actual logueado. 
                fetchSubscriptionStatus(currentUser.uid);
            } else {
                 // Si no hay usuario, limpiar estados
                setDaysRemaining(null);
                setIsLoadingData(false);
            }
        });
        return () => unsubscribe();
    }, [fetchSubscriptionStatus]); 


    // --- LÓGICA DE ESTADO (RENDERIZADO) ---
    const isExpired = daysRemaining !== null && daysRemaining <= 0; 

    // 🛑 LÓGICA DE COLOR ACTUALIZADA: Verde > 14, Amarillo 14 a 8, Rojo <= 7 y Vencido
    const statusClass = (() => {
        if (daysRemaining === null || IS_SUPER_ADMIN) {
            return "text-slate-400"; // Default o SuperAdmin
        }
        if (daysRemaining <= 0) {
            return "text-red-400 font-bold"; // Vencido (Rojo Fuerte)
        }
        if (daysRemaining <= 7) {
            return "text-red-400 font-bold"; // 7 días o menos (Rojo)
        }
        if (daysRemaining <= 14) {
            return "text-yellow-400 font-bold"; // 8 a 14 días (Amarillo)
        }
        return "text-green-400"; // Más de 14 días (Verde)
    })();
    
    // 🛑 LÓGICA PARA EL TEXTO A MOSTRAR
    const displayDays = isLoadingData
        ? "Cargando..."
        : (daysRemaining === null || user === undefined || !user) 
            ? '---'
            : IS_SUPER_ADMIN
                ? '✅ ILIMITADO' 
                : isExpired
                    ? `Vencido (${Math.abs(daysRemaining)} d.)`
                    : daysRemaining; 
            
    const isUserLoggedIn = !!user; 

    // Lista de rutas accesibles
    const managementRoutes = [
        { name: "Panel General", path: "/barber-manager/dashboard", icon: IconDashboard, allowed: true },
        { name: "Turnos", path: "/barber-manager/turnos", icon: IconCalendar, allowed: true },
        { name: "Clientes", path: "/barber-manager/clientes", icon: IconClients, allowed: true },
        { name: "Empleados", path: "/barber-manager/empleados", icon: IconEmployees, allowed: isOwnerMode },
        { name: "Servicios", path: "/barber-manager/servicios", icon: IconServices, allowed: true },
    ];

    const reportRoutes = [
        { name: "Ventas", path: "/barber-manager/ventas", icon: IconSales, allowed: true },
        { name: "Stock", path: "/barber-manager/stock", icon: IconStock, allowed: true },
        // 🛑 RUTA CORREGIDA: SOLO /admin-super
        { name: "Panel Administrador", path: "/admin-super", icon: IconSuperAdmin, allowed: IS_SUPER_ADMIN }, 
        // Configuración (Solo para Dueño normal, no para el SA)
        { name: "Configuración", path: "/barber-manager/configuracion", icon: IconSettings, allowed: isOwnerMode && !IS_SUPER_ADMIN },
    ];

    const toggleMenu = () => setMenuOpen((prev) => !prev);

    const goTo = (path: string) => {
        navigate(path);
        setMenuOpen(false);
    };

    const goToHomePage = () => {
        navigate("/");
    };

    const handleLogout = async () => {
        try {
            await signOut(barberAuth);
            setMenuOpen(false);
            navigate("/barber-manager/login", { replace: true });
        } catch (error) {
            console.error("Error al cerrar sesión", error);
        }
    };

    useEffect(() => {
        if (!menuOpen) return;
        const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (
            menuRef.current &&
            !menuRef.current.contains(target) &&
            buttonRef.current &&
            !buttonRef.current.contains(target)
        ) {
            setMenuOpen(false);
        }
        };
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, [menuOpen]);

    return (
        <header className="sticky top-0 z-40 shadow-md">
            
            {/* BARRA PRINCIPAL DEL HEADER */}
            <div className="bg-slate-900 text-white">
                <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between relative">
                    
                    {/* LOGO */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-[11px] font-semibold">
                            BM
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">
                                Exentra
                            </p>
                            <h1 className="text-sm font-semibold">Hair Salon Manager</h1>
                            <p className="text-[11px] text-slate-400">
                                Administra tu barbería/peluquería en un solo lugar
                            </p>
                        </div>
                    </div>

                    {/* INFO DERECHA Y BOTONES */}
                    <div className="flex items-center gap-4">
                        
                        {/* 🌟 INFORMACIÓN DE SUSCRIPCIÓN */}
                        {isUserLoggedIn && (
                            <div className="flex flex-col text-right text-sm sm:text-xs"> 
                                <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase leading-none">
                                    {IS_SUPER_ADMIN ? 'Modo SA' : 'Servicio Vence en'}
                                </span>
                                <div className="font-semibold whitespace-nowrap leading-none mt-0.5">
                                    <span className={statusClass}>
                                        {/* MOSTRANDO LOS DÍAS CALCULADOS */}
                                        {displayDays} {(!IS_SUPER_ADMIN && daysRemaining !== null && daysRemaining > 1 && !isExpired) ? 'días' : (isExpired || daysRemaining === 1) ? '' : ''}
                                    </span>
                                    
                                    {/* 🛑 BOTÓN DE RENOVAR ELIMINADO SEGÚN LA SOLICITUD DEL USUARIO */}
                                </div>
                                <span className="text-[10px] sm:text-[11px] text-slate-400 leading-none mt-0.5">{formattedDate}</span>
                            </div>
                        )}
                        
                        {/* BOTÓN REGRESAR A PÁGINA INICIAL */}
                        <button
                            onClick={goToHomePage}
                            className="hidden md:flex items-center gap-2 cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95"
                        >
                            <IconHome />
                            Inicio Exentra IT
                        </button>


                        {/* BOTÓN HAMBURGUESA */}
                        <button
                            ref={buttonRef}
                            onClick={toggleMenu}
                            className="cursor-pointer w-9 h-9 flex flex-col items-center justify-center gap-[4px] rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                        >
                            <span className={`block h-[2px] w-5 bg-white rounded-full transition-transform ${menuOpen ? "translate-y-[6px] rotate-45" : ""}`} />
                            <span className={`block h-[2px] w-5 bg-white rounded-full transition-opacity ${menuOpen ? "opacity-0" : "opacity-100"}`} />
                            <span className={`block h-[2px] w-5 bg-white rounded-full transition-transform ${menuOpen ? "-translate-y-[6px] -rotate-45" : ""}`} />
                        </button>

                        {/* MENÚ DESPLEGABLE */}
                        <div
                            ref={menuRef}
                            className={`absolute right-6 top-[52px] w-52 bg-slate-900/95 border border-slate-700 rounded-xl shadow-lg backdrop-blur-sm transition-all duration-200 ${
                                menuOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                            }`}
                        >
                            <div className="px-4 py-3 border-b border-slate-700">
                                <p className="text-xs text-slate-400">Hoy</p>
                                <p className="text-xs font-medium">{formattedDate}</p>
                            </div>

                            <nav className="py-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {/* BOTÓN INICIO (DASHBOARD) */}
                                {managementRoutes.filter(r => r.name === "Panel General" && r.allowed).map(route => (
                                    <button key={route.name} onClick={() => goTo(route.path)} className="cursor-pointer w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-slate-800 transition-colors">
                                        <IconBox><route.icon /></IconBox> {route.name}
                                    </button>
                                ))}
                                
                                {/* Separador */}
                                <div className="border-t border-slate-700 my-1"></div>

                                {/* SECCIÓN DE GESTIÓN */}
                                {managementRoutes.filter(r => r.name !== "Panel General" && r.allowed).map(route => (
                                    <button key={route.name} onClick={() => goTo(route.path)} className="cursor-pointer w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
                                        <IconBox><route.icon /></IconBox> {route.name}
                                    </button>
                                ))}

                                {/* Sección de Reportes y Stock */}
                                <div className="border-t border-slate-700 my-1"></div>

                                {reportRoutes.filter(r => r.name !== "Configuración" && r.name !== "Panel Administrador").map(route => (
                                    <button key={route.name} onClick={() => goTo(route.path)} className="cursor-pointer w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
                                        <IconBox><route.icon /></IconBox> {route.name}
                                    </button>
                                ))}
                                
                                {/* === SECCIÓN: CONFIGURACIÓN/ADMIN === */}
                                {reportRoutes.some(r => r.allowed) && (
                                    <>
                                        <div className="border-t border-slate-700 my-1"></div>
                                        {/* Botón de Panel SA */}
                                        {reportRoutes.filter(r => r.name === "Panel Administrador" && r.allowed).map(route => (
                                            <button key={route.name} onClick={() => goTo(route.path)} className="cursor-pointer w-full px-4 py-2 flex items-center gap-2 text-left text-blue-300 hover:bg-blue-900/40 transition-colors">
                                                <IconBox><route.icon /></IconBox> {route.name}
                                            </button>
                                        ))}

                                        {/* Botón de Configuración Normal */}
                                        {reportRoutes.filter(r => r.name === "Configuración" && r.allowed).map(route => (
                                            <button key={route.name} onClick={() => goTo(route.path)} className="cursor-pointer w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
                                                <IconBox><route.icon /></IconBox> {route.name}
                                            </button>
                                        ))}
                                    </>
                                )}


                                {/* Cierre de Sesión */}
                                <div className="border-t border-slate-700 mt-2 pt-2">
                                    {/* Botón de volver a Home también para móvil */}
                                    <button onClick={goToHomePage} className="md:hidden cursor-pointer w-full px-4 py-2 flex items-center gap-2 text-left text-slate-300 hover:bg-slate-800 transition-colors">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-700"><IconHome /></span> Regresar a Inicial
                                    </button>
                                    
                                    {/* Botón de Cerrar Sesión */}
                                    <button onClick={handleLogout} className="cursor-pointer w-full px-4 py-2 flex items-center gap-2 text-left text-red-300 hover:bg-red-600/20 hover:text-red-200 transition-colors">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-900/40"><IconLogout /></span> Cerrar sesión
                                    </button>
                                </div>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};