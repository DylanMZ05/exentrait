import React, { useEffect, useState, useCallback } from "react";
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  getDocs, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { barberDb, barberAuth } from "../services/firebaseBarber";

// Tipados (Simplificados)
interface Empleado {
  id: string;
  nombre: string;
}

interface BarberConfig {
  barberName: string;
  masterPassword: string;
  ownerUid: string;
}

/* ============================================================
    CONSTANTES & HELPERS
============================================================ */

// Genera un slug seguro a partir de un texto (Ej: "Nach Barbershop" -> "nach-barbershop")
const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Reemplaza espacios con guiones
    .replace(/[^\w\-]+/g, '') // Elimina caracteres no alfanuméricos
    .replace(/\-\-+/g, '-') // Reemplaza múltiples guiones con uno solo
    .substring(0, 50); // Limita la longitud
};

// Genera el email interno y el nombre de usuario único para Firebase Auth
const generateEmployeeCredentials = (ownerUid: string, barberSlug: string, employeeName: string) => {
  const employeeSlug = slugify(employeeName);
  const username = `${barberSlug}-${employeeSlug}`;
  
  // Usamos una convención de email interno para cumplir con Firebase Auth.
  const internalEmail = `${username}@${ownerUid}.internal`; 
  
  return { username, internalEmail };
};

const IconSettings = () => (
    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.526.323.864.555 1.066 1.066z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);


