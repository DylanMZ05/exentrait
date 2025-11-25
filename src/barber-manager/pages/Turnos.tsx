import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// 🔥 CORRECCIÓN: Importamos iconos desde el nuevo archivo centralizado
import { IconCalendar, IconPlus, IconCheck, IconClock, IconUserPlus, IconX, IconTrash, IconUndo, IconAlertModal as IconAlert, IconList, IconChevronLeft, IconChevronRight } from "../components/Icons.tsx"; 

/* ============================================================
   HELPER: MANEJO DE FECHAS
============================================================ */

/**
 * Añade o resta días a una fecha y devuelve el formato YYYY-MM-DD.
 * @param dateString - Fecha actual en formato YYYY-MM-DD.
 * @param days - Número de días a añadir (positivo) o restar (negativo).
 */
const changeDay = (dateString: string, days: number): string => {
    const date = new Date(dateString + 'T00:00:00'); // Añadimos T00:00:00 para evitar problemas de zona horaria
    date.setDate(date.getDate() + days);
    return formatDateToInput(date);
};

// Formatear fecha a YYYY-MM-DD
const formatDateToInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* ============================================================
   HELPER: Generar horarios (24 HORAS)
============================================================ */
const generateTimeSlots = () => {
  const slots = [];
  // Itera de 0 (00:00) a 23 (23:00)
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0');
    slots.push(`${hour}:00`);
    slots.push(`${hour}:30`);
  }
  return slots;
};
const TIME_SLOTS = generateTimeSlots(); // 🔥 AHORA TIENE 48 SLOTS (00:00 a 23:30)

