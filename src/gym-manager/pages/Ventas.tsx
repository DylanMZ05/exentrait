import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { type User } from 'firebase/auth';
import { MdSearch, MdArrowDropDown, MdClose, MdAttachMoney, MdDelete, MdEdit } from 'react-icons/md';
import { db } from '../../../firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore'; 

// ----------------------------------------------------------------------
// TIPOS y HELPERS
// ----------------------------------------------------------------------

interface Venta {
    id: string;
    fecha: string; // YYYY-MM-DD
    monto: number;
    observaciones: string;
    _ymd?: string; // Fecha normalizada
}

interface VentaFormData {
    fecha: string;
    monto: string; // Se utiliza string para el input (ej: "10000")
    observaciones: string;
}

type VentasDayTree = { [dayKey: string]: Venta[] };
type VentasMonthTree = { [month: number]: VentasDayTree };
type VentasYearTree = { [year: number]: VentasMonthTree };

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const MESES_IDX: { [key: string]: number } = { ENERO:1, FEBRERO:2, MARZO:3, ABRIL:4, MAYO:5, JUNIO:6, JULIO:7, AGOSTO:8, SEPTIEMBRE:9, SETIEMBRE:9, OCTUBRE:10, NOVIEMBRE:11, DICIEMBRE:12 };

const fmtMoneySigned = (n: number | string) => {
    const num = Number(n) || 0;
    const abs = Math.abs(num).toLocaleString("es-AR");
    return `${num >= 0 ? "+" : "-"}$${abs}`;
}
const limpiarMonto = (valor: string): number => {
    // Elimina el signo $ y puntos de miles para obtener un flotante
    const numStr = String(valor).replace(/[$.]/g, "").replace(",", ".");
    // Permite que el signo negativo se mantenga si está presente, solo para parsing
    const cleaned = parseFloat(numStr.replace(/[^\d.-]/g, "")) || 0; 
    return cleaned;
};
const formatearMonto = (valor: number): string => {
    const n = Number(valor) || 0;
    const abs = Math.abs(n).toLocaleString("es-AR");
    // Al formatear para el input, solo devolvemos el valor absoluto (ej: "10.000")
    return `${abs}`; 
};
const toYMD = (date: Date): string => { 
    const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0"); 
    return `${y}-${m}-${d}`; 
};
const norm = (s: string) => (s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

const groupVentas = (ventas: Venta[]): VentasYearTree => {
    const tree: VentasYearTree = {};
    ventas.forEach(v => {
        let fechaStr = v.fecha;
        
        // Normalización de fecha
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr) && v.fecha) {
            try {
                // 🚨 CORRECCIÓN TS2339 🚨: El objeto v.fecha debe ser tratado como "any" o su tipo correcto.
                // Usaremos un chequeo seguro para Timestamp.
                const dateInput = (v.fecha as any).seconds ? (v.fecha as any).toDate() : v.fecha;
                const dt = new Date(dateInput);
                if (!isNaN(dt.getTime())) fechaStr = toYMD(dt);
            } catch {}
        }
        if (!fechaStr) return;


        const [Y, M, D] = fechaStr.split("-").map(n => parseInt(n, 10));

        if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D)) return;

        if (!tree[Y]) tree[Y] = {};
        if (!tree[Y][M]) tree[Y][M] = {};
        const dayKey = `${D}/${M}/${Y}`;
        if (!tree[Y][M][dayKey]) tree[Y][M][dayKey] = [];
        tree[Y][M][dayKey].push({ ...v, _ymd: fechaStr });
    });
    return tree;
};

const sumYear = (monthsObj: VentasMonthTree): number => {
    return Object.values(monthsObj).reduce((s, md) => s + sumMonth(md), 0);
};
const sumMonth = (daysObj: VentasDayTree): number => {
    let t = 0; Object.values(daysObj).forEach(arr => arr.forEach(v => t += Number(v.monto || 0))); return t;
};
const sumDay = (ventas: Venta[]): number => {
    return ventas.reduce((s, v) => s + Number(v.monto || 0), 0);
};

