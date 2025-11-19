// import React, { useEffect, useMemo, useState } from "react";
// import { getDaySlots, setSlot, DEFAULT_MAX } from "./schedule";

// // const BASE_WORKING: Hour[] = [8,9,10,11,13,14,15,16,17];
// // const EXTENDED_ADD: Hour[] = [18,19,20];
// // const ALL_HOURS: Hour[] = [8,9,10,11,12,13,14,15,16,17,18,19,20];

// function toDate(iso: string){ return new Date(iso + "T00:00:00"); }
// function toISO(d: Date){
//   return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
// }
// function startOfWeekMonday(iso: string) {
//   const d = toDate(iso);
//   const diff = (d.getDay() + 6) % 7; // 0 si ya es lunes
//   d.setDate(d.getDate() - diff);
//   return d;
// }
// function dayLabel(iso: string){
//   const wd = toDate(iso).toLocaleDateString("es-AR", { weekday:"long" });
//   return wd.charAt(0).toUpperCase() + wd.slice(1);
// }
// function isSunday(iso: string){ return toDate(iso).getDay() === 0; }
// function isExtendedDay(iso: string){ const dw = toDate(iso).getDay(); return dw===1 || dw===2 || dw===4; }

// function getWorkingHoursForDate(iso: string): Hour[] {
//   return isExtendedDay(iso) ? [...BASE_WORKING, ...EXTENDED_ADD] : BASE_WORKING;
// }
// function formatHour(h: Hour){
//   const pad = (n:number)=>String(n).padStart(2,"0");
//   return `${pad(h)}:00 - ${pad((h+1) as number)}:00`;
// }


// const Pills: React.FC<{used:number,max:number}> = ({used,max}) => (
//   <div className="flex items-center gap-1.5">
//     {Array.from({length:max}).map((_,i)=>(
//       <div key={i} className={`h-2.5 w-6 rounded-full ${i<used? "bg-rose-500":"bg-emerald-500/80"}`} />
//     ))}
//   </div>
// );

// const AdminCupos: React.FC = () => {
//   // base: hoy -> lunes de esa semana
//   const [baseDate, setBaseDate] = useState<string>(toISO(new Date()));
//   const monday = startOfWeekMonday(baseDate);
//   const week = useMemo(()=> Array.from({length:7}, (_,i)=> {
//     const d = new Date(monday); d.setDate(monday.getDate()+i); return toISO(d);
//   }), [baseDate]);

//   const [loading, setLoading] = useState(false);
//   const [daysData, setDaysData] = useState<Record<string, DayState>>({}); // dateIso -> DayState
//   const [dirty, setDirty] = useState<Record<string, boolean>>({}); // para avisar cambios

//   useEffect(()=>{
//     let alive = true;
//     (async ()=>{
//       setLoading(true);
//       const out: Record<string, DayState> = {};
//       for (const dIso of week) {
//         if (isSunday(dIso)) { out[dIso] = {}; continue; }
//         const slots = await getDaySlots(dIso);
//         out[dIso] = slots;
//       }
//       if (alive){ setDaysData(out); setLoading(false); setDirty({}); }
//     })();
//     return ()=>{ alive=false; };
//   }, [week]);

//   const handlePeopleChange = (dateIso: string, hour: Hour, raw: string) => {
//     setDaysData(prev=>{
//       const day = {...(prev[dateIso]||{})};
//       const current: SlotDoc = day[String(hour)] ?? { hour, people: [], maxPerHour: DEFAULT_MAX, working: true };
//       const names = raw.split(",").map(s=>s.trim()).filter(Boolean).slice(0,3); // máx 3
//       day[String(hour)] = { ...current, people: names };
//       return { ...prev, [dateIso]: day };
//     });
//     setDirty(prev=>({ ...prev, [dateIso]: true }));
//   };

//   const handleWorkingToggle = (dateIso: string, hour: Hour, working: boolean) => {
//     setDaysData(prev=>{
//       const day = {...(prev[dateIso]||{})};
//       const current: SlotDoc = day[String(hour)] ?? { hour, people: [], maxPerHour: DEFAULT_MAX, working: true };
//       day[String(hour)] = { ...current, working };
//       return { ...prev, [dateIso]: day };
//     });
//     setDirty(prev=>({ ...prev, [dateIso]: true }));
//   };

//   const saveDay = async (dateIso: string) => {
//     const entries = Object.values(daysData[dateIso] || {});
//     await Promise.all(entries.map(s =>
//       setSlot(dateIso, s.hour, {
//         people: s.people,
//         maxPerHour: s.maxPerHour ?? DEFAULT_MAX,
//         working: s.working ?? true
//       })
//     ));
//     setDirty(prev=>({ ...prev, [dateIso]: false }));
//   };

//   const prevWeek = () => setBaseDate(toISO(new Date(monday.getTime() - 7*86400000)));
//   const nextWeek = () => setBaseDate(toISO(new Date(monday.getTime() + 7*86400000)));

//   return (
//     <div className="max-w-4xl mx-auto px-4 py-6">
//       <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
//         <h1 className="text-2xl font-bold">Admin · Cupos y Agenda</h1>
//         <div className="flex items-center gap-2">
//           <button onClick={prevWeek} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50">← Semana</button>
//           <input
//             type="date"
//             className="px-3 py-2 rounded-lg border bg-white"
//             value={baseDate}
//             onChange={(e)=>setBaseDate(e.target.value)}
//           />
//           <button onClick={nextWeek} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50">Semana →</button>
//         </div>
//       </header>

//       {loading ? (
//         <div className="text-gray-500">Cargando…</div>
//       ) : (
//         <div className="flex flex-col gap-4">
//           {week.map((dateIso)=> {
//             const isSun = isSunday(dateIso);
//             const workingHours = getWorkingHoursForDate(dateIso);
//             const daySlots = daysData[dateIso] || {};
//             const freeDay = workingHours.reduce((acc,h)=>{
//               const used = daySlots[String(h)]?.people?.length ?? 0;
//               const max = daySlots[String(h)]?.maxPerHour ?? DEFAULT_MAX;
//               return acc + Math.max(0, max - used);
//             },0);

//             if (isSun) {
//               return (
//                 <div key={dateIso} className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 flex items-center justify-between text-gray-500">
//                   <div>
//                     <div className="text-base font-semibold">{dayLabel(dateIso)}</div>
//                     <div className="text-xs">No se trabaja</div>
//                   </div>
//                   <span className="px-2 py-1 text-xs rounded-md bg-gray-300 text-gray-700 font-semibold">CERRADO</span>
//                 </div>
//               );
//             }

//             return (
//               <details key={dateIso} className="group rounded-2xl border border-gray-200 bg-white open:shadow-sm">
//                 <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between">
//                   <div>
//                     <div className="text-base font-semibold text-gray-900">{dayLabel(dateIso)}</div>
//                     <div className="text-xs text-gray-500">{freeDay} cupo{freeDay===1?"":"s"} libres</div>
//                   </div>
//                   <div className="text-gray-400 group-open:rotate-180 transition">▾</div>
//                 </summary>

//                 <div className="px-3 pb-4 flex flex-col gap-3">
//                   {ALL_HOURS.map((h)=>{
//                     const isWorking = workingHours.includes(h);
//                     const slot = daySlots[String(h)] ?? { hour:h, people:[], maxPerHour:DEFAULT_MAX, working:isWorking };
//                     const used = slot.people.length;
//                     const free = Math.max(0, (slot.maxPerHour ?? DEFAULT_MAX) - used);
//                     const hourIsFull = used >= (slot.maxPerHour ?? DEFAULT_MAX);

//                     return (
//                       <details key={h} className="rounded-xl overflow-hidden border border-gray-200">
//                         <summary className="list-none cursor-pointer select-none grid grid-cols-[1fr_auto] items-center gap-3 p-3 bg-white">
//                           <div>
//                             <div className="text-sm font-semibold text-gray-900">{formatHour(h)} HS</div>
//                             {!isWorking ? (
//                               <div className="text-xs text-gray-500">NO SE TRABAJA</div>
//                             ) : (
//                               <div className="text-xs text-gray-500">
//                                 {free>0 ? `${free} cupo${free===1?"":"s"} disponible` : "Ningún cupo disponible"}
//                               </div>
//                             )}
//                           </div>
//                           <span className={`px-2 py-1 text-xs rounded-md font-semibold ${!isWorking ? "bg-gray-200 text-gray-700" : hourIsFull ? "bg-rose-500 text-white":"bg-emerald-500 text-white"}`}>
//                             {!isWorking ? "OFF" : hourIsFull ? "OCUPADO" : "LIBRE"}
//                           </span>
//                         </summary>

//                         {/* Panel de edición del horario */}
//                         <div className="p-3 bg-gray-50 border-t border-gray-200">
//                           <div className="bg-white rounded-lg p-3 border border-gray-200 flex flex-col gap-3">
//                             <div className="flex items-center justify-between">
//                               <label className="inline-flex items-center gap-2 text-sm">
//                                 <input
//                                   type="checkbox"
//                                   className="size-4 accent-indigo-600"
//                                   checked={slot.working}
//                                   onChange={(e)=>handleWorkingToggle(dateIso, h, e.target.checked)}
//                                 />
//                                 <span>Se trabaja</span>
//                               </label>

//                               <Pills used={used} max={slot.maxPerHour ?? DEFAULT_MAX} />
//                             </div>

//                             <div className="text-xs text-gray-600">
//                               Nombres (máx 3), separados por coma (ej: <em>Adri, Facu, Jesús</em>)
//                             </div>
//                             <input
//                               type="text"
//                               className="w-full px-3 py-2 rounded-md border bg-white"
//                               placeholder="Nombre1, Nombre2, Nombre3"
//                               value={slot.people.join(", ")}
//                               onChange={(e)=>handlePeopleChange(dateIso, h, e.target.value)}
//                               disabled={!slot.working}
//                             />

//                             <div className="flex justify-end">
//                               <button
//                                 className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
//                                 onClick={()=>setSlot(dateIso, h, {
//                                   people: (daysData[dateIso]?.[String(h)]?.people) ?? [],
//                                   maxPerHour: DEFAULT_MAX,
//                                   working: (daysData[dateIso]?.[String(h)]?.working) ?? false
//                                 }).then(()=>saveDay(dateIso))}
//                                 disabled={!slot.working}
//                               >
//                                 Guardar horario
//                               </button>
//                             </div>
//                           </div>
//                         </div>
//                       </details>
//                     );
//                   })}

//                   <div className="mt-2 flex justify-end">
//                     <button
//                       className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60"
//                       onClick={()=>saveDay(dateIso)}
//                       disabled={!dirty[dateIso]}
//                     >
//                       Guardar cambios del día
//                     </button>
//                   </div>
//                 </div>
//               </details>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// };

// export default AdminCupos;
