import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, Heart } from 'lucide-react'; // Ícono Heart para el CTA

// --- Constantes de Contacto ---
const WHATSAPP_NUMBER = '5492257538156'; 
const DEFAULT_MESSAGE = "Tengo una pregunta específica que no está en el FAQ de la App de Gimnasio. ¿Me ayudan?";
const ENCODED_MESSAGE = encodeURIComponent(DEFAULT_MESSAGE);
const WHATSAPP_URL_WITH_MESSAGE = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_MESSAGE}`;

// --- Data de Preguntas Frecuentes (Adaptadas a Gimnasios) ---
interface FAQItemData {
    question: string;
    answer: string;
}

const FAQ_DATA: FAQItemData[] = [
    {
        question: "¿Cómo se calcula el costo del software y hay tarifas ocultas?",
        answer: "El costo se basa en el número de socios activos o la cantidad de sedes que maneja tu gimnasio. Ofrecemos planes flexibles de suscripción mensual/anual y el precio es completamente transparente, sin tarifas ocultas por soporte o actualizaciones.",
    },
    {
        question: "¿Puedo integrar mi sistema de control de acceso (torniquetes/puertas) existente?",
        answer: "Sí. Nuestra plataforma está diseñada para ser modular y compatible con la mayoría de los sistemas de control de acceso basado en DNI. Nuestro equipo técnico asiste en la integración.",
    },
    {
        question: "¿Qué pasa con la migración de mi base de datos de socios?",
        answer: "No contamos con un proceso de migración asistida para importar tu base de datos actual de socios, historial de pagos y rutinas. En caso de tener otro sistema, habrá que hablar personalmente con uno de nuestros técnicos para evaluar la viabilidad.",
    },
    {
        question: "¿Qué soporte técnico recibo si tengo problemas en horarios pico?",
        answer: "Ofrecemos soporte premium por chat y teléfono los 7 días de la semana, cubriendo horarios extendidos para coincidir con los picos de afluencia de tu gimnasio. Tu operación es nuestra prioridad.",
    },
];

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

// --- Componente Individual de Acordeón FAQ ---
const FAQItem: React.FC<FAQItemData> = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border-b border-gray-200 py-6">
            <button
                className="flex justify-between items-center w-full text-left focus:outline-none cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${question.replace(/\s/g, '-')}`}
            >
                <span className="text-xl font-semibold text-gray-800 hover:text-lime-600 transition-colors duration-200"> {/* <-- Color Lime */}
                    {question}
                </span>
                <ChevronDown 
                    className={`w-6 h-6 text-lime-600 transition-transform duration-300 ${isOpen ? 'transform rotate-180' : ''}`}
                />
            </button>
            
            <div
                id={`faq-answer-${question.replace(/\s/g, '-')}`}
                className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
                role="region"
                aria-labelledby={`faq-question-${question.replace(/\s/g, '-')}`}
            >
                <p className="text-gray-600 pl-2 pr-6 border-l-2 border-lime-400"> {/* <-- Color Lime */}
                    {answer}
                </p>
            </div>
        </div>
    );
};

// --- Componente Principal de la Sección ---
const FifthSectionGym: React.FC = () => {
    
    // Lógica de animación por bloque
    const { isVisible: isHeaderVisible, elementRef: headerRef } = useScrollAnimation(0.2); 
    const { isVisible: isFaqVisible, elementRef: faqRef } = useScrollAnimation(0.3); 
    const { isVisible: isCtaVisible, elementRef: ctaRef } = useScrollAnimation(0.2); 
    
    const transitionBaseClass = "transform transition-all duration-700 ease-out";
    const entryAnimationClass = (visible: boolean) => 
        `${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`;

    return (
        <section id='faq-gym' className="py-20 bg-white relative overflow-hidden"> {/* <-- ID adaptado */}
            <div className="container mx-auto px-4 md:px-8">
                
                {/* 1. Título y Subtítulo Central (Header - Animación Escalonada) */}
                <div 
                    className="max-w-4xl mx-auto text-center mb-12"
                    ref={headerRef as React.RefObject<HTMLDivElement>}
                >
                    <span 
                        className={`text-lime-600 text-base font-semibold uppercase tracking-wider block ${transitionBaseClass} ${entryAnimationClass(isHeaderVisible)}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        Preguntas Frecuentes
                    </span>
                    <h2 
                        className={`mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 ${transitionBaseClass} ${entryAnimationClass(isHeaderVisible)}`}
                        style={{ transitionDelay: '100ms' }}
                    >
                        Resuelve tus <span className="text-lime-700">Dudas de Crecimiento</span> {/* <-- Texto y Color Lime */}
                    </h2>
                    <p 
                        className={`mt-4 text-lg sm:text-xl text-gray-600 ${transitionBaseClass} ${entryAnimationClass(isHeaderVisible)}`}
                        style={{ transitionDelay: '200ms' }}
                    >
                        Transparencia total sobre costos, implementación y cómo el software impulsa la retención de socios.
                    </p>
                </div>

                {/* 2. Contenedor de FAQ (Acordeón - Animación como Bloque Único) */}
                <div 
                    className="max-w-3xl mx-auto mt-10"
                    ref={faqRef as React.RefObject<HTMLDivElement>}
                >
                    <div 
                        className={`bg-gray-50 p-6 rounded-xl border border-gray-200 ${transitionBaseClass} ${entryAnimationClass(isFaqVisible)}`}
                        style={{ transitionDelay: '350ms' }} 
                    >
                        {FAQ_DATA.map((item, index) => (
                            <FAQItem 
                                key={index}
                                question={item.question}
                                answer={item.answer}
                            />
                        ))}
                    </div>
                </div>

                {/* 3. CTA Flotante para Preguntas No Resueltas (Animación) */}
                <div 
                    className="mt-16 text-center"
                    ref={ctaRef as React.RefObject<HTMLDivElement>}
                >
                    <h3 
                        className={`text-2xl font-bold text-gray-900 mb-4 ${transitionBaseClass} ${entryAnimationClass(isCtaVisible)}`}
                        style={{ transitionDelay: '500ms' }} 
                    >
                        ¿Listo para comenzar a optimizar tu gimnasio?
                    </h3>
                    <a 
                        href={WHATSAPP_URL_WITH_MESSAGE}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center px-8 py-3 border-2 border-lime-600 text-lg font-semibold rounded-full 
                            text-lime-600 hover:bg-lime-600 hover:text-white transition duration-300 ${transitionBaseClass} ${entryAnimationClass(isCtaVisible)}`}
                        style={{ transitionDelay: '650ms' }}
                    >
                        <Heart className="w-5 h-5 mr-2" /> {/* <-- Ícono temático */}
                        Solicita tu Demo Gratuita y Personalizada
                    </a>
                </div>

            </div>
        </section>
    );
};

export default FifthSectionGym;