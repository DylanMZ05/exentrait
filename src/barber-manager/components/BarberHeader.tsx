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
    <path
      d="M3.5 18c.7-2.3 2.4-4 4.5-4s3.8 1.7 4.5 4"
      className="stroke-slate-300"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M11.5 18c.7-2.3 2.4-4 4.5-4s3.8 1.7 4.5 4"
      className="stroke-slate-500"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IconCalendar = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="2" className="fill-slate-200" />
    <path
      d="M3 9h18"
      className="stroke-slate-400"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <rect x="7" y="3" width="2" height="4" className="fill-slate-500" />
    <rect x="15" y="3" width="2" height="4" className="fill-slate-500" />
    <rect
      x="8"
      y="12"
      width="3"
      height="3"
      rx="0.8"
      className="fill-slate-500"
    />
  </svg>
);

const IconEmployees = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.2" className="fill-slate-300" />
    <path
      d="M6 19c.7-2.6 3-4.5 6-4.5s5.3 1.9 6 4.5"
      className="stroke-slate-500"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="6" cy="9" r="2" className="fill-slate-200" />
    <circle cx="18" cy="9" r="2" className="fill-slate-200" />
  </svg>
);

const IconLogout = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <rect
      x="4"
      y="4"
      width="9"
      height="16"
      rx="2"
      className="fill-red-200/60"
    />
    <path
      d="M11 12h7"
      className="stroke-red-400"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M15 9l3 3-3 3"
      className="stroke-red-400"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ================================
   COMPONENTE PRINCIPAL
================================ */
export const BarberHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const today = new Date();
  const formattedDate = today.toLocaleDateString("es-AR");

  const getSectionTitle = () => {
    if (location.pathname.includes("dashboard")) return "Panel general";
    if (location.pathname.includes("clientes")) return "Clientes";
    if (location.pathname.includes("turnos")) return "Turnos";
    if (location.pathname.includes("empleados")) return "Empleados";
    return "Panel general";
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const goTo = (path: string) => navigate(path);

  const handleLogout = async () => {
    await signOut(barberAuth);
    setMenuOpen(false);
    navigate("/barber-manager/login", { replace: true });
  };

  /* ======================================
     1) CERRAR MENÚ AL HACER SCROLL
  ======================================= */
  useEffect(() => {
    let lastY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;

      // Ocultar header al bajar
      if (currentY > lastY + 10 && currentY > 80) {
        setIsHidden(true);
        setMenuOpen(false); // cerrar menú si estaba abierto
      }

      // Mostrar header al subir
      if (currentY < lastY - 10) {
        setIsHidden(false);
      }

      lastY = currentY;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ======================================
     2) CERRAR MENÚ AL HACER CLICK FUERA
  ======================================= */
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
        setMenuOpen(false); // cerrar menú al tocar afuera
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [menuOpen]);

  /* ======================================
     JSX
  ======================================= */
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-slate-900 text-white shadow-md transform transition-transform duration-200 ${
        isHidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
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

        {/* INFO DERECHA */}
        <div className="flex items-center gap-4">
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
            <span
              className={`block h-[2px] w-5 bg-white rounded-full transition-transform ${
                menuOpen ? "translate-y-[6px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-[2px] w-5 bg-white rounded-full transition-opacity ${
                menuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`block h-[2px] w-5 bg-white rounded-full transition-transform ${
                menuOpen ? "-translate-y-[6px] -rotate-45" : ""
              }`}
            />
          </button>

          {/* MENÚ DESPLEGABLE */}
          <div
            ref={menuRef}
            className={`absolute right-6 top-[52px] w-52 bg-slate-900/95 border border-slate-700 rounded-xl shadow-lg backdrop-blur-sm transition-all duration-200 ${
              menuOpen
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-xs text-slate-400">Hoy</p>
              <p className="text-xs font-medium">{formattedDate}</p>
            </div>

            <nav className="py-2">
              <button
                onClick={() => {
                  goTo("/barber-manager/dashboard");
                  setMenuOpen(false); // cerrar menú al hacer click
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-slate-800"
              >
                <IconBox>
                  <IconDashboard />
                </IconBox>
                Inicio
              </button>

              <button
                onClick={() => {
                  goTo("/barber-manager/clientes");
                  setMenuOpen(false); // cerrar menú al hacer click
                }}
                className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800"
              >
                <IconBox>
                  <IconClients />
                </IconBox>
                Clientes
              </button>

              <button
                onClick={() => {
                  goTo("/barber-manager/turnos");
                  setMenuOpen(false); // cerrar menú al hacer click
                }}
                className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800"
              >
                <IconBox>
                  <IconCalendar />
                </IconBox>
                Turnos
              </button>

              <button
                onClick={() => {
                  goTo("/barber-manager/empleados");
                  setMenuOpen(false); // cerrar menú al hacer click
                }}
                className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-slate-800"
              >
                <IconBox>
                  <IconEmployees />
                </IconBox>
                Empleados
              </button>

              <div className="border-t border-slate-700 mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 flex items-center gap-2 text-left text-red-300 hover:bg-red-600/20 hover:text-red-200"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-900/40">
                    <IconLogout />
                  </span>
                  Cerrar sesión
                </button>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
