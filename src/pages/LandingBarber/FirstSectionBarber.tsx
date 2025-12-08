import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Smartphone, Scissors } from 'lucide-react'; // <-- Importamos Scissors

// --- Constantes de Contacto (Ajustar según la Barbería/Demo) ---
const WHATSAPP_NUMBER = '5492257538156'; 
const DEFAULT_MESSAGE = "Hola, me interesa la demo de su Software de Gestión para Barberías.";
const ENCODED_MESSAGE = encodeURIComponent(DEFAULT_MESSAGE);
const WHATSAPP_URL_WITH_MESSAGE = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_MESSAGE}`;

// --- Configuración de Animación (Framer Motion Variants) ---

// Contenedor principal: Stagger para animar los hijos secuencialmente
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1, // Retraso de 0.1s entre cada hijo
            delayChildren: 0.2    // Retraso de 0.2s antes de que empiece el primer hijo
        }
    }
};

// Elementos individuales: Desplazamiento desde abajo y fade-in
const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
};

// Variantes para el Ícono Temático (Aparece y gira ligeramente)



const FirstSectionBarber: React.FC = () => {
    
    // --- Implementación de Scroll Suave ---
    const scrollToElement = useCallback((id: string) => {
        const element = document.getElementById(id.replace('#', ''));
        if (element) {
            // Usamos un offset negativo para compensar el header fijo
            const yOffset = -50; 
            const yPosition = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

            window.scrollTo({
                top: yPosition,
                behavior: 'smooth'
            });
        }
    }, []);

    return (
        // Sección principal, oscura y con relleno considerable.
        <section className="bg-gray-900 text-white min-h-[90vh] flex items-center pt-20 pb-16 relative overflow-hidden">
            
            {/* Fondo con gradiente y textura sutil (simulada por clases) */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-950 to-gray-800 opacity-95"></div>
            
            {/* Líneas de acento o "corte" visual (simulación de neón o cian) */}
            <div className="absolute top-0 right-0 w-1/4 h-full bg-cyan-600/10 [clip-path:polygon(75%_0,100%_0,100%_100%,50%_100%)]"></div>

            {/* 💡 LÍNEA NEÓN en el Borde Inferior para el Cambio de BG */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-500 shadow-[0_0_15px_rgba(0,255,255,0.7)]"></div>
            

            {/* Contenedor central y animado */}
            <motion.div
                className="container mx-auto px-4 md:px-8 z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* 1. Columna de Contenido (Texto y CTAs) */}
                <div>
                    
                    {/* ✂️ AÑADIDO: ÍCONO TEMÁTICO DE BARBERÍA Y TEXTO EN UN SOLO BLOQUE */}
                    <motion.div 
                        className="flex items-center space-x-3 mb-3"
                        initial="hidden"
                        animate="visible"
                    >
                        {/* Ícono de tijeras para referencia visual rápida */}
                        <Scissors className="w-6 h-6 text-cyan-500" strokeWidth={2.5} />
                        
                        {/* El span del subtítulo se mueve junto al ícono */}
                        <span className="text-cyan-400 text-sm font-bold uppercase tracking-widest block">
                             Gestión 360° para Barberías
                        </span>
                    </motion.div>
                    
                    {/* Nota: Se eliminó el span original de la línea 74, ya que se integró arriba */}
                    
                    <motion.h1 
                        className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tighter"
                        variants={itemVariants}
                    >
                        El Poder de la <span className="text-cyan-500">Eficiencia</span> en tus Manos
                    </motion.h1>

                    <motion.p 
                        className="mt-6 text-xl text-gray-300 max-w-lg"
                        variants={itemVariants}
                    >
                        Agenda sin caos, optimiza el tiempo de tus estilistas y haz crecer tu base de clientes con el software diseñado para la precisión.
                    </motion.p>

                    {/* Contenedor de CTAs */}
                    <motion.div 
                        className="mt-10 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
                        variants={itemVariants}
                    >
                        {/* CTA Principal: Pedir Demo */}
                        <a 
                            href={WHATSAPP_URL_WITH_MESSAGE}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-bold rounded-full shadow-lg 
                                bg-cyan-600 text-white hover:bg-cyan-700 
                                transition duration-300 transform hover:scale-[1.03]"
                        >
                            <Calendar className="w-5 h-5 mr-2" />
                            Solicitar Demo Personalizada
                        </a>
                        
                        {/* CTA Secundaria: Ver Características Clave (Scroll Suave) */}
                        <a 
                            href="#features" 
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToElement('features'); // Llamada a la función de scroll
                            }}
                            className="inline-flex items-center justify-center px-8 py-4 border-2 border-cyan-600 text-base font-semibold rounded-full 
                                text-cyan-400 hover:bg-cyan-600/10 
                                transition duration-300"
                        >
                            Ver Características Clave
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </a>
                    </motion.div>
                </div>

                {/* 2. Columna de Visualización (Mockup del Software) */}
                <motion.div 
                    className="relative hidden lg:block"
                    variants={itemVariants} 
                    transition={{ duration: 0.8, delay: 0.4 }} 
                >
                    {/* Mockup estilizado de un teléfono mostrando la app */}
                    <div className="absolute inset-0 flex justify-center items-center">
                        <Smartphone className="w-20 h-20 text-cyan-600 animate-pulse" />
                        <span className="text-xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-light text-gray-400/50">App Mockup</span>
                    </div>
                    
                    {/* Placeholder de imagen o animación de la aplicación */}
                    <div 
                        className="w-full max-w-md h-96 mx-auto bg-gray-800 rounded-[2.5rem] p-1 shadow-[0_30px_60px_-12px_rgba(0,180,255,0.4),0_18px_36px_-18px_rgba(0,180,255,0.6)] 
                            flex justify-center items-center relative z-20 border-4 border-gray-700"
                    >
                        <div className="text-gray-500 italic">Aquí va el Mockup de la App</div>
                    </div>
                </motion.div>

            </motion.div>
        </section>
    );
};

export default FirstSectionBarber;