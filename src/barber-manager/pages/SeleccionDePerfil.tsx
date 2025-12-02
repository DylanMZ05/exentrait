// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { getFirestore, collection, query, where, getDocs,} from 'firebase/firestore';
// // Importaciones de tus servicios
// import { useAuth } from '../services/authService'; // <--- Usamos el hook de authservice.ts
// import { useUserContext } from '../services/userContext'; // <--- Usamos el contexto de perfil
// import { barberDb } from '../services/firebaseBarber'; // <--- Tu instancia de Firestore

// // Define la interfaz para los datos de un perfil (igual que en userContext.ts)
// interface Perfil extends DocumentData {
//   id: string;
//   uid_de_la_cuenta: string;
//   nombre: string;
//   rol: 'owner' | 'employee';
// }

// export const SeleccionDePerfil: React.FC = () => {
//   const [perfiles, setPerfiles] = useState<Perfil[]>([]);
//   const [cargando, setCargando] = useState(true);
  
//   // 1. OBTENER ESTADO DE AUTENTICACIÓN
//   const { user, logOut } = useAuth(); 
  
//   // 2. OBTENER ESTADO DEL PERFIL (Para guardar la selección)
//   const { setProfile, clearProfile } = useUserContext(); 
  
//   const navigate = useNavigate();
//   const db = getFirestore(barberDb); // Usamos la instancia que definiste

//   useEffect(() => {
//     // Si la selección de perfil se carga, aseguramos que el perfil anterior esté limpio
//     clearProfile(); 
    
//     if (user) {
//       const uidActual = user.uid;
//       const perfilesRef = collection(db, 'perfiles');
      
//       const q = query(perfilesRef, where('uid_de_la_cuenta', '==', uidActual));

//       getDocs(q)
//         .then((snapshot) => {
//           const perfilesEncontrados: Perfil[] = snapshot.docs.map(doc => ({
//             id: doc.id,
//             ...doc.data() as Omit<Perfil, 'id'>
//           }));
//           setPerfiles(perfilesEncontrados);
//         })
//         .catch(error => {
//           console.error("Error al obtener perfiles:", error);
//           // Si hay error, forzamos el cierre de sesión
//           logOut().then(() => navigate('/login'));
//         })
//         .finally(() => {
//           setCargando(false);
//         });
//     } else {
//         // Si el RequireBarberAuth falló, navegamos a login
//         navigate('/login');
//     }
//   }, [user, db, navigate, logOut, clearProfile]);


//   // Manejador cuando el usuario selecciona un perfil
//   const handleSelection = (perfil: Perfil) => {
//     // 1. Guardar el perfil completo en el Contexto de Usuario
//     setProfile(perfil); 
    
//     // 2. Redirigir al Dashboard principal
//     navigate('/dashboard'); 
//   };

//   const handleLogout = () => {
//     logOut().then(() => {
//       clearProfile();
//       navigate('/login');
//     });
//   };

//   // --- RENDERING ---

//   if (cargando) {
//     return (
//       <div className="flex justify-center items-center min-h-screen bg-gray-50">
//         <p className="text-lg text-gray-700">Cargando perfiles...</p>
//       </div>
//     );
//   }

//   if (perfiles.length === 0) {
//     return (
//       <div className="flex flex-col justify-center items-center min-h-screen bg-red-50 p-6">
//         <h1 className="text-3xl font-bold text-red-700 mb-4">⚠️ Acceso Denegado</h1>
//         <p className="text-gray-600 mb-8">
//             No se encontraron roles activos para esta cuenta. 
//             Asegúrese de que el Dueño haya configurado su perfil.
//         </p>
//         <button
//           onClick={handleLogout}
//           className="px-6 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition"
//         >
//           Cerrar Sesión
//         </button>
//       </div>
//     );
//   }
  
//   return (
//     <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      
//       <div className="w-full max-w-xl bg-white p-10 rounded-xl shadow-2xl">
//         <h1 className="text-4xl font-extrabold text-gray-900 mb-3">👋 Bienvenido</h1>
//         <p className="text-xl text-gray-600 mb-10">
//             Selecciona el rol con el que deseas acceder:
//         </p>

//         <div className="flex flex-col sm:flex-row gap-6 justify-center">
          
//           {perfiles.map((perfil) => (
//             <button
//               key={perfil.id}
//               onClick={() => handleSelection(perfil)}
//               className={`
//                 flex flex-col items-center justify-center p-8 w-full transition duration-300 transform hover:scale-105 rounded-xl shadow-lg
//                 ${perfil.rol === 'owner' 
//                   ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
//                   : 'bg-green-500 text-white hover:bg-green-600'
//                 }
//               `}
//             >
//               <span className="text-5xl mb-2">
//                 {perfil.rol === 'owner' ? '👑' : '👨‍🔧'}
//               </span>
//               <h3 className="text-2xl font-bold">
//                 {perfil.rol === 'owner' ? 'Dueño/Administrador' : 'Empleado/Barbero'}
//               </h3>
//               <p className="mt-1 text-sm opacity-90">{perfil.nombre}</p>
//             </button>
//           ))}

//         </div>

//         <div className="mt-10 text-center">
//           <button
//             onClick={handleLogout}
//             className="text-sm text-gray-500 hover:text-gray-900 transition underline"
//           >
//             Usar otra cuenta
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };