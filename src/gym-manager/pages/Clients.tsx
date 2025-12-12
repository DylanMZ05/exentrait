import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { type User } from 'firebase/auth'; 
// Importamos calculateDaysRemaining para identificar vencidos en el render
import { useClientData, type Client, type ClientFormData } from '../hooks/useClientData'; 
import { useMemoizedClientList, type SortState, type SortField } from '../hooks/useMemoizedClientList'; 
import { formatFechaCorta, timeAgo } from '../utils/dateHelpers'; // 🚨 CORRECCIÓN TS6133 🚨: Eliminado calculateDaysRemaining

// 👑 REACT ICONS
import { 
    MdSearch, MdGroup, MdAdd, MdPeople, MdList, 
    MdEventNote, MdAssignmentInd, // 🚨 CORRECCIÓN TS6133 🚨: Eliminado MdAccessTime
    MdMailOutline, MdPhone, MdEdit, MdRemoveRedEye,
    MdArrowUpward, MdArrowDownward, MdAttachMoney,
    MdInfoOutline, MdClose, MdPhoneAndroid, MdAccessTime
} from 'react-icons/md'; // 🚨 CORRECCIÓN TS6133 🚨: Eliminado MdSupport

// ----------------------------------------------------------------------
// TIPOS Y CONSTANTES
// ----------------------------------------------------------------------

// 🚨 La Interfaz debe incluir todos los campos usados, ya sean opcionales o no 🚨
interface ClientWithContact extends Client {
    email?: string;
    telefono?: string;
    telefonoRespaldo?: string; // Nuevo
    comentarios?: string; // Aseguramos que existe
}

interface ClientsProps {
    user: User;
    onLogout: () => void;
}

const VIEW_KEY = "clientes-view";
const DIAS_SEMANA = ["L","M","X","J","V","S","D","Libre"];
const HORAS_DISPONIBLES = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];

// --- KpiCard (para la sección de Resumen) ---
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
// SUBCOMPONENTE 1: ClientCard (Vista Tarjetas)
// ----------------------------------------------------------------------

