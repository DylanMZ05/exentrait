// src/barber-manager/RequireBarberAuth.tsx (CORREGIDO)
import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { barberAuth } from "./services/firebaseBarber";

interface Props {
    children?: React.ReactNode;
}

export const RequireBarberAuth: React.FC<Props> = ({ children }) => {
    // Definimos el usuario como null (no logueado) o User, e undefined mientras carga.
    const [user, setUser] = useState<User | null | undefined>(undefined);
    // Cambiamos el estado de acceso a un booleano, undefined mientras carga.
    const [hasAccess, setHasAccess] = useState<boolean | undefined>(undefined);
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(barberAuth, (authUser) => {
            
            // Si el usuario no existe, limpiamos y denegamos el acceso.
            if (!authUser) {
                setUser(null);
                setHasAccess(false);
                return;
            }

            // Si el usuario existe, lo seteamos
            setUser(authUser);
            
            // --- LÓGICA DE VALIDACIÓN DE ACCESO ---
            
            // 1. Obtenemos el ownerUid que fue seteado por Login.tsx
            const ownerUid = localStorage.getItem('barberOwnerId');
            
            // 2. Determinar si es Dueño (si el email NO termina en .internal)
            const isOwner = authUser.email && !authUser.email.endsWith('.internal');

            // Si es Dueño (isOwner es true) O si encontramos el ownerUid en localStorage (es empleado)
            if (isOwner || ownerUid) {
                
                // Si es dueño (usuario principal), aseguramos que su UID esté guardado.
                if (isOwner) {
                    localStorage.setItem('barberOwnerId', authUser.uid);
                }
                
                // Acceso concedido
                setHasAccess(true);
            } else {
                // Caso: Logueado, pero sin documento de dueño asociado (error de flujo o sesión antigua)
                // Forzamos el cierre de sesión para ir al login y revalidar.
                barberAuth.signOut();
                setHasAccess(false);
            }
        });
        
        return () => unsubscribe();
    }, []);

    // --- RENDERIZADO ---

    // 1. Cargando
    if (user === undefined || hasAccess === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col space-y-2 bg-gray-50">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                <p className="mt-2 text-sm text-slate-500">Comprobando credenciales...</p>
            </div>
        );
    }

    // 2. No autenticado o sin acceso válido
    if (!user || hasAccess === false) {
        return (
            <Navigate
                to="/barber-manager/login"
                state={{ from: location }}
                replace
            />
        );
    }

    // 3. Acceso concedido
    if (children) return <>{children}</>;

    return <Outlet />;
};