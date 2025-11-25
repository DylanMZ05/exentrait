import { Link } from "react-router-dom";

// IMPORTANTE: Simulamos la variable 'logo' para evitar el error de compilación
// de archivos locales, pero el resto del componente usa 'logo' como solicitaste.
const logo = "../assets/logo-2.png";

export default function Footer() {
  
  // Función para desplazar la ventana a la parte superior al hacer clic
  const scrollToTop = () => {
    window.scrollTo(0, 0);
  };

  return (
    <footer className="bg-[#0b0c1a] text-white py-12 px-6 shadow-2xl mt-8">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Columna 1: Logo y Branding */}
        <div className="md:col-span-2 space-y-4">
          <Link to="/" className="inline-block" onClick={scrollToTop}>
            <img
              src={logo}
              alt="Exentra Logo"
              className="h-8 w-auto transition-transform duration-200 hover:scale-[1.02]"
            />
          </Link>
          <p className="text-sm text-slate-400">
            Plataformas de gestión para negocios de alto rendimiento.
          </p>
          <div className="text-xs text-slate-500 pt-4">
            &copy; {new Date().getFullYear()} Exentra. Todos los derechos reservados.
          </div>
        </div>

        {/* Columna 2: Navegación Principal */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
            General
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors">
                Inicio
              </Link>
            </li>
          </ul>
        </div>

        {/* Columna 3: Áreas de Gestión */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
            Gestión
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/gym-manager/" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors">
                Gestión Gimnasio
              </Link>
            </li>
            <li>
              <Link to="/barber-manager/login" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors">
                Gestión Barbería
              </Link>
            </li>
          </ul>
        </div>

      </div>
    </footer>
  );
}