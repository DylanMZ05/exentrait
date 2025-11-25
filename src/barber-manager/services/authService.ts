// src/barber-manager/services/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import type { UserCredential } from "firebase/auth"; // ERROR TS1484 CORREGIDO: Importar como tipo

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { barberAuth, barberDb } from "./firebaseBarber";

/* ============================================
    COLECCIÓN PRINCIPAL DEL BARBER MANAGER
    (coincide con tus reglas de seguridad)
============================================ */
const usersCol = collection(barberDb, "barber_users");

/* ============================================
    REGISTRO DE USUARIO (Dueño / Owner)
============================================ */
export const registerBarberUser = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  // 1) Crear usuario en Firebase Auth
  const cred = await createUserWithEmailAndPassword(
    barberAuth,
    email,
    password
  );

  // 2) Guardarlo en Firestore según reglas
  const ref = doc(usersCol, cred.user.uid);

  await setDoc(ref, {
    uid: cred.user.uid,
    email,
    role: "owner", // 🔥 necesario para que pueda crear empleados
    activo: true,
    porcentaje: 0, // dueño no cobra %, pero se puede dejar
    origen: "signup-barber",
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });

  return cred;
};

/* ============================================
    LOGIN
============================================ */
export const loginBarberUser = async (email: string, password: string) => {
  const cred = await signInWithEmailAndPassword(barberAuth, email, password);

  // Verificar documento en Firestore
  const ref = doc(usersCol, cred.user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await signOut(barberAuth);
    throw new Error(
      "Tu usuario no está registrado correctamente. Contactá al administrador."
    );
  }

  const data = snap.data() as any;

  if (data.activo === false) {
    await signOut(barberAuth);
    throw new Error("Tu cuenta está desactivada. Contactá al administrador.");
  }

  return cred;
};

/* ============================================
    RECUPERAR CONTRASEÑA
============================================ */
export const sendBarberPasswordReset = async (email: string) => {
  await sendPasswordResetEmail(barberAuth, email);
};