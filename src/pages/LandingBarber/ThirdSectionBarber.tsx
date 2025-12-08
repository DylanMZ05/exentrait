import React, { useRef, useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';

// --- Constantes de Contacto ---
const WHATSAPP_NUMBER = '5492257538156'; 
const DEFAULT_MESSAGE = "Quisiera agendar una llamada para conversar sobre el Software de Gestión para Barberías después de ver el video demo.";
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

// --- Componente de la Sección ---
const ThirdSectionBarber: React.FC = () => {
    
    // Animaciones para diferentes bloques
    const { isVisible: isTextVisible, elementRef: textRef } = useScrollAnimation(0.2); // Título y subtítulo
    const { isVisible: isVideoVisible, elementRef: videoRef } = useScrollAnimation(0.2); // Video
    const { isVisible: isCtaVisible, elementRef: ctaRef } = useScrollAnimation(0.2); // CTA final

    // Clases de transición base para todos los elementos
    const transitionBaseClass = "transform transition-all duration-700 ease-out";
    
    // Clases de animación de entrada (fade-in y desplazamiento)
    const entryAnimationClass = (visible: boolean) => 
        `${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`;

    return (
        <section id='video' className="py-20 md:py-32 bg-gray-900 relative overflow-hidden">
            <div className="container mx-auto px-4 md:px-8 text-white">
                
                {/* 1. Título y Subtítulo (Animación Escalonada Aplicada a las líneas) */}
                <div 
                    className="max-w-4xl mx-auto text-center mb-16"
                    ref={textRef as React.RefObject<HTMLDivElement>} 
                >
                    <span 
                        className={`text-cyan-400 text-base font-semibold uppercase tracking-wider block ${transitionBaseClass} ${entryAnimationClass(isTextVisible)}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        La Prueba está en la Pantalla
                    </span>
                    <h2 
                        className={`mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold ${transitionBaseClass} ${entryAnimationClass(isTextVisible)}`}
                        style={{ transitionDelay: '100ms' }}
                    >
                        Mira en <span className="text-cyan-500">90 Segundos</span> cómo funciona
                    </h2>
                    <p 
                        className={`mt-4 text-lg sm:text-xl text-gray-300 ${transitionBaseClass} ${entryAnimationClass(isTextVisible)}`}
                        style={{ transitionDelay: '200ms' }}
                    >
                        Observa la fluidez del agendamiento, la gestión de clientes y la interfaz de caja. Ver para creer.
                    </p>
                </div>

                {/* 2. Contenedor del Video / Mockup (Animación) */}
                <div 
                    ref={videoRef as React.RefObject<HTMLDivElement>}
                    className={`
                        max-w-4xl mx-auto relative shadow-2xl rounded-2xl overflow-hidden border-4 border-cyan-500/50 
                        ${transitionBaseClass}
                        ${isVideoVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
                    `}
                    style={{ transitionDelay: '350ms' }} 
                >
                    
                    {/* Placeholder para el Video (Mantenemos la estructura) */}
                    <div className="aspect-video bg-gray-800 flex flex-col justify-center items-center h-full">
                        <PlayCircle className="w-16 h-16 text-cyan-500" />
                        <p className="mt-4 text-gray-400 italic">Video de Demostración de la App</p>
                    </div>
                    
                    {/* Banner flotante de confianza */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gray-800/80 backdrop-blur-sm p-3 text-center text-sm font-medium">
                        Tecnología rápida y estable para tu crecimiento.
                    </div>
                </div>

                {/* 3. CTA Post-Video (Llamada a la Acción Fuerte - Aplicada Animación a las líneas) */}
                <div 
                    ref={ctaRef as React.RefObject<HTMLDivElement>}
                    className={`mt-16 text-center`}
                >
                    <h3 
                        className={`text-2xl font-bold mb-4 ${transitionBaseClass} ${entryAnimationClass(isCtaVisible)}`}
                        style={{ transitionDelay: '700ms' }}
                    >
                        ¿Te ha gustado lo que viste?
                    </h3>
                    <a 
                        href={WHATSAPP_URL_WITH_MESSAGE} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center px-10 py-4 border border-transparent text-lg font-bold rounded-full shadow-lg 
                            bg-cyan-600 text-white hover:bg-cyan-700 transition duration-300 transform hover:scale-[1.03]
                            ${transitionBaseClass} ${isCtaVisible ? 'opacity-100' : 'opacity-0'}
                        `}
                        style={{ transitionDelay: '800ms' }}
                    >
                        Agendar Llamada y Empezar
                    </a>
                    <p 
                        className={`mt-3 text-sm text-gray-400 ${transitionBaseClass} ${isCtaVisible ? 'opacity-100' : 'opacity-0'}`} 
                        style={{ transitionDelay: '900ms' }}
                    >
                        Te contactaremos en menos de 24 horas.
                    </p>
                </div>

            </div>
        </section>
    );
};

export default ThirdSectionBarber;