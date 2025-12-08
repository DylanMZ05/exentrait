import React, { useRef, useEffect, useState } from 'react';
import { CalendarCheck, TrendingUp, DollarSign, Smartphone, Briefcase } from 'lucide-react';

// --- Constantes de Contacto ---
const WHATSAPP_NUMBER = '5492257538156'; 
const DEFAULT_MESSAGE = "Estoy revisando las características de la app de barbería y tengo algunas preguntas antes de la demo. ¡Contactémos!";
const ENCODED_MESSAGE = encodeURIComponent(DEFAULT_MESSAGE);
const WHATSAPP_URL_WITH_MESSAGE = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_MESSAGE}`;


// --- Hook para aplicar animación de scroll a un elemento ---
const useScrollAnimation = (threshold = 0.2) => {
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            { root: null, rootMargin: '0px', threshold }
        );

        const currentElement = elementRef.current;
        if (currentElement) {
            observer.observe(currentElement);
        }

        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
            }
        };
    }, [threshold]);

    return { isVisible, elementRef };
};


// --- Data de Características por Módulo ---
interface FeatureModule {
    icon: React.ElementType;
    title: string;
    features: string[];
}

const FEATURE_MODULES: FeatureModule[] = [
    {
        icon: CalendarCheck,
        title: "Agendamiento & Clientes",
        features: [
            "Reservas online 24/7 (widget web)",
            "Contacto directo con el cliente",
            "Historial detallado de servicios por cliente",
            "Fichas de clientes personalizadas",
        ],
    },
    {
        icon: Briefcase,
        title: "Gestión de Personal",
        features: [
            "Asignación de comisiones y rendimiento",
            "Gestión de turnos y disponibilidad de estilistas",
            "Métricas individuales de productividad",
            "Control de accesos y permisos por rol",
        ],
    },
    {
        icon: DollarSign,
        title: "Finanzas",
        features: [
            "Resumen diario, mensual y anual de ingresos y gastos",
            "Cierre de caja rápido y auditable",
            "Gestión de inventario de productos",
            "Registro de gastos operativos",
        ],
    },
    {
        icon: TrendingUp,
        title: "Reportes & Analíticas",
        features: [
            "Reportes de ingresos por periodo",
            "Análisis de servicios",
            "Rentabilidad total de tu negocio",
            "Panel de control en tiempo real",
        ],
    },
];

// --- Componente de Módulo de Característica Individual (Ya Animado) ---
const FeatureModuleCard: React.FC<{ module: FeatureModule, delay: number }> = ({ module, delay }) => {
    // La lógica de animación ya está aquí (isVisible, elementRef, useEffect)
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            { root: null, rootMargin: '0px', threshold: 0.3 }
        );

        const currentElement = elementRef.current;
        if (currentElement) observer.observe(currentElement);
        return () => { if (currentElement) observer.unobserve(currentElement); };
    }, []);

    const Icon = module.icon;
    const transitionDelay = `${delay}ms`;
    const transitionBaseClass = "transition-all duration-700 ease-out";


    return (
        <div 
            ref={elementRef}
            className={`
                p-8 border border-gray-100 rounded-xl bg-white shadow-lg ${transitionBaseClass}
                transform 
                ${isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-10'
                }
            `}
            style={{ transitionDelay: transitionDelay }}
        >
            <Icon className="w-10 h-10 text-cyan-600 mb-4" strokeWidth={1.5} />
            <h3 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-2">{module.title}</h3>
            <ul className="space-y-3">
                {module.features.map((feature, idx) => (
                    // 💡 Mejorado: Aplicar animación de entrada a las listas si es necesario, pero mantendremos el foco en el card para este componente
                    <li key={idx} className="flex items-start text-gray-600">
                        <CalendarCheck className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1 mr-2" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// --- Componente Principal de la Sección (Añadida Animación a Textos y CTA) ---
const FourthSectionBarber: React.FC = () => {
    
    // 💡 NUEVA LÓGICA: Animación para Títulos y CTA
    const { isVisible: isTextVisible, elementRef: textRef } = useScrollAnimation(0.2);
    const { isVisible: isCtaVisible, elementRef: ctaRef } = useScrollAnimation(0.1); 

    const transitionBaseClass = "transform transition-all duration-700 ease-out";
    const entryAnimationClass = (visible: boolean) => 
        `${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`;

    return (
        <section id='features' className="py-20 bg-gray-50">
            <div className="container mx-auto px-4 md:px-8">
                
                {/* Título y Subtítulo Central (Animación Escalonada) */}
                <div 
                    className="max-w-4xl mx-auto text-center mb-16"
                    ref={textRef as React.RefObject<HTMLDivElement>}
                >
                    <span 
                        className={`text-cyan-600 text-base font-semibold uppercase tracking-wider block ${transitionBaseClass} ${entryAnimationClass(isTextVisible)}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        Funcionalidad Completa
                    </span>
                    <h2 
                        className={`mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 ${transitionBaseClass} ${entryAnimationClass(isTextVisible)}`}
                        style={{ transitionDelay: '100ms' }}
                    >
                        Todo lo que tu Barbería <span className="text-cyan-700">Necesita para Escalar</span>
                    </h2>
                    <p 
                        className={`mt-4 text-lg sm:text-xl text-gray-600 ${transitionBaseClass} ${entryAnimationClass(isTextVisible)}`}
                        style={{ transitionDelay: '200ms' }}
                    >
                        Dividimos las funciones en cuatro módulos clave para darte control total sobre cada aspecto del negocio.
                    </p>
                </div>

                {/* Contenedor de Módulos (Grid de 2x2) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {FEATURE_MODULES.map((module, index) => (
                        <FeatureModuleCard 
                            key={index}
                            module={module}
                            // Retraso después de que el bloque de texto ya apareció (ej. 300ms)
                            delay={300 + index * 150} 
                        />
                    ))}
                </div>

                {/* CTA Reforzado (Soft CTA - Animación Escalonada) */}
                <div 
                    className="mt-16 text-center pt-8 border-t border-gray-200"
                    ref={ctaRef as React.RefObject<HTMLDivElement>}
                >
                    <h3 
                        className={`text-2xl font-bold text-gray-900 mb-4 ${transitionBaseClass} ${entryAnimationClass(isCtaVisible)}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        ¿Te preguntas cómo se integra en tu equipo?
                    </h3>
                    <a 
                        href={WHATSAPP_URL_WITH_MESSAGE}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center text-lg font-semibold text-cyan-600 hover:text-cyan-800 transition duration-300 border-b border-cyan-600/50 ${transitionBaseClass} ${entryAnimationClass(isCtaVisible)}`}
                        style={{ transitionDelay: '150ms' }}
                    >
                        Contacta ahora y resuelve todas tus dudas con un especialista.
                        <Smartphone className="w-5 h-5 ml-2" />
                    </a>
                </div>

            </div>
        </section>
    );
};

export default FourthSectionBarber;