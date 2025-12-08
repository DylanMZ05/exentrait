import React, { useRef, useEffect, useState } from 'react';
import { Calendar, ArrowRight, Zap, Scissors } from 'lucide-react';

// --- Constantes de Contacto (Máxima Importancia) ---
const WHATSAPP_NUMBER = '5492257538156'; 
const CTA_MESSAGE = "¡Estoy listo para automatizar mi barbería! Quiero mi demo del software ahora mismo.";
const ENCODED_CTA_MESSAGE = encodeURIComponent(CTA_MESSAGE);
const WHATSAPP_URL_WITH_MESSAGE = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_CTA_MESSAGE}`;

// --- FUNCIÓN DE SCROLL SUAVE (Añadida para su uso) ---
const scrollToElement = (id: string) => {
    const element = document.getElementById(id.replace('#', ''));
    if (element) {
        const yOffset = -50; 
        const yPosition = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: yPosition, behavior: 'smooth' });
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

// --- Componente de la Sección ---
const SixthSectionBarber: React.FC = () => {
    
    // Aplicamos el hook al contenedor del contenido (contentRef)
    const { isVisible: isContentVisible, elementRef: contentRef } = useScrollAnimation(0.2); 
    
    const transitionBaseClass = "transform transition-all duration-700 ease-out";
    const entryAnimationClass = (visible: boolean) => 
        `${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`;

    return (
        <section 
            className="py-24 md:py-40 bg-gray-950 relative overflow-hidden" 
        >
            {/* 1. Fondo (Permanece estático) */}
            <div className="absolute inset-0 bg-gray-950 opacity-90"></div>
            <div 
                className="absolute inset-0 opacity-10" 
                style={{ 
                    backgroundImage: 'url("https://images.unsplash.com/photo-1549487928-872f2e46b970?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    mixBlendMode: 'lighten'
                }}
            ></div>
            
            {/* 2. Elementos Gráficos NEÓN (Permanece estático) */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Tijeras grandes superior izquierda */}
                <div className="absolute top-10 left-1/4 w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_20px_#00ffff,0_0_40px_#00ffff]"></div>
                <div className="absolute top-1/4 left-5 w-72 h-72 opacity-50 text-cyan-500/20 transform -rotate-45">
                    <Scissors className="w-full h-full" strokeWidth={1} />
                </div>
                
                {/* Navaja lateral derecha */}
                <div className="absolute bottom-1/4 right-5 w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_20px_#00ffff,0_0_40px_#00ffff]"></div>
                <div className="absolute bottom-10 right-1/4 w-72 h-72 opacity-50 text-cyan-500/20 transform rotate-45">
                    <Scissors className="w-full h-full scale-x-[-1]" strokeWidth={1} /> 
                </div>
            </div>


            {/* 3. CONTENIDO (Aquí aplicamos la animación y la referencia) */}
            <div 
                className="container mx-auto px-4 md:px-8 text-white relative z-20"
                ref={contentRef as React.RefObject<HTMLDivElement>}
            >
                <div className="max-w-4xl mx-auto text-center backdrop-blur-sm bg-black/20 p-8 rounded-xl">
                    
                    {/* Icono (Animado con el primer retraso) */}
                    <Zap 
                        className={`w-16 h-16 text-cyan-400 mx-auto mb-6 shadow-[0_0_20px_#00ffff] rounded-full p-2 ${transitionBaseClass} ${entryAnimationClass(isContentVisible)}`} 
                        style={{ transitionDelay: '0ms' }}
                    />
                    
                    {/* Título de Alto Impacto (Animación Escalonada) */}
                    <h2 
                        className={`text-4xl md:text-6xl font-extrabold tracking-tighter leading-snug ${transitionBaseClass} ${entryAnimationClass(isContentVisible)}`}
                        style={{ transitionDelay: '100ms' }}
                    >
                        No Dejes Tu Crecimiento
                        <span className="block text-cyan-500 mt-2">Al Azar. Actúa Hoy.</span>
                    </h2>
                    
                    {/* Mensaje Final Fuerte (Animación Escalonada) */}
                    <p 
                        className={`mt-6 text-xl text-gray-300 max-w-2xl mx-auto ${transitionBaseClass} ${entryAnimationClass(isContentVisible)}`}
                        style={{ transitionDelay: '200ms' }}
                    >
                        Miles de reservas, gestión de personal, análisis de rendimiento... todo lo que necesitas para escalar tu barbería, ahora mismo, sin contratos confusos.
                    </p>

                    {/* CTA Principal (El Botón Definitivo - Retraso mayor) */}
                    <div className="mt-10">
                        <a 
                            href={WHATSAPP_URL_WITH_MESSAGE}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center justify-center px-12 py-5 border border-transparent text-xl font-extrabold rounded-full shadow-2xl 
                                bg-cyan-600 text-white hover:bg-cyan-700 
                                transition duration-300 transform hover:scale-105 ${transitionBaseClass} ${entryAnimationClass(isContentVisible)}`}
                            style={{ transitionDelay: '400ms' }}
                        >
                            <Calendar className="w-6 h-6 mr-3" />
                            ¡Quiero Mi Demo Ahora!
                        </a>
                    </div>
                    
                    {/* CTA Secundario (Garantía o Siguiente Paso - Último Retraso con SCROLL SUAVE) */}
                    <div className="mt-6">
                        <a 
                            href="#features" 
                            onClick={(e) => {
                                e.preventDefault(); // Evita el salto brusco
                                scrollToElement('features'); // Aplica el scroll suave
                            }}
                            className={`inline-flex items-center text-lg font-semibold text-gray-400 hover:text-cyan-400 transition duration-300 ${transitionBaseClass} ${entryAnimationClass(isContentVisible)}`}
                            style={{ transitionDelay: '600ms' }}
                        >
                            <ArrowRight className="w-5 h-5 mr-2" />
                            ¿Dudas? Revisa las características nuevamente
                        </a>
                    </div>
                    
                </div>
            </div>
        </section>
    );
};

export default SixthSectionBarber;