import React, { useState, useCallback, useMemo } from 'react'; 
import { type User, signInWithEmailAndPassword } from 'firebase/auth'; 
import { auth } from '../../../firebase'; 

// Importaciones necesarias
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// 🚨 HOOK DE DATOS REALES (useDashboardData) 🚨
// Eliminamos las importaciones fallidas y definimos los tipos aquí.
import { useDashboardData } from '../hooks/useDashboardData'; 
import { type Client } from '../hooks/useClientData';


// 👑 IMPORTAMOS ICONOS DE MATERIAL DESIGN
import { 
    MdPeople, 
    MdAttachMoney, 
    MdCalendarToday, 
    MdVisibility, 
    MdVisibilityOff,
    MdSchedule, // Para la Agenda
    MdHistory, // Para Actividad Reciente
} from 'react-icons/md'; 

// ----------------------------------------------------------------------
// TIPOS (MOVIDOS AQUÍ PARA RESOLVER ERRORES TS)
// ----------------------------------------------------------------------

// interface DashboardMetrics {
//     activeCount: number;
//     overdueCount: number;
//     monthlyRevenueFormatted: string; 
//     // Otros KPIs si existen
// }

interface Sale {
    id: string;
    monto: number;
    concepto?: string;
    observaciones?: string;
    cliente?: string;
}

// Interfaz para la Agenda (basada en la estructura de agendaSlots)
interface AgendaData {
    targetDate: Date;
    agendaSlots: { 
        hour: string; 
        count: number; 
        members: Pick<Client, "id" | "nombre">[];
    }[];
    // Asumimos que el campo activeSlotsCount fue removido del hook
    setTargetDate: (date: Date) => void;
}


interface KpiCardProps {
    title: string;
    value: string | number;
    link?: string;
    IconComponent: React.ElementType; 
    isRevenue?: boolean;
    revenueProtected: boolean;
    onToggleBlur: () => void;
}

interface GymDashboardProps {
    user: User;
    onLogout: () => void;
}

