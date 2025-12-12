// src/gym-manager/utils/dateHelpers.ts

// --- Tipos de Firebase (para Type Guards) ---
interface FirestoreTimestamp {
    toDate(): Date;
    seconds: number;
    nanoseconds: number;
}
export type DateInput = string | Date | FirestoreTimestamp | undefined | null;

/** =========================
 * HELPERS DE FORMATO
 * ========================= */

/** Formatea un número a moneda ARS sin decimales. */
export const fmtMoney = (n: number): string =>
    Number(n || 0).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    });

/** Devuelve la letra inicial del día (D, L, M, X, J, V, S). */
export const getShortDayLetter = (d: Date): string =>
    ["D", "L", "M", "X", "J", "V", "S"][d.getDay()];
    
/** Rellena con cero a la izquierda si es necesario. */
export const two = (n: number): string => String(n).padStart(2, "0");

/** Calcula el tiempo transcurrido (hace X min, hace Y días). */
export const timeAgo = (fecha: DateInput): string => {
    const d = parseDateLocal(fecha);
    if (!d) return "";
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000); // Diferencia en segundos

    if (diff < 60) return `hace ${diff}s`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    const days = Math.floor(h / 24);
    return `hace ${days} d`;
};


/** =========================
 * HELPERS DE PARSEO DE FECHAS
 * ========================= */

/** Convierte una entrada de fecha a un objeto Date (seguro local). */
export function parseDateLocal(fecha: DateInput): Date | null {
    if (!fecha) return null;
    if (typeof fecha === "object" && 'toDate' in fecha) return (fecha as FirestoreTimestamp).toDate();
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const [Y, M, D] = fecha.split("-").map(Number);
        return new Date(Y, M - 1, D, 0, 0, 0, 0);
    }
    const d = new Date(fecha);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** 🚨 EXPORTADO PARA MODAL 🚨 Convierte una cadena YYYY-MM-DD a objeto Date (mediante parseDateLocal). */
export function parseISODate(iso: string): Date | null {
    return parseDateLocal(iso);
}

/** 🚨 EXPORTADO PARA MODAL 🚨 Convierte un objeto Date a la cadena YYYY-MM-DD. */
export function formatISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}


/** Convierte una entrada de fecha a la cadena YYYY-MM-DD. */
export function ymdFromDate(fecha: DateInput): string {
    if (!fecha) return "";
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
    const d = parseDateLocal(fecha);
    if (!d) return "";
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** Formato dd/mm/YYYY para mostrar. */
export function formatFechaCorta(fecha: DateInput): string {
    const d = parseDateLocal(fecha);
    if (!d) return "—";
    return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}


/** =========================
 * HELPERS DE CÁLCULO DE DÍAS
 * ========================= */

/** * Días restantes (recorta a 0 cuando está vencido).
 * 🚨 CLAVE 1: Exportamos con el nombre que espera useClientData.ts
 * @param ymd Fecha YYYY-MM-DD o DateInput
 */
export const daysRemainingFromToday = (ymd: DateInput): number => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const dYmd = ymdFromDate(ymd);
    if (!dYmd) return 0;
    
    const [Y, M, D] = dYmd.split("-").map(Number);
    const v = new Date(Y, M - 1, D);
    v.setHours(0, 0, 0, 0); 
    
    const diffDays = Math.ceil((v.getTime() - hoy.getTime()) / 86400000);
    
    return diffDays; // No truncamos a 0 aquí, dejamos que sea negativo (para useClientData)
};

/** * Diferencia en días respecto a hoy.
 * 🚨 CLAVE 2: Exportamos la función que usa useDashboardData.ts
 */
export function daysUntil(ymd: DateInput): number | null {
    const dYmd = ymdFromDate(ymd);
    if (!dYmd) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const [Y, M, D] = dYmd.split("-").map(Number);
    if (!Y || !M || !D) return null;
    
    const v = new Date(Y, M - 1, D);
    v.setHours(0, 0, 0, 0);
    
    return Math.floor((v.getTime() - hoy.getTime()) / 86400000);
}

// 🚨 CLAVE 3: ALIAS para asegurar que useDashboardData.ts también funcione
export { daysRemainingFromToday as calculateDaysRemaining }; 


/** =========================
 * HELPERS DE HORARIOS
 * ========================= */

interface HourRange {
    start: number; // Hora de inicio (0-23)
    end: number;  // Hora de fin (0-24)
}

/** Parsea la cadena "HH:MM - HH:MM" para obtener la hora de inicio y fin (entero). */
export function getHourRange(r: string | null | undefined): HourRange {
    const DEFAULT_HOUR = 99;
    
    if (!r || r === "Libre") return { start: DEFAULT_HOUR, end: DEFAULT_HOUR };

    const [a, b] = r.split("-").map((s) => (s || "").trim());
    
    const sh = parseInt((a || "").split(":")[0], 10);
    const start = Number.isFinite(sh) ? sh : DEFAULT_HOUR;
    
    const eh = parseInt((b || "").split(":")[0], 10);
    let end = Number.isFinite(eh) ? eh : start + 1;
    
    if (end <= start || end > 24) {
        end = start !== DEFAULT_HOUR ? start + 1 : DEFAULT_HOUR;
    }
    
    return { start, end };
}