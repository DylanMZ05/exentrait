import { useState, useEffect, useMemo, useCallback } from 'react';
import { type User } from 'firebase/auth';
import { 
    collection, 
    onSnapshot, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    serverTimestamp, 
    type DocumentData, // Usado para tipar data sin saber el esquema exacto
} from 'firebase/firestore'; 

import { db } from '../../../firebase'; 
import { 
    ymdFromDate, 
    daysUntil, 
    daysRemainingFromToday, 
} from '../utils/dateHelpers'; 

// ----------------------------------------------------------------------
// TIPOS EXPORTADOS Y TIPOS DE FORMULARIO
// ----------------------------------------------------------------------

// Interfaz extendida para el cliente que se usa en el front
export interface Client {
    id: string;
    dni: string;
    nombre: string;
    fechaVencimiento: string; // YYYY-MM-DD
    horario: string; // "Libre" o "HH:MM - HH:MM"
    dias: string[]; // ["L", "M", "X"] o ["Libre"]
    monto: number;
    comentarios?: string;
    ultimaActualizacion?: string | null; // Corregido: puede ser string o null
    diasRestantes: number;
    email?: string; // Nuevo
    telefono?: string; // Nuevo
    telefonoRespaldo?: string; // Nuevo
}

// Interfaz para la data que viene del formulario (sin ID, con horaInicio/Fin)
export interface ClientFormData {
    dni: string; 
    nombre: string; 
    dias: string[]; 
    fechaVencimiento: string; 
    monto: string; // Viene como string del input
    horaInicio: string; 
    horaFin: string; 
    email: string; 
    telefono: string; 
    telefonoRespaldo: string;
    comentarios?: string;
}

// ----------------------------------------------------------------------
// HOOK PRINCIPAL: useClientData
// ----------------------------------------------------------------------

