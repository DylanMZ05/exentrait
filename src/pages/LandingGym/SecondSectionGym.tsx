import React, { useRef, useEffect, useState } from 'react';
import { BarChart3, Heart, Zap, DollarSign } from 'lucide-react'; // Íconos adaptados

// --- FUNCIÓN DE SCROLL SUAVE (Necesaria para el CTA) ---
const scrollToElement = (id: string) => {
    const element = document.getElementById(id.replace('#', ''));
    if (element) {
        const yOffset = 0; 
        const yPosition = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

        window.scrollTo({
            top: yPosition,
            behavior: 'smooth'
        });
    }
};

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


// --- Interfaz para las propiedades de cada pilar ---
interface FeaturePillarProps {
    icon: React.ElementType;
    title: string;
    description: string;
    delay: number; // Retraso de animación
}

// --- Componente de Pilar Individual (Animado con Scroll) ---
const FeaturePillar: React.FC<FeaturePillarProps> = ({ icon: Icon, title, description, delay }) => {
    const { isVisible, elementRef } = useScrollAnimation(0.5); // Activación al 50%
    const transitionDelay = `${delay}ms`;

    return (
        <div 
            ref={elementRef as React.RefObject<HTMLDivElement>}
            className={`
                p-6 rounded-xl border border-gray-200 shadow-xl bg-white 
                transform transition-all duration-700 ease-out 
                
                ${isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-10'
                }
            `}
            style={{ transitionDelay: transitionDelay }}
        >
            <div className="flex items-center space-x-4 mb-4">
                {/* Ícono de color de acento (Verde Lima) */}
                <Icon className="w-8 h-8 text-lime-600" strokeWidth={2} />
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            </div>
            <p className="text-gray-600">{description}</p>
        </div>
    );
};


// --- Componente Principal de la Sección (Añadida Animación a Textos y CTA) ---
const SecondSectionGym: React.FC = () => {
    
    // Lógica de animación para Títulos y CTA
    const { isVisible: isTextVisible, elementRef: textRef } = useScrollAnimation(0.2); 
    // Corregido: 'isCtaVisible' ya no se declara porque no se usa
    const { elementRef: ctaRef } = useScrollAnimation(0.2); 

    const textTransitionClass = `
        transform transition-all duration-700 ease-out 
        ${isTextVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }
    `;

    // Datos de los Pilares (Retrasos ajustados)
    const pillars = [
        {
            icon: Heart, // Nuevo enfoque en Retención y Salud
            title: "1. Máxima Retención",
            description: "Controla el check-in, gestiona las membresías con renovación automática y envía notificaciones personalizadas para mantener a tus socios activos.",
            delay: 300, // Inicia después de que los títulos terminen
        },
        {
            icon: Zap, // Nuevo enfoque en Eficiencia
            title: "2. Optimización Operativa",
            description: "Simplifica la programación de clases y maneja la disponibilidad de equipos y espacios de forma intuitiva, ahorrando tiempo diario.",
            delay: 450, // Retraso para efecto escalonado
        },
        {
            icon: DollarSign, // Nuevo enfoque en Finanzas
            title: "3. Control Financiero",
            description: "Obtén reportes detallados de ingresos y gastos, permitiendo una toma de decisiones inteligente y un crecimiento sostenible.",
            delay: 600, // Retraso adicional
        },
    ];

    return (
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4 md:px-8">
                
                {/* Subtítulo y Título Central (Animación Escalonada) */}
                <div 
                    className="max-w-4xl mx-auto text-center mb-16"
                    ref={textRef as React.RefObject<HTMLDivElement>} 
                >
                    <span 
                        className={`text-lime-600 text-base font-semibold uppercase tracking-wider block mb-2 ${textTransitionClass}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        El Core de tu Negocio
                    </span>
                    <h2 
                        className={`mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 ${textTransitionClass}`}
                        style={{ transitionDelay: '100ms' }}
                    > 
                        Crece y Escala con <span className="text-lime-700">Tres Pilares de Control</span>
                    </h2>
                    <p 
                        className={`mt-4 text-lg sm:text-xl text-gray-600 ${textTransitionClass}`}
                        style={{ transitionDelay: '200ms' }}
                    > 
                        Una solución modular diseñada para la realidad del fitness: enfócate en el entrenamiento, no en la administración.
                    </p>
                </div>

                {/* Contenedor de Pilares (Layout Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {pillars.map((pillar, index) => (
                        <FeaturePillar 
                            key={index}
                            icon={pillar.icon}
                            title={pillar.title}
                            description={pillar.description}
                            // El delay se aplica DENTRO del componente FeaturePillar
                            delay={pillar.delay} 
                        />
                    ))}
                </div>

                {/* CTA Reforzado (Soft CTA - Animación) */}
                <div 
                    className="mt-16 text-center"
                    ref={ctaRef as React.RefObject<HTMLDivElement>}
                >
                    <a 
                        href="#video-gym" // ID de la siguiente sección (Video Demo)
                        onClick={(e) => {
                            e.preventDefault(); 
                            scrollToElement('video-gym'); 
                        }}
                        className={`inline-flex items-center text-lg font-semibold text-gray-800 hover:text-lime-600 transition duration-300 ${textTransitionClass}`}
                        style={{ transitionDelay: '750ms' }} // Retraso mayor para que aparezca al final
                    >
                        <BarChart3 className="w-5 h-5 text-lime-600 mr-2" />
                        ¿Listo para maximizar ganancias? Mira cómo funciona.
                    </a>
                </div>

            </div>
        </section>
    );
};

export default SecondSectionGym;