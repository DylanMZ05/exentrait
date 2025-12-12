import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { type User } from 'firebase/auth'; 
// Importaciones necesarias para el diseño de Clients.tsx
import { MdList, MdPeople, MdSearch, MdEdit, MdRemoveRedEye, MdArrowUpward, MdArrowDownward, MdInfoOutline, MdClose, MdMailOutline, MdAssignmentInd, MdPhoneAndroid, MdSupport } from 'react-icons/md'; 
import { FaCalendarTimes } from 'react-icons/fa'; 
import { Link } from 'react-router-dom'; 

// Importaciones necesarias desde los hooks y utils existentes
import { useClientData, type Client, type ClientFormData } from '../hooks/useClientData'; 
import { useMemoizedClientList, type SortState, type SortField } from '../hooks/useMemoizedClientList'; 
import { formatFechaCorta, calculateDaysRemaining, formatISODate, parseISODate, timeAgo } from '../utils/dateHelpers'; 


// ----------------------------------------------------------------------
// TIPOS Y CONSTANTES
// ----------------------------------------------------------------------

// Ampliamos SortField localmente para incluir los campos que se usan en la tabla
type CustomSortField = SortField | 'ultimaActualizacion' | 'diasVencido' | 'dni' | 'horario' | 'comentarios';

interface ClientWithOverdue extends Client {
    id: string;
    diasRestantes: number; 
    diasVencido: number; 
    email?: string;
    telefono?: string;
    telefonoRespaldo?: string;
    comentarios?: string;
}

interface ClientsProps {
    user: User;
}

const VIEW_KEY = "vencidos-view";
const DIAS_SEMANA_CHECKBOX = ["L", "M", "X", "J", "V", "S", "D"];
const HORAS_DISPONIBLES = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);


// --- KpiCard (Tomado de Clients.tsx) ---
interface KpiCardProps { title: string; value: string | number; icon: React.ElementType; color: string; }

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-lg ring-1 ring-black/5 p-4">
        <p className="text-[12px] text-gray-500">{title}</p>
        <div className={`text-2xl font-bold ${color} flex items-center gap-2 mt-1`}>
            <Icon className="text-xl" />
            <span>{value}</span>
        </div>
    </div>
);


// ----------------------------------------------------------------------
// SUBCOMPONENTE 3: ClientDetailsModal (Mantiene el diseño de Clientes)
// ----------------------------------------------------------------------

const ClientDetailsModal: React.FC<{
    client: Client | null;
    isVisible: boolean;
    onClose: () => void;
}> = ({ client, isVisible, onClose }) => {
    
    if (!isVisible || !client) return null;

    const diasTexto = (Array.isArray(client.dias) && client.dias.includes("Libre")) ? "Libre" : (client.dias || []).join(" - ");
    const clientWithContact = client as ClientWithOverdue; 

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 ring-1 ring-black/5 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800">
                    <MdClose className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-[#152754] mb-4 border-b pb-2">Detalles del Cliente</h2>
                
                <div className="space-y-3 text-sm">
                    {/* Nombre */}
                    <div><p className="text-xs font-medium text-gray-500 uppercase">Nombre:</p><p className="font-semibold text-gray-900">{client.nombre}</p></div>
                    {/* DNI */}
                    <div><p className="text-xs font-medium text-gray-500 uppercase">DNI:</p><p className="text-gray-900">{client.dni}</p></div>
                    {/* Contacto */}
                    {clientWithContact.email && (<div><p className="text-xs font-medium text-gray-500 uppercase">Email:</p><p className="text-gray-900">{clientWithContact.email}</p></div>)}
                    {/* 🚨 CORRECCIÓN TS17001 🚨: Eliminado className duplicado */}
                    {clientWithContact.telefono && (<div><p className="text-xs font-medium text-gray-500 uppercase">Teléfono:</p><p className="text-gray-900">{clientWithContact.telefono}</p></div>)}
                    {clientWithContact.telefonoRespaldo && (<div><p className="text-xs font-medium text-gray-500 uppercase">Tel. Respaldo:</p><p className="text-gray-900">{clientWithContact.telefonoRespaldo}</p></div>)}
                    {/* Plan */}
                    <div><p className="text-xs font-medium text-gray-500 uppercase">Días de Plan:</p><p className="text-gray-900">{diasTexto}</p></div>
                    <div><p className="text-xs font-medium text-gray-500 uppercase">Horario:</p><p className="text-gray-900">{client.horario}</p></div>
                    {/* Vencimiento */}
                    <div><p className="text-xs font-medium text-gray-500 uppercase">Vencimiento:</p><p className="text-red-500 font-semibold">{formatFechaCorta(client.fechaVencimiento || "")}</p></div>
                    {clientWithContact.comentarios && (<div><p className="text-xs font-medium text-gray-500 uppercase">Comentarios:</p><p className="text-gray-600 italic">{clientWithContact.comentarios}</p></div>)}
                </div>
            </div>
        </div>
    );
};


