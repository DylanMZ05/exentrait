// src/barber-manager/BarberApp.tsx
import React from "react";
import {
    Routes,
    Route,
    Navigate,
    useLocation,
} from "react-router-dom";

// Components
import { BarberHeader } from "./components/BarberHeader.tsx";
import { RequireBarberAuth } from "./RequireBarberAuth.tsx";

// Pages
import { Login as BarberLogin } from "./pages/Login.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Empleados } from "./pages/Empleados.tsx";
import { Clientes } from "./pages/Clientes.tsx";
import { Turnos } from "./pages/Turnos.tsx";
import { Servicios } from "./pages/Servicios.tsx";
import { Ventas } from "./pages/Ventas.tsx";
import { Stock } from "./pages/Stock.tsx";
import { Configuracion } from "./pages/Configuracion.tsx";
// IMPORTACIÓN ELIMINADA: import { SeleccionDePerfil } from "./pages/SeleccionDePerfil.tsx";


export const BarberApp: React.FC = () => {
    const location = useLocation();

    // Ocultar el header si la ruta es:
    // 1. /barber-manager/login
    const isLoginRoute = location.pathname.includes("/barber-manager/login"); 

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">

            {/* HEADER EXCLUSIVO (solo ocultar en login) */}
            {!isLoginRoute && <BarberHeader />}

            <div className="flex-1">
                <Routes>

                    {/* ========= LOGIN (Pública) ========= */}
                    <Route path="login" element={<BarberLogin />} />

                    {/* ========= RUTA EXCLUSIVA SA (Guardián dentro de SaPanel.tsx) ========= */}

                    {/* ========= RUTAS PROTEGIDAS (Validadas por RequireBarberAuth) ========= */}
                    <Route element={<RequireBarberAuth />}>
                        
                        {/* RUTAS DEL DASHBOARD (Ahora acceden directamente al pasar la validación) */}
                        <Route path="dashboard" element={<Dashboard />} />
                        
                        <Route path="empleados" element={<Empleados />} />
                        
                        <Route path="clientes" element={<Clientes />} />

                        <Route path="turnos" element={<Turnos />} />

                        <Route path="servicios" element={<Servicios />} />

                        <Route path="ventas" element={<Ventas />} />
                        
                        <Route path="stock" element={<Stock />} />

                        <Route path="configuracion" element={<Configuracion />} />

                        {/* 🛑 RUTA admin-super ELIMINADA DE AQUÍ, YA QUE ESTÁ ARRIBA FUERA DEL GUARD */}
                        
                    </Route>

                    {/* ========= DEFAULT / CATCH-ALL ========= */}
                    <Route 
                        path="" 
                        element={<Navigate to="/barber-manager/dashboard" replace />} 
                    />
                    <Route 
                        path="*" 
                        element={<Navigate to="/barber-manager/dashboard" replace />} 
                    />

                </Routes>
            </div>

        </div>
    );
};