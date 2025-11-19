// import React, { useMemo, useState } from "react";

// /* =============================
//    Tipos
// ============================= */
// export type Hour =
//   | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17
//   | 18 | 19 | 20; // extendidas

// export interface BookingSlot {
//   /** ISO date yyyy-mm-dd */
//   date: string;
//   /** 8..20 */
//   hour: Hour;
//   /** Nombres de personas agendadas (solo en modo admin) */
//   people: string[];
// }

// export interface ScheduleAvailabilityProps {
//   slots: BookingSlot[];         // Reservas existentes
//   maxPerHour?: number;          // Máximo por hora (default 3)
//   startDate: string;            // ISO yyyy-mm-dd (para ubicar la semana)
//   days: number;                 // (no se usa: siempre mostramos L→D)
//   admin?: boolean;              // Muestra nombres
// }

// /* =============================
//    Utilidades
// ============================= */
// const BASE_WORKING: Hour[] = [8, 9, 10, 11, 13, 14, 15, 16, 17]; // sin 12
// const EXTENDED_ADD: Hour[] = [18, 19, 20];

// function toDate(iso: string) {
//   return new Date(iso + "T00:00:00");
// }
// function toISO(d: Date) {
//   return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
//     .toISOString()
//     .slice(0, 10);
// }
// function startOfWeekMonday(iso: string) {
//   const d = toDate(iso); // 0=Dom..6=Sab
//   const diff = (d.getDay() + 6) % 7;
//   d.setDate(d.getDate() - diff);
//   return d;
// }
// function isSunday(iso: string) {
//   return toDate(iso).getDay() === 0;
// }
// function isExtendedDay(iso: string) {
//   const dow = toDate(iso).getDay(); // 1=Lun,2=Mar,3=Mié,4=Jue
//   return dow === 1 || dow === 2 || dow === 4; // Lun, Mar, Jue
// }
// function getWorkingHoursForDate(iso: string): Hour[] {
//   return isExtendedDay(iso)
//     ? [...BASE_WORKING, ...EXTENDED_ADD]
//     : BASE_WORKING;
// }
// function allHoursUnion(): Hour[] {
//   // Para listar todas las filas (las no trabajadas se pintan gris/“no se trabaja”)
//   return [8,9,10,11,12,13,14,15,16,17,18,19,20];
// }
// function dayLabel(iso: string) {
//   const d = toDate(iso);
//   const wd = d.toLocaleDateString("es-AR", { weekday: "long" });
//   return wd.charAt(0).toUpperCase() + wd.slice(1);
// }
// function formatHour(h: Hour) {
//   const pad = (n: number) => String(n).padStart(2, "0");
//   return `${pad(h)}:00 - ${pad((h + 1) as number)}:00`;
// }
// function clsx(...xs: (string | false | null | undefined)[]) {
//   return xs.filter(Boolean).join(" ");
// }

// /* =============================
//    Componente principal (un grupo por hora, horas desplegables)
// ============================= */
// const ScheduleAvailability: React.FC<ScheduleAvailabilityProps> = ({
//   slots,
//   maxPerHour = 3,
//   startDate,
//   days, // eslint-disable-line @typescript-eslint/no-unused-vars
//   admin = false,
// }) => {
//   const [showAdmin, setShowAdmin] = useState(admin);

//   const data = useMemo(() => {
//     // Índice: date|hour -> nombres
//     const byKey: Record<string, string[]> = {};
//     for (const s of slots) {
//       byKey[`${s.date}|${s.hour}`] = s.people ?? [];
//     }
//     // Semana L→D a partir de startDate
//     const monday = startOfWeekMonday(startDate);
//     const weekIso = Array.from({ length: 7 }, (_, i) => {
//       const d = new Date(monday);
//       d.setDate(monday.getDate() + i);
//       return toISO(d);
//     });
//     return { byKey, weekIso };
//   }, [slots, startDate]);

//   const getUsed = (dateIso: string, hour: Hour) =>
//     data.byKey[`${dateIso}|${hour}`]?.length ?? 0;

//   const getNames = (dateIso: string, hour: Hour) =>
//     data.byKey[`${dateIso}|${hour}`] ?? [];

//   return (
//     <div className="w-full max-w-md mx-auto px-3 py-6">
//       <div className="mb-4 flex items-center justify-between">
//         <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
//           Días disponibles
//         </h1>
//         <label className="inline-flex items-center gap-2 text-xs select-none">
//           <input
//             type="checkbox"
//             className="size-4 accent-indigo-600"
//             checked={showAdmin}
//             onChange={(e) => setShowAdmin(e.target.checked)}
//           />
//           <span className="font-medium text-gray-700">Admin</span>
//         </label>
//       </div>

