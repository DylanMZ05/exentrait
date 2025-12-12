import {
    BrowserRouter as Router,
    Routes,
    Route,
    useLocation,
} from "react-router-dom";
import React from 'react';

import Login from "./pages/ClienteView/Login.tsx";
import ClienteView from "./pages/ClienteView/ClienteView.tsx";
import Updates from "./pages/Updates/Updates.tsx";
import HomeWrapper from "./pages/Home/HomeWrapper.tsx";

import Header from "./components/Header.tsx";
import Footer from "./components/Footer.tsx";

import LandingGym from "./pages/LandingGym/LandingGym.tsx";
import LandingBarber from "./pages/LandingBarber/LandingBarber.tsx";

import PrivacyPolicyPage from "./pages/legal/PrivacyPolicyPage.tsx";
import TermsAndConditionsPage from "./pages/legal/TermsAndConditionsPage.tsx";

// Módulo Barber Manager
import { BarberApp } from "./barber-manager/BarberApp.tsx";
import AccountDayManager from "./barber-manager/pages/AccountDayMaganer.tsx";

// Gym App
import { AppGymWrapper } from "./gym-manager/AppGymWrapper.tsx";

// --- Componentes Wrapper para inyectar el Header ---

// Wrapper Estándar (Header Transparente en el tope)
const StandardLayout = ({ children }: { children: React.ReactNode }) => (
    <>
        {/* Header sin prop forceSolidBg (Permite transparencia) */}
        <Header />
        <main className="flex-1">
            {children}
        </main>
    </>
);

// Wrapper Legal (Header Siempre Sólido)
const LegalLayout = ({ children }: { children: React.ReactNode }) => (
    <>
        {/* Header con prop forceSolidBg (Fuerza fondo oscuro) */}
        <Header forceSolidBg={true} />
        <main className="flex-1">
            {children}
        </main>
    </>
);

// 💡 Wrapper sin Header ni Footer (Para Vistas de Cliente/Login)
const NoLayout = ({ children }: { children: React.ReactNode }) => (
    <main className="flex-1">
        {children}
    </main>
);


function AppContent() {
    const location = useLocation();

    // Rutas que NO usan el layout general (Header/Footer)
    const routesWithoutGeneralLayout = [
        '/gym-manager/', // Login de GYM
        '/cliente/', // 💡 Vista de Cliente (Sin Header/Footer)
        '/barber-manager/', // Login/App de BARBER (Manejado por BarberApp)
    ];

    // Determinar si la ruta actual es una de las rutas que oculta el layout general
    const shouldHideLayout = routesWithoutGeneralLayout.some(route => 
        // Si la ruta es exacta (/gym-manager/) O si comienza con /cliente/ o /barber-manager/
        location.pathname === route || 
        location.pathname.startsWith(route)
    );

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            
            <Routes>
                {/* 💡 RUTAS SIN HEADER/FOOTER (Login de GYM y Vista de Cliente) */}
                <Route path="/gym-manager/" element={<NoLayout><Login /></NoLayout>} />
                <Route path="/cliente/:dni" element={<NoLayout><ClienteView /></NoLayout>} /> {/* 💡 CORREGIDO */}
                
                {/* ---- RUTAS CON HEADER ESTÁNDAR ---- */}
                <Route path="/" element={<StandardLayout><HomeWrapper /></StandardLayout>} />
                <Route path="/gym-landing/" element={<StandardLayout><LandingGym /></StandardLayout>} />
                <Route path="/barber-landing/" element={<StandardLayout><LandingBarber /></StandardLayout>} />
                <Route path="/gym-manager/updates" element={<StandardLayout><Updates /></StandardLayout>} />

                {/* ---- RUTAS LEGALES CON HEADER SÓLIDO ---- */}
                <Route path="/legal/privacidad" element={<LegalLayout><PrivacyPolicyPage /></LegalLayout>} />
                <Route path="/legal/terminos" element={<LegalLayout><TermsAndConditionsPage /></LegalLayout>} />

                {/* ---- BARBER MANAGER (NO USAN EL LAYOUT GENERAL) ---- */}
                <Route path="/barber-manager/*" element={<BarberApp />} />
                <Route path="/barber-manager/admin-master" element={<AccountDayManager />} />

                {/* ---- GYM MANAGER (NO USAN EL LAYOUT GENERAL) ---- */}
                {/* Esta ruta es CLAVE: Cuando la URL empieza con /app-gym, renderiza AppGymWrapper, 
                   y este último maneja las subrutas /home, /clientes, etc. */}
                <Route path="/app-gym/*" element={<AppGymWrapper />} />
                

            </Routes>


            {/* FOOTER GENERAL: Renderiza si NO estamos en una ruta que lo oculte */}
            {!shouldHideLayout && <Footer />}
            
        </div>
    );
}

export default function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}