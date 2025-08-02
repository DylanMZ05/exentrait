// src/firebase.ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// 🔑 Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCYxQEZLzWSqGFjz-xNyNZI-QcYbBX63Ns",
  authDomain: "exentra-gym.firebaseapp.com",
  projectId: "exentra-gym",
  storageBucket: "exentra-gym.appspot.com", // ✅ corregido
  messagingSenderId: "592568295991",
  appId: "1:592568295991:web:e520eb6e2739a28ef055b2",
  measurementId: "G-H5PQC2PXS7",
};

// ✅ Inicializar Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// ✅ Firestore con persistencia offline
const db: Firestore = getFirestore(app);
enableIndexedDbPersistence(db).catch((err: unknown) => {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "failed-precondition") {
      console.warn("⚠️ Persistencia fallida: varias pestañas abiertas.");
    } else if (code === "unimplemented") {
      console.warn("⚠️ Este navegador no soporta persistencia offline.");
    }
  }
});

// ✅ Auth (lo dejamos aunque no uses login, para futuro)
const auth: Auth = getAuth(app);

// ⚠️ Analytics comentado porque estaba tirando error 400 en consola
// import { getAnalytics } from "firebase/analytics";
// let analytics: Analytics | null = null;
// try {
//   if (typeof window !== "undefined") {
//     analytics = getAnalytics(app);
//   }
// } catch {
//   console.log("Analytics no disponible en este entorno.");
// }

export { app, db, auth };