function parseQueryMesAnio(q: string) {
    const Q = norm(q).replace(/\s+DE\s+/g, " ").replace(/\s+/g, " ").trim();
    const yearMatch = Q.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
    let month = null;
    
    const tokens = Q.split(" ").filter(Boolean);
    for (const t of tokens) {
        if (/^(19|20)\d{2}$/.test(t)) continue;
        if (t.length < 3) continue;
        for (const [name, idx] of Object.entries(MESES_IDX)) {
            if (name.startsWith(t)) { month = idx; break; }
        }
        if (month) break;
    }
    if (!month) {
        for (const [name, idx] of Object.entries(MESES_IDX)) {
            if (Q.includes(name)) { month = idx; break; }
        }
    }
    return { month, year, queryNorm: Q };
}


// ----------------------------------------------------------------------
// HOOK: useVentasData
// ----------------------------------------------------------------------

const useVentasData = (user: User | null) => {
    const [data, setData] = useState<Venta[]>([]);
    const [loading, setLoading] = useState(true);

    const uid = user?.uid;

    useEffect(() => {
        if (!uid) {
            setData([]);
            setLoading(false);
            return;
        }

        const qv = query(collection(db, "usuarios", uid, "ventas"), orderBy("fecha", "desc"));
        
        const unsubscribe = onSnapshot(qv, (snap) => {
            const ventasList: Venta[] = [];
            snap.forEach(d => {
                const v = d.data();
                
                let fechaStr = v.fecha;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr) && v.fecha) {
                    try {
                        const dateInput = (v.fecha as any).seconds ? (v.fecha as any).toDate() : v.fecha;
                        const dt = new Date(dateInput);
                        if (!isNaN(dt.getTime())) fechaStr = toYMD(dt);
                    } catch {}
                }

                if (fechaStr) {
                    ventasList.push({ 
                        id: d.id, 
                        ...v, 
                        fecha: fechaStr, 
                        monto: Number(v.monto || 0),
                        observaciones: v.observaciones || ''
                    });
                }
            });
            setData(ventasList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching ventas:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [uid]);

    // Lógica CRUD
    const addVenta = useCallback(async (data: VentaFormData) => {
        if (!uid) return;
        const monto = limpiarMonto(data.monto); // Recibe el monto con signo correcto
        await addDoc(collection(db, "usuarios", uid, "ventas"), { 
            fecha: data.fecha, 
            monto: monto, 
            observaciones: data.observaciones 
        });
    }, [uid]);

    const updateVenta = useCallback(async (id: string, data: VentaFormData) => {
        if (!uid) return;
        const monto = limpiarMonto(data.monto);
        await updateDoc(doc(db, "usuarios", uid, "ventas", id), { 
            fecha: data.fecha, 
            monto: monto, 
            observaciones: data.observaciones 
        });
    }, [uid]);

    const deleteVenta = useCallback(async (id: string) => {
        if (!uid) return;
        await deleteDoc(doc(db, "usuarios", uid, "ventas", id));
    }, [uid]);

    // Agrupación y árbol
    const ventasTree = useMemo(() => groupVentas(data), [data]);
    // 🚨 CORRECCIÓN TS6133 🚨: Eliminada allVentas no utilizada
    // const allVentas = data;

    return { ventasTree, loading, addVenta, updateVenta, deleteVenta };
};

// ----------------------------------------------------------------------
// MODAL VentaModal (Unificado para Add/Edit)
// ----------------------------------------------------------------------

interface VentaModalProps {
    isVisible: boolean;
    onClose: () => void;
    onSubmit: (data: VentaFormData & { id?: string }) => void;
    initialData?: Venta | null;
    isEdit: boolean;
    onDelete?: (id: string) => void;
}

const VentaModal: React.FC<VentaModalProps> = ({ isVisible, onClose, onSubmit, initialData, isEdit, onDelete }) => {
    // Estado para definir si la transacción en CREACIÓN es un Gasto
    const [isExpenseMode, setIsExpenseMode] = useState(false);
    
    const [formData, setFormData] = useState<VentaFormData>({ fecha: toYMD(new Date()), monto: formatearMonto(0), observaciones: '' });
    const [isDeletePopupVisible, setIsDeletePopupVisible] = useState(false);
    
    // Reset y carga de data inicial
    useEffect(() => {
        if (isVisible) {
            if (isEdit && initialData) {
                // En edición, establecemos el modo Gasto si el monto es negativo
                setFormData({
                    fecha: initialData.fecha,
                    // El formatearMonto devuelve el valor absoluto
                    monto: formatearMonto(initialData.monto), 
                    observaciones: initialData.observaciones || '',
                });
                setIsExpenseMode(initialData.monto < 0); 
            } else if (!isEdit) {
                // Para creación: modo por defecto es Ingreso
                setFormData({ fecha: toYMD(new Date()), monto: formatearMonto(0), observaciones: '' });
                setIsExpenseMode(false);
            }
        }
    }, [isVisible, isEdit, initialData]);

    const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const num = Math.abs(limpiarMonto(rawValue)); 
        
        // Al formatear, solo mostramos el valor absoluto limpio
        const formatted = formatearMonto(num);
        setFormData(prev => ({ ...prev, monto: formatted }));
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id.replace(isEdit ? 'edit' : 'add', '').toLowerCase()]: value }));
    };

    const isFormValid = useMemo(() => {
        const montoNum = limpiarMonto(formData.monto);
        const obsOk = formData.observaciones.trim().length >= 5;
        const fechaOk = !!formData.fecha;
        return fechaOk && obsOk && !isNaN(montoNum) && montoNum !== 0; 
    }, [formData]);


    // LÓGICA DE SUBMISIÓN FINAL
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;

        let montoNum = limpiarMonto(formData.monto);

        if (isEdit) {
            // En edición, el signo se decide por el chequeo de initialData al abrir el modal.
            // Si initialData.monto era < 0, isExpenseMode es true.
            // Al guardar, aplicamos el signo basado en ese estado, no en el input,
            // ya que el input solo muestra el valor absoluto.
             montoNum = isExpenseMode ? -Math.abs(montoNum) : Math.abs(montoNum);
        } else {
            // Lógica de Creación: Forzamos el signo según el modo
            montoNum = isExpenseMode ? -Math.abs(montoNum) : Math.abs(montoNum);
        }

        onSubmit({ 
            ...formData, 
            monto: String(montoNum), 
            id: isEdit ? initialData!.id : undefined 
        });
        onClose();
    };
    
    // Controla la apertura del modal y resetea el modo Gasto si es necesario
    const handleSetMode = (isExpense: boolean) => {
        if (!isEdit) {
            setIsExpenseMode(isExpense);
        }
    };
    
    // Estilos condicionales para los botones de modo
    const expenseButtonClass = isExpenseMode 
        ? 'bg-red-600 text-white hover:bg-red-700' 
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100';

    const incomeButtonClass = !isExpenseMode 
        ? 'bg-green-600 text-white hover:bg-green-700' 
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100';

    
    if (!isVisible) return null;
    
    // Chequeos de seguridad para TS18048 antes de usar initialData.monto
    const isInitialMontoNegative = isEdit && initialData && initialData.monto < 0;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 ring-1 ring-black/5 relative" onClick={e => e.stopPropagation()}>
                
                {/* Título y Cerrar */}
                <h2 className="text-xl font-bold text-[#0f1c3f] mb-4">
                    {isEdit ? 'Editar Transacción' : `Nueva Operación (${isExpenseMode ? 'Gasto' : 'Ingreso'})`}
                </h2>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><MdClose className="w-6 h-6" /></button>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* SWITCH INGRESO / GASTO (Solo en Creación) */}
                    {!isEdit && (
                        <div className="flex gap-3 pb-4 border-b border-gray-200">
                            <button type="button" onClick={() => handleSetMode(false)}
                                className={`flex-1 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${incomeButtonClass}`}
                                disabled={isEdit}
                            >
                                <MdAttachMoney className="w-5 h-5" /> Añadir Venta (Ingreso)
                            </button>
                            <button type="button" onClick={() => handleSetMode(true)}
                                className={`flex-1 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${expenseButtonClass}`}
                                disabled={isEdit}
                            >
                                <MdAttachMoney className="w-5 h-5" /> Registrar Gasto (Egreso)
                            </button>
                        </div>
                    )}

                    {/* Fecha */}
                    <div>
                        <label htmlFor={isEdit ? "editFecha" : "addFecha"} className="block text-sm font-medium text-gray-700">Fecha</label>
                        <input type="date" id={isEdit ? "editFecha" : "addFecha"} name="fecha" value={formData.fecha} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required />
                    </div>
                    
                    {/* Monto */}
                    <div>
                        <label htmlFor={isEdit ? "editMontoVenta" : "addMontoVenta"} className="block text-sm font-medium text-gray-700">
                            Monto {isEdit ? `(${isExpenseMode ? 'Gasto' : 'Ingreso'})` : ''}
                        </label>
                        <div className="relative mt-1">
                            {/* Prefijo Condicional (solo visual) */}
                            {(isExpenseMode || isInitialMontoNegative) && (
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 text-sm">
                                    $-
                                </span>
                            )}
                            <input type="text" id={isEdit ? "editMontoVenta" : "addMontoVenta"} name="monto" value={formData.monto} onChange={handleMontoChange}
                                className={`block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none ${isExpenseMode || isInitialMontoNegative ? 'pl-8' : ''}`} 
                                required inputMode="numeric" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {isEdit 
                                ? `Monto actual: ${formatearMonto(limpiarMonto(formData.monto))}`
                                : 'Ingresa solo el valor monetario (sin el signo $).'
                            }
                        </p>
                    </div>
                    
                    {/* Observaciones */}
                    <div>
                        <label htmlFor={isEdit ? "editObservaciones" : "addObservaciones"} className="block text-sm font-medium text-gray-700">Observaciones</label>
                        <textarea id={isEdit ? "editObservaciones" : "addObservaciones"} name="observaciones" value={formData.observaciones} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none"
                            rows={2} placeholder="Detalle (mín. 5 caracteres)" required minLength={5}></textarea>
                    </div>
                    
                    {/* Botones Finales */}
                    <div className="flex justify-between mt-4 pt-4 border-t">
                        {isEdit && (
                             <button type="button" onClick={() => setIsDeletePopupVisible(true)}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition flex items-center gap-1">
                                <MdDelete /> Eliminar
                            </button>
                        )}
                        <div className={`flex ${isEdit ? 'justify-end' : 'flex-1 justify-end' } gap-3`}>
                            <button type="button" onClick={onClose}
                                className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded transition">
                                Cancelar
                            </button>
                            
                            {/* En Edición, solo un botón de Guardar */}
                            <button type="submit" disabled={!isFormValid}
                                className="bg-[#152754] hover:bg-[#0e1f48] text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed">
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            
            {/* Popup Confirmación Eliminar Venta */}
            {isEdit && isDeletePopupVisible && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={e => e.stopPropagation()}>
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 ring-1 ring-black/5">
                        <h2 className="text-xl font-bold text-red-600 mb-4">Confirmar Eliminación</h2>
                        <p className="mb-3">¿Seguro que deseas eliminar esta venta?</p>
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setIsDeletePopupVisible(false)}
                                    className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition">
                                Cancelar
                            </button>
                            <button type="button" onClick={() => { if (onDelete && initialData) onDelete(initialData.id); setIsDeletePopupVisible(false); onClose(); }}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ----------------------------------------------------------------------
