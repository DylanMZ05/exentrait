import React from 'react';

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
    // Generación de la URL con el mensaje predefinido
    const WHATSAPP_URL_WITH_MESSAGE = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_MESSAGE}`;
    
    // El div exterior utiliza el color de fondo opcional
    return (
        <div className={`flex justify-center py-12 ${bgColor}`}>
            <a 
                href={WHATSAPP_URL_WITH_MESSAGE} // URL con el mensaje predefinido
                target="_blank"
                rel="noopener noreferrer"
                // Clases de estilo del botón
                className="
                    inline-flex items-center justify-center 
                    bg-cyan-600 hover:bg-cyan-700 
                    text-white font-semibold text-lg 
                    py-3 px-6 rounded-lg
                    shadow-xl transition-all duration-300
                    transform hover:scale-105
                "
            >
                
                Empieza tu Proyecto de Software a Medida
            </a>
        </div>
    );
};

export default WhatsAppCTA;