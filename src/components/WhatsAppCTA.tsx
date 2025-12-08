import React, { useState, useEffect, useRef } from 'react';

// Número de WhatsApp (código de país + número)
const WHATSAPP_NUMBER = '5492257538156'; 

// Mensaje predefinido codificado para URL
const DEFAULT_MESSAGE = "Hola! Me comunico desde la web de Exentra IT! Me gustaría charlar sobre un proyecto que tengo en mente";
const ENCODED_MESSAGE = encodeURIComponent(DEFAULT_MESSAGE);

// Estructura de Props
interface WhatsAppCTAProps {
    /** * Clase de color de fondo opcional para la sección (e.g., 'bg-gray-100', 'bg-black').
     * Por defecto es 'bg-white'.
     */
    bgColor?: string;
}

const WhatsAppCTA: React.FC<WhatsAppCTAProps> = ({ bgColor = 'bg-white' }) => {
    
    // --- Lógica de Detección de Scroll (IntersectionObserver) ---
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null); // Referencia al <div> contenedor

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Si el elemento está intersectando (visible), cambiamos el estado
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    // Opcional: Desconectar el observer después de la primera vez que se hace visible
                    observer.unobserve(entry.target); 
                }
            },
            {
                root: null, // El viewport
                rootMargin: '0px',
                threshold: 0.2, // El 20% del elemento debe ser visible para disparar
            }
        );

        const currentElement = elementRef.current;

        if (currentElement) {
            observer.observe(currentElement);
        }

        // Cleanup: Desconectar el observer al desmontar el componente
        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
            }
        };
    }, []);
    // --------------------------------------------------------------------

    // Generación de la URL con el mensaje predefinido
    const WHATSAPP_URL_WITH_MESSAGE = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_MESSAGE}`;
    
    // El div exterior utiliza el color de fondo opcional y la referencia
    return (
        <div 
            className={`flex justify-center py-12 ${bgColor}`}
            ref={elementRef} // Asignamos la referencia aquí para detectar visibilidad
        >
            <a 
                href={WHATSAPP_URL_WITH_MESSAGE} // URL con el mensaje predefinido
                target="_blank"
                rel="noopener noreferrer"
                // Clases de estilo del botón
                className={`
                    inline-flex items-center justify-center 
                    bg-cyan-600 hover:bg-cyan-700 
                    text-white font-semibold text-lg 
                    py-3 px-6 rounded-lg
                    shadow-xl transition-all duration-700 ease-out // Aumenté la duración para que sea más visible
                    transform hover:scale-105 mx-5 text-center

                    // --- CLASES DE ANIMACIÓN APLICADAS CON EL ESTADO 'isVisible' ---
                    ${isVisible 
                        ? 'opacity-100 translate-y-0' 
                        : 'opacity-0 translate-y-8' // Se esconde 8px hacia abajo y tiene opacidad 0
                    }
                `}
            >
                Empieza tu Proyecto de Software a Medida
            </a>
        </div>
    );
};

export default WhatsAppCTA;