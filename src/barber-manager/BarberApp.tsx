import React from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// Components
// Las rutas se especifican completamente para forzar la resolución
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
import { Stock } from "./pages/Stock.tsx"; // ✅ Importamos Stock

export const BarberApp: React.FC = () => {
  const location = useLocation();

  // Ocultar el header SOLO en /barber-manager/login
  const isLoginRoute = location.pathname === "/barber-manager/login";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* HEADER EXCLUSIVO (menos en login) */}
      {!isLoginRoute && <BarberHeader />}

      <div className="flex-1">
        <Routes>

          {/* ========= LOGIN (Pública) ========= */}
          <Route path="login" element={<BarberLogin />} />

          {/* ========= RUTAS PROTEGIDAS ========= */}
          <Route element={<RequireBarberAuth />}>
            
            <Route path="dashboard" element={<Dashboard />} />
            
            <Route path="empleados" element={<Empleados />} />
            
            <Route path="clientes" element={<Clientes />} />

            <Route path="turnos" element={<Turnos />} />

            <Route path="servicios" element={<Servicios />} />

            <Route path="ventas" element={<Ventas />} />
            
            <Route path="stock" element={<Stock />} />

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