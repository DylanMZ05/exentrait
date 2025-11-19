// src/barber-manager/components/BarberLayout.tsx
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export const BarberLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Barber Manager</h1>
          <p className="text-xs text-gray-500">
            Módulo de gestión para barberías
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
};
