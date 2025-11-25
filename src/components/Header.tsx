import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo-2.png"; 

// Definición de las rutas principales
const menuItems = [
  { name: "Inicio", path: "/" },
  { name: "Gestión Gimnasio", path: "/gym-manager/" },
  { name: "Gestión Barbería", path: "/barber-manager/login" },
];

// ICONOS HAMBURGUESA Y CIERRE (SVG)
const MenuIcon = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => (
  <button 
    // Ahora solo visible en pantallas pequeñas
    className="cursor-pointer w-8 h-8 flex flex-col justify-around relative focus:outline-none z-50 transition-transform duration-300 ease-in-out lg:hidden"
    onClick={onClick}
    aria-label="Toggle Menu"
  >
    <div className={`block h-[3px] w-full bg-white transform transition duration-300 ease-in-out ${isOpen ? 'rotate-45 translate-y-2.5' : 'rotate-0'}`} />
    <div className={`block h-[3px] w-full bg-white transform transition duration-300 ease-in-out ${isOpen ? 'opacity-0' : 'opacity-100'}`} />
    <div className={`block h-[3px] w-full bg-white transform transition duration-300 ease-in-out ${isOpen ? '-rotate-45 -translate-y-2.5' : 'rotate-0'}`} />
  </button>
);


export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true); // Estado para esconder/mostrar en scroll
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Estado para manejar el scroll up/down
  const lastScrollY = useRef(0);

  // =========================================================
  // LOGIC 1: ESCONDER/MOSTRAR HEADER EN SCROLL
  // =========================================================
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;

    // Si el scroll es muy pequeño al principio, no hacer nada
    if (Math.abs(currentScrollY - lastScrollY.current) < 50) {
      return;
    }

    // SCROLL DOWN (Esconder)
    if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
      setIsVisible(false);
      setIsMenuOpen(false); // Asegurarse de cerrar el menú al hacer scroll
    } 
    // SCROLL UP (Mostrar)
    else if (currentScrollY < lastScrollY.current) {
      setIsVisible(true);
    }

    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // =========================================================
  // LOGIC 2: CERRAR MENÚ AL CLICKEAR FUERA
  // =========================================================
  const handleClickOutside = useCallback((event: MouseEvent) => {
    // Si el menú está abierto y el clic no fue dentro del contenedor del menú
    if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsMenuOpen(false);
    }
  }, [isMenuOpen]);

  useEffect(() => {
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    // Limpiar listener al cambiar de ruta
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, handleClickOutside, location.pathname]);


  // Cerrar menú al cambiar de ruta (Link clickeado)
  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);


  // Estilos del header para la animación de esconder/mostrar
  const headerClasses = `
    fixed top-0 left-0 w-full z-40
    bg-[#0b0c1a] py-4 shadow-xl transition-transform duration-300
    ${isVisible ? 'transform translate-y-0' : 'transform -translate-y-full'}
  `;


  return (
    <header className={headerClasses} ref={menuRef}>
      <div className="flex items-center justify-between px-6 container mx-auto">
        
        {/* Logo Link */}
        <Link to="/" onClick={() => setIsMenuOpen(false)}>
          <img
            src={logo}
            alt="Exentra Logo"
            className="h-8 sm:h-10 w-auto cursor-pointer transition-transform duration-200 hover:scale-105"
          />
        </Link>
        
        {/* =========================================================
            MENU DE ESCRITORIO (LG) - CON SEPARADOR SUTIL
        ========================================================= */}
        <nav className="hidden lg:flex items-center">
          {menuItems.map((item, index) => (
            <Link
              key={item.path}
              to={item.path}
              className={`
                text-white text-base font-medium transition-colors hover:text-gray-300 
                px-4 py-1 
                ${index < menuItems.length - 1 ? 'border-r border-slate-700/50' : ''} // Borde sutil a la derecha
              `}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Toggle Hamburguesa (Solo Móvil) */}
        <div className="z-50 lg:hidden">
          <MenuIcon isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
        </div>
      </div>
      
      {/* =========================================================
          MENÚ LATERAL (SIDE DRAWER) - SOLO PARA MÓVIL
      ========================================================= */}
      {/* Overlay para cerrar al tocar fuera */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 lg:hidden" />
      )}
      
      <div
        className={`fixed top-0 right-0 h-screen w-64 bg-slate-900 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out
          ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:hidden 
        `}
        style={{ paddingTop: '6rem' }} // Evita que el contenido se superponga con el header (64px)
      >
        <nav className="flex flex-col p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMenuOpen(false)}
              className="text-white text-lg font-medium py-3 px-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

    </header>
  );
}