// ----------------------------------------------------------------------
// SUBCOMPONENTE 4: EditUserModal (Se mantiene la lógica de edición)
// ----------------------------------------------------------------------

const limpiarMonto = (valor: string | number | undefined): number =>
    parseFloat(String(valor || "").replace(/[$.\s]/g, "").replace(",", ".")) || 0;

const EditUserModal: React.FC<{
    client: ClientWithOverdue | null;
    isVisible: boolean;
    onClose: () => void;
    onSubmit: (id: string, data: any) => Promise<void>; 
    onDelete: (id: string) => Promise<void>; 
}> = ({ client, isVisible, onClose, onSubmit, onDelete }) => {
    
    const [formData, setFormData] = useState({
        dni: '', nombre: '', fechaVencimiento: '', monto: '',
        horaInicio: '08:00', horaFin: '09:00', dias: [] as string[],
        email: '', telefono: '', telefonoRespaldo: '', comentarios: '',
    });
    
    const [baseDateForExtras, setBaseDateForExtras] = useState<Date | null>(null);
    const [diasExtra, setDiasExtra] = useState<string>('');
    const [inputDiasManualValue, setInputDiasManualValue] = useState<number | ''>('');
    const [showManualInput, setShowManualInput] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [horarioError, setHorarioError] = useState('');


    useEffect(() => {
        if (client) {
            const [horaInicio, horaFin] = (client.horario || "08:00 - 09:00").split(" - ");
            setFormData({
                dni: client.dni || '',
                nombre: client.nombre || '',
                fechaVencimiento: client.fechaVencimiento || formatISODate(new Date()),
                monto: client.monto?.toString() ?? '',
                horaInicio: horaInicio || '08:00',
                horaFin: horaFin || '09:00',
                dias: client.dias || [],
                email: client.email || '',
                telefono: client.telefono || '',
                telefonoRespaldo: client.telefonoRespaldo || '',
                comentarios: client.comentarios || '',
            });

            setBaseDateForExtras(parseISODate(client.fechaVencimiento || formatISODate(new Date())));
            setDiasExtra('');
            setInputDiasManualValue('');
            setShowManualInput(false);
            setIsSaving(false);
            setHorarioError('');
        }
    }, [client]);

    // Cálculo de días restantes/vencidos actual
    const currentDaysRemaining = useMemo(() => {
        return calculateDaysRemaining(formData.fechaVencimiento);
    }, [formData.fechaVencimiento]);
    
    // Handlers de input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDiaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        setFormData(prev => {
            const newDays = checked
                ? [...prev.dias, value]
                : prev.dias.filter(d => d !== value);
            return { ...prev, dias: newDays };
        });
    };
    
    // Lógica: Añade días a la fecha base (NO acumulativo)
    const handleDaysExtension = (dias: number) => {
        if (!client || !baseDateForExtras) {
            return;
        }

        const nueva = new Date(baseDateForExtras.getTime());
        nueva.setDate(nueva.getDate() + dias);
        
        setFormData(prev => ({ 
            ...prev, 
            fechaVencimiento: formatISODate(nueva) 
        }));
    };
    
    const handleDiasExtraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const valor = e.target.value;
        setDiasExtra(valor);
        setInputDiasManualValue('');

        if (valor === "manual") {
            setShowManualInput(true);
            return;
        } else {
            setShowManualInput(false);
        }

        const dias = parseInt(valor);
        if (!dias || isNaN(dias)) return;
        
        handleDaysExtension(dias);
        setDiasExtra(''); // Reset del selector
    };

    const handleManualDaysBlur = () => {
        const dias = parseInt(String(inputDiasManualValue));
        if (dias && !isNaN(dias)) {
            handleDaysExtension(dias);

            setShowManualInput(false);
            setInputDiasManualValue('');
            setDiasExtra('');
        }
    };
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        handleInputChange(e);
        // Cambio manual: actualiza la base para futuros cálculos de "días extra"
        setBaseDateForExtras(parseISODate(newDate)); 
    }
    
    // Manejo del Submit del Formulario
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setHorarioError('');
        if (!client || isSaving) return;
        
        // Validación de horario simple
        if (formData.horaFin <= formData.horaInicio) {
             setHorarioError("La hora de fin debe ser posterior a la de inicio.");
             return;
        }

        setIsSaving(true);
        
        const dataToSend: ClientFormData & { id: string } = {
            ...formData,
            id: client.id,
            monto: limpiarMonto(formData.monto).toString(), 
            horario: `${formData.horaInicio} - ${formData.horaFin}`,
        } as ClientFormData & { id: string };

        try {
            await onSubmit(client.id, dataToSend); 
            onClose();
        } catch (error) {
            console.error("Error al guardar cambios:", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    // Manejo de la Eliminación
    const handleConfirmDelete = async () => {
        if (!client || isSaving) return;
        
        setIsSaving(true);
        
        try {
            await onDelete(client.id); 
            setShowDeletePopup(false);
            onClose();
        } catch (error) {
            console.error("Error al eliminar:", error);
        } finally {
             setIsSaving(false);
        }
    };
    
    const handleClose = () => {
        if (!isSaving && !showDeletePopup) {
            onClose();
        }
    };
    
    if (!isVisible) return null;

    return (
        <div id="modalEditUser" className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 ring-1 ring-black/5 max-h-[90vh] overflow-y-auto relative">
                
                {/* Botón de cerrar */}
                <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
                    <MdClose className="text-2xl" />
                </button>
                
                <h2 className="text-xl font-bold text-[#0f1c3f] mb-4">Editar Usuario: {client?.nombre}</h2>
                
                <form id="formEditUser" className="space-y-4" onSubmit={handleSubmit}>
                    
                    {/* DNI */}
                    <div>
                        <label htmlFor="editDni" className="block text-sm font-medium text-gray-700">DNI</label>
                        <input 
                            type="text" id="editDni" name="dni" value={formData.dni} onChange={handleInputChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required
                        />
                    </div>
                    
                    {/* Nombre */}
                    <div>
                        <label htmlFor="editNombre" className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input 
                            type="text" id="editNombre" name="nombre" value={formData.nombre} onChange={handleInputChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required
                        />
                    </div>
                    
                    {/* Campos de Contacto Opcionales */}
                    <div><label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Opcional)</label><input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" /></div>
                    <div><label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono (Opcional)</label><input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleInputChange} className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" /></div>
                    <div><label htmlFor="telefonoRespaldo" className="block text-sm font-medium text-gray-700">Teléfono Respaldo (Opcional)</label><input type="tel" id="telefonoRespaldo" name="telefonoRespaldo" value={formData.telefonoRespaldo} onChange={handleInputChange} className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" /></div>
                    <div><label htmlFor="comentarios" className="block text-sm font-medium text-gray-700">Comentarios (Opcional)</label><textarea id="comentarios" name="comentarios" value={formData.comentarios} onChange={handleInputChange} className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" /></div>


                    {/* Días Plan */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Plan (días)</label>
                        <div id="editDiasContainer" className="flex flex-wrap gap-2 mt-2">
                            {DIAS_SEMANA_CHECKBOX.map((dia) => (
                                <label key={dia} className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                        type="checkbox" name="editDias" value={dia} 
                                        checked={formData.dias.includes(dia)} 
                                        onChange={handleDiaChange}
                                        className="hidden peer"
                                    />
                                    <span className="w-8 h-8 flex items-center justify-center rounded-full border peer-checked:bg-blue-600 peer-checked:text-white transition">
                                        {dia}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    {/* Horario */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Horario</label>
                        <div className="flex items-center gap-3 mt-1">
                            <select 
                                id="editHoraInicio" name="horaInicio" value={formData.horaInicio} onChange={handleInputChange}
                                className="block w-1/2 p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required
                            >
                                {HORAS_DISPONIBLES.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span>a</span>
                            <select 
                                id="editHoraFin" name="horaFin" value={formData.horaFin} onChange={handleInputChange}
                                className="block w-1/2 p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required
                            >
                                {HORAS_DISPONIBLES.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        {horarioError && <p className="text-red-600 text-sm mt-1">{horarioError}</p>}
                    </div>
                    
                    {/* Fecha vencimiento + añadir días (Lógica de vencidos.js) */}
                    <div>
                        <label htmlFor="editFechaVencimiento" className="block text-sm font-medium text-gray-700">Fecha de vencimiento</label>
                        <div className="flex items-center gap-2">
                            <input 
                                id="editFechaVencimiento" type="date" name="fechaVencimiento"
                                value={formData.fechaVencimiento} onChange={handleDateChange} 
                                className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required
                            />
                            
                            <select 
                                id="selectDiasExtra" value={diasExtra} onChange={handleDiasExtraChange}
                                className="mt-1 block w-36 p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none"
                            >
                                <option value="">+ Días</option>
                                <option value="1">+1 día</option>
                                <option value="7">+7 días (semana)</option>
                                <option value="15">+15 días (quincena)</option>
                                <option value="30">+30 días</option>
                                <option value="31">+31 días</option>
                                <option value="manual">Manual…</option>
                            </select>
                        </div>
                        
                        <input 
                            id="inputDiasManual" type="number" min="1" placeholder="Cantidad de días"
                            value={inputDiasManualValue} 
                            onChange={(e) => setInputDiasManualValue(parseInt(e.target.value) || '')}
                            onBlur={handleManualDaysBlur} 
                            className={`${showManualInput ? '' : 'hidden'} mt-2 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none`}
                        />
                        
                        {/* Etiqueta de días restantes */}
                        <div id="labelDiasRestantes" className="text-xs text-gray-600 mt-1">
                            {currentDaysRemaining < 0 ? 
                                <span className="text-red-600 font-bold">Vencido hace {Math.abs(currentDaysRemaining)} días</span> : 
                                `Días restantes: ${currentDaysRemaining}`
                            }
                        </div>
                    </div>
                    
                    {/* Monto abonado */}
                    <div>
                        <label htmlFor="editMonto" className="block text-sm font-medium text-gray-700">Monto abonado</label>
                        <input 
                            type="number" id="editMonto" name="monto" value={formData.monto} onChange={handleInputChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required
                        />
                    </div>
                    
                    {/* Botones */}
                    <div className="flex justify-between pt-4 border-t mt-6">
                        <button 
                            type="button" id="btnDeleteUser" onClick={() => setShowDeletePopup(true)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition"
                        >
                            Eliminar
                        </button>
                        <div className="flex gap-3">
                            <button 
                                type="button" id="btnCancelEditUser" onClick={handleClose}
                                className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" disabled={isSaving}
                                className={`bg-[#152754] text-white px-4 py-2 rounded transition ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#0e1f48]'}`}
                            >
                                {isSaving ? "Guardando..." : "Guardar Cambios"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            
            {/* Popup Confirmación */}
            {showDeletePopup && (
                <div id="popupDeleteConfirm" className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 ring-1 ring-black/5">
                        <h2 className="text-xl font-bold text-red-600 mb-4">Confirmar Eliminación</h2>
                        <p className="mb-3">¿Seguro que deseas eliminar este usuario?</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                type="button" id="btnCancelDeletePopup" onClick={() => setShowDeletePopup(false)}
                                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button" id="btnConfirmDeletePopup" onClick={handleConfirmDelete} disabled={isSaving}
                                className={`bg-red-600 text-white px-4 py-2 rounded transition ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'}`}
                            >
                                {isSaving ? "Eliminando..." : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ----------------------------------------------------------------------
// SUBCOMPONENTE 1: OverdueCard (Vista Tarjeta) - CORREGIDO: Muestra solo "Vencido"
// ----------------------------------------------------------------------

const OverdueCard: React.FC<{ client: ClientWithOverdue; onEdit: (id: string) => void; onViewDetails: (client: ClientWithOverdue) => void; }> = ({ client, onEdit, onViewDetails }) => {
    
    // Lógica simplificada: siempre mostrar "Vencido"
    const diasVencido = client.diasVencido; 
    const isRecentOverdue = diasVencido <= 30 && diasVencido > 0;
    // CORRECCIÓN: Texto fijo "Vencido"
    const pillText = "Vencido"; 
    
    // Estilos adaptados al rojo
    let pillClass = isRecentOverdue ? "bg-red-600 text-white" : "bg-gray-400 text-white";
    let ringClass = isRecentOverdue ? "ring-red-300 bg-red-50" : "ring-gray-300 bg-white";
    
    const esLibre = Array.isArray(client.dias) && client.dias.includes("Libre");
    const planTexto = esLibre ? "Libre" : `${client.dias.length}× semana`;
    const diasTexto = esLibre ? "Libre" : (client.dias || []).join(" · ");
    const ultima = client.ultimaActualizacion ? parseISODate(client.ultimaActualizacion) : null;
    
    const handleEdit = () => onEdit(client.id);

    return (
        <article className={`rounded-xl ring-1 ${ringClass} shadow-sm hover:shadow transition p-4`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 grid place-items-center text-red-500 text-sm flex-shrink-0">
                        {client.nombre?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                        <p className="font-semibold text-[#152754] leading-tight">{client.nombre || "—"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${pillClass} font-medium`}>{pillText}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#152754]/10 text-[#152754] font-medium">{planTexto}</span>
                        </div>
                    </div>
                </div>
                <button onClick={handleEdit} className="text-gray-400 hover:text-gray-600" title="Editar">
                    <MdEdit className="text-xl" />
                </button>
            </div>

            {/* Datos de Contacto/DNI (Tomado de Clients.tsx) */}
            <div className="mt-3 space-y-1 text-[13px] text-gray-600">
                {client.email && <div className="flex items-center gap-2"><MdMailOutline className="w-4 h-4 opacity-70" /><span>{client.email}</span></div>}
                {client.telefono && (<div><p className="text-xs font-medium text-gray-500 uppercase">Teléfono:</p><p className="text-gray-900">{client.telefono}</p></div>)}
                {client.telefonoRespaldo && <div className="flex items-center gap-2"><MdPhoneAndroid className="w-4 h-4 opacity-70" /><span>Resp: {client.telefonoRespaldo}</span></div>}
                <div className="flex items-center gap-2"><MdAssignmentInd className="w-4 h-4 opacity-70" /><span>DNI: {client.dni || "—"}</span></div>
            </div>
            
            {/* Plan / Última Actualización (Tomado de Clients.tsx) */}
            <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-md bg-gray-50 p-2 ring-1 ring-black/5">
                    <p className="text-gray-500">Plan</p>
                    <p className="font-medium text-[#152754]">{diasTexto}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-2 ring-1 ring-black/5">
                    <p className="text-gray-500">Última Act.</p>
                    <p className={`font-medium ${ultima ? 'text-[#152754]' : 'text-gray-400'}`}>
                        {ultima ? timeAgo(ultima) : "—"}
                    </p>
                </div>
            </div>

            {/* ACCIONES INFERIORES: DISEÑO DE 2 FILAS EN MÓVIL */}
            <div className="mt-3 flex flex-col gap-2">
                
                {/* FILA 1: DETALLES | RUTINA (50% / 50%) */}
                <div className="flex gap-2 w-full">
                    
                    {/* Botón 1: Detalles (abre modal) */}
                    <button 
                        onClick={() => onViewDetails(client)} 
                        className="flex-1 h-9 flex items-center justify-center rounded-md bg-white ring-1 ring-black/10 hover:bg-gray-50 transition text-xs"
                        title="Ver Horario, Vencimiento y Contacto"
                    >
                        <MdInfoOutline className="text-xl mr-1" /> Detalles
                    </button>

                    {/* Botón 2: Rutina (abre nueva pestaña) */}
                    <a className="flex-1 h-9 flex items-center justify-center rounded-md bg-[#eef2ff] text-[#152754] hover:bg-[#e4e9ff] text-xs transition"
                        href={`/rutina.html?id=${client.id}`} target="_blank" rel="noopener noreferrer">
                        <MdRemoveRedEye className="text-xl mr-1" /> Rutina
                    </a>
                </div>
                
                {/* FILA 2: EDITAR PAGO (100% de Ancho, color rojo para énfasis) */}
                <button 
                    onClick={handleEdit} 
                    className="w-full h-9 rounded-md bg-red-600 text-white hover:bg-red-700 transition text-sm flex items-center justify-center"
                >
                    <MdEdit className="text-xl mr-1" /> EDITAR PAGO
                </button>
            </div>
        </article>
    );
};


// ----------------------------------------------------------------------
// SUBCOMPONENTE 2: OverdueTable (Vista Lista) - Mantiene el formato solicitado
// ----------------------------------------------------------------------

const OverdueTable: React.FC<{ 
    clientes: ClientWithOverdue[]; 
    onEdit: (id: string) => void; 
    handleSort: (field: CustomSortField) => void; 
    sortState: SortState;
    onViewDetails: (client: ClientWithOverdue) => void;
}> = ({ clientes, onEdit, handleSort, sortState, onViewDetails }) => {
    
    const SortIcon: React.FC<{ field: CustomSortField }> = ({ field }) => {
        if (sortState.field !== field) return null;
        return sortState.direction === 'asc' 
            ? <MdArrowUpward className="inline w-3 h-3 ml-1 text-gray-500" />
            : <MdArrowDownward className="inline w-3 h-3 ml-1 text-gray-500" />;
    };

    // Columnas adaptadas al formato solicitado: Cliente | DNI | Vencimiento | Comentarios
    const COLUMNS: { field: CustomSortField, label: string }[] = [
        { field: 'nombre', label: 'Cliente' },
        { field: 'dni', label: 'DNI' },
        { field: 'diasVencido', label: 'Días Vencido' }, // Usamos diasVencido para permitir el sorting
        { field: 'comentarios', label: 'Comentarios' },
    ];

    return (
        <div id="vistaListaSection" className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-700">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                        <tr>
                            {COLUMNS.map(({ field, label }) => (
                                <th 
                                    key={field}
                                    onClick={() => handleSort(field)} 
                                    className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100 transition whitespace-nowrap"
                                >
                                    {label}
                                    <SortIcon field={field} />
                                </th>
                            ))}
                            {/* ACCIONES CONSOLIDADAS: Detalles | Rutina | EDITAR (colSpan=3) */}
                            <th className="px-4 py-3 text-center whitespace-nowrap" colSpan={3}>Acciones</th> 
                        </tr>
                    </thead>
                    <tbody id="tabla-vencidos" className="[&_tr:hover]:bg-gray-50]">
                        {clientes.length > 0 ? (
                            clientes.map(c => {
                                // 🚨 CORRECCIÓN TS2345 🚨: Accedemos directamente a diasVencido
                                const diasVencidoAbs = c.diasVencido;
                                const rowClass = "hover:bg-red-50"; // Siempre están vencidos
                                
                                return (
                                    <tr key={c.id} className={`border-b ${rowClass}`}>
                                        
                                        {/* Columna: Nombre */}
                                        <td className="px-4 py-2 font-medium text-[#152754] whitespace-nowrap">
                                            <a href={`/rutina.html?id=${c.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">{c.nombre || "—"}</a>
                                        </td>
                                        
                                        {/* Columna: DNI */}
                                        <td className="px-4 py-2 whitespace-nowrap">{c.dni || "—"}</td>
                                        
                                        {/* Columna: Días Vencido */}
                                        <td className={`px-4 py-2 font-bold text-red-600 whitespace-nowrap`}>
                                            {diasVencidoAbs} días
                                        </td>
                                        
                                        {/* Columna: Comentarios */}
                                        <td className="px-4 py-2 max-w-xs truncate">{c.comentarios || "—"}</td>
                                        
                                        {/* ACCIÓN 1: DETALLES */}
                                        <td className="px-2 py-2 text-center whitespace-nowrap">
                                            <button 
                                                onClick={() => onViewDetails(c)}
                                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-3 py-1 rounded flex items-center justify-center gap-1 mx-auto"
                                                title="Ver días, horario y fecha de vencimiento"
                                            >
                                                <MdInfoOutline className="text-base" /> Det.
                                            </button>
                                        </td>

                                        {/* ACCIÓN 2: RUTINA */}
                                        <td className="px-2 py-2 text-center whitespace-nowrap">
                                            <a 
                                                href={`/rutina.html?id=${c.id}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="bg-[#eef2ff] text-[#152754] hover:bg-[#e4e9ff] text-xs px-3 py-1 rounded flex items-center justify-center gap-1 mx-auto"
                                            >
                                                <MdRemoveRedEye className="text-base" /> Rutina
                                            </a>
                                        </td>
                                        
                                        {/* ACCIÓN 3: EDITAR */}
                                        <td className="px-2 py-2 text-center whitespace-nowrap">
                                            <button 
                                                onClick={() => onEdit(c.id)}
                                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded"
                                            >
                                                EDITAR
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan={6} className='text-center py-8 text-gray-500'>No se encontraron resultados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// ----------------------------------------------------------------------
// COMPONENTE PRINCIPAL OVERDUECLIENTS.TSX
// ----------------------------------------------------------------------

export const OverdueClients: React.FC<ClientsProps> = ({ user }) => {
    // Usamos 'as any' para evitar error TS 
    const { dataMetrics, loading, updateClient, deleteClient, addVenta } = useClientData(user) as any;

    // 1. Estado de la UI
    const [view, setView] = useState<'cards' | 'lista'>(() => (localStorage.getItem(VIEW_KEY) === 'lista' ? 'lista' : 'cards'));
    const [searchTerm, setSearchTerm] = useState('');
    const [clientToEdit, setClientToEdit] = useState<ClientWithOverdue | null>(null);
    const [clientToDetail, setClientToDetail] = useState<Client | null>(null); 

    // 2. Filtro CLAVE: Obtener todos los vencidos y calcular días vencido
    const allOverdueClients = useMemo(() => {
        if (loading) return [];

        const overdue = dataMetrics.all
            .filter((c: any) => calculateDaysRemaining(c.fechaVencimiento || formatISODate(new Date())) < 0)
            .map((c: any) => ({
                ...c,
                diasVencido: Math.abs(calculateDaysRemaining(c.fechaVencimiento || formatISODate(new Date()))), 
            })) as ClientWithOverdue[];
        
        // Ordenamiento por defecto: los que tienen menos días vencidos (diasVencido ASC)
        // Ya no es necesario ordenar aquí si usamos el defaultField del hook
        return overdue; 
    }, [dataMetrics.all, loading]);
    
    // 3. Filtrado y Ordenamiento
    // 🚨 CORRECCIÓN TS2554 🚨: Se pasa la lista y el término de búsqueda,
    // La configuración del ordenamiento inicial se MANEJA INTERNAMENTE.
    const { sortedList: hookSortedList, handleSort, sortState } = useMemoizedClientList(
        allOverdueClients, 
        searchTerm
    );

    // SOLUCIÓN CLAVE: Bypasseamos el resultado del hook si el buscador está vacío
    const sortedList = useMemo(() => {
        if (!searchTerm || searchTerm.trim() === '') {
            // Pre-ordenamos la lista aquí si el hook no lo hace por defecto (garantía ASC)
            return allOverdueClients.sort((a, b) => a.diasVencido - b.diasVencido); 
        }
        // Cuando hay búsqueda, el hook ya aplicó la búsqueda y el ordenamiento
        return hookSortedList;
    }, [allOverdueClients, searchTerm, hookSortedList]);
    
    // --- Handlers de Modales y Acciones CRUD ---
    
    const findClientById = (id: string) => allOverdueClients.find(c => c.id === id) as ClientWithOverdue | undefined;

    // R: Read (Detail) Handler
    const handleViewDetails = useCallback((client: Client) => {
        setClientToDetail(client);
    }, []);

    // U: Update (Edit) Handler
    const handleEditClick = useCallback((id: string) => {
        const clientFound = findClientById(id);
        if (clientFound) {
            setClientToEdit(clientFound);
        } else {
            console.error("Cliente no encontrado para edición:", id);
        }
    }, [allOverdueClients]);
    
    const handleEditSubmit = useCallback(async (id: string, data: any) => {
        await updateClient(id, data); 
        
        if (data.monto > 0 && addVenta) {
            await addVenta({
                clienteId: id,
                clienteNombre: data.nombre,
                monto: data.monto,
                fecha: new Date().toISOString(),
                observaciones: `Cuota ${data.nombre}`,
            });
        }
        setClientToEdit(null);
    }, [updateClient, addVenta]);

    const handleDelete = useCallback(async (id: string) => {
        await deleteClient(id); 
        setClientToEdit(null);
    }, [deleteClient]);
    
    // Handlers de Vista
    const setViewCards = () => setView('cards');
    const setViewLista = () => setView('lista');

    if (loading) {
        return <div className="p-6 text-center text-[#152754]">Cargando usuarios vencidos...</div>;
    }

    // ----------------------------------------------------------------------
    // MARKUP (Adaptado al diseño de Clients.tsx)
    // ----------------------------------------------------------------------

    return (
        <div className="flex-1 flex flex-col">
            <main className="p-2 flex-1 overflow-y-auto">
                <div className="max-w-[1200px] mx-auto space-y-6">

                    {/* 1. ENCABEZADO Y ACCIONES */}
                    <section>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-y-3">
                            {/* Título */}
                            <div className="order-1 w-full sm:w-auto">
                                <h1 className="text-[18px] font-semibold text-[#152754]">Usuarios Vencidos</h1>
                                <p className="text-[13px] text-gray-500 mt-1">Administra los planes que requieren renovación</p>
                            </div>

                            {/* Botones de Acción y Vista */}
                            <div className="order-2 w-full flex flex-wrap items-center justify-start sm:justify-end gap-2 mt-3 sm:mt-0">
                                {/* Conmutador vista */}
                                <div className="flex items-center bg-white ring-1 ring-black/10 rounded-md overflow-hidden">
                                    <button 
                                        onClick={setViewCards}
                                        className={`px-3 h-9 text-sm font-medium transition cursor-pointer flex items-center gap-1 ${view === 'cards' ? 'bg-[#eef2ff] text-[#152754] hover:brightness-105' : 'text-[#152754] hover:bg-gray-50'}`}
                                    >
                                        <MdPeople className="text-lg" /> Tarjetas
                                    </button>
                                    <button 
                                        onClick={setViewLista}
                                        className={`px-3 h-9 text-sm font-medium transition cursor-pointer flex items-center gap-1 ${view === 'lista' ? 'bg-[#eef2ff] text-[#152754] hover:brightness-105' : 'text-[#152754] hover:bg-gray-50'}`}
                                    >
                                        <MdList className="text-lg" /> Lista
                                    </button>
                                </div>

                                {/* Botón Volver a Clientes */}
                                <Link to="/app-gym/clientes"
                                    className="bg-gray-200 hover:bg-gray-300 text-black text-sm px-3 h-9 rounded-md shadow-sm transition cursor-pointer flex items-center gap-1">
                                    ← Volver a Clientes
                                </Link>
                            </div>
                        </div>
                    </section>
                    
                    {/* 2. RESUMEN KPI */}
                    <section className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
                        <KpiCard title="Total Vencidos" value={allOverdueClients.length} icon={FaCalendarTimes} color="text-red-600" />
                        <KpiCard title="Vencidos Recientes (<=30D)" value={allOverdueClients.filter(c => c.diasVencido <= 30).length} icon={FaCalendarTimes} color="text-amber-500" />
                    </section>

                    {/* 3. BUSCADOR Y BADGES */}
                    <section className="flex flex-wrap items-center gap-3">
                        {/* Buscador */}
                        <label className="flex items-center bg-white ring-1 ring-black/10 rounded-md px-3 h-10 w-full sm:max-w-md transition hover:ring-black/20">
                            <MdSearch className="w-4 h-4 opacity-60" />
                            <input 
                                type="text" 
                                placeholder="Buscar por nombre o DNI…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ml-2 w-full text-sm outline-none placeholder:text-gray-400"
                            />
                        </label>

                        {/* Badge de Soporte */}
                        <a 
                            href="#" // Enlace real
                            className="inline-flex items-center gap-2 text-sm text-[#152754] hover:underline"
                        >
                            <MdSupport className="text-lg" /> Ver Soporte
                        </a>

                        {/* Información adicional */}
                        <span className="ml-auto hidden sm:inline-flex items-center gap-2 text-[13px] text-gray-600">
                            Total Vencidos:
                            <span 
                                className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-red-600 text-white text-[11px] font-bold">
                                {allOverdueClients.length}
                            </span>
                        </span>
                    </section>


                    {/* 4. VISTA DE DATOS (Tarjetas o Lista) */}
                    <section>
                        {view === 'cards' ? (
                            <div id="cardsGrid" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {sortedList.length > 0 ? (
                                    sortedList.map((client) => (
                                        <OverdueCard 
                                            key={client.id} 
                                            client={client as ClientWithOverdue} 
                                            onEdit={handleEditClick} 
                                            onViewDetails={handleViewDetails as (c: ClientWithOverdue) => void}
                                        />
                                    ))
                                ) : (
                                    <div className="col-span-full text-center text-gray-500 py-8">No se encontraron usuarios vencidos que coincidan con la búsqueda.</div>
                                )}
                            </div>
                        ) : (
                            <OverdueTable 
                                clientes={sortedList as ClientWithOverdue[]}
                                onEdit={handleEditClick}
                                handleSort={handleSort as (field: CustomSortField) => void}
                                sortState={sortState}
                                onViewDetails={handleViewDetails as (c: ClientWithOverdue) => void}
                            />
                        )}
                    </section>
                </div>
            </main>
            
            {/* MODALES */}
            <EditUserModal 
                client={clientToEdit}
                isVisible={!!clientToEdit}
                onClose={() => setClientToEdit(null)}
                onSubmit={handleEditSubmit}
                onDelete={handleDelete}
            />

            <ClientDetailsModal 
                client={clientToDetail}
                isVisible={!!clientToDetail}
                onClose={() => setClientToDetail(null)}
            />
        </div>
    );
};