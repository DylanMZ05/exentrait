// import React, { useState, useContext } from 'react';
// import type { DocumentData } from 'firebase/firestore';

// // Define la interfaz para los datos del Perfil que obtienes de Firestore
// interface Perfil extends DocumentData {
//   id: string; // ID del documento de perfil (no el UID de Firebase)
//   uid_de_la_cuenta: string;
//   nombre: string;
//   rol: 'owner' | 'employee';
// }

// // Tipado del Contexto
// interface UserContextType {
//   profile: Perfil | null;
//   setProfile: (perfil: Perfil) => void;
//   clearProfile: () => void;
// }

// const UserContext = React.createContext<UserContextType | undefined>(undefined);

// export const useUserContext = () => {
//   const context = useContext(UserContext);
//   if (context === undefined) {
//     throw new Error('useUserContext debe usarse dentro de un UserProvider');
//   }
//   return context;
// };

// // Componente Provider (Debe envolver AuthProvider o BarberApp)
// export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const [profile, setProfileState] = useState<Perfil | null>(null);

//   const setProfile = (perfil: Perfil) => {
//     // Aquí puedes añadir lógica para guardar en localStorage si quieres persistencia
//     setProfileState(perfil);
//   };

//   const clearProfile = () => {
//     // También limpiar localStorage si se usó
//     setProfileState(null);
//   }; // <--- Este cierre es CRÍTICO

//   const value = {
//     profile,
//     setProfile,
//     clearProfile,
//   }; // <--- Este objeto debe estar bien definido

//   return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
// };