// ----------------------------------------------------------------------
// SUBCOMPONENTE 1: KpiCard (Se mantiene sin cambios)
// ----------------------------------------------------------------------
const KpiCard: React.FC<KpiCardProps> = ({ title, value, link, IconComponent, isRevenue, revenueProtected, onToggleBlur }) => {
    // ESTILOS: USO DE className
    const valueClasses = `mt-1 text-3xl sm:text-4xl font-extrabold ${
        title === 'Cuotas Vencidas' ? 'text-red-600' : 'text-[#152754]'
    } ${revenueProtected ? 'blur-sm select-none' : ''}`;
    
    const iconWrapperColor = title === 'Cuotas Vencidas' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-[#0f1c3f]';
    
    const content = (
        <div className="flex items-start justify-between">
            <div>
                <p className="text-[12px] uppercase tracking-wider text-gray-500">{title}</p>
                <p id={title === 'Miembros Activos' ? 'kpiActivos' : title === 'Cuotas Vencidas' ? 'kpiVencidas' : title === 'Ingresos Mensuales' ? 'kpiFacturacion' : title === 'Clases Programadas' ? 'kpiClases' : ''} 
                    className={valueClasses}>{value}</p>
                
                {/* Lógica del botón de Ingresos Mensuales */}
                {isRevenue && (
                    <button 
                        id="btnToggleBlurFacturacion"
                        type="button" 
                        onClick={(e) => { e.preventDefault(); onToggleBlur(); }} 
                        className="mt-6 inline-flex items-center justify-center text-[11px] px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                    >
                        {revenueProtected ? <MdVisibility className="mr-1" /> : <MdVisibilityOff className="mr-1" />}
                        {revenueProtected ? 'Mostrar' : 'Ocultar'}
                    </button>
                )}
                
                {/* Tendencia y texto adicional (simulados) */}
                {(title === 'Miembros Activos' || title === 'Ingresos Mensuales') && (
                    <p id={title === 'Miembros Activos' ? 'kpiActivosTrend' : 'kpiFactTrend'} className="text-[12px] text-emerald-600 mt-1 hidden">+0% vs mes anterior</p>
                )}
                {title === 'Cuotas Vencidas' && (
                    <p className="text-[12px] text-gray-500 mt-1">Al día de hoy</p>
                )}
                {title === 'Clases Programadas' && (
                    <p className="text-[12px] text-gray-500 mt-1">Hoy</p>
                )}
            </div>
            {/* USO DEL ICONO */}
            <div className={`w-9 h-9 grid place-items-center rounded-lg ${iconWrapperColor} transition duration-300`}>
                <IconComponent className="text-2xl opacity-80" />
            </div>
        </div>
    );
    
    if (link) return <a href={link} id={title === 'Ingresos Mensuales' ? 'cardFacturacion' : undefined} 
                        onClick={(e) => {
                            if (title === 'Ingresos Mensuales' && revenueProtected) {
                                e.preventDefault();
                                onToggleBlur(); 
                            }
                        }}
                        className="bg-white rounded-xl p-5 shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:-translate-y-0.5" 
                        data-locked={revenueProtected ? '1' : '0'}>
                        {content}
                    </a>;
    
    return <div className="bg-white rounded-xl p-5 shadow-sm ring-1 ring-black/5">{content}</div>;
};

// ----------------------------------------------------------------------
// SUBCOMPONENTE 2: KpiPasswordModal (Se mantiene sin cambios)
// ----------------------------------------------------------------------
const KpiPasswordModal: React.FC<{ 
    email: string, 
    isVisible: boolean, 
    onConfirm: (pass: string) => void, 
    onCancel: () => void, 
    error: string 
}> = ({ isVisible, onCancel, onConfirm, error }) => {
    const [password, setPassword] = useState('');
    
    if (!isVisible) return null;
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(password);
    };

    return (
        <div id="kpiPasswordOverlay" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-[90%] sm:w-[400px] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-base font-semibold text-gray-900">Ver ingresos mensuales</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Ingresá la contraseña para mostrar el monto de ingresos mensuales.
                    </p>
                </div>
                <div className="px-6 py-4 space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="kpiPasswordInput">
                        Contraseña
                    </label>
                    <input
                        id="kpiPasswordInput"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152754]/60 focus:border-[#152754]"
                        autoComplete="current-password"
                        required
                    />
                    <p id="kpiPasswordError" data-error className="text-xs text-red-600 mt-1 min-h-[1rem]">{error}</p>
                </div>
                <div className="px-6 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-200">
                    <button
                        type="button"
                        data-btn-cancel
                        onClick={onCancel}
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        data-btn-ok
                        onClick={handleSubmit}
                        className="px-3 py-1.5 text-sm rounded-md bg-[#152754] text-white hover:bg-[#111a3a]">
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};


// ----------------------------------------------------------------------
// DASHBOARD PRINCIPAL
// ----------------------------------------------------------------------

export const GymDashboard: React.FC<GymDashboardProps> = ({ user}) => {
    
    // 🚨 CARGA DE DATOS REALES 🚨
    const { metrics, loading, recentSales, agenda } = useDashboardData(user);
    
    // Calculamos el conteo de clases ACTIVAS para el KPI.
    // 🚨 CORRECCIÓN TS2339 🚨: Si activeSlotsCount no existe, caemos a contar los slots > 0
    const activeClassCount = useMemo(() => {
        // Acceso seguro a la propiedad, usando 'as any' solo para la propiedad inexistente si el hook no está tipado
        // Si el hook está tipado, usamos la lógica de fallback.
        const agendaData = agenda as AgendaData & { activeSlotsCount?: number };

        if (agendaData.activeSlotsCount !== undefined) return agendaData.activeSlotsCount;
        
        // Lógica de fallback: Contar slots donde count > 0
        return agendaData.agendaSlots?.filter((s) => s.count > 0).length ?? 0;
    }, [agenda]); // Dependencia simplificada al objeto agenda completo
    
    // Asignación de datos (usando valores por defecto si loading es true o si metrics es undefined)
    const kpis = {
        activeCount: metrics?.activeCount ?? 0,
        overdueCount: metrics?.overdueCount ?? 0,
        monthlyRevenueFormatted: metrics?.monthlyRevenueFormatted ?? "$0", 
    };

    // Lógica de Protección de Ingresos
    const [ingresosVisibles, setIngresosVisibles] = useState(false);
    const [showKpiModal, setShowKpiModal] = useState(false);
    const [kpiModalError, setKpiModalError] = useState('');

    const handleToggleRevenue = useCallback(() => { 
        if (ingresosVisibles) {
            setIngresosVisibles(false);
        } else {
            setShowKpiModal(true);
            setKpiModalError('');
        }
    }, [ingresosVisibles]);
    
    const handleConfirmRevenue = useCallback(async (password: string) => {
        if (!user || !user.email) return;
        setKpiModalError('');

        try {
            await signInWithEmailAndPassword(auth, user.email, password); 
            setIngresosVisibles(true);
            setShowKpiModal(false);
        } catch (err) {
            setKpiModalError('Contraseña incorrecta. Probá de nuevo.');
        }
    }, [user]);
    
    // Formateo de Fecha de Agenda
    const formattedTargetDate = useMemo(() => {
        try {
            return format(agenda.targetDate, "EEEE dd/MM/yyyy", { locale: es });
        } catch {
            return "Fecha no disponible";
        }
    }, [agenda.targetDate]);


    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = new Date(e.target.value);
        if (!isNaN(date.getTime())) {
            agenda.setTargetDate(date);
        }
    };

    const handleDayChange = (days: number) => {
        const newDate = new Date(agenda.targetDate);
        newDate.setDate(newDate.getDate() + days);
        agenda.setTargetDate(newDate);
    };

    if (loading) {
        return <div className="p-6 text-center text-[#152754]">Cargando información del tablero...</div>;
    }

    return (
        <div className="bg-[#f5f7fb] h-full flex flex-col">
            <div className="flex-1 flex flex-col">
                <main className="p-2 flex-1 overflow-y-auto">
                    <div className="max-w-[1200px] mx-auto space-y-6">
                        
                        {/* HERO */}
                        <section
                            className="rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5"
                            style={{background: "linear-gradient(90deg, rgba(21,39,84,1) 0%, rgba(21,39,84,.85) 45%, rgba(254,128,74,.85) 100%), url('assets/fondo-home.jpeg') center/cover no-repeat"}}>
                            <div className="p-6 sm:p-7 text-white">
                                <h1 className="text-2xl sm:text-3xl font-bold">Bienvenido/a a Exentra - Gym Manager</h1>
                                <p className="mt-1 text-white/90">Gestioná tu gimnasio de manera inteligente y eficiente</p>
                                <p className="mt-3 text-sm font-medium text-white/90">Agenda de hoy: {formattedTargetDate}</p>
                            </div>
                        </section>
                        
                        {/* KPIS */}
                        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Miembros Activos */}
                            <KpiCard title="Miembros Activos" value={kpis.activeCount} link="/app-gym/clientes" IconComponent={MdPeople} revenueProtected={false} onToggleBlur={()=>{}} />
                            
                            {/* Cuotas Vencidas */}
                            <KpiCard title="Cuotas Vencidas" value={kpis.overdueCount} link="/app-gym/clientes?filter=overdue" IconComponent={MdPeople} revenueProtected={false} onToggleBlur={()=>{}} />
                            
                            {/* Ingresos Mensuales */}
                            <KpiCard 
                                title="Ingresos Mensuales" 
                                value={ingresosVisibles ? kpis.monthlyRevenueFormatted : "$*****"} 
                                link="/app-gym/ventas" 
                                IconComponent={MdAttachMoney}
                                isRevenue={true}
                                revenueProtected={!ingresosVisibles}
                                onToggleBlur={handleToggleRevenue} 
                            />
                            
                            {/* Clases Programadas 🚨 CORREGIDO: Cuenta solo slots con personas */}
                            <KpiCard title="Clases Programadas" value={activeClassCount} IconComponent={MdCalendarToday} revenueProtected={false} onToggleBlur={()=>{}} />
                        </section>
                        
                        {/* SECCIONES DE ACTIVIDAD Y AGENDA */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                            
                            {/* 1. ACTIVIDAD RECIENTE (Ventas) */}
                            <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 overflow-hidden flex flex-col h-full min-h-[350px]">
                                <header className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MdHistory className="w-5 h-5 text-[#fe804a]" />
                                        <h3 className="font-semibold text-[#152754]">Últimos Movimientos de Caja</h3>
                                    </div>
                                    <a href="/app-gym/ventas" className="text-sm text-[#152754] transition hover:underline hover:opacity-80">Ver todo</a>
                                </header>
                                <div id="actividadScroll" className="flex-1 overflow-y-auto">
                                    {recentSales && recentSales.length > 0 ? (
                                        <ul className="divide-y divide-gray-100">
                                            {recentSales.slice(0, 7).map((sale: Sale) => ( // Limitamos a 7 items
                                                <li key={sale.id} className="flex justify-between items-center px-5 py-3 hover:bg-gray-50 transition">
                                                    <div>
                                                        <p className="text-sm font-medium text-[#152754]">{sale.concepto || sale.observaciones}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">Cliente: {sale.cliente || 'Anónimo'}</p>
                                                    </div>
                                                    <p className="font-semibold text-sm text-emerald-600">{`$${sale.monto}`}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="px-5 py-6 text-sm text-gray-500">No hay movimientos recientes.</p>
                                    )}
                                </div>
                            </div>

                            {/* 2. PRÓXIMAS CLASES (Agenda Dinámica con colores) */}
                            <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 overflow-hidden flex flex-col h-full">
                                <header className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MdSchedule className="w-5 h-5 text-[#fe804a]" />
                                        <h3 className="font-semibold text-[#152754]">Próximas Clases</h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <button 
                                            type="button" 
                                            className="px-2 py-1 rounded border transition hover:bg-gray-50" 
                                            title="Día anterior"
                                            onClick={() => handleDayChange(-1)}>‹</button>
                                        <span id="labelFecha" className="min-w-[140px] text-[#152754] font-medium text-sm text-center">{formattedTargetDate}</span>
                                        <input 
                                            id="inputFecha" 
                                            type="date" 
                                            className="px-2 py-1 border rounded-md text-sm cursor-pointer" 
                                            value={format(agenda.targetDate, 'yyyy-MM-dd')}
                                            onChange={handleDateChange}
                                        />
                                        <button 
                                            type="button" 
                                            className="px-2 py-1 rounded border transition hover:bg-gray-50" 
                                            title="Día siguiente"
                                            onClick={() => handleDayChange(1)}>›</button>
                                    </div>
                                </header>
                                <div id="agendaScroll" className="flex-1 overflow-y-auto">
                                    {agenda.agendaSlots && agenda.agendaSlots.length > 0 ? (
                                        <ul className="divide-y divide-gray-100 text-sm">
                                            {agenda.agendaSlots.map((slot, index) => {
                                                const isOccupied = slot.count > 0;
                                                
                                                // CLASES CONDICIONALES PARA ESTILO SUTIL
                                                // Fondo blanco/gris y borde izquierdo sutil
                                                const listItemClasses = `flex flex-col px-5 py-3 transition 
                                                    ${isOccupied 
                                                        ? 'hover:bg-gray-50 border-l-4 border-l-[#fe804a]/50' // Ocupado: Borde lateral sutil
                                                        : 'bg-white text-gray-500'} // Libre: Blanco sin borde
                                                    `;
                                                // 🚨 CORRECCIÓN 1: Horario en Naranja principal
                                                const hourTextClass = `font-semibold ${isOccupied ? 'text-[#fe804a]' : 'text-gray-500'}`;
                                                
                                                const namesTextClass = isOccupied ? 'mt-1 text-xs text-[#152754] leading-relaxed' : 'mt-1 text-xs text-gray-500';
                                                
                                                // Badge discreto para el conteo de inscritos
                                                const badgeClasses = isOccupied 
                                                     ? 'inline-flex items-center justify-center h-5 px-2 text-xs font-medium rounded-full bg-blue-100 text-blue-800' // Azul sutil
                                                     : 'text-gray-400';


                                                return (
                                                    <li key={index} className={listItemClasses}>
                                                        <div className="flex justify-between items-start">
                                                            <p className={hourTextClass}>{slot.hour}</p>
                                                            {slot.count > 0 ? (
                                                                <span className={badgeClasses}>
                                                                    {slot.count} inscrito{slot.count !== 1 ? 's' : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400">—</span>
                                                            )}
                                                        </div>
                                                        {slot.count > 0 ? (
                                                            // MOSTRAR NOMBRES DE INSCRITOS
                                                            <p className={namesTextClass}>
                                                                {slot.members.map(m => m.nombre).join(', ')}
                                                            </p>
                                                        ) : (
                                                            <p className={namesTextClass}>LIBRE</p>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <p className="px-5 py-6 text-sm text-gray-500">No hay clases programadas para este día.</p>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
            
            {/* 🚨 MODAL DE CONTRASEÑA KPI 🚨 */}
            <KpiPasswordModal 
                email={user.email || ''} 
                isVisible={showKpiModal} 
                onConfirm={handleConfirmRevenue} 
                onCancel={() => setShowKpiModal(false)}
                error={kpiModalError}
            />
        </div>
    );
};