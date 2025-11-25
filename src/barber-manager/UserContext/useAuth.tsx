import { useState, useEffect, useContext, createContext } from 'react';
import type { ReactNode } from 'react'; // FIX TS1484: Importar ReactNode como tipo
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth'; // FIX TS1484: Importar User como tipo
import { barberAuth } from '../services/firebaseBarber';

// 1. Definición de Tipos
interface AuthContextProps {
  user: User | null;
  loading: boolean;
  isOwner: boolean;
  isEmployee: boolean;
}

// 2. Definición de Contexto
const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// Función para determinar el rol basada en el email interno
const determineUserRole = (user: User | null): { isOwner: boolean, isEmployee: boolean } => {
  if (!user || !user.email) {
    return { isOwner: false, isEmployee: false };
  }
  
  // Asumimos que cualquier email que contenga "@" + UID + ".internal" es un empleado.
  // Cualquier otro formato de email es el DUEÑO.
  const isInternalEmployee = user.email.includes('@'); 

  if (isInternalEmployee) {
    // Si la convención de email interno existe, es un empleado (que usa un email interno).
    return { isOwner: false, isEmployee: true };
  } else {
    // Si usa un email estándar (ej: gmail.com, outlook.com), es el dueño.
    return { isOwner: true, isEmployee: false };
  }
};

// 3. Provider de Contexto
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(barberAuth, async (authUser) => {
      setUser(authUser);
      
      const { isOwner: ownerRole, isEmployee: employeeRole } = determineUserRole(authUser);
      
      setIsOwner(ownerRole);
      setIsEmployee(employeeRole);
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Nota: El valor del contexto se actualiza dinámicamente cuando cambian los estados (user, isOwner, isEmployee)
  const value = {
    user,
    loading,
    isOwner,
    isEmployee,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 4. Hook Personalizado para Consumir
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};