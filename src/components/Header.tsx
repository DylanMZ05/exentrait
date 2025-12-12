import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Scissors, Dumbbell, Zap } from "lucide-react";
import logo from "../assets/logo-2.png"; 

// --- Configuración de Rutas ---
const DROPDOWN_MENU_ITEMS = {
  GYM: [
    { name: "Conocer más", path: "/gym-landing/", icon: Zap },
    { name: "Acceder a la App", path: "/app-gym/login", icon: Dumbbell },
  ],
  BARBER: [
    { name: "Conocer más", path: "/barber-landing/", icon: Zap },
    { name: "Acceder a la App", path: "/barber-manager/login", icon: Scissors },
  ],
};

// Definición de las rutas principales
const menuItems = [
  { name: "Inicio", path: "/", type: "link" },
  { name: "Gestión Gimnasio", path: "/gym-landing/", type: "dropdown", key: "GYM" }, 
  { name: "Gestión Barbería", path: "/barber-landing/", type: "dropdown", key: "BARBER" }, 
];

// ICONOS HAMBURGUESA Y CIERRE (SVG)
const MenuIcon = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => (
  <button 
    className="cursor-pointer w-8 h-8 flex flex-col justify-around relative focus:outline-none z-[100] transition-transform duration-300 ease-in-out lg:hidden"
    onClick={onClick}
    aria-label="Toggle Menu"
  >
    <div className={`block h-[3px] w-full bg-white transform transition duration-300 ease-in-out ${isOpen ? 'rotate-45 translate-y-2.5' : 'rotate-0'}`} />
    <div className={`block h-[3px] w-full bg-white transform transition duration-300 ease-in-out ${isOpen ? 'opacity-0' : 'opacity-100'}`} />
    <div className={`block h-[3px] w-full bg-white transform transition duration-300 ease-in-out ${isOpen ? '-rotate-45 -translate-y-2.5' : 'rotate-0'}`} />
  </button>
);

// 💡 Interfaz para la nueva prop
interface HeaderProps {
    forceSolidBg?: boolean; // Si es true, ignora scrollY=0 y siempre usa fondo sólido.
}

