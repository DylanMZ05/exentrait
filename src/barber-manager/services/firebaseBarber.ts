// src/barber-manager/services/firebaseBarber.ts
import { initializeApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app"; // ERROR TS1484 CORREGIDO: Importar como tipo
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 1. Definimos y EXPORTAMOS la configuración AFUERA del bloque condicional.
// Esto es vital para que 'Empleados.tsx' pueda importarla y crear la App Secundaria.
export const firebaseConfig = {
  apiKey: "AIzaSyDfZSn1ILBQTdcGq3eqzU0i6p6Ev00wZvg",
  authDomain: "exentra-it---barber-manager.firebaseapp.com",
  projectId: "exentra-it---barber-manager",
  storageBucket: "exentra-it---barber-manager.appspot.com", // 🔥 CORREGIDO
  messagingSenderId: "422545654130",
  appId: "1:422545654130:web:7e20ccb3f9ededf781ddeb",
};

// Evitar doble inicialización (Vite + HMR)
let barberApp: FirebaseApp;
const existing = getApps().find((app) => app.name === "barberApp");

if (existing) {
  barberApp = existing;
} else {
  // Usamos la configuración exportada arriba
  barberApp = initializeApp(firebaseConfig, "barberApp");
}

export const barberDb = getFirestore(barberApp);
export const barberAuth = getAuth(barberApp);

// Si querés analytics en producción:
// import { getAnalytics } from "firebase/analytics";
// export const barberAnalytics = getAnalytics(barberApp);