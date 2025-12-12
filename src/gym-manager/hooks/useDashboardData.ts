import { useState, useEffect, useCallback, useMemo } from 'react';
import { type User } from 'firebase/auth';
import { db } from '../../../firebase'; 
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';

// 🚨 Asumiendo que estos helpers existen en '../utils/dateHelpers' 🚨
import {
    calculateDaysRemaining, // Debe aceptar Date o Timestamp
    daysUntil, // Debe aceptar Date o Timestamp
    fmtMoney,
    getShortDayLetter,
    getHourRange, // Debe retornar { start: number, end: number }
} from '../utils/dateHelpers'; 


// ----------------------------------------------------------------------
// TIPOS DE DATOS Y CONVERSIONES
// ----------------------------------------------------------------------

interface Client {
  id: string;
  nombre: string;
  fechaVencimiento: string; // YYYY-MM-DD
  horario: string; 
  dias: string[]; 
  // El hook necesita el Timestamp original para el cálculo de días si está en ese formato
  fechaVencimientoTs?: Timestamp; 
}

interface Sale {
  id: string;
  monto: number;
  fecha: Timestamp; // Usamos Timestamp para la lectura de la BD
  cliente: string;
  observaciones: string;
  concepto: string;
}

// ----------------------------------------------------------------------
// HOOK PRINCIPAL
// ----------------------------------------------------------------------

export const useDashboardData = (user: User | null) => {
  const [loading, setLoading] = useState(true);
  
  // Data de Firestore
  const [clients, setClients] = useState<Client[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  
  // Estados para Agenda
  const [targetDate, setTargetDate] = useState(new Date());
  
  // KPIs
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);

  // --- Subscripciones de Clientes y Ventas ---
  useEffect(() => {
    if (!user || !user.uid) {
        setLoading(false);
        return;
    }
    
    const baseRef = `usuarios/${user.uid}`; // Ruta base para el usuario autenticado

    // 1. CLIENTES (KPIs y Agenda) - Lectura Filtrada por UID
    const clientsRef = collection(db, baseRef, "clientes");
    const unsubscribeClients = onSnapshot(clientsRef, (snap) => {
      const data: Client[] = snap.docs.map((d) => {
        const docData = d.data();
        
        // Convertimos Timestamp a formato YYYY-MM-DD si es necesario
        const fechaVencimiento = docData.fechaVencimiento && typeof docData.fechaVencimiento.toDate === 'function'
            ? docData.fechaVencimiento.toDate().toISOString().split('T')[0]
            : docData.fechaVencimiento;

        return { 
            id: d.id, 
            nombre: docData.nombre || 'N/A',
            horario: docData.horario || 'N/A',
            dias: docData.dias || [],
            fechaVencimiento: fechaVencimiento,
            fechaVencimientoTs: docData.fechaVencimiento, // Guardamos el Timestamp para calcular días
        } as Client;
      });
      setClients(data);
    });

    // 2. VENTAS RECIENTES (Actividad reciente)
    const salesCollectionRef = collection(db, baseRef, "ventas");
    const salesQuery = query(
      salesCollectionRef,
      orderBy("fecha", "desc"),
      limit(100)
    );
    const unsubscribeSales = onSnapshot(salesQuery, (snap) => {
      const data: Sale[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      setRecentSales(data);
    });

    // 3. FACTURACIÓN MENSUAL (Usa where para filtrar el mes actual)
    const now = new Date();
    // 🚨 CORRECCIÓN: Firestore requiere comparar Timestamp con Timestamp 🚨
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // Convertimos las fechas de JS a Firestore Timestamps para la consulta
    const startTs = Timestamp.fromDate(startOfMonth);
    const endTs = Timestamp.fromDate(endOfMonth);

    const revenueQuery = query(
        salesCollectionRef,
        where("fecha", ">=", startTs), // Comparamos Timestamp con Timestamp
        where("fecha", "<", endTs)
    );

    const unsubscribeRevenue = onSnapshot(revenueQuery, (snap) => {
        let total = 0;
        snap.forEach((d) => (total += Number((d.data() as DocumentData).monto) || 0));
        setMonthlyRevenue(total);
        setLoading(false);
    });


    return () => {
      unsubscribeClients();
      unsubscribeSales();
      unsubscribeRevenue();
    };
  }, [user]);

  // --- 4. CÁLCULOS DE KPIS (useMemo) ---
  const kpis = useMemo(() => {
    // Nota: calculateDaysRemaining debe ser capaz de manejar c.fechaVencimiento que es string (YYYY-MM-DD)
    
    // Activos: vencimiento > hoy
    const activeMembers = clients.filter(
        (c) => calculateDaysRemaining(c.fechaVencimiento) > 0
    );

    // Vencidos (dentro de los últimos 30 días)
    const overdueMembers = clients.filter((c) => {
      // Aquí usamos días hasta la fecha de vencimiento (negativo si venció)
      const days = daysUntil(c.fechaVencimiento); 
      return days !== null && days <= 0 && days >= -30;
    });

    return {
      activeCount: activeMembers.length,
      overdueCount: overdueMembers.length,
      monthlyRevenueFormatted: fmtMoney(monthlyRevenue),
      // Añadir aquí lógica de Trend (simulación simple)
      monthlyRevenueRaw: monthlyRevenue,
    };
  }, [clients, monthlyRevenue]);
  
  // --- 5. LÓGICA DE AGENDA ---
  const agendaSlots = useMemo(() => {
    const targetDayLetter = getShortDayLetter(targetDate);
    
    // 1. Filtrar clientes activos para el día
    const membersToday = clients.filter(
      (c) => calculateDaysRemaining(c.fechaVencimiento) > 0 && 
             Array.isArray(c.dias) && 
             c.dias.includes(targetDayLetter) && 
             c.horario !== "Libre"
    );

    // 2. Calcular rango de horas y agrupar
    const peopleByHour = new Map<number, Pick<Client, 'id' | 'nombre'>[]>();
    let minH = 24;
    let maxH = 0;
    
    membersToday.forEach((c) => {
        const { start, end } = getHourRange(c.horario);
        if (start < minH) minH = start;
        if (end > maxH) maxH = end;

        if (!peopleByHour.has(start)) peopleByHour.set(start, []);
        peopleByHour.get(start)?.push({ id: c.id, nombre: c.nombre });
    });

    // 3. Construir los slots hora a hora (versión simplificada para el hook)
    const slots: { hour: string, count: number, members: Pick<Client, 'id' | 'nombre'>[] }[] = [];
    
    if (minH <= maxH) {
        for (let h = minH; h < maxH; h++) {
            const hourString = `${String(h).padStart(2, '0')}:00`;
            const members = peopleByHour.get(h) || [];
            slots.push({
                hour: hourString,
                count: members.length,
                members: members
            });
        }
    }
    
    return slots;
    
  }, [clients, targetDate]);


  // --- 6. Handlers de Agenda ---
  const changeTargetDate = useCallback((date: Date) => {
    // Limpiar horas/minutos para hacer la comparación YYYY-MM-DD
    setTargetDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  }, []);


  return {
    loading,
    metrics: kpis, // Renombramos kpis a metrics para usar el alias en el dashboard
    recentSales,
    agenda: {
        targetDate,
        agendaSlots,
        setTargetDate: changeTargetDate,
    },
  };
};