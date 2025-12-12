import React, { useState, useCallback, useEffect } from 'react';
// Importamos solo las funciones necesarias para evitar dependencias completas como useAuth
import { signInWithEmailAndPassword, getAuth, type User } from 'firebase/auth'; 
import { auth } from '../../../firebase'; // ⬅️ Asegúrate de que esta ruta a src/firebase.ts sea correcta (../firebase o ../../firebase)

interface VentasSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Esta función se llama si la contraseña es correcta, y recibe el destino final.
  onSuccess: (password: string) => Promise<void>; 
  targetHref: string; 
}

export const VentasSecurityModal: React.FC<VentasSecurityModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Obtener el usuario actual
  const currentUser: User | null = getAuth(auth.app).currentUser; 

  // Limpiar estado cuando el modal se abre
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setIsLoading(false);
      // Foco en el input después de un pequeño retraso para asegurar que el modal esté visible
      setTimeout(() => {
        document.getElementById("ventasPasswordInput")?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    if (!currentUser || !currentUser.email) {
      setError("No hay usuario autenticado.");
      return;
    }
    if (!password) {
      setError("Ingresá tu contraseña.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Re-autenticar usando el mismo email y contraseña para verificar la clave
      await signInWithEmailAndPassword(auth, currentUser.email, password);
      
      // 2. Si la re-autenticación es exitosa, se concede acceso.
      // Llamamos a onSuccess para que el componente padre (Header) maneje la navegación.
      await onSuccess(password); 
      onClose();

    } catch (err) {
      console.error("Error al verificar contraseña para Ventas", err);
      // Manejo de errores basado en el JS original (Contraseña incorrecta)
      setError("Contraseña incorrecta. Probá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, password, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div id="ventasPasswordOverlay" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-[90%] sm:w-[400px] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Acceder a Ventas</h2>
          <p className="mt-1 text-sm text-gray-600">
            Ingresá la contraseña de tu usuario para acceder a la sección de ventas.
          </p>
        </div>
        
        {/* Body */}
        <div className="px-6 py-4 space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="ventasPasswordInput">
            Contraseña
          </label>
          <input
            id="ventasPasswordInput"
            type="password"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152754]/60 focus:border-[#152754]"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleConfirm()}
            disabled={isLoading}
          />
          <p className="text-xs text-red-600 mt-1 min-h-[1rem]">{error}</p>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm rounded-md bg-[#152754] text-white hover:bg-[#111a3a] disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};