// SUBCOMPONENTES DE RENDERIZADO (Con estado de expansión)
// ----------------------------------------------------------------------

interface CollapseBlockProps {
    total: number;
    title: string | React.ReactNode; // 🚨 CORRECCIÓN TS2503 🚨
    children: React.ReactNode;
    defaultOpen?: boolean;
    className: string;
}

const CollapseBlock: React.FC<CollapseBlockProps> = ({ total, title, children, defaultOpen = false, className }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const chevClass = isOpen ? 'rotate-180' : 'rotate-90'; 
    const totalClass = total >= 0 ? 'total-pos bg-green-100 text-green-800' : 'total-neg bg-red-100 text-red-800'; 
    
    const bgClass = className.includes('year-block') ? 'year-bg bg-white' : (className.includes('month-block') ? 'bg-white' : 'bg-[#2c3b64] text-white');
    const ringClass = className.includes('year-block') ? 'ring-1 ring-black/5' : '';


    return (
        <div className={className}>
            <div className={`px-4 py-3 hdr cursor-pointer ${bgClass} ${ringClass}`} onClick={() => setIsOpen(prev => !prev)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MdArrowDropDown className={`w-6 h-6 transition-transform duration-300 ${chevClass}`} />
                        <span className={`font-semibold ${className.includes('year-block') ? 'text-[#0f1c3f]' : 'text-current'}`}>{title}</span>
                    </div>
                    {/* Únicamente los números del resumen anual y mensual tienen el color de fondo */}
                    <span className={`total-chip text-[11px] px-2 py-1 rounded-full ${totalClass}`}>
                        Total: {fmtMoneySigned(total)}
                    </span>
                </div>
            </div>
            
            {/* Panel de Contenido: Se utiliza max-h para animaciones fluidas */}
            <div 
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className={className.includes('day-block') ? 'w-full bg-white ring-1 ring-black/5' : 'w-full'}>
                    {children}
                </div>
            </div>
        </div>
    );
};


// DayBlock (Contiene las ventas individuales)
const DayBlock: React.FC<{ dayKey: string; ventas: Venta[]; onEditClick: (venta: Venta) => void; defaultOpen: boolean }> = ({ dayKey, ventas, onEditClick, defaultOpen }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen); // Estado para colapsar/desplegar días
    const totalDay = sumDay(ventas);
    const dayVentas = ventas.sort((a,b)=> (a.fecha < b.fecha ? 1 : -1));
    
    // UX MEJORADO: Header del Día (Azul Principal y un poco más de padding)
    const headerBgClass = "bg-[#0f1c3f] text-white hover:bg-[#152754]";
    const chevClass = isOpen ? 'rotate-180' : 'rotate-90'; 
    
    return (
        <div className="subgroup-sep day-block">
             <div className={`px-4 py-2 hdr day-hdr cursor-pointer ${headerBgClass}`} onClick={() => setIsOpen(prev => !prev)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MdArrowDropDown className={`w-6 h-6 transition-transform duration-300 ${chevClass}`} />
                        <span className="font-semibold">{dayKey}</span>
                    </div>
                    {/* SOLO EL NÚMERO DIARIO: Color condicional */}
                    <span className={`font-semibold text-sm ${totalDay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Total Día: {fmtMoneySigned(totalDay)}
                    </span>
                </div>
            </div>

            {/* Contenido del Día (desplegable) */}
            <div 
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className="w-full bg-white ring-1 ring-black/5">
                    {/* Cabecera Desapilada */}
                    <div className="venta-row grid grid-cols-[100px_100px_1fr_80px] px-4 py-2 bg-gray-100 venta-head text-gray-700 font-semibold text-[11px] uppercase">
                        <div>Fecha</div><div>Monto</div><div>Observaciones</div><div className="text-center">Acción</div>
                    </div>
                    {/* Filas de ventas */}
                    {dayVentas.map((v, index) => {
                        const amtPos = Number(v.monto) >= 0;
                        // Fondo gris claro alternado (mejor UX que fondo blanco o colores saturados)
                        const rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50'; 

                        return (
                            <div key={v.id} id={`venta-${v.id}`} className={`venta-row grid grid-cols-[100px_100px_1fr_80px] px-4 py-2 border-b last:border-b-0 hover:bg-gray-100 transition ${rowBgClass}`}>
                                <div className="venta-cell text-xs">{dayKey.substring(0, dayKey.lastIndexOf('/'))}</div> {/* Fecha DD/MM */}
                                {/* SOLO EN NÚMEROS DE FILA: Color condicional */}
                                <div className={`venta-cell ${amtPos ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'} text-sm`}>
                                    {fmtMoneySigned(v.monto)}
                                </div>
                                <div className="venta-cell text-xs text-gray-600">{v.observaciones||"Sin detalle"}</div>
                                <div className="text-center">
                                    <button className="bg-[#0f1c3f] text-white text-[10px] px-2 py-1 rounded hover:opacity-90" onClick={() => onEditClick(v)}>
                                        <MdEdit className="inline mr-1 -mt-0.5" /> EDITAR
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


// MonthBlock
const MonthBlock: React.FC<{ year: number; month: number; daysObj: VentasDayTree; onEditClick: (venta: Venta) => void; defaultOpen: boolean }> = ({ year, month, daysObj, onEditClick, defaultOpen }) => {
    const totalsMonth = sumMonth(daysObj);
    const days = Object.keys(daysObj).sort((a,b)=>{
        const [da, ma, ya] = a.split("/").map(Number);
        const [db, mb, yb] = b.split("/").map(Number);
        return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
    });

    const today = new Date();
    const currentDayKey = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    return (
        <CollapseBlock total={totalsMonth} title={`${MESES[month - 1]} DE ${year}`} defaultOpen={defaultOpen} className="subgroup-sep month-block">
            <div className="w-full">
                {days.map(dayKey => (
                    <DayBlock 
                        key={dayKey} 
                        dayKey={dayKey} 
                        ventas={daysObj[dayKey]} 
                        onEditClick={onEditClick} 
                        // Abrir solo el día de hoy si el mes está abierto por defecto
                        defaultOpen={defaultOpen && dayKey === currentDayKey}
                    />
                ))}
            </div>
        </CollapseBlock>
    );
};


// YearBlock
const YearBlock: React.FC<{ year: number; monthsObj: VentasMonthTree; onEditClick: (venta: Venta) => void; defaultOpen: boolean }> = ({ year, monthsObj, onEditClick, defaultOpen }) => {
    const totalsYear = sumYear(monthsObj);
    const months = Object.keys(monthsObj).map(Number).sort((a,b)=>b-a);
    const currentMonth = new Date().getMonth() + 1;

    return (
        <tr className="group-sep">
            <td colSpan={100} className="p-0">
                <CollapseBlock total={totalsYear} title={String(year)} defaultOpen={defaultOpen} className="year-block">
                    {months.map(month => (
                        <MonthBlock 
                            key={month} 
                            year={year} 
                            month={month} 
                            daysObj={monthsObj[month]} 
                            onEditClick={onEditClick} 
                            // Abrir SOLO el mes actual si el año está abierto por defecto
                            defaultOpen={defaultOpen && month === currentMonth}
                        />
                    ))}
                </CollapseBlock>
            </td>
        </tr>
    );
};


// ----------------------------------------------------------------------
// COMPONENTE PRINCIPAL VENTAS
// ----------------------------------------------------------------------

interface VentasProps { user: User; onLogout: () => void; }

export const Ventas: React.FC<VentasProps> = ({ user }) => {
    
    // 1. Data y CRUD
    const { ventasTree, loading, addVenta, updateVenta, deleteVenta } = useVentasData(user);
    
    // 2. Estado de la UI
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [ventaToEdit, setVentaToEdit] = useState<Venta | null>(null);

    // 3. Handlers CRUD
    const handleAddSubmit = (data: VentaFormData & { id?: string }) => {
        addVenta(data);
    };

    const handleEditClick = useCallback((venta: Venta) => {
        setVentaToEdit(venta);
        setShowEditModal(true);
    }, []);

    const handleUpdateSubmit = useCallback((data: VentaFormData & { id?: string }) => {
         if (data.id) {
             updateVenta(data.id, data);
             setShowEditModal(false);
         }
    }, [updateVenta]);

    const handleDelete = (id: string) => {
        deleteVenta(id);
    };
    
    // 4. Lógica de Búsqueda y Filtrado
    const filteredResults = useMemo(() => {
        const years = Object.keys(ventasTree).map(Number).sort((a, b) => b - a);

        if (!searchTerm.trim()) {
            return { list: years, tree: ventasTree };
        }

        const queryNorm = norm(searchTerm);
        const { month: monthQuery, year: yearQuery } = parseQueryMesAnio(searchTerm);
        const results: VentasYearTree = {};

        for (const year of years) {
            if (yearQuery && year !== yearQuery) continue;

            const monthsTree = ventasTree[year];
            for (const month in monthsTree) {
                const monthNum = Number(month);
                if (monthQuery && monthNum !== monthQuery) continue;

                const daysTree = monthsTree[monthNum];
                for (const dayKey in daysTree) {
                    const ventas = daysTree[dayKey];
                    const isMatch = ventas.some(v => 
                        norm(v.observaciones).includes(queryNorm) || 
                        dayKey.includes(queryNorm)
                    );

                    if (isMatch || (monthQuery && yearQuery && !isMatch)) {
                        if (!results[year]) results[year] = {};
                        if (!results[year][monthNum]) results[year][monthNum] = {};
                        results[year][monthNum][dayKey] = ventas;
                    }
                }
            }
        }
        return { list: Object.keys(results).map(Number).sort((a, b) => b - a), tree: results };
    }, [searchTerm, ventasTree]);
    
    // 5. Determinar la expansión inicial (solo si no hay búsqueda)
    const currentYear = new Date().getFullYear();
    const defaultOpen = !searchTerm.trim();

    if (loading) {
        return <div className="p-6 text-center text-[#152754]">Cargando registro económico...</div>;
    }


    return (
        <>
        <main className="p-6 flex-1 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* 1. Encabezado / acciones */}
                <section className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 overflow-hidden">
                    <div className="px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#152754]/10 grid place-items-center">
                                <MdAttachMoney className="w-5 h-5 opacity-80 text-[#152754]" />
                            </div>
                            <h2 className="text-[#152754] font-semibold">Registro Económico</h2>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Buscador */}
                            <label className="flex items-center bg-gray-50 ring-1 ring-black/5 rounded-full px-3 py-1.5 w-64 transition hover:bg-white">
                                <input
                                    type="text"
                                    placeholder="Buscar por mes/año o detalle…"
                                    className="bg-transparent focus:outline-none text-sm text-gray-700 placeholder:text-gray-400 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <MdSearch className="w-4 h-4 opacity-60 ml-2" />
                            </label>

                            {/* Botón NUEVA VENTA */}
                            <button
                                onClick={() => setShowAddModal(true)}
                                title="Nueva venta"
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#152754] text-white text-xl leading-none shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:-translate-y-0.5"
                            >
                            <span className="mb-[5.5px]">+</span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* 2. Tabla / listado */}
                <section className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left text-gray-700">
                            <tbody id="tabla-ventas" className="[&_tr:hover]:bg-gray-50">
                                {filteredResults.list.length > 0 ? (
                                    <>
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50 uppercase whitespace-nowrap" colSpan={100}>
                                                Registro
                                            </th>
                                        </tr>
                                        {filteredResults.list.map(year => (
                                            <YearBlock
                                                key={year}
                                                year={year}
                                                monthsObj={filteredResults.tree[year]}
                                                onEditClick={handleEditClick}
                                                // Abrir solo el año actual si no hay búsqueda
                                                defaultOpen={defaultOpen && year === currentYear} 
                                            />
                                        ))}
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={100} className="text-center py-8 text-gray-500">
                                            {searchTerm.trim() ? `No se encontraron resultados para "${searchTerm}"` : 'No hay registros de ventas.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
        
        {/* MODAL NUEVA VENTA */}
        <VentaModal 
            isVisible={showAddModal} 
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddSubmit}
            isEdit={false}
        />

        {/* MODAL EDITAR VENTA */}
        <VentaModal 
            isVisible={showEditModal} 
            onClose={() => setShowEditModal(false)}
            onSubmit={handleUpdateSubmit}
            onDelete={handleDelete}
            initialData={ventaToEdit}
            isEdit={true}
        />
        </>
    );
};