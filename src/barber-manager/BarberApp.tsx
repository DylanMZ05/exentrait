// src/barber-manager/BarberApp.tsx
import React from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { BarberHeader } from "./components/BarberHeader";
import { Dashboard } from "./pages/Dashboard";
import { Login as BarberLogin } from "./pages/Login";

// Nuevas páginas Barber Manager

import { Empleados } from "./pages/Empleados";

export const BarberApp: React.FC = () => {
  const location = useLocation();

  // Ocultar el header SOLO en /barber-manager/login
  const isLoginRoute = location.pathname === "/barber-manager/login";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* HEADER EXCLUSIVO (menos en login) */}
      {!isLoginRoute && <BarberHeader />}

      {/* pt-16 porque el header es fijo */}
      <div className={`flex-1 ${!isLoginRoute ? "pt-16" : ""}`}>
        <Routes>

          {/* ========= LOGIN ========= */}
          <Route path="login" element={<BarberLogin />} />

          {/* ========= PANEL PRINCIPAL ========= */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* ========= EMPLEADOS ========= */}
          <Route path="empleados" element={<Empleados />} />

          {/* ========= DEFAULT ========= */}
          <Route path="" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />

        </Routes>
      </div>

    </div>
  );
};
