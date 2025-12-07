// ProductShowcase.tsx

import React, { useRef, useState, useEffect } from 'react';

// URL de la App Móvil para Gym Manager (PLACEHOLDER)
const GYM_APP_LINK = '/gym-manager/'; 
// URL de la App Móvil para Barber Manager (PLACEHOLDER)
const BARBER_APP_LINK = '/barber-manager/'; 

// === Hook Personalizado useInView (Con control de Sincronización) ===
const useInView = <T extends HTMLElement>(threshold: number = 0.1, once: boolean = true) => {
    const ref = useRef<T>(null); 
    const [isVisible, setIsVisible] = useState(false);
    const [shouldAnimate, setShouldAnimate] = useState(false); 

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Forzamos la activación de la transición en el próximo ciclo de eventos
        const timer = setTimeout(() => {
            setShouldAnimate(true);
        }, 0); 
        
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
            clearTimeout(timer);
            if (element) {
                observer.unobserve(element);
            }
        };
    }, [threshold, once]);

    return [ref, isVisible, shouldAnimate] as const;
};

// === Componente Principal ProductShowcase ===
const ProductShowcase: React.FC = () => {
    // Referencias y estados para el ENCABEZADO (DIV)
    const [headerRef, headerIsVisible, headerShouldAnimate] = useInView<HTMLDivElement>(0.1, true); 
    
    // Referencias y estados para los CONTENEDORES DE ANIMACIÓN (DIVs)
    const [gymRef, gymIsVisible, gymShouldAnimate] = useInView<HTMLDivElement>(0.15, true); 
    const [barberRef, barberIsVisible, barberShouldAnimate] = useInView<HTMLDivElement>(0.15, true); 
    
    // Clases de transición base
    const transitionClasses = "transition-all duration-1000 ease-out"; 

    // Lógica para aplicar las clases de visibilidad/animación (incluye el delay)
    const getVisibilityClasses = (isVisible: boolean, delayClass: string) => 
        isVisible 
            ? `opacity-100 translate-y-0 ${delayClass}` 
            : `opacity-0 translate-y-8 ${delayClass}`;
        
    // Generación de clases específicas
    const headerVisibility = getVisibilityClasses(headerIsVisible, 'delay-[0ms]');
    const gymVisibility = getVisibilityClasses(gymIsVisible, 'delay-[100ms]');
    const barberVisibility = getVisibilityClasses(barberIsVisible, 'delay-[350ms]');

    // Función para obtener las clases completas, controlando cuándo se aplica la transición
    const getFinalClasses = (visibilityClasses: string, shouldAnimate: boolean) => {
        // Si shouldAnimate es falso (Render 1), solo aplicamos el estado oculto (sin transition).
        if (!shouldAnimate) {
            return 'opacity-0 translate-y-8';
        }
        // Si shouldAnimate es true (Render 2+), aplicamos la visibilidad condicional Y la transición.
        return `${visibilityClasses} ${transitionClasses}`;
    }

    // Función que se ejecuta en el click de los botones para evitar que el evento 
    // se propague al enlace padre de la tarjeta.
    const handleButtonClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        // Detiene la propagación del evento click al elemento padre (la tarjeta <a>)
        e.stopPropagation(); 
    };

    return (
        <section id='plataformas' className="pt-16 pb-5 bg-white">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                
                {/* Título de la Sección */}
                <div 
                    ref={headerRef} 
                    className={`${getFinalClasses(headerVisibility, headerShouldAnimate)} text-center mb-16`}
                >
                    <h2 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                        Plataformas de Gestión Diseñadas para Crecer
                    </h2>
                    <p className="text-xl text-gray-500 max-w-3xl mx-auto">
                        Interfaz limpia, potencia extrema.
                    </p>
                </div>
                
                {/* ESTRUCTURA DE DOS COLUMNAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Bloque 1: GYM MANAGER */}
                    <div
                        ref={gymRef}
                        className={`${getFinalClasses(gymVisibility, gymShouldAnimate)}`}
                    >
                        <a 
                            href="/gym-landing/" 
                            // 🔑 CLASES MODIFICADAS: Ahora usa md:aspect-square y h-auto en md
                            className={`block h-[500px] md:h-auto md:aspect-square 
                                        relative overflow-hidden bg-[#E8E8E8] group`}
                        >
                            {/* IMAGEN DE FONDO con la animación de zoom */}
                            <div 
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out transform group-hover:scale-[1.05]"
                                style={{
                                    backgroundImage: `url(src/assets/gym-app.webp)`, 
                                    // Aseguramos que la imagen cubra completamente el área cuadrada
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    zIndex: 0,
                                }}
                            ></div>
                            
                            {/* Contenido: Alineado AL FONDO para dejar más imagen visible arriba */}
                            <div className="relative z-10 h-full flex flex-col items-center **justify-end** text-center **pb-10** p-8">
                                
                                {/* Título: Ajustamos a text-3xl en md para que quepa mejor en un cuadrado. */}
                                <h3 className="text-4xl md:text-3xl lg:text-5xl font-semibold text-gray-900 mb-2 tracking-tight">
                                    GYM MANAGER 
                                </h3>
                                
                                {/* Subtítulo/Descripción: font-medium para ser más fino */}
                                <p className="text-xl font-medium text-gray-800 mb-6 max-w-md">
                                    Administración gimnasios.
                                </p>
                                
                                {/* CTA/Botones */}
                                <div className="flex justify-center space-x-4">
                                    {/* Botón "Más Información" (Lleva al href principal: /gym-landing/) */}
                                    <button 
                                        // Usamos handleButtonClick para evitar que el click en el botón 
                                        // active el link principal de la tarjeta.
                                        onClick={handleButtonClick}
                                        className="text-base py-1 px-4 text-white bg-cyan-600 hover:bg-cyan-700 rounded-full transition duration-150 cursor-pointer"
                                    >
                                        Más Información
                                    </button>
                                    
                                    {/* Botón "App" (Cambiado a <a> con link específico) */}
                                    <a 
                                        href={GYM_APP_LINK} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={handleButtonClick}
                                        className="text-base py-1 px-4 text-gray-900 border border-cyan-600 bg-transparent hover:bg-gray-100 rounded-full transition duration-150 cursor-pointer flex items-center justify-center"
                                    >
                                        App
                                    </a>
                                </div>
                            </div>
                        </a>
                    </div>
                    
                    {/* Bloque 2: BARBER MANAGER */}
                    <div
                        ref={barberRef}
                        className={`${getFinalClasses(barberVisibility, barberShouldAnimate)} `}
                    >
                        <a 
                            href="/barber-manager/" 
                            // 🔑 CLASES MODIFICADAS: Ahora usa md:aspect-square y h-auto en md
                            className={`block h-[500px] md:h-auto md:aspect-square 
                                        relative overflow-hidden bg-[#E8E8E8] group`}
                        >
                            {/* IMAGEN DE FONDO con la animación de zoom */}
                            <div 
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out transform group-hover:scale-[1.05]"
                                style={{
                                    backgroundImage: `url(src/assets/barber-app.webp)`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    zIndex: 0,
                                }}
                            ></div>
                            
                            {/* Contenido: Alineado AL FONDO para dejar más imagen visible arriba */}
                            <div className="relative z-10 h-full flex flex-col items-center **justify-end** text-center **pb-10** p-8">
                                
                                {/* Título: Ajustamos a text-3xl en md para que quepa mejor en un cuadrado. */}
                                <h3 className="text-4xl md:text-3xl lg:text-5xl font-semibold text-gray-900 mb-2 tracking-tight">
                                    BARBER MANAGER
                                </h3>
                                
                                {/* Subtítulo/Descripción: font-medium para ser más fino */}
                                <p className="text-xl font-medium text-gray-800 mb-6 max-w-md">
                                    Gestión barberías/salones.
                                </p>
                                
                                {/* CTA/Botones */}
                                <div className="flex justify-center space-x-4">
                                    {/* Botón "Más Información" (Lleva al href principal: /barber-manager/) */}
                                    <button 
                                        onClick={handleButtonClick}
                                        className="text-base py-1 px-4 text-white bg-cyan-600 hover:bg-cyan-700 rounded-full transition duration-150 cursor-pointer"
                                    >
                                        Más Información
                                    </button>
                                    
                                    {/* Botón "App" (Cambiado a <a> con link específico) */}
                                    <a 
                                        href={BARBER_APP_LINK} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={handleButtonClick}
                                        className="text-base py-1 px-4 text-gray-900 border border-cyan-600 bg-transparent hover:bg-gray-100 rounded-full transition duration-150 cursor-pointer flex items-center justify-center"
                                    >
                                        App
                                    </a>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProductShowcase;