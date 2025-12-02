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

// Tipado para el Servicio (usado para el CRUD)
interface Servicio {
    id: string;
    nombre: string;
    precio: number;
}


/* ============================================================
    ICONOS SVG & HELPERS
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

const IconSpinner = () => (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
);

// Formato de moneda
const formatCurrency = (amount: number) => {
    return `$ ${Math.abs(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
};

/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Servicios: React.FC = () => {
    const user = barberAuth.currentUser;
    const userUid = user?.uid;
    // CRÍTICO: Usar el UID del Dueño/Barbería para la consulta
    const effectiveBarberieUid = localStorage.getItem('barberOwnerId') || userUid;


    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(true);

    // Modales
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // ⭐ ESTADOS DE BLOQUEO
    const [isSaving, setIsSaving] = useState(false); 
    const [isConfirming, setIsConfirming] = useState(false); 
    
    // Confirmación Custom
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        message: string;
        action: () => Promise<void>; // La acción ahora es asíncrona
        confirmText: string;
        isDanger?: boolean;
    }>({ title: "", message: "", action: async () => {}, confirmText: "", isDanger: false });

    // Formulario
    const [formNombre, setFormNombre] = useState("");
    const [formPrecio, setFormPrecio] = useState("");
    const [currentId, setCurrentId] = useState<string | null>(null);

    /* ============================================================
        CARGA DE DATOS (SERVICIO)
    ============================================================ */
    const loadServicios = async () => {
        if (!effectiveBarberieUid) return;
        setLoading(true);

        try {
            const uid = effectiveBarberieUid;
            
            const qServicios = query(collection(barberDb, `barber_users/${uid}/servicios`), orderBy("nombre", "asc"));
            const snapServicios = await getDocs(qServicios);
            const serviciosList: Servicio[] = [];
            snapServicios.forEach((d) => serviciosList.push({ id: d.id, ...d.data() } as Servicio));
            setServicios(serviciosList);

        } catch (err) {
            console.error("Error al cargar servicios:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServicios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveBarberieUid]);


    /* ============================================================
        HANDLERS FORMULARIO Y CRUD
    ============================================================ */
    const openNew = () => {
        setIsEditing(false);
        setFormNombre("");
        setFormPrecio("");
        setModalOpen(true);
    };

    const openEdit = (item: Servicio) => {
        setIsEditing(true);
        setCurrentId(item.id);
        setFormNombre(item.nombre);
        setFormPrecio(item.precio.toString());
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setCurrentId(null);
    };

    const handleSave = async () => {
        if (!effectiveBarberieUid || isSaving) return; // Prevenir doble clic
        if (!formNombre.trim() || !formPrecio) return alert("Completa todos los campos");

        setIsSaving(true); // ⭐ BLOQUEA el botón
        
        try {
            const data = {
                nombre: formNombre.trim(),
                precio: Number(formPrecio),
                updatedAt: serverTimestamp(),
            };

            if (isEditing && currentId) {
                // Editar servicio existente
                await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/servicios/${currentId}`), data);
            } else {
                // Crear nuevo servicio
                await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/servicios`), {
                    ...data,
                    createdAt: serverTimestamp(),
                });
            }

            closeModal();
            loadServicios(); // Force refresh 
        } catch (e) {
            console.error(e);
            alert("Error al guardar");
        } finally {
            setIsSaving(false); // ⭐ DESBLOQUEA el botón
        }
    };

    const executeConfirmAction = async () => {
        if (isConfirming) return; // Prevenir doble clic
        
        setIsConfirming(true); // ⭐ BLOQUEA el botón de confirmación
        
        try {
            await confirmConfig.action(); // Ejecuta la acción (eliminar)
            setConfirmOpen(false);
        } catch (e) {
            console.error("Error al ejecutar acción confirmada:", e);
            alert("Ocurrió un error al procesar la acción.");
        } finally {
            setIsConfirming(false); // ⭐ DESBLOQUEA el botón de confirmación
        }
    };


    const triggerDelete = (item: Servicio) => {
        const action = async () => {
            if (!effectiveBarberieUid) return;
            try {
                await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/servicios/${item.id}`));
                setConfirmOpen(false);
                loadServicios(); 
            } catch (e) {
                console.error(e);
                alert("Error al eliminar");
                throw e; // Lanza el error para que sea capturado por executeConfirmAction
            }
        };

        setConfirmConfig({
            title: "¿Eliminar servicio?",
            message: `Estás a punto de eliminar "${item.nombre}". Esto es irreversible.`,
            confirmText: "Sí, eliminar",
            isDanger: true,
            action: action as () => Promise<void>
        });
        setConfirmOpen(true);
    };
    
    // Asumimos que los estilos están definidos globalmente o en un helper
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
    const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed";


    /* ============================================================
        RENDER PRINCIPAL
    ============================================================ */
    
    // No hay data combinada de stock, solo servicios

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servicios.map((item) => {
                        return (
                            <div key={item.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all group flex justify-between items-center border-slate-200`}>
                                
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                                        <IconScissors />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">{item.nombre}</h3>
                                        <p className="text-sm font-bold text-emerald-600">
                                            {formatCurrency(item.precio)}
                                        </p>
                                    </div>
                                </div>

                                {/* ACCIONES VISIBLES */}
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(item)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition">
                                        <IconEdit />
                                    </button>
                                    <button onClick={() => triggerDelete(item)} className="p-2 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-600 transition">
                                        <IconTrash />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* =========================================
                MODAL CREAR / EDITAR
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
                                    className={inputClass}
                                    value={formNombre}
                                    onChange={(e) => setFormNombre(e.target.value)}
                                    disabled={isSaving}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Precio ({formatCurrency(0).replace('0', '$')})</label>
                                <input 
                                    type="number" 
                                    placeholder="0"
                                    className={`${inputClass} font-medium text-emerald-600`}
                                    value={formPrecio}
                                    onChange={(e) => setFormPrecio(e.target.value)}
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={closeModal}
                                    className={btnSecondary}
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className={btnPrimary}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <IconSpinner />
                                            Guardando...
                                        </>
                                    ) : (isEditing ? "Guardar Cambios" : "Guardar")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN CUSTOM */}
            {confirmOpen && (
                <div 
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                    onClick={() => setConfirmOpen(false)}
                >
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn text-center" onClick={(e) => e.stopPropagation()}>
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
                                disabled={isConfirming}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={executeConfirmAction} // Usa la función que maneja el estado de carga
                                className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm active:scale-95 transition flex items-center justify-center gap-2 ${
                                    confirmConfig.isDanger 
                                        ? "bg-red-600 hover:bg-red-700" 
                                        : "bg-slate-900 hover:bg-slate-800"
                                }`}
                                disabled={isConfirming} // ⭐ Bloquea el botón al confirmar
                            >
                                {isConfirming ? (
                                    <>
                                        <IconSpinner />
                                        Cargando...
                                    </>
                                ) : confirmConfig.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};