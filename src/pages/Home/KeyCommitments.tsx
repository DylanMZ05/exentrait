// KeyCommitments.tsx

import React, { useRef, useState, useEffect } from 'react';

/**
 * Hook personalizado para detectar cuando un elemento entra en el viewport.
 * Utiliza la Intersection Observer API.
 * @param threshold El porcentaje del elemento que debe estar visible (0.1 = 10%).
 * @param once Si la animación solo debe ocurrir una vez.
 * @returns [ref, isVisible]
 */
const useInView = (threshold: number = 0.1, once: boolean = true) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (once) {
                        observer.unobserve(element);
                    }
                } else if (!once) {
                    setIsVisible(false);
                }
            },
            { threshold }
        );

        observer.observe(element);

        return () => {
            if (element) {
                observer.unobserve(element);
            }
        };
    }, [threshold, once]);

    return [ref, isVisible] as const;
};


const KeyCommitments: React.FC = () => {
    // Referencias y estados para el encabezado (título + subtítulo)
    const [headerRef, headerIsVisible] = useInView(0.1, true);
    
    // Referencias y estados individuales para cada tarjeta
    // Nota: El threshold está ligeramente elevado (0.15) para que se disparen
    // tan pronto como el usuario las vea.
    const [card1Ref, card1IsVisible] = useInView(0.15, true);
    const [card2Ref, card2IsVisible] = useInView(0.15, true);
    const [card3Ref, card3IsVisible] = useInView(0.15, true);

    const transitionClasses = "transition-all duration-700 ease-out";

    // Visibilidad del encabezado (delay 0ms)
    const headerVisibility = headerIsVisible 
        ? "opacity-100 translate-y-0 delay-[0ms]" 
        : "opacity-0 translate-y-8 delay-[0ms]";
        
    // Visibilidad de las tarjetas con retraso progresivo (escalonado)
    const card1Visibility = card1IsVisible 
        ? "opacity-100 translate-y-0 delay-[100ms]" 
        : "opacity-0 translate-y-8 delay-[100ms]";
        
    const card2Visibility = card2IsVisible 
        ? "opacity-100 translate-y-0 delay-[250ms]" 
        : "opacity-0 translate-y-8 delay-[250ms]";
        
    const card3Visibility = card3IsVisible 
        ? "opacity-100 translate-y-0 delay-[400ms]" 
        : "opacity-0 translate-y-8 delay-[400ms]";


    return (
        <section className="pt-20 bg-gray-100">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
                
                {/* 🎯 HEADER (Título y Subtítulo) */}
                <div ref={headerRef as React.RefObject<HTMLDivElement>} 
                     className={`${headerVisibility} ${transitionClasses}`}>
                    <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
                        Nuestro Compromiso de Valor
                    </h2>
                    <p className="text-xl text-gray-600 mb-12 max-w-4xl mx-auto">
                        En <span className="font-semibold text-gray-800">EXENTRA IT</span>, entendemos que el éxito se basa en la 
                        <span className="font-semibold text-gray-800"> eficiencia </span>, la 
                        <span className="font-semibold text-gray-800"> usabilidad </span> y un soporte que realmente apoya el crecimiento de su negocio.
                    </p>
                </div>
                
                {/* 🎯 TARJETAS - Contenedor de las 3 columnas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
                    
                    {/* Columna 1: Interfaces Sencillas (Usabilidad) */}
                    <div ref={card1Ref as React.RefObject<HTMLDivElement>} 
                         className={`${card1Visibility} ${transitionClasses} p-6`}>
                        {/* IMAGEN 1: Interfaz */}
                        <img 
                            src="src/assets/interfaz.webp" 
                            alt="Diseño de interfaz de usuario" 
                            className="w-16 h-16 mb-4 mx-auto object-contain"
                        />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Usabilidad sin Precedentes</h3>
                        <p className="text-gray-600">
                            Diseñamos pensando en el usuario. Nuestras interfaces son <span className='font-bold'>intuitivas y veloces</span>, minimizando la curva de aprendizaje y optimizando el tiempo de su equipo.
                        </p>
                    </div>

                    {/* Columna 2: Velocidad de Desarrollo y Entrega (Eficiencia) */}
                    <div ref={card2Ref as React.RefObject<HTMLDivElement>} 
                         className={`${card2Visibility} ${transitionClasses} p-6`}>
                        {/* IMAGEN 2: Veloz */}
                        <img 
                            src="src/assets/veloz.webp" 
                            alt="Icono de velocidad y agilidad" 
                            className="w-16 h-16 mb-4 mx-auto object-contain"
                        />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Desarrollo Ágil y Escala Rápida</h3>
                        <p className="text-gray-600">
                            Nuestra metodología garantiza la entrega <span className='font-bold'>rápida de valor</span> y una <span className='font-bold'>implementación eficiente</span>. Su negocio estará operativo y escalando en el menor tiempo posible.
                        </p>
                    </div>

                    {/* Columna 3: Soporte y Adaptabilidad (Relación a Largo Plazo) */}
                    <div ref={card3Ref as React.RefObject<HTMLDivElement>} 
                        className={`${card3Visibility} ${transitionClasses} p-6`}>
                        {/* IMAGEN 3: Apoyo Técnico */}
                        <img 
                            src="src/assets/apoyo-tecnico.webp" 
                            alt="Icono de apoyo técnico o soporte" 
                            className="w-16 h-16 mb-4 mx-auto object-contain"
                        />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Soporte Dedicado y Evolución Constante</h3>
                        <p className="text-gray-600">
                            Somos su <span className='font-bold'>socio tecnológico</span> a largo plazo. Ofrecemos soporte continuo y la capacidad de <span className='font-bold'>adaptar, escalar y extender</span> su software a medida que su negocio crece.
                        </p>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default KeyCommitments;