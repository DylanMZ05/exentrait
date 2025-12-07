import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import flechaImg from "../../assets/flecha.png";

import { barberAuth, barberDb } from "../services/firebaseBarber";
import {
    loginBarberUser,
    registerBarberUser,
    sendBarberPasswordReset,
} from "../services/authService";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    Timestamp,
    setDoc,
    serverTimestamp
} from "firebase/firestore";
import React from "react";

// ==========================================================
// CONFIGURACIÓN DE PAGO
// ==========================================================
const API_BASE = "https://exentrait.com/api";
const PRECIO_TEST = 37500;

// ==========================================================
// CONSTANTE GLOBAL: Contraseña Maestra Fija
// ==========================================================
const DEFAULT_MASTER_PASSWORD = "Admin1234";

// --- TIPOS Y CONSTANTES ---
type Mode = "login" | "dni_login" | "register";

// Claves de localStorage
const LS_SLUG = 'barberSlug';
const LS_CREDENTIAL = 'barberCredential';
const LS_MODE = 'loginMode';
const LS_REMEMBER = 'rememberMe';
// 💡 CAMBIO: Nueva clave para guardar la contraseña
const LS_PASSWORD = 'barberPassword';

// Tipo de dato del documento de usuario para la suscripción
interface BarberUserData {
    activo?: boolean;
    fechaVencimiento?: Timestamp | Date | string | null;
}

// ------------------------------------------------------------------
// LÓGICA CRÍTICA: BÚSQUEDA DE OWNER POR SLUG
// ------------------------------------------------------------------
const findOwnerUidBySlug = async (barberSlug: string) => {
    const q = query(
        collection(barberDb, 'barber_config'),
        where('barberSlug', '==', barberSlug.trim().toLowerCase())
    );

    const snap = await getDocs(q);

    if (snap.empty) {
        throw new Error("Identificador de barbería no encontrado. Revisa el Slug.");
    }

    return snap.docs[0].id;
}


// ------------------------------------------------------------------
// LÓGICA DE AUTENTICACION EMPLEADO
// ------------------------------------------------------------------
const attemptEmployeeLogin = async (barberSlugInput: string, dniInput: string, passwordInput: string) => {

    if (passwordInput !== DEFAULT_MASTER_PASSWORD) {
        throw new Error("Contraseña Maestra incorrecta.");
    }

    const ownerUid = await findOwnerUidBySlug(barberSlugInput);

    localStorage.setItem('barberOwnerId', ownerUid);

    const q = query(
        collection(barberDb, `barber_users/${ownerUid}/empleados`),
        where('dni', '==', dniInput.trim()),
    );

    const employeeSnap = await getDocs(q);

    if (employeeSnap.empty) {
        throw new Error("DNI no encontrado para esta barbería.");
    }

    const employeeData = employeeSnap.docs[0].data();

    if (employeeData.activo === false) {
        throw new Error("Cuenta de empleado inactiva. Contacte al dueño.");
    }

    const internalEmail = employeeData.internalEmail as string;

    if (!internalEmail) {
        throw new Error('Error: Credenciales de empleado incompletas. Contacte al dueño.');
    }

    const userCredential = await signInWithEmailAndPassword(barberAuth, internalEmail, passwordInput);
    
    return userCredential;
};

// ------------------------------------------------------------------
// HELPERS DE SUSCRIPCIÓN Y CHEQUEO
// ------------------------------------------------------------------

function parseFechaVenc(data: BarberUserData): Date | null {
    if (!data || !data.fechaVencimiento) return null;

    if ((data.fechaVencimiento as Timestamp)?.toDate) {
        return (data.fechaVencimiento as Timestamp).toDate();
    }
    return new Date(data.fechaVencimiento as string | Date);
}

function isActivo(data: BarberUserData): boolean {
    if (!data) return false;
    const activo = data.activo === true;
    const venceDate = parseFechaVenc(data);

    if (!venceDate) return false;

    const hoyMs = Date.now();
    const venceMs = venceDate.getTime();

    return activo && hoyMs <= venceMs;
}