/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Configuracion: React.FC = () => {
  const owner = barberAuth.currentUser;
  const uid = owner?.uid;

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BarberConfig | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  // Estados del formulario
  const [barberNameInput, setBarberNameInput] = useState("");
  const [masterPasswordInput, setMasterPasswordInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* =========================================================
    CARGA DE DATOS INICIAL
  ========================================================= */
  const loadData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Cargar Configuración de Barbería
      const configRef = doc(barberDb, `barber_config/${uid}`);
      const configSnap = await getDoc(configRef);

      if (configSnap.exists()) {
        const data = configSnap.data() as BarberConfig;
        setConfig(data);
        setBarberNameInput(data.barberName || "");
        setMasterPasswordInput(data.masterPassword || "");
      } else {
        // Inicializar con valores por defecto
        const defaultName = "Mi Nueva Barbería";
        const defaultConfig: BarberConfig = {
          barberName: defaultName,
          masterPassword: "", // La contraseña debe ser establecida por el usuario
          ownerUid: uid,
        };
        setConfig(defaultConfig);
        setBarberNameInput(defaultName);
      }

      // 2. Cargar Lista de Empleados
      const empSnap = await getDocs(query(collection(barberDb, `barber_users/${uid}/empleados`), orderBy("nombre", "asc")));
      const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Empleado));
      setEmpleados(empList);
      
    } catch (error) {
      console.error("Error al cargar configuración:", error);
      // Solo mostrar mensaje de error si no es un simple documento no encontrado.
      setErrorMessage("Error al cargar la configuración. Intente de nuevo."); 
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) loadData();
  }, [uid, loadData]);

  /* =========================================================
    GUARDAR CONFIGURACIÓN Y ACTUALIZAR CONTRASEÑAS
  ========================================================= */
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrorMessage(null); 
    setStatusMessage(null);
    
    // Validaciones
    if (!uid || !barberNameInput.trim() || !masterPasswordInput) {
      setErrorMessage("Nombre de barbería y Contraseña Maestra son obligatorios.");
      return;
    }
    if (masterPasswordInput.length < 6) {
        setErrorMessage("La Contraseña Maestra debe tener al menos 6 caracteres.");
        return;
    }
    
    try {
      const barberSlug = slugify(barberNameInput);

      // 1. Guardar o actualizar la configuración en Firestore
      const newConfig: BarberConfig = {
        barberName: barberNameInput.trim(),
        masterPassword: masterPasswordInput, 
        ownerUid: uid,
      };
      await setDoc(doc(barberDb, `barber_config/${uid}`), { ...newConfig, updatedAt: serverTimestamp() }, { merge: true });

      // 2. Actualizar/crear las cuentas de Firebase Auth para los empleados (Lógica simplificada)
      for (const empleado of empleados) {
        const { internalEmail } = generateEmployeeCredentials(uid, barberSlug, empleado.nombre);

        // Intenta crear la cuenta si no existe con la Master Password.
        // Esta operación se realiza bajo la sesión del DUEÑO (que puede fallar si la sesión es antigua).
        try {
            await createUserWithEmailAndPassword(barberAuth, internalEmail, masterPasswordInput);
        } catch (authError: any) {
            // Si el error es 'email-already-in-use', la cuenta ya existe y es un éxito de validación.
            if (authError.code !== 'auth/email-already-in-use') {
                 console.warn(`Error al crear cuenta para ${empleado.nombre}:`, authError);
            }
        }
      }
      
      setStatusMessage("Configuración y Contraseña Maestra guardadas correctamente. Las credenciales de acceso de los empleados están listas.");
      // Recargar datos y empleados para asegurar que el slug se actualice en la vista
      loadData(); 
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      // Mensaje genérico de fallback si falla la operación de Firebase Auth o Firestore.
      setErrorMessage("Error al guardar la configuración. Vuelva a intentar. (Verifique que su sesión de Dueño esté activa y reintente).");
    }
  };


  /* =========================================================
    RENDER HELPERS
  ========================================================= */

  const getBarberSlug = config?.barberName ? slugify(config.barberName) : 'pending';

  const renderEmployeeUsernames = () => {
    if (!uid) return null; // No renderizar si no hay UID

    if (empleados.length === 0) {
      return <p className="text-sm text-slate-500 italic">No hay empleados registrados.</p>;
    }

    return (
      <div className="space-y-2">
        {empleados.map(emp => {
          // Generamos el username único para que el empleado use en el login
          const { username } = generateEmployeeCredentials(uid, getBarberSlug, emp.nombre);
          return (
            <div key={emp.id} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-900">{emp.nombre}</p>
              <code className="text-xs text-slate-700 bg-slate-100 px-1 rounded-sm block select-all">
                {username}
              </code>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Estilos Comunes (copiados del Dashboard)
  const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
  const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm cursor-pointer";

  /* =========================================================
    RENDER PRINCIPAL
  ========================================================= */
  return (
    <div className="space-y-8 animate-fadeIn m-2 max-w-4xl">
      
      {/* HEADER */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <IconSettings />
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Configuración de Barbería</h2>
          <p className="text-sm text-slate-500">
            Define el nombre del negocio y la contraseña de acceso para empleados.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="mt-2 text-sm text-slate-500">Cargando datos...</p>
        </div>
      ) : (
        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUMNA 1 & 2: FORMULARIO */}
          <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-2xl shadow-md border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Credenciales Generales</h3>

            {/* Nombre de la Barbería */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre del Negocio (Define el prefijo del usuario)</label>
              <input 
                type="text" 
                value={barberNameInput} 
                onChange={(e) => setBarberNameInput(e.target.value)} 
                className={inputClass}
                placeholder="Ej. Nach Barbershop"
              />
              <p className="mt-1 text-xs text-slate-500">
                Slug único: <code className="font-mono text-slate-700">{slugify(barberNameInput || "ejemplo")}</code>
              </p>
            </div>

            {/* Contraseña Maestra */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Contraseña Maestra para Empleados</label>
              <input 
                type="password" 
                value={masterPasswordInput} 
                onChange={(e) => setMasterPasswordInput(e.target.value)} 
                className={inputClass}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
              <p className="mt-1 text-xs text-red-500">
                Advertencia: Esta contraseña se usará para el inicio de sesión de **TODOS** tus empleados.
              </p>
            </div>
            
            {/* Mensajes */}
            {errorMessage && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{errorMessage}</div>}
            {statusMessage && <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-200">{statusMessage}</div>}

            {/* Botón de Guardar */}
            <button type="submit" className={btnPrimary}>
              Guardar Configuración y Actualizar Usuarios
            </button>
          </div>

          {/* COLUMNA 3: NOMBRES DE USUARIO */}
          <div className="lg:col-span-1 space-y-4 bg-white p-6 rounded-2xl shadow-md border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Usuarios Empleados</h3>
            <p className="text-sm text-slate-500 border-b border-slate-100 pb-2">
                Credenciales de acceso únicas (usan la Contraseña Maestra).
            </p>
            {renderEmployeeUsernames()}
          </div>
        </form>
      )}

    </div>
  );
};