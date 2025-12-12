// src/firebase.ts

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { 
    getAuth, 
    type Auth 
} from "firebase/auth";
import { 
    getFirestore, 
    Firestore, 
    enableIndexedDbPersistence 
} from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCYxQEZ4zWSqGfjz-xNyNZI-QcYbBX63Ns", // <-- USAMOS ESTA CLAVE
    authDomain: "exentra-gym.firebaseapp.com",
    projectId: "exentra-gym",
    storageBucket: "exentra-gym.firebasestorage.app",
    messagingSenderId: "592568295991",
    appId: "1:592568295991:web:e520eb6e2739a28ef055b2",
    measurementId: "G-H5PQC2PXS7"
};

// Inicializar Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Inicializar servicios
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

let analytics: Analytics | null = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("⚠️ Analytics no disponible:", (e as Error)?.message);
}

// Persistencia de Firestore (copiada de tu archivo anterior)
(async () => {
    try {
        await enableIndexedDbPersistence(db);
    } catch (err) {
        const error = err as { code?: string };
        if (error.code === "failed-precondition") {
            console.warn("⚠️ Persistencia fallida: varias pestañas abiertas.");
        } else if (error.code === "unimplemented") {
            console.warn("⚠️ Este navegador no soporta persistencia offline.");
        }
    }
})();


// Exportar para que AppGymWrapper pueda usar Auth y Firestore
export { app, auth, db, analytics };