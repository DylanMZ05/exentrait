// src/barber-manager/pages/Servicios.tsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";

/* ============================================================
   ICONOS SVG
============================================================ */
const IconScissors = () => (
  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconAlert = () => (
  <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */
export const Servicios: React.FC = () => {
  const user = barberAuth.currentUser;
  const uid = user?.uid;

  const [servicios, setServicios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Confirmación Custom
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    action: () => void;
    confirmText: string;
    isDanger?: boolean;
  }>({ title: "", message: "", action: () => {}, confirmText: "", isDanger: false });

  // Formulario
  const [formNombre, setFormNombre] = useState("");
  const [formPrecio, setFormPrecio] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);

  /* ============================================================
     CARGA DE DATOS (CACHE FIRST)
  ============================================================ */
  const loadServicios = async (forceRefresh = false) => {
    if (!uid) return;
    
    const cacheKey = `barber_data_servicios_list_${uid}`;
    const cachedData = localStorage.getItem(cacheKey);

    // 1. Si hay caché y no forzamos refresco, usar caché (Costo $0)
    if (cachedData && !forceRefresh) {
      console.log("⚡ Usando Servicios desde caché");
      setServicios(JSON.parse(cachedData));
      setLoading(false);
      return;
    }

    // 2. Si no hay caché o forzamos refresco (ej. después de guardar), leer de Firebase
    try {
      console.log("🔥 Leyendo Servicios de Firebase");
      const q = query(collection(barberDb, `barber_users/${uid}/servicios`), orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

      setServicios(list);
      localStorage.setItem(cacheKey, JSON.stringify(list));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadServicios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  /* ============================================================
     HANDLERS
  ============================================================ */
  const openNew = () => {
    setIsEditing(false);
    setFormNombre("");
    setFormPrecio("");
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setIsEditing(true);
    setCurrentId(item.id);
    setFormNombre(item.nombre);
    setFormPrecio(item.precio);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCurrentId(null);
  };

  /* ============================================================
     GUARDAR
  ============================================================ */
  const handleSave = async () => {
    if (!uid) return;
    if (!formNombre.trim() || !formPrecio) return alert("Completa todos los campos");

    try {
      const data = {
        nombre: formNombre.trim(),
        precio: Number(formPrecio),
        updatedAt: serverTimestamp(),
      };

      if (isEditing && currentId) {
        await updateDoc(doc(barberDb, `barber_users/${uid}/servicios/${currentId}`), data);
      } else {
        await addDoc(collection(barberDb, `barber_users/${uid}/servicios`), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      closeModal();
      loadServicios(true); // Force refresh para actualizar caché
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
  };

  /* ============================================================
     ELIMINAR (CON CONFIRMACIÓN CUSTOM)
  ============================================================ */
  const triggerDelete = (item: any) => {
    setConfirmConfig({
      title: "¿Eliminar servicio?",
      message: `Estás a punto de eliminar "${item.nombre}". Esto no afectará a los turnos pasados.`,
      confirmText: "Sí, eliminar",
      isDanger: true,
      action: async () => {
        if (!uid) return;
        try {
          await deleteDoc(doc(barberDb, `barber_users/${uid}/servicios/${item.id}`));
          setConfirmOpen(false);
          loadServicios(true); // Force refresh para actualizar caché
        } catch (e) {
          console.error(e);
          alert("Error al eliminar");
        }
      }
    });
    setConfirmOpen(true);
  };

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="space-y-6 animate-fadeIn m-2">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            Catálogo de Servicios
          </h2>
          <p className="text-sm text-slate-500">Define los precios de tus cortes y productos</p>
        </div>

        <button 
          onClick={openNew}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
        >
          <IconPlus />
          Nuevo Servicio
        </button>
      </div>

      {/* LISTA DE SERVICIOS (GRID) */}
      {loading ? (
        <p className="text-center text-slate-500 py-10">Cargando servicios...</p>
      ) : servicios.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
          <p className="text-slate-400 mb-2">No tienes servicios configurados</p>
          <button onClick={openNew} className="text-sm text-slate-900 font-medium hover:underline">
            Crear el primero ahora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicios.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex justify-between items-center">
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <IconScissors />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{item.nombre}</h3>
                  <p className="text-sm font-bold text-emerald-600">
                    $ {Number(item.precio).toLocaleString("es-AR")}
                  </p>
                </div>
              </div>

              {/* ACCIONES VISIBLES (Sin hover para mobile) */}
              <div className="flex gap-1">
                <button onClick={() => openEdit(item)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition">
                  <IconEdit />
                </button>
                <button onClick={() => triggerDelete(item)} className="p-2 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-600 transition">
                  <IconTrash />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* =========================================
          MODAL FORMULARIO
      ========================================= */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {isEditing ? "Editar Servicio" : "Nuevo Servicio"}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre del servicio</label>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Ej. Corte Clásico"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Precio ($)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm font-medium text-emerald-600"
                  value={formPrecio}
                  onChange={(e) => setFormPrecio(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={closeModal}
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL CONFIRMACIÓN CUSTOM
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