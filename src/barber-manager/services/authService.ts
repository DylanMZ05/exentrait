// src/barber-manager/services/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import type { UserCredential } from "firebase/auth"; 

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
    role: "owner", // 🔥 Rol inicial como dueño
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

  // Verificar documento en Firestore (solo para dueños)
  const ref = doc(usersCol, cred.user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Si el usuario no tiene un documento en /barber_users, puede ser un empleado
    // o un registro incompleto. En este flujo, forzamos que el dueño exista aquí.
    await signOut(barberAuth);
    throw new Error(
      "Usuario no registrado como dueño. Use la pestaña 'Empleado' o regístrese."
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