const ClientCard: React.FC<{ client: ClientWithContact; onEdit: (id: string) => void; onViewDetails: (client: ClientWithContact) => void; }> = ({ client, onEdit, onViewDetails }) => {
    let pillText = client.diasRestantes > 0 ? `${client.diasRestantes} días` : "Vencido";
    let pillClass = "bg-emerald-100 text-emerald-700";
    let ringClass = "ring-emerald-200";

    // Si está vencido, usa el estilo rojo, independientemente de los días restantes
    if (client.diasRestantes <= 0) { 
        pillClass = "bg-red-600 text-white"; 
        ringClass = "ring-red-200 bg-red-50"; 
        pillText = "Vencido";
    }
    else if (client.diasRestantes <= 7) { pillClass = "bg-red-100 text-red-700";  ringClass = "ring-red-200";  }
    else if (client.diasRestantes <= 14) { pillClass = "bg-amber-100 text-amber-700"; ringClass = "ring-amber-200"; }


    const esLibre = Array.isArray(client.dias) && client.dias.includes("Libre");
    const planTexto = esLibre ? "Libre" : `${client.dias.length}× semana`;
    const diasTexto = esLibre ? "Libre" : (client.dias || []).join(" · ");
    const ultima = client.ultimaActualizacion ? new Date(client.ultimaActualizacion) : null;
    
    const handleEdit = () => onEdit(client.id);

    return (
        <article className={`bg-white rounded-xl ring-1 ${ringClass} shadow-sm hover:shadow transition p-4`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 grid place-items-center text-gray-500 text-sm">
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

            {/* Datos de Contacto/DNI */}
            <div className="mt-3 space-y-1 text-[13px] text-gray-600">
                {client.email && <div className="flex items-center gap-2"><MdMailOutline className="w-4 h-4 opacity-70" /><span>{client.email}</span></div>}
                {client.telefono && <div className="flex items-center gap-2"><MdPhone className="w-4 h-4 opacity-70" /><span>{client.telefono}</span></div>}
                {client.telefonoRespaldo && <div className="flex items-center gap-2"><MdPhoneAndroid className="w-4 h-4 opacity-70" /><span>Resp: {client.telefonoRespaldo}</span></div>}
                <div className="flex items-center gap-2"><MdAssignmentInd className="w-4 h-4 opacity-70" /><span>DNI: {client.dni || "—"}</span></div>
            </div>
            
            {/* Plan / Última Actualización */}
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

            {/* 🚨 ACCIONES INFERIORES: DISEÑO DE 2 FILAS EN MÓVIL 🚨 */}
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
                
                {/* FILA 2: EDITAR (100% de Ancho) */}
                <button 
                    onClick={handleEdit} 
                    className="w-full h-9 rounded-md bg-[#0f1c3f] text-white hover:bg-blue-900 transition text-sm flex items-center justify-center"
                >
                    <MdEdit className="text-xl mr-1" /> EDITAR
                </button>
            </div>
        </article>
    );
};


// ----------------------------------------------------------------------
// SUBCOMPONENTE 2: ClientTable (Vista Lista)
// ----------------------------------------------------------------------

const ClientTable: React.FC<{ 
    clientes: ClientWithContact[]; 
    onEdit: (id: string) => void; 
    handleSort: (field: SortField) => void; 
    sortState: SortState;
    onViewDetails: (client: ClientWithContact) => void; 
}> = ({ clientes, onEdit, handleSort, sortState, onViewDetails }) => {
    
    const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
        if (sortState.field !== field) return null;
        return sortState.direction === 'asc' 
            ? <MdArrowUpward className="inline w-3 h-3 ml-1 text-gray-500" />
            : <MdArrowDownward className="inline w-3 h-3 ml-1 text-gray-500" />;
    };

    const COLUMNS: { field: SortField, label: string }[] = [
        { field: 'nombre', label: 'Cliente' },
        { field: 'dni', label: 'DNI' },
        { field: 'diasRestantes', label: 'Vencimiento' }, 
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
                            <th className="px-4 py-3 text-center whitespace-nowrap" colSpan={3}>Acciones</th> 
                        </tr>
                    </thead>
                    <tbody id="tabla-clientes" className="[&_tr:hover]:bg-gray-50]">
                        {clientes.length > 0 ? (
                            clientes.map(c => {
                                let colorDias = "text-emerald-600";
                                let vencimientoTexto = `${c.diasRestantes} días`;
                                
                                // Vencido (incluye los resultados de búsqueda de vencidos)
                                if (c.diasRestantes <= 0) { 
                                    colorDias = "text-red-600 font-bold";
                                    vencimientoTexto = "Vencido";
                                }
                                else if (c.diasRestantes <= 7) colorDias = "text-red-600";
                                else if (c.diasRestantes <= 14) colorDias = "text-amber-500";


                                return (
                                    <tr key={c.id} className={`border-b ${c.diasRestantes <= 0 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                                        
                                        {/* Columna: Nombre (no clickeable) */}
                                        <td className="px-4 py-2 font-medium text-[#152754] whitespace-nowrap">
                                            {c.nombre || ""}
                                        </td>
                                        
                                        {/* Columna: DNI */}
                                        <td className="px-4 py-2 whitespace-nowrap">{c.dni || ""}</td>
                                        
                                        {/* Columna: Vencimiento (diasRestantes) */}
                                        <td className={`px-4 py-2 font-semibold ${colorDias} whitespace-nowrap`}>
                                            {vencimientoTexto}
                                        </td>
                                        
                                        {/* Columna: Comentarios */}
                                        <td className="px-4 py-2 max-w-xs truncate">{c.comentarios || ""}</td>
                                        
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
                                                className="bg-[#0f1c3f] hover:bg-blue-900 text-white text-sm px-3 py-1 rounded"
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
// SUBCOMPONENTE 3: ClientDetailsModal (Modal de Solo Lectura)
// ----------------------------------------------------------------------

const ClientDetailsModal: React.FC<{
    client: ClientWithContact | null;
    isVisible: boolean;
    onClose: () => void;
}> = ({ client, isVisible, onClose }) => {
    
    if (!isVisible || !client) return null;

    const diasTexto = (Array.isArray(client.dias) && client.dias.includes("Libre")) ? "Libre" : (client.dias || []).join(" - ");

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 ring-1 ring-black/5 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800">
                    <MdClose className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-[#152754] mb-4 border-b pb-2">Detalles del Cliente</h2>
                
                <div className="space-y-3 text-sm">
                    {/* Nombre */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Nombre:</p>
                        <p className="font-semibold text-gray-900">{client.nombre}</p>
                    </div>
                    {/* DNI */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">DNI:</p>
                        <p className="text-gray-900">{client.dni}</p>
                    </div>
                    {/* Campos de contacto añadidos */}
                    {client.email && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Email:</p>
                            <p className="text-gray-900">{client.email}</p>
                        </div>
                    )}
                    {client.telefono && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Teléfono:</p>
                            <p className="text-gray-900">{client.telefono}</p>
                        </div>
                    )}
                    {client.telefonoRespaldo && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Tel. Respaldo:</p>
                            <p className="text-gray-900">{client.telefonoRespaldo}</p>
                        </div>
                    )}
                    {/* Días */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Días de Plan:</p>
                        <p className="text-gray-900">{diasTexto}</p>
                    </div>
                    {/* Horario */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Horario:</p>
                        <p className="text-gray-900">{client.horario}</p>
                    </div>
                    {/* Vence */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Vencimiento:</p>
                        <p className={`font-semibold ${client.diasRestantes <= 0 ? 'text-red-500' : 'text-gray-900'}`}>{formatFechaCorta(client.fechaVencimiento || "")}</p>
                    </div>
                    {/* Comentarios */}
                    {client.comentarios && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Comentarios:</p>
                            <p className="text-gray-600 italic">{client.comentarios}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// SUBCOMPONENTE 4: AddUserModal (Pop-up para NUEVOS clientes)
// ----------------------------------------------------------------------

const AddUserModal: React.FC<{ 
    isVisible: boolean; 
    onClose: () => void; 
    onSubmit: (data: ClientFormData) => void;
}> = ({ isVisible, onClose, onSubmit }) => {
    
    // Estado inicial limpio
    const INITIAL_FORM_DATA = useMemo(() => ({
        dni: '', nombre: '', dias: [] as string[], fechaVencimiento: '', monto: '',
        horaInicio: '08:00', horaFin: '09:00', email: '', telefono: '', telefonoRespaldo: '', comentarios: '',
    }), []);

    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [horarioError, setHorarioError] = useState('');
    const esLibre = formData.dias.includes("Libre");
    
    // Handlers
    const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        let newDays = [...formData.dias];
        if (value === 'Libre') { newDays = checked ? ['Libre'] : []; } 
        else {
            if (newDays.includes('Libre')) newDays = []; 
            newDays = checked ? [...newDays, value] : newDays.filter(d => d !== value);
        }
        setFormData(prev => ({ ...prev, dias: newDays }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    // Sincronización de hora de fin
    useEffect(() => {
        if (formData.horaInicio) {
            const hI = parseInt(formData.horaInicio.split(":")[0], 10);
            const hF = Math.min(hI + 1, 23);
            const newHoraFin = `${String(hF).padStart(2, "0")}:00`;
            if (formData.horaFin <= formData.horaInicio) { // Corregido: si la hora de fin es menor/igual, la forzamos
                setFormData(prev => ({ ...prev, horaFin: newHoraFin }));
            }
        }
    }, [formData.horaInicio, formData.horaFin]); // Se incluye horaFin para evitar loop al resetear


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setHorarioError('');
        if (!esLibre && formData.horaFin <= formData.horaInicio) {
            setHorarioError("La hora de fin debe ser posterior a la de inicio.");
            return;
        }
        // Preparamos la data para el hook
        const newClientData = {
            ...formData,
            // Aquí no se genera el campo 'horario', se deja al hook (useClientData)
            // que genere la versión limpia y el horario, por eso ClientFormData no necesita horario
        } as ClientFormData;

        // console.log("C: Datos de nuevo cliente recibidos:", data); // Eliminado
        onSubmit(newClientData); 
        onClose();
    };
    
    // Resetear al cerrar
    useEffect(() => {
        if (!isVisible) {
            setFormData(INITIAL_FORM_DATA);
            setHorarioError('');
        }
    }, [isVisible, INITIAL_FORM_DATA]);

    if (!isVisible) return null;

    return (
        <div id="modalAddUser" className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 ring-1 ring-black/5 max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[#0f1c3f] mb-4">Añadir Usuario</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* DNI y Nombre */}
                    <div>
                        <label htmlFor="dni" className="block text-sm font-medium text-gray-700">DNI</label>
                        <input type="text" id="dni" name="dni" value={formData.dni} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required />
                    </div>
                    <div>
                        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required />
                    </div>

                    {/* Campos de Contacto Opcionales */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Opcional)</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" placeholder="ejemplo@mail.com" />
                    </div>
                    <div>
                        <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono (Opcional)</label>
                        <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" placeholder="11 2345-6789" />
                    </div>
                    <div>
                        <label htmlFor="telefonoRespaldo" className="block text-sm font-medium text-gray-700">Teléfono Respaldo (Opcional)</label>
                        <input type="tel" id="telefonoRespaldo" name="telefonoRespaldo" value={formData.telefonoRespaldo} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" placeholder="Contacto de emergencia" />
                    </div>
                    
                    {/* Plan (días) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Plan (días)</label>
                        <div id="diasContainer" className="flex flex-wrap gap-2 mt-2">
                            {DIAS_SEMANA.map(dia => (
                                <label key={dia} className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" name="dias" value={dia} 
                                        checked={formData.dias.includes(dia)}
                                        onChange={handleDaysChange}
                                        disabled={esLibre && dia !== 'Libre'}
                                        className="hidden peer" 
                                    />
                                    <span className={`${dia === 'Libre' ? 'px-3' : 'w-8'} h-8 flex items-center justify-center rounded-full border peer-checked:bg-blue-600 peer-checked:text-white ${esLibre && dia !== 'Libre' ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}>
                                        {dia}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {/* Horario */}
                    <div className={esLibre ? 'opacity-50 pointer-events-none' : ''}>
                        <label className="block text-sm font-medium text-gray-700">Horario</label>
                        {esLibre && (
                            <p id="hintHorarioLibre" className="mt-2 text-xs italic text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                Con “Libre”, no hace falta seleccionar horario.
                            </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                            <select id="horaInicio" name="horaInicio" value={formData.horaInicio} 
                                onChange={handleChange}
                                className="block w-1/2 p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required={!esLibre} disabled={esLibre}>
                                {HORAS_DISPONIBLES.map(time => <option key={time} value={time}>{time}</option>)}
                            </select>
                            <span>a</span>
                            <select id="horaFin" name="horaFin" value={formData.horaFin}
                                onChange={handleChange}
                                className="block w-1/2 p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required={!esLibre} disabled={esLibre}>
                                {HORAS_DISPONIBLES.map(time => <option key={time} value={time} disabled={time <= formData.horaInicio}>{time}</option>)}
                            </select>
                        </div>
                        {horarioError && <p id="errorHorario" className="text-red-600 text-sm mt-1">{horarioError}</p>}
                    </div>
                    {/* Fecha vencimiento */}
                    <div>
                        <label htmlFor="fechaVencimiento" className="block text-sm font-medium text-gray-700">Fecha de vencimiento</label>
                        <input type="date" id="fechaVencimiento" name="fechaVencimiento" value={formData.fechaVencimiento} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required />
                    </div>
                    {/* Monto */}
                    <div>
                        <label htmlFor="monto" className="block text-sm font-medium text-gray-700">Monto abonado</label>
                        <input type="number" id="monto" name="monto" min="0" step="any" placeholder="Opcional" value={formData.monto} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" />
                    </div>
                    {/* Comentarios */}
                    <div>
                        <label htmlFor="comentarios" className="block text-sm font-medium text-gray-700">Comentarios (Opcional)</label>
                        <textarea id="comentarios" name="comentarios" value={formData.comentarios} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none"
                            placeholder="Escribe un comentario (opcional)"></textarea>
                    </div>
                    {/* Botones */}
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={onClose} id="btnCancelAddUser"
                            className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded transition">Cancelar</button>
                        <button type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded transition">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// SUBCOMPONENTE 5: EditUserModal (Pop-up para EDITAR clientes - MISMA ESTRUCTURA)
// ----------------------------------------------------------------------

const EditUserModal: React.FC<{
    client: ClientWithContact | null;
    isVisible: boolean;
    onClose: () => void;
    onSubmit: (data: ClientFormData & { id: string }) => void;
    onDelete: (id: string) => void;
}> = ({ client, isVisible, onClose, onSubmit, onDelete }) => {
    
    // Estado inicial
    const [formData, setFormData] = useState({
        dni: '', nombre: '', dias: [] as string[], fechaVencimiento: '', monto: '',
        horaInicio: '08:00', horaFin: '09:00', comentarios: '', email: '', telefono: '', telefonoRespaldo: '',
    });
    const [horarioError, setHorarioError] = useState('');
    const esLibre = formData.dias.includes("Libre");
    
    // 🚨 EFECTO CLAVE: Inicializar el formulario cuando el modal se abre 🚨
    useEffect(() => {
        if (isVisible && client) {
            const [hI, hF] = client.horario?.includes(' - ') 
                ? client.horario.split(' - ').map(s => s.trim()) 
                : ['08:00', '09:00'];

            setFormData({
                dni: client.dni || '',
                nombre: client.nombre || '',
                dias: client.dias || [],
                fechaVencimiento: client.fechaVencimiento || '',
                monto: String(client.monto || ''),
                horaInicio: hI,
                horaFin: hF,
                comentarios: client.comentarios || '',
                email: client.email || '', // NUEVO
                telefono: client.telefono || '', // NUEVO
                telefonoRespaldo: client.telefonoRespaldo || '', // NUEVO
            });
            setHorarioError('');
        }
    }, [isVisible, client]);
    
    // Handlers replicados de AddUserModal
    const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        let newDays = [...formData.dias];
        if (value === 'Libre') { newDays = checked ? ['Libre'] : []; } 
        else {
            if (newDays.includes('Libre')) newDays = []; 
            newDays = checked ? [...newDays, value] : newDays.filter(d => d !== value);
        }
        setFormData(prev => ({ ...prev, dias: newDays }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    useEffect(() => {
        if (formData.horaInicio) {
            const hI = parseInt(formData.horaInicio.split(":")[0], 10);
            const hF = Math.min(hI + 1, 23);
            const newHoraFin = `${String(hF).padStart(2, "0")}:00`;
            if (formData.horaFin <= formData.horaInicio) {
                setFormData(prev => ({ ...prev, horaFin: newHoraFin }));
            }
        }
    }, [formData.horaInicio, formData.horaFin]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setHorarioError('');
        if (!esLibre && formData.horaFin <= formData.horaInicio) {
            setHorarioError("La hora de fin debe ser posterior a la de inicio.");
            return;
        }
        // Se envía toda la data junto con el ID
        // console.log("U: Guardando edición para cliente:", client!.id, data); // Eliminado
        onSubmit({ ...formData, id: client!.id } as ClientFormData & { id: string }); 
        onClose();
    };

    if (!isVisible || !client) return null;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            {/* 🚨 CORRECCIÓN SCROLL: max-h-[90vh] y overflow-y-auto en el contenedor del modal 🚨 */}
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 ring-1 ring-black/5 max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[#0f1c3f] mb-4">Editar Usuario: {client.nombre}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* DNI */}
                    <div>
                        <label htmlFor="dni" className="block text-sm font-medium text-gray-700">DNI</label>
                        <input type="text" id="dni" name="dni" value={formData.dni} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required />
                    </div>
                    {/* Nombre */}
                    <div>
                        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required />
                    </div>
                    
                    {/* Campos de Contacto Opcionales */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Opcional)</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" placeholder="ejemplo@mail.com" />
                    </div>
                    <div>
                        <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono (Opcional)</label>
                        <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" placeholder="11 2345-6789" />
                    </div>
                    <div>
                        <label htmlFor="telefonoRespaldo" className="block text-sm font-medium text-gray-700">Teléfono Respaldo (Opcional)</label>
                        <input type="tel" id="telefonoRespaldo" name="telefonoRespaldo" value={formData.telefonoRespaldo} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" placeholder="Contacto de emergencia" />
                    </div>
                    
                    {/* Plan (días) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Plan (días)</label>
                        <div id="editDiasContainer" className="flex flex-wrap gap-2 mt-2">
                            {DIAS_SEMANA.map(dia => (
                                <label key={dia} className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" name="dias" value={dia} 
                                        checked={formData.dias.includes(dia)}
                                        onChange={handleDaysChange}
                                        disabled={esLibre && dia !== 'Libre'}
                                        className="hidden peer" 
                                    />
                                    <span className={`${dia === 'Libre' ? 'px-3' : 'w-8'} h-8 flex items-center justify-center rounded-full border peer-checked:bg-blue-600 peer-checked:text-white ${esLibre && dia !== 'Libre' ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}>
                                        {dia}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {/* Horario */}
                    <div className={esLibre ? 'opacity-50 pointer-events-none' : ''}>
                        <label className="block text-sm font-medium text-gray-700">Horario</label>
                        {esLibre && (
                            <p id="hintHorarioLibre" className="mt-2 text-xs italic text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                Con “Libre”, no hace falta seleccionar horario.
                            </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                            <select id="horaInicio" name="horaInicio" value={formData.horaInicio} 
                                onChange={handleChange}
                                className="block w-1/2 p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required={!esLibre} disabled={esLibre}>
                                {HORAS_DISPONIBLES.map(time => <option key={time} value={time}>{time}</option>)}
                            </select>
                            <span>a</span>
                            <select id="horaFin" name="horaFin" value={formData.horaFin}
                                onChange={handleChange}
                                className="block w-1/2 p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required={!esLibre} disabled={esLibre}>
                                {HORAS_DISPONIBLES.map(time => <option key={time} value={time} disabled={time <= formData.horaInicio}>{time}</option>)}
                            </select>
                        </div>
                        {horarioError && <p id="errorHorario" className="text-red-600 text-sm mt-1">{horarioError}</p>}
                    </div>
                    {/* Fecha vencimiento */}
                    <div>
                        <label htmlFor="fechaVencimiento" className="block text-sm font-medium text-gray-700">Fecha de vencimiento</label>
                        <input type="date" id="fechaVencimiento" name="fechaVencimiento" value={formData.fechaVencimiento} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" required />
                    </div>
                    {/* Monto */}
                    <div>
                        <label htmlFor="monto" className="block text-sm font-medium text-gray-700">Monto abonado</label>
                        <input type="number" id="monto" name="monto" min="0" step="any" placeholder="Opcional" value={formData.monto} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none" />
                    </div>
                    {/* Comentarios */}
                    <div>
                        <label htmlFor="comentarios" className="block text-sm font-medium text-gray-700">Comentarios</label>
                        <textarea id="comentarios" name="comentarios" value={formData.comentarios} onChange={handleChange}
                            className="mt-1 block w-full p-2 border rounded focus:ring-2 focus:ring-[#152754]/30 focus:outline-none"
                            placeholder="Escribe un comentario (opcional)"></textarea>
                    </div>

                    {/* Botones */}
                    <div className="flex justify-between mt-4 pt-4 border-t">
                        <button type="button" onClick={() => {
                            // Confirmación simple antes de llamar a onDelete
                            if (window.confirm("¿Estás seguro de que quieres eliminar a este cliente? Esta acción no se puede deshacer.")) {
                                onDelete(client!.id);
                                // 🚨 CORRECCIÓN TS2304 🚨: Llama a onClose, que es el setter del padre.
                                onClose(); 
                            }
                        }}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition">Eliminar</button>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose}
                                className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded transition">Cancelar</button>
                            <button type="submit"
                                className="bg-[#152754] hover:bg-[#0e1f48] text-white px-4 py-2 rounded transition">Guardar Cambios</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};


// ----------------------------------------------------------------------
// COMPONENTE PRINCIPAL CLIENTES.TSX
// ----------------------------------------------------------------------

export const Clients: React.FC<ClientsProps> = ({ user }) => {
    
    // ------------------------------------------------------------------
    // 🚨 DEBUGGING: Verificar el estado del usuario 🚨
    // ------------------------------------------------------------------
    useEffect(() => {
        console.log("➡️ [CLIENTS.TSX] Componente Clients montado.");
        if (user && user.uid) {
            console.log("✅ [CLIENTS.TSX] Usuario Autenticado. UID:", user.uid);
            console.log("✅ [CLIENTS.TSX] El hook useClientData debería cargarse correctamente.");
        } else {
            console.error("❌ [CLIENTS.TSX] Advertencia: 'user' no es válido. Estado de carga de Firebase en App principal no finalizado.");
            console.error("❌ [CLIENTS.TSX] user object:", user);
        }
    }, [user]);

    // 1. Fetch de Datos de Firebase
    const { dataMetrics, loading, addClient, updateClient, deleteClient } = useClientData(user);
    
    // 2. Estado de la UI
    const [view, setView] = useState<'cards' | 'lista'>(() => (localStorage.getItem(VIEW_KEY) === 'lista' ? 'lista' : 'cards'));
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Estados para los modales de Edición y Detalles
    const [clientToEdit, setClientToEdit] = useState<ClientWithContact | null>(null);
    const [clientToDetail, setClientToDetail] = useState<ClientWithContact | null>(null);

    // --------------------------------------------------------------------------------
    // 3. LÓGICA DE FILTRADO (Mantenida en Clients.tsx para controlar el comportamiento)
    // --------------------------------------------------------------------------------
    
    // A) Lista Base: Solo Activos (para la vista por defecto sin búsqueda)
    const clientesActivos = useMemo(() => dataMetrics.all.filter(c => c.diasRestantes > 0) as ClientWithContact[], [dataMetrics.all]);
    const totalVencidosBadge = dataMetrics.vencidosRecientes.length;

    // B) Lista Filtrada (Activos + Vencidos que coinciden con la búsqueda)
    const filteredList = useMemo(() => {
        if (!searchTerm || searchTerm.trim() === '') {
            // Si no hay búsqueda, devolvemos la lista activa por defecto
            return clientesActivos;
        }

        // Si hay búsqueda, filtramos TODOS los clientes (dataMetrics.all)
        const lowerCaseSearch = searchTerm.trim().toLowerCase();
        
        const results = dataMetrics.all.filter(client => {
            const nombreMatch = client.nombre?.toLowerCase().includes(lowerCaseSearch) || false;
            const dni = String(client.dni || "").toLowerCase();
            const dniMatch = dni.includes(lowerCaseSearch);

            return nombreMatch || dniMatch;
        }) as ClientWithContact[];
        
        return results;
    }, [searchTerm, dataMetrics.all, clientesActivos]);

    // C) Lista Final Renderizada (solo ordenamiento)
    // Pasamos la lista filtrada a useMemoizedClientList solo para que aplique la ORDENACIÓN.
    const { sortedList, handleSort, sortState } = useMemoizedClientList(filteredList, searchTerm); 

    const finalRenderList = useMemo(() => {
        // Devolvemos la lista ordenada. Si había búsqueda, es la lista filtrada (incluyendo vencidos); si no, es la de activos.
        return sortedList;
    }, [sortedList]);
    
    // --------------------------------------------------------------------------------
    // FIN LÓGICA DE FILTRADO
    // --------------------------------------------------------------------------------


    // 4. Efecto para guardar vista en localStorage
    useEffect(() => {
        localStorage.setItem(VIEW_KEY, view);
    }, [view]);

    // --- Handlers de Modales y Acciones CRUD ---
    const handleAddClick = useCallback(() => setShowAddModal(true), []);
    
    const findClientById = (id: string) => dataMetrics.all.find(c => c.id === id) as ClientWithContact | undefined;

    // C: Create Handler
    const handleAddSubmit = (data: ClientFormData) => {
        addClient(data); // ⬅️ Llama a la función CRUD del hook
        setShowAddModal(false);
    }

    // R: Read (Detail) Handler
    const handleViewDetails = useCallback((client: ClientWithContact) => {
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
    }, [dataMetrics.all]);

    const handleEditSubmit = (data: ClientFormData & { id: string }) => {
        // console.log("U: Guardando edición para cliente:", data.id, data); // Eliminado
        updateClient(data.id, data); // ⬅️ Llama a la función CRUD del hook
        setClientToEdit(null);
    };

    // D: Delete Handler
    const handleDelete = (id: string) => {
        // console.log("D: Eliminando cliente:", id); // Eliminado
        deleteClient(id); // ⬅️ Llama a la función CRUD del hook
        setClientToEdit(null); // Resetea el estado del modal de edición/eliminación
    };
    
    // Handlers de Vista
    const setViewCards = () => setView('cards');
    const setViewLista = () => setView('lista');
    

    if (loading) {
        return <div className="p-6 text-center text-[#152754]">Cargando miembros...</div>;
    }

    // ----------------------------------------------------------------------
    // MARKUP (Optimizado para Mobile)
    // ----------------------------------------------------------------------

    return (
        <>
            <main className="p-2 flex-1 overflow-y-auto">
                <div className="max-w-[1200px] mx-auto space-y-6">

                    {/* 1. ENCABEZADO Y ACCIONES */}
                    <section>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-y-3">
                            {/* Título */}
                            <div className="order-1 w-full sm:w-auto">
                                <h1 className="text-[18px] font-semibold text-[#152754]">Gestión de Miembros</h1>
                                <p className="text-[13px] text-gray-500 mt-1">Administra los miembros de tu gimnasio</p>
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

                                {/* Botón Nuevo Miembro */}
                                <button 
                                    onClick={handleAddClick}
                                    className="bg-[#ff7a45] hover:brightness-110 text-white text-sm px-3 h-9 rounded-md shadow-sm transition cursor-pointer flex items-center gap-1"
                                >
                                    <MdAdd className="text-xl" /> Nuevo Miembro
                                </button>
                            </div>
                        </div>
                    </section>
                    
                    {/* 2. RESUMEN KPI */}
                    <section className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
                        <KpiCard title="Total Miembros" value={dataMetrics.total} icon={MdAttachMoney} color="text-[#152754]" />
                        <KpiCard title="Activos" value={dataMetrics.activos.length} icon={MdPeople} color="text-emerald-600" />
                        <KpiCard title="Con plan semanal" value={dataMetrics.semanales.length} icon={MdEventNote} color="text-[#152754]" />
                        <KpiCard title="Plan Libre" value={dataMetrics.libres.length} icon={MdAccessTime} color="text-[#152754]" />
                    </section>

                    {/* 3. BUSCADOR Y BADGES */}
                    <section className="flex flex-wrap items-center gap-3">
                        {/* Buscador: Ocupa todo el ancho en móvil, luego se ajusta */}
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

                        {/* Badge Vencidos */}
                        <a 
                            href="/app-gym/vencidos"
                            className="inline-flex items-center gap-2 text-sm text-[#152754] hover:underline"
                        >
                            <MdGroup className="text-lg" /> Usuarios Vencidos
                            <span 
                                className={`bg-red-600 text-white text-[11px] font-bold rounded-full px-2 py-0.5 ${totalVencidosBadge > 0 ? '' : 'hidden'}`}
                            >
                                {totalVencidosBadge}
                            </span>
                        </a>

                        {/* Badge Activos (KPI secundario, oculto en móvil) */}
                        <span className="ml-auto hidden sm:inline-flex items-center gap-2 text-[13px] text-gray-600">
                            Activos:
                            <span 
                                className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                                {dataMetrics.activos.length}
                            </span>
                        </span>
                    </section>


                    {/* 4. VISTA DE DATOS (Tarjetas o Lista) */}
                    <section>
                        {/* Mensaje cuando la búsqueda no arroja resultados */}
                        {finalRenderList.length === 0 && searchTerm.trim() !== '' && (
                            <div className="text-center text-red-500 bg-red-50 border border-red-200 rounded p-4 mb-4">
                                ⚠️ No se encontraron resultados para "{searchTerm}" (activos o vencidos).
                            </div>
                        )}
                        
                        {/* Mensaje cuando no hay clientes activos (vista por defecto sin búsqueda) */}
                        {finalRenderList.length === 0 && searchTerm.trim() === '' && (
                            <div className="text-center text-gray-500 py-8">No hay clientes activos para mostrar.</div>
                        )}

                        {view === 'cards' && finalRenderList.length > 0 && (
                            <div id="cardsGrid" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {finalRenderList.map(client => (
                                    <ClientCard key={client.id} client={client} onEdit={handleEditClick} onViewDetails={handleViewDetails} />
                                ))}
                            </div>
                        )}

                        {view === 'lista' && finalRenderList.length > 0 && (
                            <ClientTable 
                                clientes={finalRenderList}
                                onEdit={handleEditClick}
                                handleSort={handleSort}
                                sortState={sortState}
                                onViewDetails={handleViewDetails}
                            />
                        )}
                    </section>
                </div>
            </main>
            
            {/* MODALES */}
            <AddUserModal 
                isVisible={showAddModal} 
                onClose={() => setShowAddModal(false)}
                onSubmit={handleAddSubmit}
            />
            <ClientDetailsModal 
                client={clientToDetail}
                isVisible={!!clientToDetail}
                onClose={() => setClientToDetail(null)}
            />
            <EditUserModal 
                client={clientToEdit}
                isVisible={!!clientToEdit}
                onClose={() => setClientToEdit(null)}
                onSubmit={handleEditSubmit}
                onDelete={handleDelete}
            />
        </>
    );
};