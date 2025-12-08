import React, { useRef, useEffect, useState } from 'react';
import {
    Calendar, 
    Smartphone, 
    QrCode, 
    BarChart2, 
    Dumbbell, 
    Repeat
} from 'lucide-react'; // Íconos adaptados para fitness y gestión

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

// --- Interfaz para las propiedades de cada característica ---
interface FeatureCardProps {
    icon: React.ElementType;
    title: string;
    description: string;
    delay: number; // Retraso de animación
}

// --- Componente de Tarjeta de Característica Individual (Animado con Scroll) ---
const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description, delay }) => {
    const { isVisible, elementRef } = useScrollAnimation(0.5); // Activación al 50%
    const transitionDelay = `${delay}ms`;

    return (
        <div 
            ref={elementRef as React.RefObject<HTMLDivElement>}
            className={`
                p-6 md:p-8 rounded-xl border border-gray-200 bg-white shadow-lg 
                transform transition-all duration-700 ease-out 
                
                ${isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-10'
                }
            `}
            style={{ transitionDelay: transitionDelay }}
        >
            {/* Ícono de color de acento (Verde Lima) */}
            <Icon className="w-8 h-8 text-lime-600 mb-4" strokeWidth={2.5} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 text-base">{description}</p>
        </div>
    );
};

// --- Componente Principal de la Sección ---
const FourthSectionGym: React.FC = () => {
    
    // Lógica de animación para Títulos
    const { isVisible: isTextVisible, elementRef: textRef } = useScrollAnimation(0.1); 

    // Corregido: Se elimina el parámetro 'delay' ya que no se utiliza
    const textTransitionClass = () => `
        transform transition-all duration-700 ease-out 
        ${isTextVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }
    `;

    // Datos de las Características (Adaptados al GYM)
    const features = [
        {
            icon: Repeat, 
            title: "Membresías Recurrentes",
            description: "Reduce la fricción administrativa y el 'churn rate' involuntario.",
            delay: 300, 
        },
        {
            icon: Calendar,
            title: "Agenda de Clases Flexible",
            description: "Gestiona la capacidad por turno y maximiza la ocupación del salón.",
            delay: 400, 
        },
        {
            icon: Smartphone, 
            title: "App Móvil para Socios",
            description: "Tus clientes pueden ver sus rutinas y llevar un registro de ellas, mejorando su experiencia.",
            delay: 500, 
        },
        {
            icon: QrCode, 
            title: "Control de Acceso (Check-in)",
            description: "Check-in rápido y seguro mediante número de DNI. Monitorea la asistencia y evita el acceso de morosos.",
            delay: 600, 
        },
        {
            icon: BarChart2,
            title: "Dashboard de Rendimiento",
            description: "Visualiza métricas clave: Todo tu negocio en un solo panel.",
            delay: 700, 
        },
        {
            icon: Dumbbell, 
            title: "Gestión de Entrenamientos",
            description: "Crea y asigna rutinas personalizadas y planes de entrenamiento a cada socio. Mantén todo el progreso y seguimiento centralizado.",
            delay: 800, 
        },
    ];

    return (
        <section className="py-20 md:py-24 bg-gray-100" id="features-gym">
            <div className="container mx-auto px-4 md:px-8">
                
                {/* Título y Subtítulo Central (Animación) */}
                <div 
                    className="max-w-3xl mx-auto text-center mb-16"
                    ref={textRef as React.RefObject<HTMLDivElement>} 
                >
                    <span 
                        // Corregido: textTransitionClass ahora se llama sin argumentos
                        className={`text-lime-600 text-base font-semibold uppercase tracking-wider block mb-2 ${textTransitionClass()}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        Potencia Cada Área
                    </span>
                    <h2 
                        // Corregido: textTransitionClass ahora se llama sin argumentos
                        className={`mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 ${textTransitionClass()}`}
                        style={{ transitionDelay: '100ms' }}
                    > 
                        Todas las <span className="text-lime-700">Funcionalidades</span> que Necesitas
                    </h2>
                </div>

                {/* Grid de Características (Animación en Cascada) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <FeatureCard 
                            key={index}
                            icon={feature.icon}
                            title={feature.title}
                            description={feature.description}
                            delay={feature.delay} 
                        />
                    ))}
                </div>

            </div>
        </section>
    );
};

export default FourthSectionGym;