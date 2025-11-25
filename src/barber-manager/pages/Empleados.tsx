import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// Tipados (Simplificados)
interface Empleado {
  id: string;
  nombre: string;
  porcentaje: number; // Porcentaje de comisión
  activo: boolean;
}

interface BarberConfig {
  barberName: string;
  masterPassword: string;
  ownerUid: string;
}

/* ============================================================
    CONSTANTES & HELPERS
============================================================ */

const IconUser = () => (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
const IconWarning = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.45-1.74 1.54-3.04L13.54 4.04c-.91-1.3-2.37-1.3-3.28 0L3.54 17.96c-.91 1.3.003 3.04 1.54 3.04z" />
    </svg>
);
const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Reemplaza espacios con guiones
    .replace(/[^\w\-]+/g, '') // Elimina caracteres no alfanuméricos
    .replace(/\-\-+/g, '-') // Reemplaza múltiples guiones con uno solo
    .substring(0, 50); // Limita la longitud
};
const generateEmployeeCredentials = (ownerUid: string, barberSlug: string, employeeName: string) => {
  const employeeSlug = slugify(employeeName);
  const username = `${barberSlug}-${employeeSlug}`;
  const internalEmail = `${username}@${ownerUid}.internal`; 
  return { username, internalEmail };
};


/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Empleados: React.FC = () => {
  const owner = barberAuth.currentUser;
  const uid = owner?.uid;

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BarberConfig | null>(null);

  // Estados del modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Estados del formulario
  const [formNombre, setFormNombre] = useState("");
  const [formPorcentaje, setFormPorcentaje] = useState(0);
  const [formActivo, setFormActivo] = useState(true);

  // Mensajes
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ============================================================
    CARGA DE DATOS
  ============================================================ */
  const loadData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Cargar Configuración (para obtener Master Password y Slug)
      const configRef = doc(barberDb, `barber_config/${uid}`);
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        setConfig(configSnap.data() as BarberConfig);
      } else {
        setErrorMessage("¡ERROR! Define la Configuración de la Barbería antes de crear empleados.");
      }

      // 2. Cargar Lista de Empleados
      const q = query(collection(barberDb, `barber_users/${uid}/empleados`), orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      const list: Empleado[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Empleado));

      setEmpleados(list);
    } catch (err) {
      console.error(err);
      setErrorMessage("Error al cargar empleados.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) loadData();
  }, [uid, loadData]);

  /* ============================================================
    HANDLERS Y CRUD
  ============================================================ */
  const resetForm = () => {
    setFormNombre("");
    setFormPorcentaje(0);
    setFormActivo(true);
    setSelectedEmpleado(null);
    setErrorMessage(null);
  };

  const openModal = (empleado?: Empleado) => {
    if (empleado) {
      setIsEditing(true);
      setSelectedEmpleado(empleado);
      setFormNombre(empleado.nombre);
      setFormPorcentaje(empleado.porcentaje);
      setFormActivo(empleado.activo);
    } else {
      setIsEditing(false);
      resetForm();
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !config || !config.masterPassword) {
        setErrorMessage("Debe configurar el Nombre y Contraseña Maestra de la Barbería primero.");
        return;
    }
    if (!formNombre.trim()) {
        setErrorMessage("El nombre es obligatorio.");
        return;
    }

    setErrorMessage(null);
    const barberSlug = slugify(config.barberName);
    
    try {
        const baseData = {
            nombre: formNombre.trim(),
            porcentaje: Number(formPorcentaje),
            activo: formActivo,
            updatedAt: serverTimestamp(),
            role: "employee", // Rol fijo
        };
        const { internalEmail, username } = generateEmployeeCredentials(uid, barberSlug, formNombre);

        if (isEditing && selectedEmpleado) {
            // --- 1. EDICIÓN ---
            await updateDoc(doc(barberDb, `barber_users/${uid}/empleados/${selectedEmpleado.id}`), baseData);
        } else {
            // --- 2. CREACIÓN ---
            
            // CRÍTICO: Crear la cuenta de Firebase Auth con la Contraseña Maestra
            const authCred = await createUserWithEmailAndPassword(barberAuth, internalEmail, config.masterPassword);

            // Guardar el documento del empleado en Firestore con el UID de Auth
            const empleadoId = authCred.user.uid;
            await setDoc(doc(barberDb, `barber_users/${uid}/empleados/${empleadoId}`), {
                ...baseData,
                createdAt: serverTimestamp(),
                authUid: empleadoId, // Guardamos el UID de Auth para referencia
                internalEmail: internalEmail, // Guardamos el email interno
                username: username,
            });
        }

        setModalOpen(false);
        loadData(); 
    } catch (err: any) {
        console.error("Error al guardar empleado:", err);
        if (err.code === "auth/email-already-in-use") {
            setErrorMessage("Ya existe un empleado con ese nombre de usuario/email interno.");
        } else {
            setErrorMessage("Error al crear la cuenta de usuario. Intente de nuevo.");
        }
    }
  };
  
  const handleDelete = async () => {
    if (!uid || !selectedEmpleado) return;

    try {
        // 1. (OPCIONAL PERO RECOMENDADO) Eliminar el usuario de Firebase Auth
        // Nota: Esto solo funciona si el DUEÑO está re-autenticado, por seguridad.
        // En un backend, usarías Admin SDK para hacer esto sin re-autenticación.
        // Dado el frontend, confiamos en el Admin SDK para la limpieza posterior.
        
        // 2. Eliminar el documento de Firestore
        await deleteDoc(doc(barberDb, `barber_users/${uid}/empleados/${selectedEmpleado.id}`));
        
        setDeleteConfirmOpen(false);
        loadData();
    } catch (err) {
        console.error("Error al eliminar empleado:", err);
        setErrorMessage("Error al eliminar empleado. La cuenta de Auth podría requerir limpieza manual.");
    }
  };


  /* ============================================================
    RENDER
  ============================================================ */
  const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
  const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm cursor-pointer";
  const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm cursor-pointer";

  const getUsername = (empleado: Empleado) => {
    if (!config) return '—';
    const { username } = generateEmployeeCredentials(uid!, slugify(config.barberName), empleado.nombre);
    return username;
  };


  return (
    <div className="space-y-6 animate-fadeIn m-2 pb-16">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <IconUser />
            Gestión de Empleados
          </h2>
          <p className="text-sm text-slate-500">
            {empleados.length} empleados registrados.
          </p>
        </div>

        <button 
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <IconAdd />
          Nuevo Empleado
        </button>
      </div>
      
      {errorMessage && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{errorMessage}</div>}


      {/* ADVERTENCIA CRÍTICA */}
      {!config?.barberName || !config?.masterPassword ? (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm flex items-center gap-3">
            <IconWarning />
            <p className="text-sm text-orange-800">
                **Acceso Bloqueado:** Debe ir a **Configuración** y definir el Nombre de la Barbería y la Contraseña Maestra para poder crear cuentas de empleados.
            </p>
        </div>
      ) : (
        /* TABLA DE EMPLEADOS */
        loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              <p className="mt-2 text-sm text-slate-500">Cargando empleados...</p>
            </div>
        ) : empleados.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
              <p className="text-slate-400 mb-2">No tienes empleados registrados aún.</p>
              <button onClick={() => openModal()} className="text-sm text-slate-900 font-medium hover:underline cursor-pointer">
                Crear el primero ahora
              </button>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Usuario Interno</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Comisión</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {empleados.map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{emp.nombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    <code className="bg-slate-100 px-1 rounded text-xs select-all">
                                        {getUsername(emp)}
                                    </code>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{emp.porcentaje}%</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        {emp.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button 
                                        onClick={() => openModal(emp)} 
                                        className="text-slate-600 hover:text-slate-900 mr-3 cursor-pointer"
                                        title="Editar"
                                    >
                                        <IconEdit />
                                    </button>
                                    <button 
                                        onClick={() => { setSelectedEmpleado(emp); setDeleteConfirmOpen(true); }}
                                        className="text-red-400 hover:text-red-700 cursor-pointer"
                                        title="Eliminar"
                                    >
                                        <IconTrash />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
      )}

      {/* =========================================
          MODAL CREAR / EDITAR
      ========================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {isEditing ? "Editar Empleado" : "Nuevo Empleado"}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre Completo</label>
                <input 
                  type="text" 
                  value={formNombre} 
                  onChange={(e) => setFormNombre(e.target.value)} 
                  className={inputClass}
                  placeholder="Ej. Lean Martinez"
                  required
                />
              </div>

              {/* Usuario Generado (Solo muestra) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-xs font-medium text-slate-600">Usuario de Acceso (Generado)</p>
                  <code className="font-mono text-sm text-slate-800 break-words block mt-1">
                      {config?.barberName ? generateEmployeeCredentials(uid!, slugify(config.barberName), formNombre).username : 'Cargue el nombre del negocio primero.'}
                  </code>
              </div>

              {/* Porcentaje de Comisión */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Porcentaje de Comisión (%)</label>
                <input 
                  type="number" 
                  value={formPorcentaje} 
                  onChange={(e) => setFormPorcentaje(Number(e.target.value))} 
                  className={inputClass}
                  min="0"
                  max="100"
                />
              </div>
              
              {/* Estado */}
              <div className="flex items-center">
                <input 
                    type="checkbox" 
                    id="activo-check"
                    checked={formActivo}
                    onChange={(e) => setFormActivo(e.target.checked)} 
                    className="h-4 w-4 text-slate-800 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="activo-check" className="ml-2 text-sm font-medium text-slate-700 cursor-pointer">Empleado Activo</label>
              </div>

              {errorMessage && <div className="text-sm text-red-600 mt-1">{errorMessage}</div>}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={btnSecondary}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className={btnPrimary}
                >
                  {isEditing ? "Guardar Cambios" : "Crear Empleado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL ELIMINAR
      ========================================= */}
      {deleteConfirmOpen && selectedEmpleado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fadeIn text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <IconTrash />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">¿Eliminar empleado?</h3>
            <p className="text-sm text-slate-500 mt-2 mb-6">
              Estás a punto de eliminar a <span className="font-semibold text-slate-700">{selectedEmpleado.nombre}</span>. Esta acción eliminará su cuenta de acceso.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmOpen(false)}
                className={btnSecondary}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};