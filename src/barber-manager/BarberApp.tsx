// src/barber-manager/BarberApp.tsx
import React from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// Components
import { BarberHeader } from "./components/BarberHeader";
import { RequireBarberAuth } from "./RequireBarberAuth";

// Pages
import { Login as BarberLogin } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Empleados } from "./pages/Empleados";
import { Clientes } from "./pages/Clientes";

export const BarberApp: React.FC = () => {
  const location = useLocation();

  // Ocultar el header SOLO en /barber-manager/login
  const isLoginRoute = location.pathname === "/barber-manager/login";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* HEADER EXCLUSIVO (menos en login) */}
      {!isLoginRoute && <BarberHeader />}

      {/* pt-16 porque el header es fijo */}
      <div className={`flex-1 ${!isLoginRoute ? "" : ""}`}>
        <Routes>

          {/* ========= LOGIN (Pública) ========= */}
          <Route path="login" element={<BarberLogin />} />

          {/* ========= RUTAS PROTEGIDAS ========= */}
          <Route element={<RequireBarberAuth />}>
            
            <Route path="dashboard" element={<Dashboard />} />
            
            <Route path="empleados" element={<Empleados />} />
            
            <Route path="clientes" element={<Clientes />} />

          </Route>

          {/* ========= DEFAULT / CATCH-ALL ========= */}
          {/* 🔥 CORRECCIÓN CRÍTICA: Usamos rutas ABSOLUTAS (con / al principio) */}
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