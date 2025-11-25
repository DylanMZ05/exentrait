import { useEffect, useState } from "react";
import type { FormEvent } from "react"; 
import { useLocation, useNavigate } from "react-router-dom";
import { barberAuth, barberDb } from "../services/firebaseBarber";
import {
  loginBarberUser,
  registerBarberUser,
  sendBarberPasswordReset,
} from "../services/authService";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore"; 
import React from "react"; 

// --- TIPOS Y CONSTANTES ---
type Mode = "login" | "employee" | "register"; 

interface LocationState {
  from?: {
    pathname: string;
  };
}


// ------------------------------------------------------------------
// LÓGICA DE AUTENTICACION EMPLEADO (Multi-Tenant Segura)
// ------------------------------------------------------------------
const attemptEmployeeLogin = async (usernameInput: string, passwordInput: string) => {
    
    // 1. Validar el formato de usuario: debe ser slug-nombre (Ej: nach-barbershop-lean)
    const parts = usernameInput.toLowerCase().trim().split('-');
    if (parts.length < 2) {
        throw new Error("Formato de usuario incorrecto. Use el prefijo del negocio y su nombre (ej: negocio-empleado).");
    }
    
    // Última parte es el nombre del empleado
    const employeeNameSlug = parts.pop(); 
    // El prefijo es el resto (ej: nach-barbershop)
    const barberSlugPrefix = parts.join('-'); 

    // 2. BUSCAR EL UID DEL DUEÑO (Requiere la colección 'barber_config' / 'slug_map')
    // Asumimos que el DUEÑO guarda su UID como ID del documento de configuración.
    const configRef = doc(barberDb, `barber_config/${barberSlugPrefix}`); 
    const configSnap = await getDoc(configRef);
    
    if (!configSnap.exists() || !configSnap.data()?.ownerUid) {
        throw new Error("El prefijo del negocio no es reconocido. Verifique la credencial.");
    }
    
    const ownerUid = configSnap.data()!.ownerUid as string;
    
    // 3. CONSTRUIR EMAIL INTERNO Y AUTENTICAR
    const internalEmail = `${barberSlugPrefix}-${employeeNameSlug}@${ownerUid}.internal`; 

    try {
        const userCredential = await signInWithEmailAndPassword(barberAuth, internalEmail, passwordInput);
        return userCredential;
    } catch (firebaseError: any) {
        if (firebaseError.code === "auth/invalid-credential" || firebaseError.code === "auth/user-not-found") {
            throw new Error("Usuario o Contraseña Maestra incorrecta.");
        }
        throw firebaseError; 
    }
};

// ------------------------------------------------------------------


export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(""); // Usado como Email (Dueño) o Username (Empleado)
  const [password, setPassword] = useState(""); 
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Nuevo estado para Recordar Cuenta
  const [rememberMe, setRememberMe] = useState(false); 

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | undefined;
  const from = state?.from?.pathname || "/barber-manager";

  // Si ya está logueado, ir directo al dashboard
  useEffect(() => {
    const unsub = onAuthStateChanged(barberAuth, (user) => {
      if (user) {
        navigate(from, { replace: true });
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (mode === "employee") {
        // La lógica de empleado ahora busca el OwnerUID y construye el email interno.
        return attemptEmployeeLogin(email, password); 
    } 
    
    // Lógica de dueño/login normal
    return loginBarberUser(email, password);
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === "register") {
        await registerBarberUser(email, password);
        setMessage("Cuenta creada correctamente. Ya podés ingresar.");
        setMode("login");
        return;
      }
      
      // Manejar Login de Dueño/Empleado
      await handleLogin();
      
      navigate(from, { replace: true });
      
    } catch (err: any) {
      console.error(err);
      
      let displayError = "Credenciales incorrectas. Intente de nuevo.";
      
      // Manejo de errores específicos
      if (mode === "employee") {
           displayError = err.message || "Error al autenticar empleado.";
      } else if (err.code === "auth/invalid-email") {
          displayError = "Formato de email inválido (Dueño/Registro).";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          displayError = "Credenciales incorrectas.";
      }
      
      setError(displayError);

    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setMessage(null);

    // Solo permitir reset si es modo Dueño
    if (!email || mode !== "login") { 
      setError("Ingresá el email de tu cuenta principal (Dueño).");
      return;
    }

    try {
      await sendBarberPasswordReset(email);
      setMessage(
        "Si el email existe, te enviamos un correo para restablecer la contraseña."
      );
    } catch (err: any) {
      console.error(err);
      setError("No pudimos enviar el correo. Revisá el email o intentalo luego.");
    }
  };

  const inputPlaceholder = mode === "employee" ? 
    "negocio-usuario (Ej: nach-barbershop-lean)" : 
    "Email (ej: dueño@email.com)";
    
  const emailLabel = mode === "employee" ? "Usuario/Cód. Empleado" : "Email";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6">
        <h1 className="text-xl font-semibold mb-1 col-span-3 text-center">
          Barber Manager
        </h1>
        <p className="text-xs text-gray-500 mb-4 col-span-3 text-center">
          Ingresá o creá tu cuenta para gestionar tu barbería
        </p>

        {/* =======================================
            BARRA DE NAVEGACIÓN (Dueño | Empleado | Crear Cuenta)
        ======================================== */}
        <div className="flex mb-4 border border-gray-200 rounded-md overflow-hidden divide-x divide-gray-200">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); setMessage(null); setEmail(""); setPassword(""); }} // CORRECCIÓN: Resetear campos
            className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
              mode === "login"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Dueño
          </button>
          <button
            type="button"
            onClick={() => { setMode("employee"); setError(null); setMessage(null); setEmail(""); setPassword(""); }} // CORRECCIÓN: Resetear campos
            className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
              mode === "employee"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Empleado
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); setMessage(null); setEmail(""); setPassword(""); }} // CORRECCIÓN: Resetear campos
            className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
              mode === "register"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* =======================================
            FORMULARIO DE AUTENTICACIÓN
        ======================================== */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              {emailLabel}
            </label>
            <input
              type="text" // Usamos type="text" para asegurar que el username no sea validado como email por el navegador
              required
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder={inputPlaceholder}
              autoComplete={mode === "employee" ? "username" : "email"}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Contraseña {mode === "employee" && "(Maestra)"}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
              autoComplete={mode === "employee" ? "current-password" : "off"}
            />
          </div>

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          {message && <p className="text-xs text-green-600 mt-1">{message}</p>}

          {/* Opciones Adicionales y Botones de Login */}
          <div className="flex justify-between items-center text-xs">
            {/* Checkbox Recordar Cuenta */}
            <label className="flex items-center space-x-2 text-gray-600 cursor-pointer">
                <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500 cursor-pointer"
                />
                <span>Recordar cuenta</span>
            </label>

            {/* Olvidé mi Contraseña */}
            {mode !== "employee" && mode !== "register" && (
                <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
                >
                    Olvidé mi contraseña
                </button>
            )}
          </div>


          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-1 text-sm font-medium px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-black transition disabled:opacity-60 cursor-pointer"
          >
            {submitting
              ? "Ingresando..."
              : mode === "register"
              ? "Crear cuenta"
              : "Ingresar"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-gray-400 text-center">
          Más adelante vamos a agregar fecha de vencimiento y otros
          controles como en el Gym Manager.
        </p>
      </div>
    </div>
  );
};