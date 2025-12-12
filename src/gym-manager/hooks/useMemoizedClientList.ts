import { useState, useMemo, useCallback } from 'react';
import { type Client } from '../hooks/useClientData'; // Importa la interfaz Client
import { ymdFromDate } from '../utils/dateHelpers'; // Importa el helper de fecha

// ----------------------------------------------------------------------
// Tipos (CORREGIDOS: Se añade 'export')
// ----------------------------------------------------------------------

export type SortField = 'nombre' | 'dni' | 'plan' | 'dias' | 'horario' | 'diasRestantes' | 'fechaVencimiento' | 'comentarios';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
    field: SortField;
    direction: SortDirection;
}

// ----------------------------------------------------------------------
// Lógica de Ordenamiento y Filtrado
// ----------------------------------------------------------------------

/**
 * Hook para manejar el estado de ordenamiento, el término de búsqueda y
 * devolver la lista de clientes activos filtrada y ordenada, memorizada.
 */
export const useMemoizedClientList = (clients: Client[], searchTerm: string) => {
    // Estado inicial de ordenamiento (diasRestantes, ascendente, como en el JS original)
    const [sortState, setSortState] = useState<SortState>({
        field: 'diasRestantes',
        direction: 'asc',
    });

    // Función principal de comparación, replicando la lógica de clientes.js
    const comparator = useCallback((a: Client, b: Client): number => {
        const { field, direction } = sortState;

        let valorA: any = a[field as keyof Client] || '';
        let valorB: any = b[field as keyof Client] || '';
        
        // --- Conversión de Tipos ---
        if (field === 'fechaVencimiento') {
            // Convertir las cadenas YYYY-MM-DD a fechas comparables (o 0 si es nulo)
            valorA = ymdFromDate(valorA) ? new Date(valorA).getTime() : 0;
            valorB = ymdFromDate(valorB) ? new Date(valorB).getTime() : 0;
        } else if (field === 'horario') {
            // Comparar por hora de inicio (ej: "08:00 - 09:00" -> "08:00")
            valorA = (valorA as string).split(" - ")[0] || '';
            valorB = (valorB as string).split(" - ")[0] || '';
        } else if (field === 'dias') {
            // Comparar por el número de días o por el texto si es "Libre"
            const numA = (valorA as string[]).length;
            const numB = (valorB as string[]).length;
            if (numA !== numB) return numA - numB;
        }

        // --- Lógica de Desempate Específica de 'diasRestantes' (home.js) ---
        if (field === 'diasRestantes' && valorA === valorB) {
            const horaA = (a.horario as string)?.split(" - ")[0] || "";
            const horaB = (b.horario as string)?.split(" - ")[0] || "";
            // Desempatar por horario
            return direction === 'asc' ? horaA.localeCompare(horaB) : horaB.localeCompare(horaA);
        }

        // --- Comparación Final ---
        let result = 0;
        if (valorA < valorB) {
            result = -1;
        } else if (valorA > valorB) {
            result = 1;
        }

        return direction === 'asc' ? result : -result;

    }, [sortState]);


    // Lista filtrada y ordenada (se recalcula solo si cambia clients, searchTerm o comparator)
    const processedList = useMemo(() => {
        
        let listToProcess = clients;

        if (searchTerm.trim()) {
            const texto = searchTerm.toLowerCase().trim();
            
            // 🚨 1. BÚSQUEDA ACTIVADA: Filtramos en TODA la lista (incluye Vencidos) 🚨
            listToProcess = clients.filter(c => {
                const nombre = (c.nombre || "").toLowerCase();
                const dni = String(c.dni || "").toLowerCase();
                
                // Usamos includes() en lugar de startsWith() para búsquedas más flexibles (ej: "lina" encuentra "Carolina")
                // Esto soluciona que "ca" falle si el nombre es "Carolina Melo".
                return nombre.includes(texto) || dni.includes(texto);
            });
            
        } else {
            // 🚨 2. SIN BÚSQUEDA: Devolvemos SOLO los activos 🚨
            // Esto replica la lógica original de la vista por defecto de Clients.tsx
            listToProcess = clients.filter(c => c.diasRestantes > 0);
        }

        // 3. Ordenamiento: Aplicamos el ordenamiento a la lista filtrada (activos o resultados de búsqueda)
        const sorted = [...listToProcess].sort(comparator);
        return sorted;

    }, [clients, searchTerm, comparator]); // Se elimina la dependencia 'comparator' ya que está definida con useCallback, pero la mantenemos si así lo requiriera el linter/eslint.

    // Función para cambiar el orden al hacer clic en el encabezado de la tabla
    const handleSort = useCallback((field: SortField) => {
        setSortState(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    }, []);

    return {
        sortedList: processedList,
        sortState,
        handleSort,
    };
};