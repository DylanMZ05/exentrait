// src/barber-manager/pages/Login.tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react"; // ERROR TS1484 CORREGIDO: Importar FormEvent como tipo
import { useLocation, useNavigate } from "react-router-dom";
import { barberAuth } from "../services/firebaseBarber";
import {
  loginBarberUser,
  registerBarberUser,
  sendBarberPasswordReset,
} from "../services/authService";
import { onAuthStateChanged } from "firebase/auth";
import React from "react"; // Aseguramos que React esté importado

type Mode = "login" | "register";

interface LocationState {
  from?: {
    pathname: string;
  };
}

export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        await loginBarberUser(email, password);
      } else {
        // ⬇️ CREA LA CUENTA EN AUTH + CREA DOCUMENTO EN FIRESTORE
        await registerBarberUser(email, password);

        setMessage("Cuenta creada correctamente. Ya podés ingresar.");
        setMode("login");
        return; // No logueamos automáticamente, igual que tu lógica actual
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error. Intentalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRememberAccount = async () => {
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Ingresá tu email para recordar tu cuenta.");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6">
        <h1 className="text-xl font-semibold mb-1 text-center">
          Barber Manager
        </h1>
        <p className="text-xs text-gray-500 mb-4 text-center">
          Ingresá o creá tu cuenta para gestionar tu barbería
        </p>

        <div className="flex mb-4 border border-gray-200 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Ingresar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === "register"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          {message && <p className="text-xs text-green-600 mt-1">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-1 text-sm font-medium px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-black transition disabled:opacity-60"
          >
            {submitting
              ? mode === "login"
                ? "Ingresando..."
                : "Creando cuenta..."
              : mode === "login"
              ? "Ingresar"
              : "Crear cuenta"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleRememberAccount}
          className="w-full mt-3 text-xs text-gray-600 underline underline-offset-2"
        >
          Recordar cuenta
        </button>

        <p className="mt-4 text-[11px] text-gray-400 text-center">
          Más adelante vamos a agregar fecha de vencimiento y otros
          controles como en el Gym Manager.
        </p>
      </div>
    </div>
  );
};