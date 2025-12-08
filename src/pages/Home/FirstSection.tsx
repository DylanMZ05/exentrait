import React, { useState, useEffect, useRef } from 'react';

type AnimationPhase = 'initial' | 'x-centered' | 'text-reveal' | 'done';

const LOGO_TEXT_PARTS = ['E', 'X', 'E', 'N', 'T', 'R', 'A', 'IT'];
const NUM_CANVAS_PARTICLES = 120;
const MAX_DEPTH = 1000;
const CANVAS_COLOR = '#0ff'; 

// --- Configuración de WhatsApp ---
const WHATSAPP_NUMBER = '5492257538156'; 
const DEFAULT_MESSAGE = "Hola! Me comunico desde la web de Exentra IT! Me gustaría charlar sobre un proyecto que tengo en mente";
const ENCODED_MESSAGE = encodeURIComponent(DEFAULT_MESSAGE);
const WHATSAPP_URL_WITH_MESSAGE = `https://wa.me/${WHATSAPP_NUMBER}?text=${ENCODED_MESSAGE}`;


// --- Lógica del Canvas para Partículas 3D (Starfield Effect) ---
// (Clase StarParticle y funciones animateCanvas/initializeParticles omitidas para brevedad, asumiendo que ya existen en el archivo original)
class StarParticle {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;

    constructor(width: number, height: number) {
        this.x = Math.random() * width - width / 2; 
        this.y = Math.random() * height - height / 2; 
        this.z = Math.random() * MAX_DEPTH; 
        this.vx = (Math.random() - 0.5) * 0.1; 
        this.vy = (Math.random() - 0.5) * 0.1;
        this.vz = 0.5 + Math.random() * 0.5;
    }

    update() {
        this.z -= this.vz; 
        this.x += this.vx;
        this.y += this.vy;

        if (this.z < 1) {
            this.z = MAX_DEPTH;
            this.x = Math.random() * window.innerWidth - window.innerWidth / 2;
            this.y = Math.random() * window.innerHeight - window.innerHeight / 2;
        }
    }

    getProjectedPosition(width: number, height: number): { screenX: number, screenY: number, size: number, opacity: number } {
        const p = 500 / this.z; 

        const screenX = this.x * p + width / 2;
        const screenY = this.y * p + height / 2;
        
        const size = 1 + p * 1.5; 
        const opacity = 1 - this.z / MAX_DEPTH; 

        return { screenX, screenY, size, opacity };
    }

    draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const { screenX, screenY, size, opacity } = this.getProjectedPosition(width, height);

        if (screenX < 0 || screenX > width || screenY < 0 || screenY > height) return;

        ctx.fillStyle = `rgba(0, 255, 255, ${opacity * 0.5})`; 
        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

let particles: StarParticle[] = [];
let animationFrameId: number;

const animateCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    
    ctx.fillStyle = 'rgba(13, 13, 13, 0.3)'; 
    ctx.fillRect(0, 0, width, height); 
    
    ctx.shadowBlur = 10;
    ctx.shadowColor = CANVAS_COLOR;

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw(ctx, width, height);
    }
    
    ctx.shadowBlur = 0;

    animationFrameId = requestAnimationFrame(() => animateCanvas(canvas, ctx));
};


// --- FUNCIÓN DE SCROLL SUAVE CORREGIDA ---
const scrollToElement = (id: string) => {
    // Aseguramos que el ID no tenga el '#' para usarlo con document.getElementById
    const element = document.getElementById(id.replace('#', ''));
    if (element) {
        const yOffset = 0; 
        const yPosition = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

        window.scrollTo({
            top: yPosition,
            behavior: 'smooth'
        });
    }
};

// --- Componente Principal ---

