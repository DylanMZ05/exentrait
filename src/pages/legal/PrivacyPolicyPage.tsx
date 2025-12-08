import React, { useEffect } from 'react';

// --- Constantes de Contacto ---
const CONTACT_EMAIL = "exentrait.company@gmail.com";
const CONTACT_WHATSAPP = "5492257538156"; 
const COMPANY_NAME = "Exentra IT"; 
const LAST_UPDATED = "08 de Diciembre de 2025"; // Fecha de la última actualización

const PrivacyPolicyPage: React.FC = () => {
    
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
                    Política de Privacidad
                </h1>
                <p className="text-lg text-gray-500 mb-8">
                    <strong className="font-bold">Última actualización:</strong> {LAST_UPDATED}
                </p>

                <p className="mb-8 text-lg">
                    Esta Política de Privacidad describe cómo <strong className="font-bold">{COMPANY_NAME}</strong> ("nosotros", "nuestro" o "la Compañía") recopila, utiliza, divulga y protege la información personal obtenida a través de nuestras plataformas de gestión de software y nuestros sitios web informativos (landing pages). Al utilizar nuestros Servicios, usted acepta las prácticas descritas aquí.
                </p>

                {/* --- 2. Información que Recopilamos --- */}
                <Section title="2. Información que Recopilamos">
                    
                    <p className="font-semibold text-gray-800">A. Información Proporcionada Directamente (Usuarios y Prospectos)</p>
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        {/* 💡 CORRECCIÓN DE NEGRITAS */}
                        <li><strong className="font-semibold">Datos de Contacto/Cuenta:</strong> Nombre completo, correo electrónico, número de teléfono (usado para WhatsApp y soporte), nombre de la empresa, y contraseña cifrada.</li>
                        <li><strong className="font-semibold">Datos de Pago:</strong> Información de facturación y detalles de suscripción. (Manejados por procesadores de pago externos).</li>
                    </ul>

                    <p className="font-semibold text-gray-800 pt-4">B. Información Recopilada de los Clientes de Nuestros Clientes (Datos del Usuario Final)</p>
                    <p>Nuestra plataforma permite a nuestros clientes (dueños de Gimnasios o Barberías) almacenar datos de sus propios clientes (socios o clientes). Esta información incluye historial de citas/clases y estado de membresía.</p>
                    {/* 💡 CORRECCIÓN DE NEGRITAS */}
                    <p className="italic bg-gray-50 p-3 rounded"><strong className="font-bold">Nuestro rol:</strong> Actuamos como Procesadores de Datos. Nuestros clientes son los <strong className="font-bold">Controladores de Datos</strong> y son responsables de obtener el consentimiento de sus propios clientes.</p>

                    <p className="font-semibold text-gray-800 pt-4">C. Información Recopilada Automáticamente (Cookies y Analíticas)</p>
                    <p>Recopilamos: Dirección IP, tipo de navegador, datos de uso (páginas vistas) y datos de geolocalización aproximada, principalmente para fines analíticos (ej., Google Analytics) y de rendimiento.</p>
                </Section>

                <hr className="my-10" />

                {/* --- 3. Fines del Tratamiento de la Información --- */}
                <Section title="3. Fines del Tratamiento de la Información">
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        {/* 💡 CORRECCIÓN DE NEGRITAS */}
                        <li><strong className="font-semibold">Proveer el Servicio:</strong> Gestionar su cuenta, procesar pagos y ofrecer la funcionalidad principal del software (agendamiento, gestión de inventario).</li>
                        <li><strong className="font-semibold">Comunicación y Soporte:</strong> Enviar notificaciones de servicio, actualizaciones, alertas de seguridad y responder a solicitudes de soporte técnico (vía WhatsApp o correo).</li>
                        <li><strong className="font-semibold">Marketing y Mejora:</strong> Analizar el rendimiento de las landing pages y personalizar futuras comunicaciones (solo con su consentimiento).</li>
                        <li><strong className="font-semibold">Seguridad:</strong> Prevenir actividades fraudulentas, hacer cumplir nuestros términos de servicio y cumplir con obligaciones legales.</li>
                    </ul>
                </Section>

                <hr className="my-10" />

                {/* --- 4. Compartición y Divulgación --- */}
                <Section title="4. Compartición y Divulgación de la Información">
                    <p>No vendemos, alquilamos ni divulgamos su información personal, excepto a:</p>
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        <li><strong className="font-semibold">Proveedores de Servicios:</strong> Terceros que realizan servicios en nuestro nombre (hosting, procesadores de pago), obligados a proteger su privacidad.</li>
                        <li><strong className="font-semibold">Transferencias de Negocios:</strong> En caso de fusión o adquisición.</li>
                        <li><strong className="font-semibold">Cumplimiento Legal:</strong> Si la ley lo exige para proteger nuestros derechos o la seguridad pública.</li>
                    </ul>
                </Section>

                <hr className="my-10" />

                {/* --- 5. Derechos de Privacidad --- */}
                <Section title="5. Sus Derechos de Privacidad">
                    <p>Usted puede tener derecho a solicitar acceso, rectificación o supresión de sus datos personales. También puede oponerse al tratamiento de sus datos para fines de marketing.</p>
                    <p className="font-semibold text-gray-800">Para ejercer cualquiera de estos derechos, por favor, contáctenos utilizando la información de la Sección 7.</p>
                </Section>

                <hr className="my-10" />

                {/* --- 6. Seguridad y 7. Contacto --- */}
                <Section title="6. Seguridad de los Datos">
                    <p>Implementamos medidas técnicas y organizativas razonables, incluyendo <strong className="font-semibold">cifrado (SSL/TLS)</strong> y protección de contraseña, para proteger su información.</p>
                </Section>

                <hr className="my-10" />

                <Section title="7. Contacto">
                    <p>Si tiene preguntas o inquietudes, puede contactarnos en:</p>
                    <ul className="list-disc list-inside ml-4 space-y-2">
                        <li className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-cyan-600 font-semibold">{CONTACT_EMAIL}</a>
                        </li>
                        <li className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            WhatsApp: {CONTACT_WHATSAPP}
                        </li>
                    </ul>
                </Section>
                
                <hr className="my-10" />

                {/* --- 8. Cambios --- */}
                <Section title="8. Cambios a esta Política">
                    <p>Nos reservamos el derecho de modificar esta política en cualquier momento. Le notificaremos cualquier cambio sustancial publicando la nueva Política de Privacidad en nuestro sitio web.</p>
                </Section>
                
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;