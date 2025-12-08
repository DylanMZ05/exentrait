import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';

// --- Constantes de Contacto ---
const WHATSAPP_NUMBER = '5492257538156'; 
const DEFAULT_MESSAGE = "Tengo una pregunta específica que no está en el FAQ de la App de Barbería. ¿Me ayudan?";
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

// --- Data de Preguntas Frecuentes ---
interface FAQItemData {
    question: string;
    answer: string;
}

const FAQ_DATA: FAQItemData[] = [
    {
        question: "¿Cuál es el costo del software y el modelo de pago?",
        answer: "Ofrecemos un modelo de suscripción mensual flexible, sin contratos a largo plazo. El costo varía según el número de estilistas activos en tu barbería. Contáctanos para recibir una cotización exacta adaptada a tu equipo.",
    },
    {
        question: "¿Qué tan difícil es la implementación y la migración de mi agenda actual?",
        answer: "La implementación es rápida y asistida. Puedes empezar a operar en el mismo día.",
    },
    {
        question: "¿El software funciona en dispositivos móviles (celulares y tablets)?",
        answer: "Sí. Nuestra plataforma es completamente web (funciona en cualquier navegador) y está optimizada para ser 100% responsiva. No necesitas descargar una app, garantizando la misma experiencia en PC, tablet o smartphone.",
    },
    {
        question: "¿Qué tipo de soporte técnico ofrecen?",
        answer: "Ofrecemos soporte premium por chat y WhatsApp los 7 días de la semana, además de una base de conocimiento con tutoriales en video. Queremos asegurarnos de que nunca detengas tu operación.",
    },
    {
        question: "¿Puedo probar el software antes de pagar?",
        answer: "¡Absolutamente! Ofrecemos una demo personalizada sin compromiso donde puedes ver la plataforma en acción y resolver todas tus dudas antes de tomar cualquier decisión.",
    },
];

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
                <span className="text-xl font-semibold text-gray-800 hover:text-cyan-600 transition-colors duration-200">
                    {question}
                </span>
                <ChevronDown 
                    className={`w-6 h-6 text-cyan-600 transition-transform duration-300 ${isOpen ? 'transform rotate-180' : ''}`}
                />
            </button>
            
            <div
                id={`faq-answer-${question.replace(/\s/g, '-')}`}
                className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
                role="region"
                aria-labelledby={`faq-question-${question.replace(/\s/g, '-')}`}
            >
                <p className="text-gray-600 pl-2 pr-6 border-l-2 border-cyan-400">
                    {answer}
                </p>
            </div>
        </div>
    );
};

// --- Componente Principal de la Sección ---
const FifthSectionBarber: React.FC = () => {
    
    // 💡 NUEVOS HOOKS DE ANIMACIÓN POR BLOQUE
    const { isVisible: isHeaderVisible, elementRef: headerRef } = useScrollAnimation(0.2); 
    const { isVisible: isFaqVisible, elementRef: faqRef } = useScrollAnimation(0.3); 
    const { isVisible: isCtaVisible, elementRef: ctaRef } = useScrollAnimation(0.2); 
    
    const transitionBaseClass = "transform transition-all duration-700 ease-out";
    const entryAnimationClass = (visible: boolean) => 
        `${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`;

    return (
        <section id='faq' className="py-20 bg-white relative overflow-hidden">
            <div className="container mx-auto px-4 md:px-8">
                
                {/* 1. Título y Subtítulo Central (Header - Animación Escalonada) */}
                <div 
                    className="max-w-4xl mx-auto text-center mb-12"
                    ref={headerRef as React.RefObject<HTMLDivElement>}
                >
                    <span 
                        className={`text-cyan-600 text-base font-semibold uppercase tracking-wider block ${transitionBaseClass} ${entryAnimationClass(isHeaderVisible)}`}
                        style={{ transitionDelay: '0ms' }}
                    >
                        Preguntas Frecuentes
                    </span>
                    <h2 
                        className={`mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 ${transitionBaseClass} ${entryAnimationClass(isHeaderVisible)}`}
                        style={{ transitionDelay: '100ms' }}
                    >
                        Resolvemos tus <span className="text-cyan-700">Últimas Dudas</span>
                    </h2>
                    <p 
                        className={`mt-4 text-lg sm:text-xl text-gray-600 ${transitionBaseClass} ${entryAnimationClass(isHeaderVisible)}`}
                        style={{ transitionDelay: '200ms' }}
                    >
                        Transparencia total. Antes de solicitar tu demo, conoce todo lo esencial sobre el software.
                    </p>
                </div>

                {/* 2. Contenedor de FAQ (Acordeón - Animación como Bloque Único) */}
                <div 
                    className="max-w-3xl mx-auto mt-10"
                    ref={faqRef as React.RefObject<HTMLDivElement>}
                >
                    <div 
                        className={`bg-gray-50 p-6 rounded-xl border border-gray-200 ${transitionBaseClass} ${entryAnimationClass(isFaqVisible)}`}
                        style={{ transitionDelay: '350ms' }} // Aparece después del Header
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
                        style={{ transitionDelay: '500ms' }} // Aparece después del contenedor FAQ
                    >
                        ¿No encuentras tu pregunta? ¡Escríbenos directamente!
                    </h3>
                    <a 
                        href={WHATSAPP_URL_WITH_MESSAGE}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center px-8 py-3 border-2 border-cyan-600 text-lg font-semibold rounded-full 
                            text-cyan-600 hover:bg-cyan-600 hover:text-white transition duration-300 ${transitionBaseClass} ${entryAnimationClass(isCtaVisible)}`}
                        style={{ transitionDelay: '650ms' }}
                    >
                        <MessageSquare className="w-5 h-5 mr-2" />
                        Enviar Pregunta por WhatsApp
                    </a>
                </div>

            </div>
        </section>
    );
};

export default FifthSectionBarber;