const FirstSection: React.FC = () => {
    const [phase, setPhase] = useState<AnimationPhase>('initial');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // 🎯 NUEVO: Estado y Referencia para la Animación de Scroll de la Sección
    const [isSectionVisible, setIsSectionVisible] = useState(false);
    const sectionRef = useRef<HTMLElement>(null);

    // Lógica de Animación Inicial (Logo)
    useEffect(() => {
        const timer1 = setTimeout(() => { setPhase('x-centered'); }, 100); 
        const timer2 = setTimeout(() => { setPhase('text-reveal'); }, 1500); 
        const timer3 = setTimeout(() => { setPhase('done'); }, 3000); 

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);

    // Lógica de Canvas 3D
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const initializeParticles = () => {
            particles = [];
            for (let i = 0; i < NUM_CANVAS_PARTICLES; i++) {
                particles.push(new StarParticle(window.innerWidth, window.innerHeight));
            }
        };

        initializeParticles();
        animateCanvas(canvas, ctx);

        const handleResize = () => { initializeParticles(); };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);
    
    // 🎯 NUEVO: Lógica del IntersectionObserver para la Sección
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Activar la visibilidad cuando la sección entre al viewport
                if (entry.isIntersecting) {
                    setIsSectionVisible(true);
                    // Desconectar una vez que se activa
                    observer.unobserve(entry.target);
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.15, // Se activa cuando el 15% de la sección es visible
            }
        );

        const currentElement = sectionRef.current;

        if (currentElement) {
            observer.observe(currentElement);
        }

        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
            }
        };
    }, []);
    // --------------------------------------------------------------------


    const revealDelay = (index: number) => {
        return `${index * 0.15}s`; 
    };

    return (
        <>
            {/* Contenedor Principal con Semántica <main> */}
            <main className="intro-container font-sans">
                
                {/* 🖥️ Fondo de Textura Sutil */}
                <div className="subtle-bg-texture"></div> 
                
                {/* CANVAS: Fondo TECH 3D animado */}
                <canvas ref={canvasRef} id="particle-canvas" className="particle-canvas"></canvas>

                {/* ⭐ CAPA DE FONDO OSCURO (para difuminar antes de que aparezca el logo) */}
                <div className={`
                    absolute inset-0 
                    bg-black/40 
                    z-[5] 
                    transition-opacity duration-500 ease-in-out
                    ${phase === 'initial' ? 'opacity-0' : 'opacity-100'}
                `}></div>

                {/* Contenido principal del Logo */}
                <div className="logo-content-wrapper">
                    
                    {/* H1: El Logo Animado */}
                    <h1 className={`logo-text-container phase-${phase}`}>
                        
                        {LOGO_TEXT_PARTS.map((char, index) => {
                            
                            const isX = char === 'X' && index === 1;
                            const isIT = char === 'IT' && index === 7;

                            if (isX) {
                                return (
                                    <span key={index} className={`x-char-area`}>
                                        <span className={`pattern-reveal phase-${phase}`}>
                                            <span 
                                                className={`logo-char x-char phase-${phase}`}
                                            >
                                                {char}
                                            </span>
                                        </span>
                                    </span>
                                );
                            }
                            
                            if (isIT) {
                                return (
                                    <sup 
                                        key={index} 
                                        className={`logo-char it-char phase-${phase}`}
                                        style={{ animationDelay: phase === 'text-reveal' ? revealDelay(index) : '0s' } as React.CSSProperties}
                                    >
                                        {char}
                                    </sup>
                                );
                            }
                            
                            return (
                                <span 
                                    key={index} 
                                    className={`logo-char regular-char phase-${phase}`}
                                    style={{ animationDelay: phase === 'text-reveal' ? revealDelay(index) : '0s' } as React.CSSProperties}
                                >
                                    {char}
                                </span>
                            );
                        })}
                    </h1>
                    
                    {/* H2: Texto Descriptivo para SEO (Corregido para accesibilidad) */}
                    <h2 className={`
                        mt-6 
                        text-lg 
                        md:text-xl 
                        text-gray-200 
                        tracking-wide 
                        max-w-xl 
                        text-center 
                        transition-all duration-500 delay-[.1s]
                        ${phase === 'done' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                    `}>
                        Diseño centrado en el usuario: Adapta cada detalle de tu negocio con 
                        <span className="font-bold text-white"> Interfaz Rápida y Sencilla </span> 
                        y 
                        <span className="font-bold text-white"> Personalización Total </span>.
                    </h2>

                </div>
            </main>
            
            {/* 🎯 SECCIÓN DE PRODUCTOS PROPIOS: Plataformas de Gestión MODIFICADA */}
            <section 
                className={`
                    relative -mt-16 z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8
                    // --- CLASES DE ANIMACIÓN APLICADAS ---
                    transition-all duration-700 ease-out delay-200 // Duración y retardo de la transición
                    ${isSectionVisible 
                        ? 'opacity-100 translate-y-0' 
                        : 'opacity-0 translate-y-8' // Estado inicial fuera del viewport
                    }
                `}
                ref={sectionRef} // 🎯 ASIGNAMOS LA REFERENCIA
            >
                <div className="bg-white border border-gray-300/50 overflow-hidden p-8 md:p-12 text-center">
                    
                    {/* Contenedor de imágenes de los Softwares */}
                    <div className="flex justify-center items-end mb-8 relative space-x-10">
                        
                        {/* Imagen del Software 1: Pesa (Gimnasio) */}
                        <div className="flex flex-col items-center">
                            <img 
                                src="assets/pesa.webp" 
                                alt="Icono de una pesa, representando software de gestión para gimnasios" 
                                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg"
                            />
                            <span className="text-sm font-medium text-gray-500 mt-2">Gestión Fitness</span>
                        </div>

                        {/* Separador visual */}
                        <div className="text-3xl font-light text-gray-300 hidden sm:block">|</div>
                        
                        {/* Imagen del Software 2: Barber (Barbería) */}
                        <div className="flex flex-col items-center">
                            <img 
                                src="assets/barber.webp" 
                                alt="Icono de tijeras, representando software de gestión para barberías" 
                                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg"
                            />
                            <span className="text-sm font-medium text-gray-500 mt-2">Gestión Salón</span>
                        </div>
                    </div>
                    
                    {/* Título: Plataformas de Gestión Modular Especializada (Corregido) */}
                    <h3 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                        Plataformas de Gestión Modular Especializada
                    </h3>
                    
                    {/* Descripción: Clara, destacando valor y futuro modular (Corregido) */}
                    <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
                        Somos desarrolladores enfocados en <span className="font-semibold text-gray-800">automatizar negocios</span> de alto rendimiento.
                        Nuestras soluciones iniciales, optimizadas para <span className="font-semibold text-gray-800">Fitness y Salones</span>,
                        son la base modular y escalable para expandirnos a <span className="font-semibold text-gray-800">cualquier sector</span>.
                    </p>
                    
                    {/* Llamadas a la Acción para los Softwares y Desarrollo a Medida */}
                    <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 justify-center">
                        {/* BOTÓN CON SCROLL SUAVE CORREGIDO */}
                        <a 
                            href="#plataformas" 
                            onClick={(e) => {
                                e.preventDefault(); // Evita el salto brusco predeterminado
                                scrollToElement('#plataformas');
                            }}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-lg hover:shadow-xl"
                        >
                            Descubre Nuestras Plataformas
                        </a>
                        
                        {/* Botón de Software a Medida ENLAZADO A WHATSAPP */}
                        <a 
                            href={WHATSAPP_URL_WITH_MESSAGE} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-600 hover:text-cyan-800 font-semibold py-3 px-6 rounded-lg border border-cyan-200 hover:border-cyan-400 transition duration-150 flex items-center justify-center"
                        >
                            ¿Necesitas Software a Medida? ¡Contáctanos! 
                        </a>
                    </div>
                </div>
            </section>
        </>
    );
};

export default FirstSection;