export const useClientData = (user: User | null) => {
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. R: READ - Lectura en tiempo real (Ajustado para manejar Timestamp)
    useEffect(() => {
        if (!user) {
            setAllClients([]);
            setLoading(false);
            return;
        }

        const clientsRef = collection(db, "usuarios", user.uid, "clientes");
        
        const unsubscribe = onSnapshot(clientsRef, (snapshot) => {
            const todos: Client[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                
                // 🚨 CORRECCIÓN DE ERROR DE TIMESTAMP 🚨
                let ultimaActualizacion: string | null = null;
                // Verificamos que el campo exista y tenga la función toDate (es un Timestamp)
                if (data.ultimaActualizacion && typeof data.ultimaActualizacion.toDate === 'function') {
                    ultimaActualizacion = data.ultimaActualizacion.toDate().toISOString();
                } else if (typeof data.ultimaActualizacion === 'string') {
                    ultimaActualizacion = data.ultimaActualizacion;
                }
                
                // 🔑 Cálculo de días
                const diasRestantes = daysRemainingFromToday(data.fechaVencimiento || "");

                todos.push({ 
                    id: docSnap.id, 
                    ...data as DocumentData, 
                    diasRestantes,
                    fechaVencimiento: ymdFromDate(data.fechaVencimiento),
                    ultimaActualizacion: ultimaActualizacion,
                    monto: Number(data.monto) || 0,
                    dias: data.dias || [],
                    horario: data.horario || 'N/A',
                } as Client);
            });
            setAllClients(todos);
            setLoading(false);
        }, (error) => {
            console.error("Error loading clients:", error);
            setLoading(false);
        });

        return unsubscribe;
    }, [user]);

    // -------------------------------------------------------------------
    // 2. C: CREATE - Añadir Cliente
    // -------------------------------------------------------------------

    const addClient = useCallback(async (data: ClientFormData) => {
        if (!user) {
            console.error("Usuario no autenticado para crear cliente.");
            return;
        }

        try {
            const clientsCollectionRef = collection(db, "usuarios", user.uid, "clientes");
            
            // Datos a guardar en Firestore
            const clientDataForDb = {
                dni: data.dni.trim(),
                nombre: data.nombre.trim(),
                dias: data.dias,
                horario: data.dias.includes('Libre') ? 'Libre' : `${data.horaInicio} - ${data.horaFin}`,
                fechaVencimiento: data.fechaVencimiento, 
                monto: Number(data.monto) || 0, 
                email: data.email?.trim() || null,
                telefono: data.telefono?.trim() || null,
                telefonoRespaldo: data.telefonoRespaldo?.trim() || null,
                comentarios: data.comentarios?.trim() || null,
                creadoEn: serverTimestamp(),
                ultimaActualizacion: serverTimestamp(),
            };
            
            // Usando addDoc para crear
            await addDoc(clientsCollectionRef, clientDataForDb);
            console.log("🔥 Cliente creado exitosamente.");
        } catch (e) {
            console.error("Error al añadir cliente:", e);
            alert("Error al intentar crear el cliente. Revisa la consola.");
        }
    }, [user]);

    // -------------------------------------------------------------------
    // 3. U: UPDATE - Actualizar Cliente
    // -------------------------------------------------------------------
    
    // Recibe el ID y la data del formulario
    const updateClient = useCallback(async (id: string, data: ClientFormData) => {
        if (!user || !id) {
            console.error("Usuario no autenticado o ID de cliente no proporcionado.");
            return;
        }
        
        try {
            const clientDocRef = doc(db, "usuarios", user.uid, "clientes", id);
            
            // Datos a actualizar en Firestore
            const updatedDataForDb = {
                dni: data.dni.trim(),
                nombre: data.nombre.trim(),
                dias: data.dias,
                horario: data.dias.includes('Libre') ? 'Libre' : `${data.horaInicio} - ${data.horaFin}`,
                fechaVencimiento: data.fechaVencimiento, 
                monto: Number(data.monto) || 0,
                email: data.email?.trim() || null,
                telefono: data.telefono?.trim() || null,
                telefonoRespaldo: data.telefonoRespaldo?.trim() || null,
                comentarios: data.comentarios?.trim() || null,
                ultimaActualizacion: serverTimestamp(),
            };

            // Usando updateDoc para modificar
            await updateDoc(clientDocRef, updatedDataForDb);
            console.log("✏️ Cliente actualizado exitosamente:", id);
        } catch (e) {
            console.error("Error al actualizar cliente:", e);
            alert("Error al intentar actualizar el cliente. Revisa la consola.");
        }
    }, [user]);

    // -------------------------------------------------------------------
    // 4. D: DELETE - Eliminar Cliente
    // -------------------------------------------------------------------
    
    const deleteClient = useCallback(async (id: string) => {
        if (!user || !id) {
            console.error("Usuario no autenticado o ID de cliente no proporcionado.");
            return;
        }

        try {
            const clientDocRef = doc(db, "usuarios", user.uid, "clientes", id);
            
            // Usando deleteDoc para eliminar
            await deleteDoc(clientDocRef);
            console.log("🗑️ Cliente eliminado exitosamente:", id);
        } catch (e) {
            console.error("Error al eliminar cliente:", e);
            alert("Error al intentar eliminar el cliente. Revisa la consola.");
        }
    }, [user]);


    // --- Cálculos de KPIs y grupos (Se mantienen) ---
    const dataMetrics = useMemo(() => {
        const activos = allClients.filter(c => c.diasRestantes > 0);
        const vencidos = allClients.filter(c => c.diasRestantes <= 0);
        
        const vencidosRecientes = vencidos.filter(c => {
            const daysDiff = daysUntil(c.fechaVencimiento); 
            return daysDiff !== null && daysDiff >= -31;
        });

        const semanales = activos.filter(c => Array.isArray(c.dias) && !c.dias.includes("Libre"));
        const libres = activos.filter(c => Array.isArray(c.dias) && c.dias.includes("Libre"));

        return {
            all: allClients,
            activos,
            vencidos,
            vencidosRecientes,
            semanales,
            libres,
            total: allClients.length,
        };
    }, [allClients]);

    // -------------------------------------------------------------------
    // 5. RETORNO FINAL: Incluye las funciones CRUD
    // -------------------------------------------------------------------
    return { 
        dataMetrics, 
        loading, 
        addClient, 
        updateClient, 
        deleteClient 
    };
};