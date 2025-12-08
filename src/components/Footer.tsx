import { Link } from "react-router-dom";
import { Mail, MessageSquare, Home, Scale, FileText, Dumbbell, Scissors, Instagram, Linkedin } from "lucide-react"; 

// --- Constantes de Contacto ---
const WHATSAPP_NUMBER = '5492257538156';
const WHATSAPP_MESSAGE = "Hola! Quiero contactar con Exentra IT desde el Footer.";
const ENCODED_WHATSAPP_MESSAGE = encodeURIComponent(WHATSAPP_MESSAGE);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_WHATSAPP_MESSAGE}`;
const NEW_EMAIL = "exentrait.company@gmail.com";

// IMPORTANTE: Simulamos la variable 'logo' para evitar el error de compilación
const logo = "../assets/logo-2.png";

// 💡 Definición del color de íconos unificado
const ICON_COLOR_CLASS = 'text-cyan-500';

export default function Footer() {
    
    // Función para desplazar la ventana a la parte superior al hacer clic (Scroll instantáneo)
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    };
    
    // Rutas de Redes Sociales
    const SOCIAL_LINKS = [
        { icon: 'Instagram', url: "https://instagram.com/exentra_it", name: "Instagram" },
        { icon: 'Linkedin', url: "https://linkedin.com/company/exentra-it", name: "LinkedIn" },
    ];
    
    // Rutas del Footer - Estructura FINAL DE 4 BLOQUES
    const FOOTER_LINKS = {
        // 💡 BLOQUE COMBINADO: INICIO + APPS
        NAVEGACION: [
            { name: "Inicio", path: "/", icon: Home }, 
            { name: "App Gimnasio", path: "/gym-landing/", icon: Dumbbell }, 
            { name: "App Barbería", path: "/barber-landing/", icon: Scissors }, 
        ],
        LEGAL: [
            { name: "Política de Privacidad", path: "/legal/privacidad", icon: Scale }, 
            { name: "Términos y Condiciones", path: "/legal/terminos", icon: FileText }, 
        ],
        CONTACTO: [ 
             { name: "WhatsApp", path: WHATSAPP_URL, isExternal: true, isWhatsApp: true, icon: MessageSquare },
        ]
    };

    // Componente Link Personalizado para manejar links internos, externos y WhatsApp
    const FooterLink = ({ link }: { link: any }) => {
        
        // Determinación del componente de ícono
        let IconComponent: React.ElementType;
        switch (link.icon) {
            case Home: IconComponent = Home; break;
            case MessageSquare: IconComponent = MessageSquare; break;
            case Scale: IconComponent = Scale; break;
            case FileText: IconComponent = FileText; break;
            case Dumbbell: IconComponent = Dumbbell; break;
            case Scissors: IconComponent = Scissors; break;
            default: IconComponent = Home; // Fallback
        }

        if (link.isExternal) {
            // Enlace Externo (WhatsApp)
            return (
                <a 
                    href={link.path} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-slate-400 hover:text-white transition-colors flex items-center"
                >
                    <IconComponent className={`w-4 h-4 mr-2 ${ICON_COLOR_CLASS}`}/> 
                    {link.name}
                </a>
            );
        }
        
        // Enlace Interno
        return (
            <Link 
                to={link.path} 
                onClick={scrollToTop} 
                className="text-slate-400 hover:text-white transition-colors flex items-center"
            >
                <IconComponent className={`w-4 h-4 mr-2 ${ICON_COLOR_CLASS}`}/> 
                {link.name}
            </Link>
        );
    };

    return (
        <footer className="bg-[#0b0c1a] text-white py-16 px-6 shadow-2xl border-t border-slate-800">
            {/* 💡 Estructura de 4 COLUMNAS */}
            <div className="container mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
                
                {/* Columna 1: Logo, Branding y Redes */}
                <div className="col-span-2 md:col-span-1 space-y-6">
                    <Link to="/" className="inline-block" onClick={scrollToTop}>
                        <img
                            src={logo}
                            alt="Exentra Logo"
                            className="h-10 w-auto transition-transform duration-200 hover:scale-[1.02]"
                        />
                    </Link>
                    <p className="text-sm text-slate-400 max-w-xs">
                        Software de gestión modular diseñado para la precisión y el crecimiento en negocios especializados.
                    </p>
                    
                    {/* Redes Sociales */}
                    <div className="flex space-x-4 pt-2">
                        {SOCIAL_LINKS.map((social) => {
                            let IconComponent;
                            if (social.name === 'Instagram') IconComponent = Instagram;
                            else if (social.name === 'LinkedIn') IconComponent = Linkedin;

                            return (
                                <a 
                                    key={social.name}
                                    href={social.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-cyan-400 transition-colors duration-200"
                                    aria-label={social.name}
                                >
                                    {IconComponent && <IconComponent className="w-6 h-6" />}
                                </a>
                            );
                        })}
                    </div>
                </div>

                {/* Columna 2: Navegación (Inicio + Soluciones) */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold tracking-wide uppercase text-slate-300 border-b border-slate-700 pb-2">
                        Navegación
                    </h4>
                    <ul className="space-y-3 text-sm">
                        {FOOTER_LINKS.NAVEGACION.map(link => (
                            <li key={link.name}>
                                <FooterLink link={link} />
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* Columna 3: Legal */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold tracking-wide uppercase text-slate-300 border-b border-slate-700 pb-2">
                        Legal
                    </h4>
                    <ul className="space-y-2 text-sm">
                        {FOOTER_LINKS.LEGAL.map(link => (
                            <li key={link.name}>
                                <FooterLink link={link} />
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Columna 4: Contacto (Agrupado) */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold tracking-wide uppercase text-slate-300 border-b border-slate-700 pb-2">
                        Contacto
                    </h4>
                    <ul className="space-y-2 text-sm">
                        {FOOTER_LINKS.CONTACTO.map(link => (
                            <li key={link.name}>
                                <FooterLink link={link} />
                            </li>
                        ))}
                        {/* Enlace de Email, agrupado con Contacto */}
                        <li className="pt-2 flex items-center text-slate-400">
                            <Mail className={`w-4 h-4 mr-2 ${ICON_COLOR_CLASS}`}/> 
                            <a href={`mailto:${NEW_EMAIL}`} className="hover:text-white transition-colors">
                                Email
                            </a>
                        </li>
                    </ul>
                </div>

            </div>
            
            {/* Pie de Página (Copyright) */}
            <div className="mt-12 text-center border-t border-slate-800 pt-6">
                <p className="text-xs text-slate-500">
                    &copy; {new Date().getFullYear()} Exentra IT. Todos los derechos reservados.
                </p>
            </div>
        </footer>
    );
}