/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */
export const Turnos: React.FC = () => {
  const user = barberAuth.currentUser;
  const uid = user?.uid;

  // Estados de datos
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [serviciosList, setServiciosList] = useState<any[]>([]); // 🔥 Lista de servicios
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fecha seleccionada
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Modal Confirmación Custom
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    action: () => void;
    confirmText: string;
    isDanger?: boolean;
  }>({ title: "", message: "", action: () => {}, confirmText: "", isDanger: false });

  // Formulario Turno
  const [formBarberId, setFormBarberId] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formClientId, setFormClientId] = useState("");
  
  // Lógica Servicio (Manual vs Catálogo)
  const [isManualService, setIsManualService] = useState(false); // 🔥 Toggle
  const [formService, setFormService] = useState("");
  const [formPrice, setFormPrice] = useState("0");

  const [formStatus, setFormStatus] = useState("pendiente");
  const [currentTurnoId, setCurrentTurnoId] = useState<string | null>(null);

  // Formulario Creación Rápida de Cliente
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  /* ============================================================
     NAVEGACIÓN DE DÍAS
  ============================================================ */
  const goToPreviousDay = () => {
    setSelectedDate(changeDay(selectedDate, -1));
  };

  const goToNextDay = () => {
    setSelectedDate(changeDay(selectedDate, 1));
  };
  
  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  /* ============================================================
     CARGA DE DATOS (CACHE FIRST)
  ============================================================ */
  useEffect(() => {
    if (!uid) return;

    const loadResources = async () => {
      // 1. Cargar Empleados (Cache First)
      const empCacheKey = `barber_data_empleados_list_${uid}`;
      const empCache = localStorage.getItem(empCacheKey);
      
      if (empCache) {
        setEmpleados(JSON.parse(empCache));
      } else {
        const empSnap = await getDocs(collection(barberDb, `barber_users/${uid}/empleados`));
        const empList: any[] = [];
        empSnap.forEach((d) => empList.push({ id: d.id, ...d.data() }));
        setEmpleados(empList);
        localStorage.setItem(empCacheKey, JSON.stringify(empList));
      }

      // 2. Cargar Clientes (Cache First)
      const cliCacheKey = `barber_data_clientes_list_${uid}`;
      const cliCache = localStorage.getItem(cliCacheKey);

      if (cliCache) {
        setClientes(JSON.parse(cliCache));
      } else {
        const cliSnap = await getDocs(query(collection(barberDb, `barber_users/${uid}/clientes`)));
        const cliList: any[] = [];
        cliSnap.forEach((d) => cliList.push({ id: d.id, ...d.data() }));
        cliList.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setClientes(cliList);
        localStorage.setItem(`barber_data_clientes_list_${uid}`, JSON.stringify(cliList));
      }

      // 3. Cargar Servicios (Cache First) 🔥
      const servCacheKey = `barber_data_servicios_list_${uid}`;
      const servCache = localStorage.getItem(servCacheKey);

      if (servCache) {
        setServiciosList(JSON.parse(servCache));
      } else {
        const servSnap = await getDocs(query(collection(barberDb, `barber_users/${uid}/servicios`)));
        const servList: any[] = [];
        servSnap.forEach((d) => servList.push({ id: d.id, ...d.data() }));
        servList.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setServiciosList(servList);
        localStorage.setItem(servCacheKey, JSON.stringify(servList));
      }
    };

    loadResources();
  }, [uid]);

  /* ============================================================
     CARGA DE TURNOS (Siempre fresco)
  ============================================================ */
  const loadTurnos = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(barberDb, `barber_users/${uid}/turnos`),
        where("fecha", "==", selectedDate)
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setTurnos(list);
    } catch (error) {
      console.error("Error cargando turnos", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTurnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, uid]);

  /* ============================================================
     HANDLERS APERTURA MODAL
  ============================================================ */
  const openNewTurno = (barberId: string, time: string) => {
    setIsEditing(false);
    setCurrentTurnoId(null);
    setFormBarberId(barberId);
    setFormTime(time);
    setFormClientId("");
    
    // Default logic para servicios
    if (serviciosList.length > 0) {
      setIsManualService(false);
      setFormService(serviciosList[0].nombre);
      setFormPrice(serviciosList[0].precio);
    } else {
      setIsManualService(true);
      setFormService("Corte Clásico");
      setFormPrice("5000");
    }

    setFormStatus("pendiente");
    setIsCreatingClient(false);
    setNewClientName("");
    setNewClientPhone("");
    setModalOpen(true);
  };

  const openEditTurno = (turno: any) => {
    setIsEditing(true);
    setCurrentTurnoId(turno.id);
    setFormBarberId(turno.barberId);
    setFormTime(turno.hora);
    setFormClientId(turno.clientId);
    setFormService(turno.servicio);
    setFormPrice(turno.precio);
    setFormStatus(turno.estado);
    
    // Detectar si el servicio guardado existe en el catálogo para setear el modo
    const existsInCatalog = serviciosList.some(s => s.nombre === turno.servicio);
    setIsManualService(!existsInCatalog);

    setIsCreatingClient(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCurrentTurnoId(null);
  };

  /* ============================================================
     HELPER: CONFIRMACIÓN PERSONALIZADA
  ============================================================ */
  const triggerConfirm = (title: string, message: string, confirmText: string, isDanger: boolean, action: () => void) => {
    setConfirmConfig({ title, message, confirmText, isDanger, action });
    setConfirmOpen(true);
  };

  /* ============================================================
     LOGICA DE GUARDADO
  ============================================================ */
  const handleSave = async () => {
    if (!uid) return;

    let finalClientId = formClientId;
    let finalClientName = "";

    // 1. SI ESTAMOS CREANDO CLIENTE NUEVO AL VUELO
    if (isCreatingClient) {
      if (!newClientName.trim()) {
        return alert("El nombre del cliente es obligatorio.");
      }
      try {
        const docRef = await addDoc(collection(barberDb, `barber_users/${uid}/clientes`), {
          nombre: newClientName.trim(),
          telefono: newClientPhone.trim(),
          cortes: 0,
          createdAt: serverTimestamp(),
        });
        
        finalClientId = docRef.id;
        finalClientName = newClientName.trim();

        // Actualizar lista local y caché
        const newClientObj = { id: finalClientId, nombre: finalClientName, telefono: newClientPhone.trim() };
        const newList = [...clientes, newClientObj].sort((a, b) => a.nombre.localeCompare(b.nombre));
        setClientes(newList);
        localStorage.setItem(`barber_data_clientes_list_${uid}`, JSON.stringify(newList));
        
      } catch (e) {
        console.error("Error creando cliente rápido", e);
        return alert("Error al crear el cliente.");
      }
    } else {
      if (!formClientId) return alert("Selecciona un cliente.");
      finalClientName = clientes.find(c => c.id === formClientId)?.nombre || "Cliente";
    }

    const barberName = empleados.find(e => e.id === formBarberId)?.nombre || "Barbero";

    // 2. GUARDAR TURNO
    try {
      const turnoData = {
        barberId: formBarberId,
        barberName,
        clientId: finalClientId,
        clientName: finalClientName,
        fecha: selectedDate,
        hora: formTime,
        servicio: formService,
        precio: formPrice,
        estado: formStatus,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && currentTurnoId) {
        await updateDoc(doc(barberDb, `barber_users/${uid}/turnos/${currentTurnoId}`), turnoData);
      } else {
        await addDoc(collection(barberDb, `barber_users/${uid}/turnos`), {
          ...turnoData,
          createdAt: serverTimestamp(),
        });
      }
      
      closeModal();
      loadTurnos();
    } catch (e) {
      console.error(e);
      alert("Error al guardar turno");
    }
  };

  /* ============================================================
     ACCIONES DE FLUJO (Con Confirmación Custom)
  ============================================================ */
  const requestFinalizar = () => {
    triggerConfirm(
      "¿Finalizar Turno?",
      "Esto marcará el turno como completado, sumará 1 punto de fidelidad y registrará la venta.",
      "Sí, finalizar",
      false, // No es peligroso
      async () => {
        if (!uid || !currentTurnoId || !formClientId) return;
        try {
            // 1. CREAR DOCUMENTO DE VENTA
            const ventaRef = await addDoc(collection(barberDb, `barber_users/${uid}/ventas`), {
                monto: Number(formPrice),
                descripcion: `Venta - Turno: ${formService} de ${clientes.find(c => c.id === formClientId)?.nombre || 'Cliente'}`,
                tipo: 'Ingreso',
                date: formatDateToInput(new Date()), // Fecha actual de la finalización
                createdAt: serverTimestamp(),
            });

            // 2. ACTUALIZAR TURNO (Estado y ventaId)
          await updateDoc(doc(barberDb, `barber_users/${uid}/turnos/${currentTurnoId}`), {
            estado: "completado",
            ventaId: ventaRef.id, // 🔥 Guardamos el ID de la venta
          });

          // 3. SUMAR PUNTO DE FIDELIDAD
          const clientRef = doc(barberDb, `barber_users/${uid}/clientes/${formClientId}`);
          await updateDoc(clientRef, { cortes: increment(1) });
          
          closeModal();
          setConfirmOpen(false);
          loadTurnos();
        } catch (e) {
          console.error(e);
        }
      }
    );
  };

  const requestDeshacer = () => {
    triggerConfirm(
      "¿Deshacer completado?",
      "El turno volverá a pendiente. Se eliminará la venta y se restará el punto de fidelidad sumado.",
      "Confirmar deshacer",
      true, // Warning
      async () => {
        if (!uid || !currentTurnoId || !formClientId) return;
        
        // Buscar el turno actual para obtener el ventaId
        const currentTurno = turnos.find(t => t.id === currentTurnoId);
        if (!currentTurno?.ventaId) return alert("Error: Turno no tiene ID de venta asociado.");

        try {
            // 1. ELIMINAR DOCUMENTO DE VENTA
            await deleteDoc(doc(barberDb, `barber_users/${uid}/ventas/${currentTurno.ventaId}`));

            // 2. ACTUALIZAR TURNO (Estado y eliminar ventaId)
            await updateDoc(doc(barberDb, `barber_users/${uid}/turnos/${currentTurnoId}`), {
            estado: "pendiente",
            ventaId: null, // 🔥 Quitamos la referencia de venta
            });

            // 3. RESTAR PUNTO DE FIDELIDAD
            const clientRef = doc(barberDb, `barber_users/${uid}/clientes/${formClientId}`);
            await updateDoc(clientRef, { cortes: increment(-1) });
            
            closeModal();
            setConfirmOpen(false);
            loadTurnos();
        } catch (e) {
            console.error(e);
        }
      }
    );
  };

  const requestEliminar = () => {
    triggerConfirm(
      "¿Eliminar turno?",
      "Esta acción borrará el turno permanentemente. No se puede deshacer.",
      "Sí, eliminar",
      true, // Danger
      async () => {
        if (!uid || !currentTurnoId) return;
        try {
          await deleteDoc(doc(barberDb, `barber_users/${uid}/turnos/${currentTurnoId}`));
          closeModal();
          setConfirmOpen(false);
          loadTurnos();
        } catch (e) {
          console.error(e);
        }
      }
    );
  };

  /* ============================================================
     RENDER
  ============================================================ */
  const getTurnoInSlot = (barberId: string, time: string) => {
    return turnos.find(t => t.barberId === barberId && t.hora === time && t.estado !== "cancelado");
  };
  
  // Helpers para estilos de formulario
  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm";
  const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm";


  return (
    <div className="space-y-6 animate-fadeIn pb-20 m-2">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <IconCalendar />
            Agenda Diaria
          </h2>
          <p className="text-sm text-slate-500">Gestiona los turnos de tus barberos</p>
        </div>

        {/* NAVEGACIÓN DE FECHAS */}
        <div className="flex items-center gap-2">
          <button 
            onClick={goToPreviousDay} 
            className="p-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition"
            aria-label="Día anterior"
          >
            <IconChevronLeft />
          </button>
          
          <input 
            type="date" 
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none shadow-sm font-medium w-36 text-center"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          <button 
            onClick={goToNextDay} 
            className="p-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition"
            aria-label="Día siguiente"
          >
            <IconChevronRight />
          </button>
          
          {selectedDate !== formatDateToInput(new Date()) && (
              <button 
                onClick={goToToday} 
                className="ml-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
              >
                Hoy
              </button>
          )}

        </div>
      </div>

      {/* GRILLA DE TURNOS */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[800px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div className="w-16 flex-shrink-0 border-r border-slate-200 p-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              Hora
            </div>
            {empleados.length === 0 ? (
              <div className="flex-1 p-4 text-center text-sm text-slate-500 italic">
                No hay empleados.
              </div>
            ) : (
              empleados.map(emp => (
                <div key={emp.id} className="flex-1 p-3 text-center border-r border-slate-200 last:border-r-0">
                  <span className="block font-semibold text-slate-800 text-sm">{emp.nombre}</span>
                </div>
              ))
            )}
          </div>

          {empleados.length > 0 && (
            <div className="divide-y divide-slate-100">
              {TIME_SLOTS.map(time => (
                <div key={time} className="flex h-20 group">
                  <div className="w-16 flex-shrink-0 flex items-center justify-center border-r border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-500 group-hover:bg-slate-100 transition-colors">
                    {time}
                  </div>

                  {empleados.map(emp => {
                    const turno = getTurnoInSlot(emp.id, time);
                    const isCompleted = turno?.estado === "completado";

                    return (
                      <div 
                        key={`${emp.id}-${time}`} 
                        className="flex-1 border-r border-slate-200 last:border-r-0 relative p-1 transition-colors hover:bg-slate-50"
                      >
                        {turno ? (
                          <div 
                            onClick={() => openEditTurno(turno)}
                            className={`w-full h-full rounded-lg border px-3 py-1.5 cursor-pointer shadow-sm hover:shadow-md transition-all flex flex-col justify-center
                              ${isCompleted 
                                ? "bg-emerald-50 border-emerald-200" 
                                : "bg-white border-slate-200 border-l-4 border-l-slate-800"
                              }`}
                          >
                            <p className={`text-sm font-bold truncate ${isCompleted ? "text-emerald-800" : "text-slate-900"}`}>
                              {turno.clientName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{turno.servicio}</p>
                            {isCompleted && (
                              <span className="absolute top-1 right-2 text-emerald-600">
                                <IconCheck />
                              </span>
                            )}
                          </div>
                        ) : (
                          <div 
                            onClick={() => openNewTurno(emp.id, time)}
                            className="w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer"
                          >
                            <span className="bg-slate-100 text-slate-400 p-1.5 rounded-full hover:bg-slate-200 hover:text-slate-600 transition">
                              <IconPlus />
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================
          MODAL FORMULARIO
      ========================================= */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {isEditing ? "Gestionar Turno" : "Nuevo Turno"}
              </h3>
              <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 flex items-center">
                <IconClock /> {formTime}
              </div>
            </div>

            <div className="space-y-4">
              
              {/* === SECCIÓN CLIENTE === */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-slate-600">Cliente</label>
                  {!isEditing && (
                    <button 
                      onClick={() => setIsCreatingClient(!isCreatingClient)}
                      className="text-xs text-slate-900 font-bold hover:underline flex items-center gap-1"
                    >
                      {isCreatingClient ? (
                        <><IconX /> Cancelar nuevo</>
                      ) : (
                        <><IconUserPlus /> Crear nuevo</>
                      )}
                    </button>
                  )}
                </div>

                {isCreatingClient ? (
                  <div className="space-y-2 animate-fadeIn">
                    <input 
                      type="text" 
                      placeholder="Nombre (Obligatorio)"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm focus:border-slate-800"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      autoFocus
                    />
                    <input 
                      type="tel" 
                      placeholder="Teléfono (Opcional)"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm focus:border-slate-800"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                    />
                  </div>
                ) : (
                  <select 
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm focus:border-slate-800"
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    disabled={isEditing && formStatus === "completado"}
                  >
                    <option value="">-- Seleccionar --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.telefono ? `(${c.telefono})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* === SECCIÓN SERVICIO Y PRECIO (Dual Mode) === */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-600">Servicio</label>
                  <button 
                    onClick={() => setIsManualService(!isManualService)}
                    className="text-[10px] text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md transition"
                  >
                    {isManualService ? <><IconList /> Ver Catálogo</> : "Ingresar Manual"}
                  </button>
                </div>

                {/* MODO MANUAL */}
                {isManualService ? (
                  <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                    <div>
                      <input 
                        type="text" 
                        placeholder="Servicio"
                        className={inputClass}
                        value={formService}
                        onChange={(e) => setFormService(e.target.value)}
                        disabled={isEditing && formStatus === "completado"}
                      />
                    </div>
                    <div>
                      <input 
                        type="number" 
                        placeholder="$ Precio"
                        className={inputClass}
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        disabled={isEditing && formStatus === "completado"}
                      />
                    </div>
                  </div>
                ) : (
                  // MODO CATÁLOGO (SELECT)
                  <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm appearance-none"
                        value={formService} 
                        onChange={(e) => {
                          const selectedName = e.target.value;
                          const serviceObj = serviciosList.find(s => s.nombre === selectedName);
                          setFormService(selectedName);
                          if (serviceObj) setFormPrice(serviceObj.precio);
                        }}
                        disabled={isEditing && formStatus === "completado"}
                      >
                        {serviciosList.length === 0 && <option value="">Sin servicios cargados</option>}
                        {serviciosList.map(s => (
                          <option key={s.id} value={s.nombre}>{s.nombre}</option>
                        ))}
                      </select>
                      {/* Flechita custom para el select */}
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                    <div>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 cursor-not-allowed"
                        value={formPrice} 
                        readOnly 
                        disabled
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* BARBERO */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Barbero asignado</label>
                <select 
                   className={inputClass}
                   value={formBarberId}
                   onChange={(e) => setFormBarberId(e.target.value)}
                   disabled={isEditing && formStatus === "completado"}
                >
                  {empleados.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              {/* FOOTER ACCIONES */}
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 mt-2">
                
                {/* 1. COMPLETAR */}
                {isEditing && formStatus !== "completado" && (
                  <button 
                    onClick={requestFinalizar}
                    className="w-full py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 active:scale-[0.98] transition font-bold text-sm flex items-center justify-center gap-2 shadow-sm"
                  >
                    <IconCheck /> Completar y Sumar Puntos
                  </button>
                )}

                {/* 2. DESHACER */}
                {isEditing && formStatus === "completado" && (
                  <button 
                    onClick={requestDeshacer}
                    className="w-full py-2.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-200 active:scale-[0.98] transition font-bold text-sm flex items-center justify-center gap-2 shadow-sm"
                  >
                    <IconUndo /> Deshacer completado
                  </button>
                )}

                <div className="flex gap-3">
                  {/* 3. ELIMINAR */}
                  {isEditing && formStatus !== "completado" && (
                    <button 
                      onClick={requestEliminar}
                      className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition"
                      title="Eliminar turno"
                    >
                      <IconTrash />
                    </button>
                  )}

                  <button 
                    onClick={closeModal}
                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm"
                  >
                    Cerrar
                  </button>
                  
                  {/* 4. GUARDAR */}
                  {formStatus !== "completado" && (
                    <button 
                      onClick={handleSave}
                      className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm"
                    >
                      {isCreatingClient ? "Crear y Agendar" : (isEditing ? "Guardar" : "Agendar")}
                    </button>
                  )}
                </div>

                {isEditing && formStatus === "completado" && (
                  <p className="text-center text-xs text-emerald-600 font-medium mt-1">
                    ✅ Turno completado. Para editarlo o eliminarlo, primero debes deshacerlo.
                  </p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL DE CONFIRMACIÓN PERSONALIZADO
      ========================================= */}
      {confirmOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          onClick={() => setConfirmOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconAlert />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {confirmConfig.title}
            </h3>
            
            <p className="text-sm text-slate-500 mb-6 px-2 leading-relaxed">
              {confirmConfig.message}
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmConfig.action}
                className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm active:scale-95 transition ${
                  confirmConfig.isDanger 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {confirmConfig.confirmText}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};