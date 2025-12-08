import React, { useEffect } from 'react';

// --- Constantes de Contacto ---
const CONTACT_EMAIL = "exentrait.company@gmail.com";
const CONTACT_WHATSAPP = "5492257538156"; 
const COMPANY_NAME = "Exentra IT"; 
const LAST_UPDATED = "08 de Diciembre de 2025"; // Fecha de la última actualización

const TermsAndConditionsPage: React.FC = () => {
    
    // Función para asegurar que la página siempre comience en la parte superior
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Componente para la Subsección con título
    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="mb-8 border-l-4 border-cyan-500 pl-4">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">{title}</h3>
            <div className="text-gray-600 space-y-4">
                {children}
            </div>
        </div>
    );

    return (
        <div className="bg-white min-h-screen py-20 px-4 md:px-8">
            <div className="container mx-auto max-w-4xl pt-10">

                <h1 className="text-5xl font-extrabold text-gray-900 mb-4 border-b pb-2">
                    Términos y Condiciones de Servicio
                </h1>
                <p className="text-lg text-gray-500 mb-8">
                    <strong className="font-bold">Última actualización:</strong> {LAST_UPDATED}
                </p>

                <p className="mb-8 text-lg">
                    Bienvenido a <strong className="font-bold">{COMPANY_NAME}</strong>. Estos Términos y Condiciones ("Términos") rigen el uso de nuestros servicios de software de gestión para negocios especializados (Gimnasios y Barberías, en adelante, "el Servicio"). Al acceder o utilizar el Servicio, usted acepta estar legalmente sujeto a estos Términos. Si no está de acuerdo con alguna parte de los Términos, no debe utilizar el Servicio.
                </p>

                {/* --- 1. Aceptación de los Términos --- */}
                <Section title="1. Aceptación de los Términos">
                    <p>Estos Términos constituyen un acuerdo legal vinculante entre usted (el "Cliente" o "Usuario") y {COMPANY_NAME}. El uso del Servicio está condicionado a la aceptación incondicional de estos Términos y nuestra Política de Privacidad.</p>
                </Section>

                {/* --- 2. Descripción del Servicio --- */}
                <Section title="2. Descripción del Servicio">
                    <p>{COMPANY_NAME} proporciona un software basado en la nube para la gestión de negocios de servicios, incluyendo, pero no limitándose a, agendamiento de citas/clases, gestión de membresías, control de acceso, punto de venta (POS) y reportes de rendimiento. El acceso al Servicio se otorga mediante una suscripción de pago.</p>
                </Section>

                <hr className="my-10" />

                {/* --- 3. Uso y Responsabilidad del Cliente --- */}
                <Section title="3. Uso y Responsabilidad del Cliente">
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        {/* 💡 CORRECCIÓN DE NEGRITAS */}
                        <li><strong className="font-semibold">Cuenta de Usuario:</strong> Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades que ocurran bajo su cuenta.</li>
                        <li><strong className="font-semibold">Uso Legal:</strong> Usted acepta utilizar el Servicio únicamente para fines legales y de conformidad con todas las leyes y regulaciones aplicables.</li>
                        <li><strong className="font-semibold">Datos del Cliente Final:</strong> Usted es el único responsable de la legalidad, precisión y adecuación de los datos personales de sus clientes finales cargados en el Servicio. Debe obtener los consentimientos necesarios para el procesamiento de dichos datos.</li>
                        <li><strong className="font-semibold">Prohibiciones:</strong> Está prohibido el uso del Servicio para enviar spam, material ilegal, o cualquier contenido que viole los derechos de terceros.</li>
                    </ul>
                </Section>

                {/* --- 4. Suscripciones y Pagos --- */}
                <Section title="4. Suscripciones, Tarifas y Cancelación">
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        {/* 💡 CORRECCIÓN DE NEGRITAS */}
                        <li><strong className="font-semibold">Modelo de Pago:</strong> El Servicio se ofrece mediante una suscripción mensual o anual. Las tarifas se basan en el plan seleccionado (ej., número de estilistas, número de socios, o sedes).</li>
                        <li><strong className="font-semibold">Renovación:</strong> Las suscripciones se renuevan automáticamente al final del periodo de facturación, a menos que el Cliente cancele antes de la fecha de renovación.</li>
                        <li><strong className="font-semibold">Cancelación:</strong> El Cliente puede cancelar la suscripción en cualquier momento. La cancelación entrará en vigor al final del ciclo de facturación actual. No se emitirán reembolsos por periodos no utilizados.</li>
                        <li><strong className="font-semibold">Cambios en Tarifas:</strong> Nos reservamos el derecho de modificar las tarifas con un preaviso de [30] días.</li>
                    </ul>
                </Section>

                <hr className="my-10" />

                {/* --- 5. Propiedad Intelectual --- */}
                <Section title="5. Propiedad Intelectual">
                    <p>El Servicio, incluyendo software, diseños, logotipos y contenido de las *landing pages*, es propiedad exclusiva de {COMPANY_NAME} y está protegido por leyes de derechos de autor y propiedad intelectual. Se le otorga una licencia limitada, no exclusiva e intransferible para usar el Servicio mientras su suscripción esté activa.</p>
                    <p>Los datos que usted introduce en el Servicio (datos de su negocio y de sus clientes finales) siguen siendo propiedad suya.</p>
                </Section>

                {/* --- 6. Limitación de Responsabilidad --- */}
                <Section title="6. Limitación de Responsabilidad">
                    <p>El Servicio se proporciona "tal cual" y "según disponibilidad". {COMPANY_NAME} no garantiza que el Servicio será ininterrumpido, libre de errores o seguro. En la máxima medida permitida por la ley, {COMPANY_NAME} no será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo pérdida de beneficios o datos, derivados del uso o la imposibilidad de usar el Servicio.</p>
                </Section>

                <hr className="my-10" />

                {/* --- 7. Jurisdicción y Ley Aplicable --- */}
                <Section title="7. Jurisdicción y Ley Aplicable">
                    <p>Estos Términos se regirán e interpretarán de acuerdo con las leyes de <strong className="font-semibold">[PAÍS DE OPERACIÓN, ej., Argentina]</strong>. Cualquier disputa se someterá a la jurisdicción exclusiva de los tribunales de <strong className="font-semibold">[CIUDAD DE OPERACIÓN, ej., Buenos Aires]</strong>.</p>
                </Section>

                {/* --- 8. Contacto --- */}
                <Section title="8. Contacto">
                    <p>Para cualquier pregunta o aclaración sobre estos Términos, por favor contáctenos en:</p>
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        <li className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                            Email: <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-cyan-600 ml-1 font-semibold">{CONTACT_EMAIL}</a>
                        </li>
                        <li className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            WhatsApp: {CONTACT_WHATSAPP}
                        </li>
                    </ul>
                </Section>

            </div>
        </div>
    );
};

export default TermsAndConditionsPage;