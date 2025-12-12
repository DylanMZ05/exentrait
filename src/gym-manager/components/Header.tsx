import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { type User, signInWithEmailAndPassword, signOut } from 'firebase/auth'; // Incluimos signOut para referencia del tipo
import { auth, db } from '../../../firebase';
import { VentasSecurityModal } from '../modals/VentasSecurityModal'; 
// 👑 Importamos Iconos
import { 
    MdHome, 
    MdPeople, 
    MdAttachMoney, 
    MdCalendarToday, 
    MdSettings, 
    MdMenu, 
    MdClose, 
    MdLogout 
} from 'react-icons/md'; 

// Altura fija del Header
const HEADER_HEIGHT_PX = 60; 

// 🎯 PREFIJO BASE DE LA APLICACIÓN
const APP_BASE_PATH = '/app-gym'; 

interface HeaderProps {
    onLogout: () => void;
    onNavigate: (href: string) => void; 
    currentPath: string; 
}

// ----------------------------------------------------------------------
// DATA DE NAVEGACIÓN Y PERMISOS (Iconos actualizados)
// ----------------------------------------------------------------------
const NAV_ITEMS = [
    { href: '/home', label: 'Inicio', icon: MdHome, protected: false },
    { href: '/clientes', label: 'Clientes', icon: MdPeople, protected: false },
    { href: '/ventas', label: 'Ventas', icon: MdAttachMoney, protected: true },
    { href: 'consulta.html', label: 'Días restantes', icon: MdCalendarToday, external: true, protected: false },
];

const ADMIN_EMAILS = ["exentrait.company@gmail.com"];

// ----------------------------------------------------------------------
// HOOKS DE LÓGICA (LICENCIA Y ADMIN) - Se mantiene el código funcional
// ----------------------------------------------------------------------

interface LicenciaData { diasRestantes: number; diasLabel: string; colorClass: string; }

const useLicenciaAndAdmin = (user: User | undefined) => {
    const [licencia, setLicencia] = useState<LicenciaData | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (!user || !user.uid) {
            setLicencia(null);
            setIsAdmin(false);
            return;
        }
        
        const fetchUserData = async () => {
            // ... Lógica de Licencia (Firestore) ...
            try {
                const ref = doc(db, "usuariosAuth", user.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const { fechaVencimiento } = snap.data();
                    if (fechaVencimiento) {
                        const vencDate = typeof (fechaVencimiento as any).toDate === "function"
                            ? (fechaVencimiento as any).toDate()
                            : new Date(fechaVencimiento as string);
        
                        const diffMs = vencDate.getTime() - Date.now();
                        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                        
                        let colorClass = "text-green-400";
                        if (diasRestantes <= 7 && diasRestantes > 3) {
                            colorClass = "text-yellow-400";
                        } else if (diasRestantes <= 3) {
                            colorClass = "text-red-400";
                        }
                        
                        const sufijo = diasRestantes === 1 ? "día restante" : "días restantes";
                        setLicencia({ diasRestantes, diasLabel: `${diasRestantes} ${sufijo}`, colorClass });
                    }
                }
            } catch (err) {
                console.warn("Error al obtener días de licencia:", err);
            }
            
            // 2. Lógica de Admin
            const userEmail = user.email?.toLowerCase();
            let adminStatus = ADMIN_EMAILS.includes(userEmail || '');
            
            try {
                const snap = await getDoc(doc(db, "config", "admins"));
                const admins = snap.exists() ? snap.data() : {};
                if (admins[userEmail || ''] === true) adminStatus = true;
            } catch {}
            
            setIsAdmin(adminStatus);
        };
        
        fetchUserData();

    }, [user]);

    return { licencia, isAdmin };
};

// ----------------------------------------------------------------------
// COMPONENTE HEADER
// ----------------------------------------------------------------------

