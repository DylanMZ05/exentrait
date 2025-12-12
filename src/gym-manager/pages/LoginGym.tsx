import React, { useState, useCallback, useMemo } from 'react';

// Tipos básicos para las props que reemplazarán a la manipulación directa del DOM
interface LoginGymProps {
    onLogin: (email: string, password: string) => void;
    onOpenSignup: () => void;
    onForgetAccount: () => void;
    rememberedEmail?: string;
    rememberedPassword?: string;
    isAccountRemembered: boolean;
    onRememberChange: (checked: boolean) => void;
    // Estos son opcionales y solo para fines de demostración, la lógica de mensajes
    // y dropdown debería manejarse en el componente padre o un hook.
    loginError?: string; 
    loginMessageOk?: string;
    usersDropdown: string[]; // Emails para el dropdown
}

export const LoginGym: React.FC<LoginGymProps> = ({
    onLogin,
    onOpenSignup,
    onForgetAccount,
    rememberedEmail = '',
    rememberedPassword = '',
    isAccountRemembered,
    onRememberChange,
    loginError,
    loginMessageOk,
    usersDropdown = [],
}) => {
    const [email, setEmail] = useState(rememberedEmail);
    const [password, setPassword] = useState(rememberedPassword);
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Lógica de manejo de Login
    const handleLogin = useCallback(() => {
        onLogin(email, password);
    }, [email, password, onLogin]);

    // Manejo del Dropdown de Usuarios
    const filteredUsers = useMemo(() => {
        if (!email || email.length < 1) return usersDropdown;
        return usersDropdown.filter(u => u.toLowerCase().includes(email.toLowerCase()));
    }, [email, usersDropdown]);


    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        setShowDropdown(true);
        setHighlightedIndex(-1);
    };

    const selectEmail = (selectedEmail: string) => {
        setEmail(selectedEmail);
        setShowDropdown(false);
        setPassword(''); // Limpiar contraseña al seleccionar un email del dropdown por seguridad.
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (filteredUsers.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % filteredUsers.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        } else if (e.key === "Enter") {
            if (highlightedIndex >= 0) {
                e.preventDefault();
                selectEmail(filteredUsers[highlightedIndex]);
            } else {
                // Si no hay nada resaltado, permite el login si los campos están llenos
                handleLogin();
            }
        }
    };

    return (
        // Estructura principal, tal como en tu body de index.html
        <div className="bg-white p-8 rounded shadow-md w-96">
            <h1 className="text-2xl font-bold text-center mb-6 text-[#0f1c3f]">Login Exentra</h1>

            {/* EMAIL */}
            <div className="relative mb-4">
                <input 
                    id="email" 
                    type="email" 
                    placeholder="Correo electrónico"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoComplete="off" 
                    value={email}
                    onChange={handleEmailChange}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={handleKeyDown}
                    // Nota: El evento onBlur debe manejarse cuidadosamente para que no cierre el dropdown
                    // antes de que el usuario pueda hacer clic en una opción.
                />

                {/* Dropdown de usuarios (Migrado de usersDropdown) */}
                {showDropdown && filteredUsers.length > 0 && (
                    <div 
                        id="usersDropdown"
                        className="absolute z-10 bg-white border rounded shadow w-full mt-1 max-h-40 overflow-y-auto"
                    >
                        {filteredUsers.map((userEmail, index) => (
                            <div
                                key={userEmail}
                                className={`px-3 py-2 cursor-pointer hover:bg-blue-100 ${index === highlightedIndex ? 'bg-blue-200' : ''}`}
                                onClick={() => selectEmail(userEmail)}
                            >
                                {userEmail}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PASSWORD */}
            <input 
                id="password" 
                type="password" 
                placeholder="Contraseña"
                className="w-full mb-3 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
            />

            {/* RECORDAR CUENTA */}
            <div className="mb-1 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                    <input 
                        id="rememberAccount" 
                        type="checkbox" 
                        className="h-4 w-4"
                        checked={isAccountRemembered}
                        onChange={(e) => onRememberChange(e.target.checked)}
                    />
                    Recordar cuenta
                </label>

                <button 
                    id="btnForgetAccount"
                    className={`text-xs text-gray-500 hover:text-gray-800 underline ${isAccountRemembered ? '' : 'hidden'}`}
                    type="button"
                    onClick={onForgetAccount}
                >
                    Olvidar
                </button>
            </div>


            {/* LOGIN BUTTON */}
            <button 
                id="btnLogin"
                className="w-full bg-[#0f1c3f] hover:bg-blue-900 text-white p-2 rounded"
                onClick={handleLogin}
            >
                Iniciar sesión
            </button>

            {/* CTA CREAR CUENTA */}
            <div className="mt-4 text-center">
                <button 
                    id="btnOpenSignup" 
                    className="text-[#0f1c3f] hover:underline text-sm"
                    onClick={onOpenSignup}
                >
                    ¿No tenés cuenta? Crear cuenta
                </button>
            </div>

            {/* MENSAJES */}
            {loginError && (
                <p id="mensaje" className="text-red-600 text-sm mt-3">
                    {loginError}
                </p>
            )}
            
            {loginMessageOk && (
                <p id="mensajeOk" className="text-green-700 text-sm mt-3">
                    {loginMessageOk}
                </p>
            )}
        </div>
    );
};