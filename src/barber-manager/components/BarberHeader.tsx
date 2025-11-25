import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { barberAuth } from "../services/firebaseBarber";

/* ================================
  ICONOS EN SVG
================================ */
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

const IconClients = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
   <circle cx="8" cy="8" r="3" className="fill-slate-200" />
   <circle cx="16" cy="8" r="3" className="fill-slate-400" />
   <path d="M3.5 18c.7-2.3 2.4-4 4.5-4s3.8 1.7 4.5 4" className="stroke-slate-300" strokeWidth="1.6" strokeLinecap="round" />
   <path d="M11.5 18c.7-2.3 2.4-4 4.5-4s3.8 1.7 4.5 4" className="stroke-slate-500" strokeWidth="1.6" strokeLinecap="round" />
 </svg>
);

const IconCalendar = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
   <rect x="3" y="5" width="18" height="16" rx="2" className="fill-slate-200" />
   <path d="M3 9h18" className="stroke-slate-400" strokeWidth="1.6" strokeLinecap="round" />
   <rect x="7" y="3" width="2" height="4" className="fill-slate-500" />
   <rect x="15" y="3" width="2" height="4" className="fill-slate-500" />
   <rect x="8" y="12" width="3" height="3" rx="0.8" className="fill-slate-500" />
 </svg>
);

const IconEmployees = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
   <circle cx="12" cy="8" r="3.2" className="fill-slate-300" />
   <path d="M6 19c.7-2.6 3-4.5 6-4.5s5.3 1.9 6 4.5" className="stroke-slate-500" strokeWidth="1.6" strokeLinecap="round" />
   <circle cx="6" cy="9" r="2" className="fill-slate-200" />
   <circle cx="18" cy="9" r="2" className="fill-slate-200" />
 </svg>
);

// NUEVOS ICONOS
const IconServices = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
   <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" className="stroke-slate-400" strokeWidth="1.6" strokeLinecap="round" />
   <circle cx="12" cy="8" r="1" className="fill-slate-200" />
   <circle cx="6" cy="12" r="1" className="fill-slate-200" />
   <circle cx="18" cy="16" r="1" className="fill-slate-200" />
 </svg>
);

const IconSales = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
   <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" className="stroke-slate-400" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
   <circle cx="12" cy="12" r="9" className="stroke-slate-500" strokeWidth="1.6" strokeOpacity="0.3"/>
 </svg>
);

const IconStock = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
   <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" className="stroke-slate-400" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
   <path d="M12 11l4-2M12 11l-4-2" className="stroke-slate-300" strokeWidth="1.6" />
 </svg>
);

const IconLogout = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
   <rect x="4" y="4" width="9" height="16" rx="2" className="fill-red-200/60" />
   <path d="M11 12h7" className="stroke-red-400" strokeWidth="1.6" strokeLinecap="round" />
   <path d="M15 9l3 3-3 3" className="stroke-red-400" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
);

const IconHome = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

/* ================================
  COMPONENTE PRINCIPAL
================================ */
export const BarberHeader: React.FC = () => {
 const navigate = useNavigate();
 const location = useLocation();
 const [menuOpen, setMenuOpen] = useState(false);
 const menuRef = useRef<HTMLDivElement | null>(null);
 const buttonRef = useRef<HTMLButtonElement | null>(null);

 const today = new Date();
 const formattedDate = today.toLocaleDateString("es-AR");

 const getSectionTitle = () => {
   const path = location.pathname;
   if (path.includes("dashboard")) return "Panel general";
   if (path.includes("clientes")) return "Clientes"; 
   if (path.includes("turnos")) return "Turnos";     
   if (path.includes("empleados")) return "Empleados"; 
   if (path.includes("servicios")) return "Servicios"; 
   if (path.includes("ventas")) return "Ventas";       
   if (path.includes("stock")) return "Stock";         
   return "Panel general";
 };

 const toggleMenu = () => setMenuOpen((prev) => !prev);

 const goTo = (path: string) => {
   navigate(path);
   setMenuOpen(false);
 };

  // FUNCIÓN: Regresar a la página inicial principal (ruta /)
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
   <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md">
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
         <h1 className="text-sm font-semibold">Barber Manager</h1>
         <p className="text-[11px] text-slate-400">
          Administra tu barbería en un solo lugar
         </p>
       </div>
      </div>

      {/* INFO DERECHA Y BOTONES */}
      <div className="flex items-center gap-4">
       
          {/* BOTÓN REGRESAR A PÁGINA INICIAL (NUEVO) */}
          <button
            onClick={goToHomePage}
            className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95"
          >
            <IconHome />
            Regresar a página Inicial
          </button>

       <div className="hidden sm:flex flex-col text-right">
         <span className="text-[11px] text-slate-400">Sección actual</span>
         <span className="text-xs font-medium">{getSectionTitle()}</span>
         <span className="text-[11px] text-slate-400">{formattedDate}</span>
       </div>

       {/* BOTÓN HAMBURGUESA */}
       <button
         ref={buttonRef}
         onClick={toggleMenu}
         className="w-9 h-9 flex flex-col items-center justify-center gap-[4px] rounded-lg bg-slate-800 hover:bg-slate-700 transition"
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
          <button onClick={() => goTo("/barber-manager/dashboard")} className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-slate-800 transition-colors">
            <IconBox><IconDashboard /></IconBox> Panel General
          </button>
              
              {/* Separador */}
              <div className="border-t border-slate-700 my-1"></div>

          <button onClick={() => goTo("/barber-manager/turnos")} className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
            <IconBox><IconCalendar /></IconBox> Turnos
          </button>

          <button onClick={() => goTo("/barber-manager/clientes")} className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
            <IconBox><IconClients /></IconBox> Clientes
          </button>
              
          <button onClick={() => goTo("/barber-manager/empleados")} className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
            <IconBox><IconEmployees /></IconBox> Empleados
          </button>

          <button onClick={() => goTo("/barber-manager/servicios")} className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
            <IconBox><IconServices /></IconBox> Servicios
          </button>

          {/* Sección de Reportes y Stock */}
          <div className="border-t border-slate-700 my-1"></div>

          <button onClick={() => goTo("/barber-manager/ventas")} className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
            <IconBox><IconSales /></IconBox> Ventas
          </button>

          <button onClick={() => goTo("/barber-manager/stock")} className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors">
            <IconBox><IconStock /></IconBox> Stock
          </button>

          {/* Cierre de Sesión */}
          <div className="border-t border-slate-700 mt-2 pt-2">
                {/* Botón de volver a Home también para móvil */}
                <button onClick={goToHomePage} className="md:hidden w-full px-4 py-2 flex items-center gap-2 text-left text-slate-300 hover:bg-slate-800 transition-colors">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-700"><IconHome /></span> Regresar a Inicial
                </button>
                
                {/* Botón de Cerrar Sesión */}
            <button onClick={handleLogout} className="w-full px-4 py-2 flex items-center gap-2 text-left text-red-300 hover:bg-red-600/20 hover:text-red-200 transition-colors">
             <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-900/40"><IconLogout /></span> Cerrar sesión
            </button>
          </div>
         </nav>
       </div>
      </div>
    </div>
   </header>
 );
};