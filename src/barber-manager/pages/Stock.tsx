// src/barber-manager/pages/Stock.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    serverTimestamp,
    increment, // Importar la función increment de Firestore
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// Tipado para el Producto
interface Producto {
    id: string;
    nombre: string;
    cantidadActual: number;
    stockBajo: number; // Nuevo campo para el umbral personalizado
}

/* ============================================================
    ICONOS SVG
============================================================ */

const IconBox = () => (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
);

const IconAdd = () => (
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
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.45-1.74 1.54-3.04L13.54 4.04c-.91-1.3-2.37-1.3-3.28 0L3.54 17.96c-.91 1.3.003 3.04 1.54 3.04z" />
    </svg>
);

// SPINNER AZUL Y ELEGANTE
const IconSpinner = ({ color = 'text-blue-600', size = 'h-4 w-4' }) => (
    <svg className={`animate-spin ${size} ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Stock: React.FC = () => {
    const user = barberAuth.currentUser;
    const uid = user?.uid;

    // Lógica CRÍTICA: Obtener el UID del dueño para consultar la base de datos
    const ownerUid = localStorage.getItem('barberOwnerId');
    const effectiveBarberieUid = ownerUid || uid;

    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);

    // ESTADO NUEVO: Cantidad para el ajuste rápido (setea el valor por defecto en 1)
    const [quickAdjustAmount, setQuickAdjustAmount] = useState(1); 

    // Modales
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    
    // Confirmación Custom
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Producto | null>(null);
    const deleteModalRef = useRef<HTMLDivElement>(null);

    // ⭐ ESTADOS DE BLOQUEO DE UI
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Formulario
    const [formNombre, setFormNombre] = useState("");
    const [formCantidad, setFormCantidad] = useState(0);
    const [formStockBajo, setFormStockBajo] = useState(5); // Valor por defecto 5
    const [currentId, setCurrentId] = useState<string | null>(null);

    /* ============================================================
        CARGA DE DATOS Y ORDENAMIENTO (Stock Bajo primero)
    ============================================================ */
    const loadProductos = async () => {
        // Usar el UID efectivo
        if (!effectiveBarberieUid) return; 
        setLoading(true);
        try {
            // 1. Cargar datos desde la colección del dueño
            const q = query(collection(barberDb, `barber_users/${effectiveBarberieUid}/stock`));
            const snap = await getDocs(q);
            const list: Producto[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Producto));

            // 2. Ordenar en el cliente: Stock Bajo primero, luego alfabéticamente
            list.sort((a, b) => {
                const aLow = a.cantidadActual <= a.stockBajo ? 0 : 1;
                const bLow = b.cantidadActual <= b.stockBajo ? 0 : 1;

                // Si A está bajo y B no (A viene primero, 0 - 1 = -1)
                if (aLow !== bLow) return aLow - bLow;
                
                // Si ambos están en el mismo estado, ordenar por nombre alfabéticamente
                return a.nombre.localeCompare(b.nombre);
            });

            setProductos(list);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        // Disparar la carga cuando el UID efectivo esté disponible
        loadProductos(); 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveBarberieUid]);

    /* ============================================================
        GESTIÓN DE MODAL Y CLICK-OUTSIDE
    ============================================================ */
    const resetForm = () => {
        setCurrentId(null);
        setFormNombre("");
        setFormCantidad(0);
        setFormStockBajo(5);
        setIsEditing(false);
    };

    const openModal = (producto?: Producto) => {
        if (producto) {
            setIsEditing(true);
            setCurrentId(producto.id);
            setFormNombre(producto.nombre);
            setFormCantidad(producto.cantidadActual || 0);
            setFormStockBajo(producto.stockBajo || 5);
        } else {
            resetForm();
        }
        setModalOpen(true);
    };

    const closeModal = useCallback(() => {
        setModalOpen(false);
        resetForm();
    }, []);
    
    const handleClickOutsideMain = useCallback((event: MouseEvent) => {
        const modalElement = modalRef.current;
        if (modalElement && !modalElement.contains(event.target as Node)) {
            closeModal();
        }
    }, [closeModal]);
    
    const handleClickOutsideDelete = useCallback((event: MouseEvent) => {
        const deleteModalElement = deleteModalRef.current;
        if (deleteModalElement && !deleteModalElement.contains(event.target as Node)) {
            setDeleteConfirmOpen(false);
            setProductToDelete(null);
        }
    }, []);

    useEffect(() => {
        if (modalOpen) {
            document.addEventListener('mousedown', handleClickOutsideMain);
        } else {
            document.removeEventListener('mousedown', handleClickOutsideMain);
        }
        return () => document.removeEventListener('mousedown', handleClickOutsideMain);
    }, [modalOpen, handleClickOutsideMain]);

    useEffect(() => {
        if (deleteConfirmOpen) {
            document.addEventListener('mousedown', handleClickOutsideDelete);
        } else {
            document.removeEventListener('mousedown', handleClickOutsideDelete);
        }
        return () => document.removeEventListener('mousedown', handleClickOutsideDelete);
    }, [deleteConfirmOpen, handleClickOutsideDelete]);


    /* ============================================================
        CRUD HANDLERS
    ============================================================ */
    
    // NUEVO HANDLER: Ajuste rápido de stock
    const handleStockAdjustment = async (productId: string, currentStock: number, type: 'add' | 'subtract') => {
        if (!effectiveBarberieUid || !productId || quickAdjustAmount <= 0) return;

        const changeAmount = type === 'add' ? quickAdjustAmount : -quickAdjustAmount;
        const newStock = currentStock + changeAmount;
        
        if (newStock < 0) {
            alert("La cantidad resultante no puede ser negativa.");
            return;
        }

        try {
            const productRef = doc(barberDb, `barber_users/${effectiveBarberieUid}/stock/${productId}`);
            
            // Usamos increment() para una actualización atómica y segura
            await updateDoc(productRef, {
                cantidadActual: increment(changeAmount),
                updatedAt: serverTimestamp(),
            });
            
            // Reiniciamos el valor de ajuste a 1 para la siguiente acción
            setQuickAdjustAmount(1);
            loadProductos();
        } catch (e) {
            console.error("Error al ajustar stock:", e);
            alert(`Error al ${type === 'add' ? 'sumar' : 'restar'} stock. Revisa permisos.`);
        }
    };


    const handleSave = async () => {
        // Usar el UID efectivo
        if (!effectiveBarberieUid || isSaving) return alert("Error de autenticación o acción en curso.");
        if (!formNombre.trim()) return alert("El nombre es obligatorio");
        if (formCantidad < 0 || formStockBajo < 0) return alert("Las cantidades no pueden ser negativas");
        
        setIsSaving(true); // ⭐ BLOQUEA el botón

        try {
            const data = {
                nombre: formNombre.trim(),
                cantidadActual: Number(formCantidad),
                stockBajo: Number(formStockBajo),
                updatedAt: serverTimestamp(),
            };

            if (isEditing && currentId) {
                // ACTUALIZAR (EDITAR) usando effectiveBarberieUid
                await updateDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/stock/${currentId}`), data);
            } else {
                // CREAR usando effectiveBarberieUid
                await addDoc(collection(barberDb, `barber_users/${effectiveBarberieUid}/stock`), {
                    ...data,
                    createdAt: serverTimestamp(),
                });
            }

            closeModal();
            loadProductos(); // Recarga para aplicar el ordenamiento
        } catch (e) {
            console.error(e);
            alert("Error al guardar el producto");
        } finally {
            setIsSaving(false); // ⭐ DESBLOQUEA el botón
        }
    };

    const triggerDelete = (producto: Producto) => {
        setProductToDelete(producto);
        setDeleteConfirmOpen(true);
    };
    
    const handleDelete = async () => {
        // Usar el UID efectivo
        if (!effectiveBarberieUid || !productToDelete || isDeleting) return; 
        
        setIsDeleting(true); // ⭐ BLOQUEA el botón
        
        try {
            // ELIMINAR usando effectiveBarberieUid
            await deleteDoc(doc(barberDb, `barber_users/${effectiveBarberieUid}/stock/${productToDelete.id}`));
            setDeleteConfirmOpen(false);
            setProductToDelete(null);
            loadProductos();
        } catch (e) {
            console.error(e);
            alert("Error al eliminar el producto.");
        } finally {
            setIsDeleting(false); // ⭐ DESBLOQUEA el botón
        }
    };

    // Estilos Comunes
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
    const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
    const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed";


    /* ============================================================
        RENDER
    ============================================================ */
    
    const totalStockBajo = productos.filter(p => p.cantidadActual <= p.stockBajo).length;

    return (
        <div className="space-y-6 animate-fadeIn m-2">
            
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                        <IconBox />
                        Inventario y Stock
                    </h2>
                    <p className="text-sm text-slate-500">
                        Gestiona tus productos y establece umbrales de stock bajo.
                    </p>
                </div>
                
                <div className="flex items-center gap-4">
                    {totalStockBajo > 0 && (
                        <div className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium flex items-center gap-2 border border-red-200">
                            <IconAlert /> {totalStockBajo} producto(s) en stock bajo
                        </div>
                    )}
                    <button 
                        onClick={() => openModal()}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                        <IconAdd />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* LISTA DE PRODUCTOS */}
            {loading ? (
                // CENTRADO ELEGANTE DEL SPINNER
                <div className="text-center py-12 flex justify-center items-center min-h-[300px] w-full">
                    <div>
                        <IconSpinner color="text-blue-600" size="h-8 w-8" />
                        <p className="mt-2 text-sm text-slate-500">Cargando inventario...</p>
                    </div>
                </div>
            ) : productos.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                    <p className="text-slate-400 mb-2">No tienes productos en el inventario.</p>
                    <button onClick={() => openModal()} className="text-sm text-slate-900 font-medium hover:underline">
                        Crear el primero ahora
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Control global de cantidad de ajuste */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Ajustar Cantidad por:
                        </label>
                        <input
                            type="number"
                            value={quickAdjustAmount}
                            onChange={(e) => setQuickAdjustAmount(Math.max(1, parseInt(e.target.value) || 1))} // Mínimo 1
                            className="w-16 text-center border border-slate-300 rounded-lg text-base font-medium py-1.5 focus:border-blue-500 focus:ring-0"
                            min="1"
                        />
                    </div>
                    
                    {/* Grid de Productos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {productos.map((item) => {
                            const isLowStock = item.cantidadActual <= item.stockBajo;
                            // Deshabilitar resta si la cantidad a restar es mayor que el stock actual
                            const disableSubtract = item.cantidadActual < quickAdjustAmount;

                            return (
                            <div 
                                key={item.id} 
                                className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow group relative 
                                ${isLowStock ? 'border-red-400/50 ring-1 ring-red-400/30' : 'border-slate-200'}`}
                            >
                                {isLowStock && (
                                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                                    STOCK BAJO
                                </div>
                                )}
                                
                                <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-slate-900">{item.nombre}</h3>
                                </div>
                                
                                {/* Botones de acción (Editar/Eliminar) */}
                                <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"> 
                                    <button 
                                    onClick={() => openModal(item)} 
                                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                                    >
                                    <IconEdit />
                                    </button>
                                    <button 
                                    onClick={() => triggerDelete(item)} 
                                    className="p-1.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-500 transition"
                                    >
                                    <IconTrash />
                                    </button>
                                </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                        Cantidad Actual
                                    </p>
                                    <p className={`text-2xl font-bold mt-1 ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                                        {item.cantidadActual}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-2 mb-3">
                                        Umbral de Stock Bajo: {item.stockBajo}
                                    </p>
                                </div>
                                
                                {/* CONTROL RÁPIDO DE STOCK */}
                                <div className="flex justify-between items-center gap-2">
                                    <button
                                        onClick={() => handleStockAdjustment(item.id, item.cantidadActual, 'subtract')}
                                        className={`px-4 py-2 text-base rounded-lg transition font-bold ${disableSubtract ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                        disabled={disableSubtract} 
                                    >
                                        -
                                    </button>
                                    <p className="text-sm text-slate-700 font-medium">
                                        {quickAdjustAmount} {quickAdjustAmount === 1 ? 'Unidad' : 'Unidades'}
                                    </p>
                                    <button
                                        onClick={() => handleStockAdjustment(item.id, item.cantidadActual, 'add')}
                                        className="px-4 py-2 text-base rounded-lg transition font-bold bg-blue-100 text-blue-600 hover:bg-blue-200"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL CREAR / EDITAR
            ========================================= */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div 
                        ref={modalRef}
                        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            {isEditing ? "Editar Producto" : "Nuevo Producto"}
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre del Producto</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={formNombre} 
                                    onChange={(e) => setFormNombre(e.target.value)} 
                                    className={inputClass}
                                    placeholder="Ej. Cera Fijadora X" 
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Cantidad Actual</label>
                                    <input 
                                        type="number" 
                                        value={formCantidad} 
                                        onChange={(e) => setFormCantidad(Number(e.target.value))} 
                                        className={inputClass}
                                        placeholder="0" 
                                        min="0"
                                        disabled={isSaving}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Stock Bajo (Umbral)</label>
                                    <input 
                                        type="number" 
                                        value={formStockBajo} 
                                        onChange={(e) => setFormStockBajo(Number(e.target.value))} 
                                        className={inputClass}
                                        placeholder="5" 
                                        min="0"
                                        disabled={isSaving}
                                    />
                                </div>
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
                                            <IconSpinner color="text-white" />
                                            Guardando...
                                        </>
                                    ) : (isEditing ? "Guardar Cambios" : "Guardar Producto")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL DE CONFIRMACIÓN DE ELIMINACIÓN (Custom UX)
            ========================================= */}
            {deleteConfirmOpen && productToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
                    <div 
                        ref={deleteModalRef}
                        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fadeIn text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <IconAlert />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">¿Eliminar Producto?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">
                            Estás a punto de eliminar <span className="font-semibold text-slate-700">{productToDelete.nombre}</span> del inventario. Esta acción no se puede deshacer.
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirmOpen(false)}
                                className={btnSecondary}
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDelete}
                                className={`w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm flex items-center justify-center gap-2`}
                                disabled={isDeleting} // ⭐ Bloquea el botón
                            >
                                {isDeleting ? (
                                    <>
                                        <IconSpinner color="text-white" />
                                        Eliminando...
                                    </>
                                ) : "Sí, eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};