export const Header: React.FC<HeaderProps> = ({ onLogout, onNavigate, currentPath }) => {
    const [user] = useAuthState(auth); 
    const { licencia, isAdmin } = useLicenciaAndAdmin(user || undefined);

    const [showVentasModal, setShowVentasModal] = useState(false);
    // 🚨 targetHref ahora debe ser la ruta completa, incluyendo APP_BASE_PATH
    const [ventasTargetHref, setVentasTargetHref] = useState(''); 
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // Función auxiliar para obtener la ruta completa con el prefijo
    const getFullPath = useCallback((href: string) => {
        return `${APP_BASE_PATH}${href.startsWith('/') ? href : `/${href}`}`;
    }, []);

    // 1. Navegación Segura/Externa (Simplificada para el flujo de Link/Button)
    const handleNavigation = useCallback((href: string, isProtected: boolean, isExternal: boolean = false) => {
        if (isExternal) {
            window.open(href, "_blank", "noopener,noreferrer");
            return;
        }
        
        const fullPath = getFullPath(href); // Usamos la ruta completa
        
        if (isProtected) {
            setVentasTargetHref(fullPath); // Guardamos la ruta completa
            setShowVentasModal(true);
        } else {
            // Llama a onNavigate, que debe estar definida en AppGymWrapper.tsx
            onNavigate(fullPath); 
        }
        setIsMobileMenuOpen(false);
    }, [onNavigate, getFullPath]);

    // 2. Lógica para el modal de Ventas (re-auth)
    const handleConfirmVentas = useCallback(async (password: string) => {
        if (!user || !user.email) return;
        
        try {
            // 🚨 Autenticación para acceder a ruta protegida 🚨
            await signInWithEmailAndPassword(auth, user.email, password);
            // ventasTargetHref ya contiene la ruta completa (/app-gym/ventas)
            onNavigate(ventasTargetHref); 
            setShowVentasModal(false);
        } catch (err) {
            throw new Error("Contraseña incorrecta.");
        }
    }, [user, onNavigate, ventasTargetHref]);

    // 3. Renderizado de Ítems de Navegación (incluye Admin)
    const finalNavItems = useMemo(() => {
        let items = [...NAV_ITEMS];
        
        if (isAdmin) {
            items.push({ 
                // Admin es externo, no necesita el prefijo
                href: 'admin.html', 
                label: 'Admin', 
                icon: MdSettings,
                external: true, 
                protected: false 
            } as any); 
        }
        return items;
    }, [isAdmin]);

    // -------------------------------------------------------------
    // RENDERIZADO (TOP STICKY HEADER)
    // -------------------------------------------------------------
    
    return (
        <>
            {/* --------------------- HEADER (Fijo/Sticky Superior) --------------------- */}
            <header 
                style={{ height: `${HEADER_HEIGHT_PX}px` }}
                className="fixed top-0 left-0 right-0 bg-[#0e1639] text-white z-50 shadow-xl flex items-center justify-between px-6 transition-all duration-300"
            >
                {/* Logo/Título */}
                <h1 className="font-extrabold text-xl tracking-wider text-[#fe804a]">EXENTRA GYM</h1>

                {/* Desktop Navigation Links */}
                <nav className="hidden md:flex items-center gap-6 h-full">
                    {finalNavItems.map(item => {
                        const IconComponent = item.icon;
                        const fullPath = getFullPath(item.href);
                        
                        // 🚨 Usamos currentPath para chequear la ruta completa
                        const isActive = currentPath.includes(item.href.replace('/', '')); 

                        // 1. Si es externo o protegido (necesita onClick para el modal o window.open)
                        if (item.external || item.protected) {
                            return (
                                <button
                                    key={item.href}
                                    onClick={() => handleNavigation(item.href, !!item.protected, !!item.external)}
                                    className={`
                                        flex items-center gap-2 h-full text-sm font-medium transition-colors duration-200 border-b-2
                                        ${isActive 
                                            ? 'text-[#fe804a] border-[#fe804a] scale-105' 
                                            : 'text-white/80 border-transparent hover:text-white hover:border-white/40 hover:scale-105'}
                                    `}
                                >
                                    {React.createElement(IconComponent as any, { className: "text-xl" })}
                                    {item.label}
                                </button>
                            );
                        }

                        // 2. Si es navegación interna simple, usamos <Link>
                        return (
                            <Link
                                key={item.href}
                                to={fullPath} // 🚨 USA LA RUTA COMPLETA (/app-gym/clientes)
                                className={`
                                    flex items-center gap-2 h-full text-sm font-medium transition-colors duration-200 border-b-2
                                    ${isActive 
                                        ? 'text-[#fe804a] border-[#fe804a] scale-105' 
                                        : 'text-white/80 border-transparent hover:text-white hover:border-white/40 hover:scale-105'}
                                `}
                            >
                                {React.createElement(IconComponent as any, { className: "text-xl" })}
                                {item.label}
                            </Link>
                        );
                    })}
                    
                    {/* Botón de Logout */}
                    <button
                        onClick={onLogout} // ⬅️ Llama al handler del AppGymWrapper que debe tener signOut(auth)
                        className="ml-4 p-2 rounded-full bg-red-600 hover:bg-red-700 transition-colors duration-200 text-white shadow-md active:scale-95"
                        title="Cerrar Sesión"
                    >
                        <MdLogout className="text-xl" />
                    </button>
                </nav>

                {/* Mobile Menu Button / Licencia Info (Mobile) */}
                <div className="flex items-center md:hidden gap-4">
                    {licencia && (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${licencia.colorClass.replace('text-', 'bg-')}`}>
                            {licencia.diasRestantes} Días
                        </span>
                    )}
                    <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 transition duration-300 hover:text-[#fe804a]">
                        <MdMenu className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* --------------------- LICENCIA INFO (Flotante - Desktop) --------------------- */}
            {licencia && (
                <div 
                    style={{ top: `${HEADER_HEIGHT_PX + 10}px` }}
                    className={`
                        hidden lg:block fixed right-0 mr-4 p-2 rounded-lg text-white text-sm z-30 shadow-xl
                        bg-[#152754] border-l-4 border-[#fe804a] transition-all duration-300
                    `}
                >
                    Licencia: <span className={`font-bold ${licencia.colorClass}`}>{licencia.diasLabel}</span>
                </div>
            )}

            {/* --------------------- MENU DESPLEGABLE (Mobile: Lateral) --------------------- */}
            <div 
                className={`
                    fixed top-0 right-0 h-full w-64 bg-[#0e1639] z-[60] flex flex-col shadow-2xl md:hidden
                    transform transition-transform duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                <div className="p-4 flex justify-between items-center border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Menú</h2>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-white hover:text-red-500 transition">
                        <MdClose className="w-6 h-6" />
                    </button>
                </div>
                
                {/* 🚨 En móvil, usamos botones con handleNavigation para mantener la lógica centralizada 🚨 */}
                <nav className="flex flex-col gap-1 p-2 flex-1">
                    {finalNavItems.map(item => (
                        <button
                            key={item.href}
                            // handleNavigation llama a onNavigate() con la ruta completa o abre el modal
                            onClick={() => handleNavigation(item.href, !!item.protected, !!item.external)}
                            className={`
                                text-left text-white py-3 px-3 rounded-md flex items-center gap-3 transition duration-150
                                ${currentPath.includes(item.href.replace('/', '')) ? 'bg-[#202547]' : 'hover:bg-[#152754]'}
                            `}
                        >
                            {React.createElement(item.icon as any, { className: "text-xl" })}
                            {item.label}
                        </button>
                    ))}
                </nav>

                <button 
                    onClick={onLogout} 
                    className="p-4 bg-red-600 hover:bg-red-700 text-white transition duration-150 text-sm flex items-center justify-center gap-2"
                >
                    <MdLogout className="text-xl" />
                    Cerrar Sesión
                </button>
            </div>
            
            {/* --------------------- Modal de Seguridad (Necesario) --------------------- */}
            <VentasSecurityModal 
              isOpen={showVentasModal}
              onClose={() => setShowVentasModal(false)}
              onSuccess={handleConfirmVentas}
              targetHref={ventasTargetHref}
            />
        </>
    );
};