// src/pages/.../schedule.ts (ajusta la ruta según tu proyecto)
import { db, auth } from "../../../firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  getDoc,
  runTransaction,
  query,
} from "firebase/firestore";

export type Hour =
  | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17
  | 18 | 19 | 20;

export type SlotDoc = {
  hour: Hour;
  people: string[];   // “casillas”: longitud 0..maxPerHour
  maxPerHour: number; // default 3
  working: boolean;   // si el horario se trabaja
};

export const DEFAULT_MAX = 3;

/** Lanza si no hay usuario autenticado (o reemplazá por un UID fijo si querés). */
function uidOrThrow(): string {
  const u = auth.currentUser;
  if (!u) throw new Error("No hay usuario autenticado.");
  return u.uid;
}

/* ----------------------------- helpers internos ---------------------------- */
function slotRef(uid: string, dateIso: string, hour: Hour) {
  return doc(db, "usuarios", uid, "agenda", dateIso, "slots", String(hour));
}

function normalizeName(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

/* --------------------------------- lecturas -------------------------------- */
export async function getDaySlots(
  dateIso: string,
  gymUid?: string
): Promise<Record<string, SlotDoc>> {
  const uid = gymUid ?? uidOrThrow();
  const ref = collection(db, "usuarios", uid, "agenda", dateIso, "slots");
  const snap = await getDocs(query(ref));
  const out: Record<string, SlotDoc> = {};
  snap.forEach((d) => {
    out[d.id] = d.data() as SlotDoc;
  });
  return out;
}

/* --------------------------- crear / actualizar base ------------------------ */
export async function setSlot(
  dateIso: string,
  hour: Hour,
  data: Partial<SlotDoc>,
  gymUid?: string
) {
  const uid = gymUid ?? uidOrThrow();
  const ref = slotRef(uid, dateIso, hour);
  const snap = await getDoc(ref);

  const payload: SlotDoc = {
    hour,
    people: [],
    maxPerHour: DEFAULT_MAX,
    working: true,
    ...(snap.exists() ? (snap.data() as SlotDoc) : {}),
    ...data,
  };

  if (!snap.exists()) {
    await setDoc(ref, payload);
  } else {
    await updateDoc(ref, payload as any);
  }
}

/* ------------------------- operaciones sobre “casillas” -------------------- */
/**
 * Asigna un nombre a una casilla (0,1,2...). Crea el slot si no existe.
 * Usa transacción para no perder cambios concurrentes.
 */
export async function assignSeat(
  dateIso: string,
  hour: Hour,
  seatIndex: number, // 0..2 típicamente
  name: string,
  gymUid?: string
) {
  const uid = gymUid ?? uidOrThrow();
  const ref = slotRef(uid, dateIso, hour);
  const clean = normalizeName(name);
  if (!clean) throw new Error("El nombre no puede estar vacío.");

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current: SlotDoc = snap.exists()
      ? (snap.data() as SlotDoc)
      : { hour, people: [], maxPerHour: DEFAULT_MAX, working: true };

    if (!current.working) {
      throw new Error("Este horario está marcado como NO trabajado.");
    }

    const max = Math.max(1, Math.min(current.maxPerHour ?? DEFAULT_MAX, DEFAULT_MAX));
    const arr = current.people.slice(0, max);

    // Aseguramos longitud mínima para poder setear por índice
    while (arr.length < max) arr.push("");

    if (seatIndex < 0 || seatIndex >= max) {
      throw new Error(`Índice de casilla fuera de rango (0..${max - 1}).`);
    }

    arr[seatIndex] = clean;
    // Limpia trailing vacíos más allá del último nombre
    const trimmed = [...arr];
    for (let i = trimmed.length - 1; i >= 0; i--) {
      if (trimmed[i]) break;
      trimmed.pop();
    }

    tx.set(ref, { ...current, people: trimmed, hour } as SlotDoc);
  });
}

/** Vacía una casilla puntual (0,1,2...). */
export async function clearSeat(
  dateIso: string,
  hour: Hour,
  seatIndex: number,
  gymUid?: string
) {
  const uid = gymUid ?? uidOrThrow();
  const ref = slotRef(uid, dateIso, hour);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return; // nada que hacer
    const current = snap.data() as SlotDoc;

    const max = current.maxPerHour ?? DEFAULT_MAX;
    const arr = current.people.slice(0, max);
    if (seatIndex < 0 || seatIndex >= max) return;

    arr[seatIndex] = "";
    // Compactar: quitamos huecos vacíos al final
    const compact = arr.filter((v, i) => v || i < arr.length - 1);
    while (compact.length && !compact[compact.length - 1]) compact.pop();

    tx.update(ref, { people: compact });
  });
}

/** Agrega un nombre en la **próxima casilla libre** (si hay). */
export async function addPersonNextFree(
  dateIso: string,
  hour: Hour,
  name: string,
  gymUid?: string
) {
  const uid = gymUid ?? uidOrThrow();
  const ref = slotRef(uid, dateIso, hour);
  const clean = normalizeName(name);
  if (!clean) throw new Error("El nombre no puede estar vacío.");

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current: SlotDoc = snap.exists()
      ? (snap.data() as SlotDoc)
      : { hour, people: [], maxPerHour: DEFAULT_MAX, working: true };

    if (!current.working) {
      throw new Error("Este horario está marcado como NO trabajado.");
    }

    const max = current.maxPerHour ?? DEFAULT_MAX;
    const arr = current.people.slice(0, max);

    if (arr.length >= max) {
      throw new Error("No hay cupos disponibles en este horario.");
    }
    arr.push(clean);

    tx.set(ref, { ...current, people: arr, hour } as SlotDoc);
  });
}

/** Quita por nombre (primera coincidencia). */
export async function removePersonByName(
  dateIso: string,
  hour: Hour,
  name: string,
  gymUid?: string
) {
  const uid = gymUid ?? uidOrThrow();
  const ref = slotRef(uid, dateIso, hour);
  const clean = normalizeName(name);
  if (!clean) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = snap.data() as SlotDoc;
    const max = current.maxPerHour ?? DEFAULT_MAX;

    const arr = current.people.slice(0, max);
    const idx = arr.findIndex((n) => n.toLowerCase() === clean.toLowerCase());
    if (idx === -1) return;

    arr.splice(idx, 1);
    tx.update(ref, { people: arr });
  });
}

/* -------------------------- banderas de configuración ---------------------- */
export async function setWorking(
  dateIso: string,
  hour: Hour,
  working: boolean,
  gymUid?: string
) {
  const uid = gymUid ?? uidOrThrow();
  const ref = slotRef(uid, dateIso, hour);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // creamos el slot con esa bandera
    await setDoc(ref, {
      hour,
      people: [],
      maxPerHour: DEFAULT_MAX,
      working,
    } as SlotDoc);
    return;
  }

  // Si se apaga working, no borramos names por si fue un toggle accidental.
  await updateDoc(ref, { working } as any);
}

export async function setMaxPerHour(
  dateIso: string,
  hour: Hour,
  maxPerHour: number,
  gymUid?: string
) {
  const uid = gymUid ?? uidOrThrow();
  const max = Math.max(1, Math.min(3, Math.floor(maxPerHour))); // acotado a 1..3
  const ref = slotRef(uid, dateIso, hour);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      hour,
      people: [],
      maxPerHour: max,
      working: true,
    } as SlotDoc);
    return;
  }

  // Si el nuevo max es menor que la cantidad actual, recortamos.
  const current = snap.data() as SlotDoc;
  const trimmed = (current.people || []).slice(0, max);
  await updateDoc(ref, { maxPerHour: max, people: trimmed } as any);
}
