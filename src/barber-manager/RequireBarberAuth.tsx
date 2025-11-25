// src/barber-manager/RequireBarberAuth.tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react"; // ERROR TS1484 CORREGIDO: ReactNode es un tipo
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth"; // ERROR TS1484 CORREGIDO: User es un tipo
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { barberAuth } from "./services/firebaseBarber";
import React from "react";

interface Props {
  children?: ReactNode;
}

export const RequireBarberAuth: React.FC<Props> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(barberAuth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/barber-manager/login"
        state={{ from: location }}
        replace
      />
    );
  }

  if (children) return <>{children}</>;

  return <Outlet />;
};