async function openExternalSystem(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
}

let payCheckInterval: number | null = null;

const checkSubscriptionStatus = async (uid: string) => {
    try {
        const docRef = doc(barberDb, 'usuariosAuth', uid);
        const snap = await getDoc(docRef);
        const data = snap.data() as BarberUserData;

        return isActivo(data);
    } catch (e) {
        console.warn("Error chequeando pago:", e);
        return false;
    }
}

const startPayAutoChecker = (uid: string, navigateToDashboard: () => void) => {
    if (payCheckInterval) clearInterval(payCheckInterval);

    payCheckInterval = setInterval(async () => {
        const isReady = await checkSubscriptionStatus(uid);
        if (isReady) {
            stopPayAutoChecker();
            navigateToDashboard();
        }
    }, 3000) as unknown as number;
}

const stopPayAutoChecker = () => {
    if (payCheckInterval) clearInterval(payCheckInterval);
    payCheckInterval = null;
}

// ------------------------------------------------------------------
// LÓGICA DE FUNCIÓN CF ELIMINADA (Ya no es necesaria)
// ------------------------------------------------------------------


export const Login: React.FC = () => {
    const [mode, setMode] = useState<Mode>("login");
    const [credential, setCredential] = useState("");
    const [barberSlug, setBarberSlug] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false);

    const [showPayModal, setShowPayModal] = useState(false);
    const [payMessage, setPayMessage] = useState<string | null>(null);
    const [payLink, setPayLink] = useState<string | null>(null);


    const navigate = useNavigate();
    const DASHBOARD_PATH = "/barber-manager/dashboard";
    const HOMEPAGE_PATH = "/"; // Ruta a la que queremos volver

    // 1. Carga de credenciales (Recordar cuenta)
    useEffect(() => {
        const savedRememberMe = localStorage.getItem(LS_REMEMBER) === 'true';

        if (savedRememberMe) {
            const savedSlug = localStorage.getItem(LS_SLUG);
            const savedCredential = localStorage.getItem(LS_CREDENTIAL);
            const savedMode = localStorage.getItem(LS_MODE);
            // 💡 CAMBIO: Cargamos también la contraseña guardada
            const savedPassword = localStorage.getItem(LS_PASSWORD);

            if (savedSlug) setBarberSlug(savedSlug);
            if (savedCredential) setCredential(savedCredential);
            if (savedMode) setMode(savedMode as Mode);
            // 💡 CAMBIO: Establecemos la contraseña si existe
            if (savedPassword) setPassword(savedPassword);
            setRememberMe(true);
        }
    }, []);

    // 2. Redirección (Logueado al cargar)
    useEffect(() => {
        const unsub = onAuthStateChanged(barberAuth, (user) => {
            if (user) {
                // Si el usuario no es un empleado interno, guarda su UID como dueño
                if (user.email && !user.email.includes('.internal')) {
                    localStorage.setItem('barberOwnerId', user.uid);
                }
            }
        });
        return () => unsub();
    }, [navigate]);

    // 3. Apertura del Modal de Pago
    const openPayModal = async (uid: string, email: string) => {
        setPayMessage(null);
        setShowPayModal(true);
        setPayLink(null);

        const navigateToDashboard = () => {
            setShowPayModal(false);
            navigate(DASHBOARD_PATH, { replace: true });
        };
        startPayAutoChecker(uid, navigateToDashboard);

        try {
            // Llamada a API externa para crear la preferencia de pago
            const res = await fetch(`${API_BASE}/create-preference-Barber.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid,
                    email,
                    amount: PRECIO_TEST,
                    description: "Barber App - Test de activación de días"
                })
            });

            const data = await res.json();

            // Validación de respuesta de la API externa
            if (!res.ok || !data?.id || !data.init_point) {
                throw new Error(data?.error || `Error creando preferencia (${res.status}).`);
            }

            setPayLink(data.init_point);

        } catch (err: any) {
            console.error(err);
            setPayMessage(`Error al preparar el pago: ${err.message || 'Failed to fetch (Problema de red/CORS)'}`);
            stopPayAutoChecker();
        }
    };


    const handleLogin = async () => {
        // Lógica de login para empleado (DNI + Contraseña Maestra)
        if (mode === "dni_login") {
            return attemptEmployeeLogin(barberSlug, credential, password);
        }

        // Lógica de login para dueño (Email + Contraseña)
        return loginBarberUser(credential, password);
    };


    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setSubmitting(true);

        try {
            if (mode === "register") {
                // ----------------------------------------------------
                // FLUJO DE REGISTRO (100% CLIENTE)
                // ----------------------------------------------------
                // 1. Registrar usuario en Firebase Auth
                const userCredential = await registerBarberUser(credential, password);
                const uid = userCredential.user.uid;
                const email = userCredential.user.email || credential;

                // 🛑 2. CREAR EL DOCUMENTO INICIAL EN FIRESTORE (LADO DEL CLIENTE)
                // El cliente intenta crear el documento de suscripción directamente.
                const docRef = doc(barberDb, 'usuariosAuth', uid);

                // Crea un documento con suscripción vencida A YER para forzar el pago.
                const vencidoAyer = new Date(Date.now() - 24 * 60 * 60 * 1000);

                try {
                    await setDoc(docRef, {
                        uid,
                        email: email.toLowerCase(),
                        activo: false,
                        lastPaymentDate: Timestamp.fromDate(vencidoAyer),
                        fechaVencimiento: Timestamp.fromDate(vencidoAyer),
                        creadoEn: serverTimestamp(),
                        origen: "register-client-side-vencido"
                    });
                } catch (dbError: any) {
                    // Si falla la creación del documento (ej. Reglas de Seguridad), eliminamos el usuario de Auth
                    console.error("Fallo la creación del documento en Firestore (Reglas/Conexión):", dbError);
                    setError(`Error crítico al crear el documento inicial. Revisa las reglas de seguridad. ${dbError.message}`);
                    await signOut(barberAuth);
                    setSubmitting(false);
                    return;
                }

                // 3. Cerrar sesión de registro
                await signOut(barberAuth);

                setMessage("Cuenta creada correctamente. Ya podés ingresar.");
                setMode("login");
                return;
            }

            // ----------------------------------------------------
            // LÓGICA DE LOGIN (DUEÑO O EMPLEADO)
            // ----------------------------------------------------
            const userCredential = await handleLogin();
            const uid = userCredential.user.uid;
            const email = userCredential.user.email || credential;

            // ----------------------------------------------------
            // LÓGICA DE CHEQUEO DE SUSCRIPCIÓN (SOLO DUEÑO)
            // ----------------------------------------------------
            if (mode === "login") { // 🔑 Solo chequear suscripción para el modo DUEÑO
                const docRef = doc(barberDb, 'usuariosAuth', uid);
                const snap = await getDoc(docRef);

                // Flujo de Migración/Creación Rápida si el documento no existe
                if (!snap.exists) {
                    // Crea un documento con suscripción vencida ayer para forzar el pago.
                    const vencidoAyer = new Date(Date.now() - 24 * 60 * 60 * 1000);

                    try {
                        await setDoc(docRef, {
                            uid,
                            email: email.toLowerCase(),
                            activo: false,
                            lastPaymentDate: Timestamp.fromDate(vencidoAyer),
                            fechaVencimiento: Timestamp.fromDate(vencidoAyer),
                            creadoEn: serverTimestamp(),
                            origen: "login-migrado"
                        });
                    } catch(e) {
                        console.error("Fallo la migración en el login:", e);
                        setError("Error crítico: El administrador debe migrar las cuentas manualmente (Admin Panel -> Migración).");
                        setSubmitting(false);
                        return;
                    }

                    setError(`Tu cuenta fue migrada pero requiere activación. Debes activar el servicio.`);
                    await openPayModal(uid, email);
                    setSubmitting(false);
                    return;
                }

                const data = snap.data() as BarberUserData;

                // Chequeo de estado de suscripción
                if (!isActivo(data)) {
                    const fv = parseFechaVenc(data);
                    const causa = fv
                        ? `Tu suscripción venció el ${fv.toLocaleDateString()}.`
                        : "Tu suscripción no está activa.";

                    setError(`${causa} Debes activar el servicio.`);

                    await openPayModal(uid, email);
                    setSubmitting(false);
                    return;
                }
            }
            // ----------------------------------------------------

            // LÓGICA CLAVE: Guardar credenciales si el login fue exitoso y activo
            // Si es EMPLEADO (mode === "dni_login"), forzar el guardado (mantener cuenta abierta)
            if (rememberMe || mode === "dni_login") { 
                localStorage.setItem(LS_REMEMBER, 'true');
                localStorage.setItem(LS_SLUG, barberSlug);
                localStorage.setItem(LS_CREDENTIAL, credential);
                localStorage.setItem(LS_MODE, mode);
                // 💡 CAMBIO: Guardar la contraseña
                localStorage.setItem(LS_PASSWORD, password);
            } else {
                // Limpiar si no se selecciona "Recordar cuenta" (Solo Dueño)
                localStorage.removeItem(LS_REMEMBER);
                localStorage.removeItem(LS_SLUG);
                localStorage.removeItem(LS_CREDENTIAL);
                localStorage.removeItem(LS_MODE);
                // 💡 CAMBIO: Eliminar la contraseña
                localStorage.removeItem(LS_PASSWORD);
            }

            // 🥳 NAVEGACIÓN EXITOSA
            navigate(DASHBOARD_PATH, { replace: true });

        } catch (err: any) {
            console.error(err);

            // Limpieza en caso de error
            localStorage.removeItem(LS_REMEMBER);
            // 💡 CAMBIO: Limpiar la contraseña en caso de error
            localStorage.removeItem(LS_PASSWORD);
            setRememberMe(false);

            let displayError = "Credenciales incorrectas. Intente de nuevo.";

            // Manejo de errores específicos
            if (mode === "dni_login") {
                const firebaseMessage = err.message || '';

                if (firebaseMessage.includes('Missing or insufficient permissions') || firebaseMessage.includes('The query requires an index') || firebaseMessage.includes('FirebaseError: ')) {
                    displayError = `Error de conexión: No se pudo verificar el DNI. <br>Asegúrate de tener los **índices de Firestore** configurados.`;
                } else {
                    displayError = firebaseMessage;
                }
            } else if (err.code === "auth/invalid-email") {
                displayError = "Formato de email inválido (Dueño/Registro).";
            } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
                displayError = "Credenciales incorrectas.";
            } else {
                // Si la CF fue la que falló, ahora el error vendrá de la creación directa del documento o de Auth
                displayError = err.message || displayError;
            }

            setError(displayError);

        } finally {
            if (!showPayModal) setSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        setError(null);
        setMessage(null);

        if (!credential || mode !== "login") {
            setError("Ingresá el email de tu cuenta principal (Dueño).");
            return;
        }

        try {
            await sendBarberPasswordReset(credential);
            setMessage(
                "Si el email existe, te enviamos un correo para restablecer la contraseña."
            );
        } catch (err: any) {
            console.error(err);
            setError("No pudimos enviar el correo. Revisá el email o intentalo luego.");
        }
    };

    const inputPlaceholder = mode === "dni_login" ?
        "DNI / Documento" :
        "Email (ej: dueño@email.com)";

    const credentialLabel = mode === "dni_login" ? "DNI / Documento" : "Email";

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            {/* Flecha ahora apuntando hacia la derecha y con texto */}
            <Link 
                to={HOMEPAGE_PATH} 
                className="absolute top-4 left-4 p-2 rounded-full bg-white/80 shadow-md hover:bg-white transition-colors flex items-center space-x-2"
                title="Volver a la página principal"
            >
                {/* 1. Imagen rotada 180 grados */}
                <img 
                    src={flechaImg} 
                    alt="Página Principal" 
                    className="w-5 h-5" 
                />
                {/* 2. Texto "Página Principal" */}
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                    Página Principal
                </span>
            </Link>
            {/* -------------------------------------- */}
            
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
                        onClick={() => { setMode("login"); setError(null); setMessage(null); setCredential(""); setPassword(""); setBarberSlug(""); }}
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
                        onClick={() => { setMode("dni_login"); setError(null); setMessage(null); setCredential(""); setPassword(""); setBarberSlug(""); }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            mode === "dni_login"
                                ? "bg-gray-900 text-white"
                                : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                        Empleado (DNI)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode("register"); setError(null); setMessage(null); setCredential(""); setPassword(""); setBarberSlug(""); }}
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

                    {/* CAMPO SLUG (Solo para Empleado) */}
                    {mode === "dni_login" && (
                        <div>
                            <label className="block text-xs font-medium mb-1">
                                Identificador de Barbería (Slug)
                            </label>
                            <input
                                type="text"
                                required
                                value={barberSlug}
                                onChange={(e) => setBarberSlug(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                                placeholder="Ej: mi-barberia-123"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Necesitas el Slug que el dueño configuró en la sección Configuración.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium mb-1">
                            {credentialLabel}
                        </label>
                        <input
                            type="text"
                            required
                            value={credential}
                            onChange={(e) => setCredential(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                            placeholder={inputPlaceholder}
                            autoComplete={mode === "dni_login" ? "username" : "email"}
                        />
                        {mode === "dni_login" && (
                            <p className="text-xs text-gray-500 mt-1">
                                Ingrese solo su número de documento.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">
                            Contraseña {mode === "dni_login" && `(Maestra)`}
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                            autoComplete={mode === "dni_login" ? "current-password" : "off"}
                        />
                    </div>

                    {error && <p className="text-xs text-red-500 mt-1" dangerouslySetInnerHTML={{__html: error}}></p>}
                    {message && <p className="text-xs text-green-600 mt-1">{message}</p>}

                    <div className="flex justify-between items-center text-xs">
                        <label className="flex items-center space-x-2 text-gray-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500 cursor-pointer"
                            />
                            <span>Recordar cuenta</span>
                        </label>

                        {mode !== "dni_login" && mode !== "register" && (
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
                            ? "Cargando..."
                            : mode === "register"
                            ? "Crear cuenta"
                            : "Ingresar"}
                    </button>
                </form>

                <p className="mt-4 text-[11px] text-gray-400 text-center">
                    El modo Empleado (DNI) ya no requiere el login del dueño en este dispositivo.
                </p>
            </div>

            {showPayModal && (
                <div id="payModal" className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Activar suscripción</h2>
                            <button
                                onClick={() => { stopPayAutoChecker(); setShowPayModal(false); signOut(barberAuth); }}
                                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-700">
                                Tu suscripción no está activa. Activala ahora con el pago de prueba.
                            </p>

                            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                                <div className="flex items-center justify-between">
                                    <span>Precio de Prueba</span>
                                    <strong id="priceLabel" className="text-gray-900">AR$ {PRECIO_TEST.toLocaleString("es-AR")}</strong>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    * Este pago activa la cuenta por 30 días (para pruebas).
                                </p>
                            </div>

                            <div id="wallet_container" className="w-full">
                                {payLink ? (
                                    <>
                                        <button
                                            onClick={() => openExternalSystem(payLink)}
                                            className="w-full text-center bg-[#009ee3] hover:bg-[#007fba] text-white px-4 py-3 rounded font-medium block"
                                        >
                                            Pagar con Mercado Pago
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-center text-sm text-gray-500">Preparando el checkout...</div>
                                )}
                            </div>

                            {payMessage && <p className="text-sm mt-2 text-red-600">{payMessage}</p>}
                        </div>

                        <div className="p-4 border-t flex justify-end">
                            <button
                                onClick={() => { stopPayAutoChecker(); setShowPayModal(false); signOut(barberAuth); }}
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
                            >
                                Cancelar / Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};