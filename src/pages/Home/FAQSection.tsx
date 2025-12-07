import React, { useRef, useState, useEffect } from 'react';

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

// Lógica para aplicar las clases de visibilidad/animación
const transitionClasses = "transition-all duration-1000 ease-out"; 

const getVisibilityClasses = (isVisible: boolean, delayClass: string) => 
    isVisible 
        ? `opacity-100 translate-y-0 ${delayClass}` 
        : `opacity-0 translate-y-8 ${delayClass}`;

const getFinalClasses = (visibilityClasses: string, shouldAnimate: boolean) => {
    if (!shouldAnimate) {
        return 'opacity-0 translate-y-8';
    }
    return `${visibilityClasses} ${transitionClasses}`;
}

// Iconos simples para el estado del desplegable (usando SVG)
const PlusIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-600 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

const MinusIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-600 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
);

interface FAQItemProps {
    question: string;
    answer: string;
}

// Componente individual de la Pregunta Frecuente (SIN animación de Scroll)
const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const toggleOpen = () => setIsOpen(!isOpen);

    return (
        <div 
            className="border-b border-gray-200 py-6"
        >
            <button
                className="flex justify-between items-center w-full text-left focus:outline-none cursor-pointer"
                onClick={toggleOpen}
            >
                <span className="text-xl font-semibold text-gray-800 hover:text-cyan-600 transition duration-300 pr-2 cursor-pointer">
                    {question}
                </span>
                {/* Rotación del icono para indicar el estado */}
                <div className={`transform ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                    {isOpen ? <MinusIcon /> : <PlusIcon />}
                </div>
            </button>
            
            {/* Contenido de la Respuesta con animación de Altura */}
            <div 
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                    maxHeight: isOpen ? '200px' : '0', // Altura máxima para la animación (ajustar si las respuestas son muy largas)
                    opacity: isOpen ? 1 : 0,
                    paddingTop: isOpen ? '1rem' : '0',
                }}
            >
                <p className="text-lg text-gray-600 pr-10">{answer}</p>
            </div>
        </div>
    );
};

// Datos de las Preguntas Frecuentes
const faqData = [
    {
        question: "¿Para qué negocios está diseñada la plataforma?",
        answer: "La plataforma es una solución de gestión integral diseñada específicamente para Gimnasios (GYM MANAGER) y Barberías/Salones (BARBER MANAGER). Cubre clientes, citas, personal, comisiones y reportes esenciales."
    },
    {
        question: "¿Puedo acceder a la plataforma desde mi teléfono o tablet?",
        answer: "Sí, es totalmente multiplataforma. La interfaz es 100% responsive, permitiendo el uso óptimo tanto en ordenadores de escritorio como en dispositivos móviles."
    },
    {
        question: "¿Puedo gestionar varias sucursales en la misma cuenta?",
        answer: "Sí, puedes gestionar múltiples ubicaciones. Sin embargo, ten en cuenta que los datos se resumen a nivel global y no se generan reportes de rendimiento individuales por cada sucursal."
    },
    {
        question: "¿Cómo se calculan y gestionan las comisiones del personal?",
        answer: "El sistema de comisiones es de autogestión: el dueño o administrador configura el porcentaje deseado para cada empleado. La plataforma realiza el cálculo de forma automática."
    },
    {
        question: "¿La plataforma permite la reserva de citas online por parte del cliente?",
        answer: "Actualmente, la funcionalidad de reserva de citas para el cliente final no está disponible. Es una prioridad y se encuentra activa en nuestro roadmap de desarrollo."
    },
    {
        question: "¿Cuál es el costo de la suscripción mensual?",
        answer: "Ofrecemos una única y potente suscripción, dependiendo del sistema a contratar. No aplicamos límites en la cantidad de usuarios, citas o clientes que puedes gestionar."
    },
    {
        question: "¿Existe alguna penalización si decido cancelar mi suscripción?",
        answer: "No hay penalización económica por cancelar. Solo si la cuenta permanece inactiva y sin uso por más de tres (3) meses, se procederá a eliminar la información."
    },
    {
        question: "¿Cómo se garantiza la seguridad de los datos de mi negocio?",
        answer: "Todos los datos sensibles están encriptados mediante técnicas de hashing. Además, la información está alojada en un entorno seguro en la nube con copias de seguridad automáticas de alta disponibilidad."
    },
];

// Componente principal de la Sección FAQ
const FAQSection: React.FC = () => {
    // Referencia para el Encabezado
    const [headerRef, headerIsVisible, headerShouldAnimate] = useInView<HTMLDivElement>(0.1, true); 
    const headerVisibility = getVisibilityClasses(headerIsVisible, 'delay-[0ms]');
    
    // Referencia para el Contenedor de las preguntas (para animación de bloque)
    const [faqContainerRef, faqContainerIsVisible, faqContainerShouldAnimate] = useInView<HTMLDivElement>(0.1, true); 
    // Clase de visibilidad sin delay adicional para que aparezca todo a la vez
    const faqContainerVisibility = getVisibilityClasses(faqContainerIsVisible, 'delay-[150ms]'); 


    return (
        <section className="pt-5 bg-white">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                
                {/* Encabezado (con animación de Scroll) */}
                <div 
                    ref={headerRef} 
                    className={`${getFinalClasses(headerVisibility, headerShouldAnimate)} text-center mb-12`}
                >
                    <h2 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                        Preguntas Frecuentes
                    </h2>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                        Resolvemos las dudas más comunes sobre la implementación y el uso de nuestra plataforma.
                    </p>
                </div>
                
                {/* Contenedor de las Preguntas (con animación de Scroll de bloque) */}
                <div 
                    ref={faqContainerRef}
                    className={`${getFinalClasses(faqContainerVisibility, faqContainerShouldAnimate)} bg-white rounded-lg p-2`}
                >
                    {faqData.map((item, index) => (
                        <FAQItem 
                            key={index} 
                            question={item.question} 
                            answer={item.answer} 
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FAQSection;