//       <div className="flex flex-col gap-3">
//         {data.weekIso.map((dateIso) => {
//           // DOMINGO: bloque gris, sin desplegable
//           if (isSunday(dateIso)) {
//             return (
//               <div
//                 key={dateIso}
//                 className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 flex items-center justify-between text-gray-500"
//               >
//                 <div>
//                   <div className="text-base font-semibold">{dayLabel(dateIso)}</div>
//                   <div className="text-xs">No se trabaja</div>
//                 </div>
//                 <span className="px-2 py-1 text-xs rounded-md bg-gray-300 text-gray-700 font-semibold">
//                   CERRADO
//                 </span>
//               </div>
//             );
//           }

//           // Horas trabajadas para ese día (con extensión Lun/Mar/Jue)
//           const workingHours = getWorkingHoursForDate(dateIso);

//           // Cupos totales libres del día (solo horas trabajadas)
//           const freeDay = workingHours.reduce((acc, h) => {
//             const used = getUsed(dateIso, h);
//             return acc + Math.max(0, maxPerHour - used);
//           }, 0);

//           return (
//             <details
//               key={dateIso}
//               className="group rounded-2xl border border-gray-200 bg-white open:shadow-sm"
//             >
//               <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between">
//                 <div>
//                   <div className="text-base font-semibold text-gray-900">
//                     {dayLabel(dateIso)}
//                   </div>
//                   <div className="text-xs text-gray-500">
//                     {freeDay} cupo{freeDay === 1 ? "" : "s"}
//                   </div>
//                 </div>
//                 <div className="text-gray-400 group-open:rotate-180 transition">▾</div>
//               </summary>

//               <div className="px-3 pb-4 flex flex-col gap-3">
//                 {allHoursUnion().map((h) => {
//                   const isWorking = workingHours.includes(h);

//                   if (!isWorking) {
//                     return (
//                       <div
//                         key={h}
//                         className="rounded-xl overflow-hidden border border-gray-200"
//                       >
//                         <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-3 bg-gray-50">
//                           <div className="text-sm font-medium text-gray-500">
//                             {formatHour(h)} HS
//                           </div>
//                           <span className="px-2 py-1 text-xs rounded-md bg-gray-200 text-gray-600 font-semibold">
//                             CERRADO
//                           </span>
//                         </div>
//                       </div>
//                     );
//                   }

//                   // HORARIO TRABAJADO → DESPLEGABLE
//                   const used = getUsed(dateIso, h);
//                   const free = Math.max(0, maxPerHour - used);
//                   const hourIsFull = used >= maxPerHour;

//                   return (
//                     <details
//                       key={h}
//                       className="rounded-xl overflow-hidden border border-gray-200"
//                     >
//                       <summary className="list-none cursor-pointer select-none grid grid-cols-[1fr_auto] items-center gap-3 p-3 bg-white">
//                         <div>
//                           <div className="text-sm font-semibold text-gray-900">
//                             {formatHour(h)} HS
//                           </div>
//                           <div className="text-xs text-gray-500">
//                             {free > 0
//                               ? `${free} CUPO${free === 1 ? "" : "S"} DISPONIBLES`
//                               : "NINGÚN CUPO DISPONIBLE"}
//                           </div>
//                         </div>
//                         <span
//                           className={clsx(
//                             "px-2 py-1 text-xs rounded-md font-semibold",
//                             hourIsFull
//                               ? "bg-rose-500 text-white"
//                               : "bg-emerald-500 text-white"
//                           )}
//                         >
//                           {hourIsFull ? "OCUPADO" : "LIBRE"}
//                         </span>
//                       </summary>

//                       {/* Contenido al desplegar el horario */}
//                       <div className="p-3 bg-gray-50 border-t border-gray-200">
//                         <div className="bg-white rounded-lg p-2 border border-gray-200">
//                           <div className="text-[11px] font-semibold text-gray-600 mb-1">
//                             CUPOS
//                           </div>
//                           <div className="flex items-center gap-1.5">
//                             {Array.from({ length: maxPerHour }).map((_, i) => (
//                               <div
//                                 key={i}
//                                 className={clsx(
//                                   "h-2.5 w-6 rounded-full",
//                                   i < used ? "bg-rose-500" : "bg-emerald-500/80"
//                                 )}
//                                 title={i < used ? "Ocupado" : "Libre"}
//                               />
//                             ))}
//                           </div>

//                           {/* Admin: nombres */}
//                           {showAdmin && (
//                             <ul className="mt-2 text-[11px] leading-5 text-gray-700 list-disc list-inside">
//                               {getNames(dateIso, h).length === 0 && (
//                                 <li className="opacity-60 italic">Sin reservas</li>
//                               )}
//                               {getNames(dateIso, h).map((p, idx) => (
//                                 <li key={idx}>{p}</li>
//                               ))}
//                             </ul>
//                           )}
//                         </div>
//                       </div>
//                     </details>
//                   );
//                 })}
//               </div>
//             </details>
//           );
//         })}
//       </div>
//     </div>
//   );
// };

// export default ScheduleAvailability;