export default function Header({ forceSolidBg = false }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false); 
  const [isVisible, setIsVisible] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const lastScrollY = useRef(0);

  // =========================================================
  // FUNCIÓN: SCROLL TO TOP (INSTANTÁNEO)
  // =========================================================
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'instant' }); 
  }, []);
  
  const handleHeaderClick = (callback?: () => void) => {
    scrollToTop();
    if (callback) callback();
  };

  // =========================================================
  // LOGIC 1: ESCONDER/MOSTRAR HEADER + FONDO DINÁMICO
  // =========================================================
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;

    // 💡 CAMBIO DE FONDO: TRUE si scrollY > 10
    setIsScrolled(currentScrollY > 10); 

    // Lógica para esconder/mostrar (se mantiene)
    if (Math.abs(currentScrollY - lastScrollY.current) < 50) return;

    if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
      setIsVisible(false);
      setIsMenuOpen(false);
      setActiveDropdown(null); 
    } 
    else if (currentScrollY < lastScrollY.current) {
      setIsVisible(true);
    }

    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    handleScroll(); 
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  
  // ... (handleClickOutside y useEffects de cierre se mantienen sin cambios)

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if ((isMenuOpen || activeDropdown) && menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsMenuOpen(false);
      setActiveDropdown(null); 
    }
  }, [isMenuOpen, activeDropdown]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (isMenuOpen || activeDropdown) {
      setIsMenuOpen(false);
      setActiveDropdown(null);
    }
  }, [location.pathname]);
  
  const handleDropdownToggle = (key: string) => {
    setActiveDropdown(activeDropdown === key ? null : key);
  };


  // 💡 CLASES DINÁMICAS DEL HEADER (Fondo transparente vs. Sólido)
  const headerClasses = `
    fixed top-0 left-0 w-full z-40 py-4 transition-all duration-300
    ${isVisible ? 'transform translate-y-0' : 'transform -translate-y-full'}
    ${(isScrolled || forceSolidBg) // 💡 Lógica de Fondo Forzado
        ? 'bg-[#0b0c1a]/95 backdrop-blur-sm' 
        : 'bg-transparent'
    }
  `;


  return (
    <header className={headerClasses} ref={menuRef}>
      <div className="flex items-center justify-between px-6 container mx-auto">
        
        {/* Logo Link */}
        <Link 
            to="/" 
            onClick={() => handleHeaderClick(() => { 
                setIsMenuOpen(false); 
                setActiveDropdown(null); 
            })}
        >
          <img
            src={logo}
            alt="Exentra Logo"
            className="h-8 sm:h-10 w-auto cursor-pointer transition-transform duration-200 hover:scale-105"
          />
        </Link>
        
        {/* =========================================================
            MENU DE ESCRITORIO (LG)
        ========================================================= */}
        <nav className="hidden lg:flex items-center">
          {menuItems.map((item, index) => {
            const isDropdown = item.type === 'dropdown';
            const isActive = isDropdown && activeDropdown === item.key;
            
            // Estilos base para Link/Button
            const linkClasses = `
                text-white text-base font-medium transition-colors hover:text-gray-300 
                px-4 py-1 flex items-center whitespace-nowrap
                ${index < menuItems.length - 1 ? 'border-r border-slate-700/50' : ''}
            `;

            if (isDropdown) {
              const dropdownItems = DROPDOWN_MENU_ITEMS[item.key as keyof typeof DROPDOWN_MENU_ITEMS];
              
              return (
                <div 
                  key={item.key} 
                  className="relative group"
                  onMouseEnter={() => setActiveDropdown(item.key!)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    to={item.path} 
                    className={linkClasses}
                    onClick={() => { // 💡 CORRECCIÓN: Event parameter 'e' removed
                        handleHeaderClick(() => handleDropdownToggle(item.key!));
                    }}
                    aria-expanded={isActive}
                  >
                    {item.name}
                    <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${isActive ? 'rotate-180' : 'rotate-0'}`} />
                  </Link>
                  
                  {/* Contenido del Dropdown */}
                  <div className={`
                    absolute top-full left-0 mt-4 w-56 bg-slate-800 rounded-md shadow-lg 
                    transition-all duration-300 ease-out cursor
                    ${isActive ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}
                  `}>
                    {dropdownItems.map((subItem) => {
                        const IconComponent = subItem.icon;
                        
                        return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            className="flex items-center px-4 py-3 text-sm text-white hover:bg-slate-700 transition-colors cursor-pointer"
                            onClick={() => handleHeaderClick(() => setActiveDropdown(null))}
                          >
                            <IconComponent className="w-5 h-5 mr-3 text-white/70" /> 
                            {subItem.name}
                          </Link>
                        );
                    })}
                  </div>
                </div>
              );
            }
            
            // Item simple (Inicio)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={linkClasses}
                onClick={() => handleHeaderClick(() => setActiveDropdown(null))}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Toggle Hamburguesa (Solo Móvil) */}
        <div className="z-200 lg:hidden">
          <MenuIcon isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
        </div>
      </div>
      
      {/* =========================================================
          MENÚ LATERAL (SIDE DRAWER) - Adaptado para Móvil
      ========================================================= */}
      {/* Overlay para cerrar al tocar fuera */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 lg:hidden" />
      )}
      
      <div
        className={`fixed top-0 right-0 h-screen w-64 bg-slate-900 shadow-2xl z-100 transform transition-transform duration-300 ease-in-out
          ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:hidden 
        `}
        style={{ paddingTop: '6rem' }}
      >
        <nav className="flex flex-col p-4 space-y-2">
          {menuItems.map((item) => {
            const isDropdown = item.type === 'dropdown';
            const dropdownItems = isDropdown ? DROPDOWN_MENU_ITEMS[item.key as keyof typeof DROPDOWN_MENU_ITEMS] : [];
            
            return (
              <div key={item.path}>
                {/* Botón/Link Principal en Móvil */}
                {isDropdown ? (
                  <button
                    className="flex justify-between items-center w-full text-white text-lg font-medium py-3 px-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 cursor-pointer"
                    onClick={() => handleDropdownToggle(item.key!)}
                  >
                    {item.name}
                    <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${activeDropdown === item.key ? 'rotate-180' : 'rotate-0'}`} />
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={() => handleHeaderClick(() => setIsMenuOpen(false))}
                    className="text-white text-lg font-medium py-3 px-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 block"
                  >
                    {item.name}
                  </Link>
                )}
                
                {/* Submenú Móvil */}
                {isDropdown && (
                  <div className={`overflow-hidden transition-max-height duration-300 ease-in-out`}
                    style={{ maxHeight: activeDropdown === item.key ? dropdownItems.length * 48 : 0 }} 
                  >
                    {dropdownItems.map((subItem) => {
                       const IconComponent = subItem.icon;

                       return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            onClick={() => handleHeaderClick(() => { setIsMenuOpen(false); setActiveDropdown(null); })}
                            className="flex items-center pl-8 pr-2 py-2 text-base text-gray-300 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <IconComponent className="w-5 h-5 mr-3 text-white/70" /> 
                            {subItem.name}
                          </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

    </header>
  );
}