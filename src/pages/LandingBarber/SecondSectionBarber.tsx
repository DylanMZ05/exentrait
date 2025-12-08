import React, { useRef, useEffect, useState } from 'react';
import { Clock, BarChart3, Users, CheckCircle } from 'lucide-react';

// --- FUNCIÓN DE SCROLL SUAVE ---
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

// --- Interfaz para las propiedades de cada pilar ---
interface FeaturePillarProps {
    icon: React.ElementType;
    title: string;
    description: string;
    delay: number; // Retraso de animación
}

// --- Componente de Pilar Individual (Ya Animado con Scroll) ---
const FeaturePillar: React.FC<FeaturePillarProps> = ({ icon: Icon, title, description, delay }) => {
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
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.5, // Se activa cuando el 50% del elemento es visible
            }
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
    }, []);

    const transitionDelay = `${delay}ms`;

    return (
        <div 
            ref={elementRef}
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
                {/* Ícono de color de acento */}
                <Icon className="w-8 h-8 text-cyan-600" strokeWidth={2} />
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            </div>
            <p className="text-gray-600">{description}</p>
        </div>
    );
};


// --- Componente Principal de la Sección (Añadida Animación a Textos) ---
const SecondSectionBarber: React.FC = () => {
    
    // 💡 NUEVA LÓGICA: Animación para Títulos y CTA
    const [isTextVisible, setIsTextVisible] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsTextVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.2, // Activar cuando el 20% del texto sea visible
            }
        );

        const currentElement = textRef.current;
        if (currentElement) {
            observer.observe(currentElement);
        }

        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
            }
        };
    }, []);
    // ------------------------------------------------------------------

    // Datos de los Pilares
    const pillars = [
        {
            icon: Clock,
            title: "1. Agenda Perfecta",
            description: "Elimina los errores de doble reserva y las llamadas constantes.",
            delay: 300, // Ajustado para iniciar DESPUÉS de los títulos
        },
        {
            icon: Users,
            title: "2. Experiencia Premium",
            description: "Ofrece un proceso de reserva fluido y profesional. Gestión de historial y preferencias para un servicio ultra-personalizado.",
            delay: 450, 
        },
        {
            icon: BarChart3,
            title: "3. Crecimiento Inteligente",
            description: "Obtén métricas clave en tiempo real: rendimiento del estilista y análisis de ingresos para tomar mejores decisiones.",
            delay: 600, 
        },
    ];

    const textTransitionClass = `
        transform transition-all duration-700 ease-out 
        ${isTextVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }
    `;

    return (
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4 md:px-8">
                
                {/* Subtítulo y Título Central (Aplicada Animación) */}
                <div 
                    className="max-w-4xl mx-auto text-center mb-16"
                    ref={textRef} // Referencia para observar los textos
                >
                    {/* Título y subtítulos con retrasos individuales para efecto escalonado dentro del bloque */}
                    <span 
                        className={`text-cyan-600 text-base font-semibold uppercase tracking-wider block mb-2 ${textTransitionClass}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        La Solución de Gestión Definitiva
                    </span>
                    <h2 
                        className={`mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 ${textTransitionClass}`}
                        style={{ transitionDelay: '100ms' }}
                    > 
                        Controla tu Barbería con <span className="text-cyan-700">Tres Pilares de Éxito</span>
                    </h2>
                    <p 
                        className={`mt-4 text-lg sm:text-xl text-gray-600 ${textTransitionClass}`}
                        style={{ transitionDelay: '200ms' }}
                    > 
                        Dejamos atrás el papel y las hojas de cálculo. Nuestro software está diseñado para la realidad de tu negocio: rápido, visual y potente.
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
                            // El delay ya no es solo index*150, sino que comienza después de los títulos
                            delay={pillar.delay} 
                        />
                    ))}
                </div>

                {/* CTA Reforzado (Soft CTA - Aplicada Animación) */}
                <div 
                    className={`mt-16 text-center ${textTransitionClass}`}
                    style={{ transitionDelay: '750ms' }} // Retraso mayor para que aparezca al final
                >
                    <a 
                        href="#video" 
                        onClick={(e) => {
                            e.preventDefault(); 
                            scrollToElement('video'); 
                        }}
                        className="inline-flex items-center text-lg font-semibold text-gray-800 hover:text-cyan-600 transition duration-300"
                    >
                        <CheckCircle className="w-5 h-5 text-cyan-600 mr-2" />
                        ¿Listo para modernizar tu negocio? Explora todas las funciones aquí.
                    </a>
                </div>

            </div>
        </section>
    );
};

export default SecondSectionBarber;