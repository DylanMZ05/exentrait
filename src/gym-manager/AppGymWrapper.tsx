import React, { useState, useEffect, useCallback } from 'react'; 
import { type User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'; 
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'; 

// --- IMPORTACIONES ---
import { auth } from '../../firebase';
import { Header } from './components/Header'; 
import { LoginGym } from './pages/LoginGym.tsx'; 
import { GymDashboard } from './pages/GymDashboard.tsx'; 
import { Clients } from './pages/Clients.tsx';

// 🚨 IMPORTACIONES NUEVAS 🚨
import { OverdueClients } from './pages/OverdueClients'; 
import { Ventas } from './pages/Ventas'; 

const HEADER_HEIGHT_PX = 60; 
const APP_BASE_PATH = '/app-gym'; 
const LOGIN_PATH = `${APP_BASE_PATH}/login`; // Definimos la ruta de login como /app-gym/login

// ----------------------------------------------------------------------
// COMPONENTE PRINCIPAL (Autenticación con Debug y Fix)
// ----------------------------------------------------------------------

export const AppGymWrapper: React.FC = () => {
    // ESTADOS DE AUTENTICACIÓN
    const [currentUser, setCurrentUser] = useState<User | null>(null); 
    const [loadingAuth, setLoadingAuth] = useState(true); 
    
    const navigate = useNavigate();
    const location = useLocation(); 
    
    // ESTADO DEL MODAL DE REGISTRO
    const [showSignupModal, setShowSignupModal] = useState(false); 

    const [loginError, setLoginError] = useState("");
    const [loginMessageOk] = useState("");
    
    if (showSignupModal) {
        console.log("[FLOW DEBUG] Modal de registro activado (estado: true)."); 
    }
    
    // HANDLER DE LOGIN (Implementación REAL de Firebase)
    const handleLogin = useCallback(async (email: string, password: string) => { 
        console.log(`[LOGIN DEBUG] Intentando login para: ${email}`);
        setLoginError("");
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("[LOGIN DEBUG] Login exitoso. Esperando onAuthStateChanged...");
            // Si tiene éxito, onAuthStateChanged se dispara y redirige. 
        } catch (error) {
            console.error("[LOGIN DEBUG] Login fallido:", error);
            setLoginError("Credenciales inválidas o usuario no encontrado.");
        }
    }, []);

    // HANDLER DE LOGOUT (Implementación REAL de Firebase)
    const handleLogout = useCallback(async () => { 
        console.log("[LOGOUT DEBUG] Intentando cerrar sesión...");
        try {
            await signOut(auth);
            console.log("[LOGOUT DEBUG] Sesión cerrada. Esperando onAuthStateChanged...");
            // Al cerrar sesión, forzamos la navegación al login.
            navigate(LOGIN_PATH, { replace: true }); 
        } catch (error) {
            console.error("[LOGOUT DEBUG] Error al cerrar sesión:", error);
            navigate(LOGIN_PATH, { replace: true }); 
        }
    }, [navigate]);
    
    const handleNavigate = useCallback((href: string) => { 
        navigate(href); 
    }, [navigate]);

    // EFECTO DE AUTENTICACIÓN (Detecta cambios de login/logout y redirige)
    useEffect(() => { 
        console.log("[AUTH LIFECYCLE] Suscribiéndose a onAuthStateChanged...");
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            
            setCurrentUser(user);
            setLoadingAuth(false);
            
            const currentPath = location.pathname;
            const userIsAuthenticated = !!user;
            
            // 🚨 DEBUG: Muestra el estado actual y la ruta
            console.log(`[AUTH DEBUG] EVENTO FIREBASE | User: ${userIsAuthenticated ? 'LOGUEADO' : 'NULL'} | Path: ${currentPath} | Loading: false`);


            // 1. Si hay usuario y está en el login, lo enviamos a Home.
            if (userIsAuthenticated && currentPath === LOGIN_PATH) {
                console.log(`[AUTH DEBUG] REDIRIGIENDO (1): Usuario Logueado desde LOGIN -> ${APP_BASE_PATH}/home.`);
                navigate(`${APP_BASE_PATH}/home`, { replace: true });
            } 
            // 2. Si NO hay usuario y está intentando acceder a una ruta protegida, lo enviamos al Login.
            // Añadimos la condición de que NO esté ya en la página de login para evitar un loop de redirección.
            else if (!userIsAuthenticated && currentPath.startsWith(APP_BASE_PATH) && currentPath !== LOGIN_PATH) {
                console.log(`[AUTH DEBUG] REDIRIGIENDO (2): Usuario NULL en ruta protegida -> ${LOGIN_PATH}.`);
                navigate(LOGIN_PATH, { replace: true });
            }
            // 3. Manejar la ruta raiz (/) si no está logueado
            else if (!userIsAuthenticated && currentPath === '/') {
                console.log(`[AUTH DEBUG] REDIRIGIENDO (3): Usuario NULL en ruta raiz ('/') -> ${LOGIN_PATH}.`);
                navigate(LOGIN_PATH, { replace: true });
            }
        });
        return () => {
            console.log("[AUTH LIFECYCLE] Desuscribiéndose de onAuthStateChanged...");
            unsubscribe();
        }
    }, [navigate, location.pathname]);


    // --- Renderizado Principal ---

    if (loadingAuth) {
        console.log("[RENDER DEBUG] Mostrando pantalla de 'Cargando autenticación...'");
        return (
            <div className="bg-gray-100 flex items-center justify-center h-screen">
                <div className="text-[#0f1c3f]">Cargando autenticación...</div>
            </div>
        );
    }
    
    // Si no hay usuario y estamos en la ruta de login, mostramos el formulario
    if (!currentUser && location.pathname === LOGIN_PATH) {
        console.log("[RENDER DEBUG] Usuario NULL en ruta de Login. Mostrando formulario...");
        return (
            <div className="bg-gray-100 flex items-center justify-center h-screen">
                <LoginGym 
                    onLogin={handleLogin}
                    onOpenSignup={() => setShowSignupModal(true)}
                    onForgetAccount={() => {}}
                    onRememberChange={() => {}} 
                    rememberedEmail={""} 
                    rememberedPassword={""} 
                    isAccountRemembered={false}
                    loginError={loginError} 
                    loginMessageOk={loginMessageOk} 
                    usersDropdown={[]} 
                />
            </div>
        );
    }
    
    // Si no hay usuario Y NO estamos en la ruta de login, no renderizamos nada,
    // ya que el useEffect debería haber redirigido o lo hará en breve.

    if (currentUser) {
        console.log("[RENDER DEBUG] Usuario Logueado. Mostrando rutas protegidas...");
        return (
            <div className="flex flex-col h-screen w-full bg-[#f5f7fb]">
                
                {/* 1. Header Fijo */}
                <Header 
                    onLogout={handleLogout} 
                    onNavigate={handleNavigate} 
                    currentPath={location.pathname.replace(APP_BASE_PATH, '')}
                />
                
                {/* 2. Contenido Principal */}
                <div 
                    className="flex-1 flex flex-col overflow-hidden"
                    style={{ paddingTop: `${HEADER_HEIGHT_PX}px` }}
                >
                    <main className="flex-1 overflow-y-auto">
                        
                        {/* ENRUTAMIENTO */}
                        <Routes>
                            
                            <Route path={`home`} element={<GymDashboard user={currentUser} onLogout={handleLogout} />} />
                            
                            {/* Añadimos redirección de /app-gym/login A home si está logueado */}
                            <Route path={`login`} element={<Navigate to={`/app-gym/home`} replace />} />
                            
                            <Route path={`clientes`} element={<Clients user={currentUser} onLogout={handleLogout} />} />
                            <Route path={`clientes/:slug`} element={<Clients user={currentUser} onLogout={handleLogout} />} />

                            <Route path={`vencidos`} element={<OverdueClients user={currentUser} />} />

                            <Route path={`ventas`} element={<Ventas user={currentUser} onLogout={handleLogout} />} />

                            {/* Fallback de Prefijo (Ej: /app-gym) */}
                            <Route path="/" element={<Navigate to={`/app-gym/home`} replace />} />

                            {/* Fallback PROTEGIDO (Ej: /app-gym/ruta-inexistente) */}
                            <Route path="*" element={<Navigate to={`/app-gym/home`} replace />} />

                        </Routes>
                        
                    </main>
                </div>
            </div>
        );
    }

    // Si llegamos a este punto y el usuario no está logueado, y no estamos en la ruta de login,
    // no renderizamos nada para que el useEffect tenga tiempo de redirigir al login (Líneas 97 y 103).
    return null; 
};