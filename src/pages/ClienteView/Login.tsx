// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import logo from "../../assets/logo-2.png";
import flechaImg from "../../assets/flecha.png";

const HOMEPAGE_PATH = "/"; // Ruta a la que queremos volver

export default function Login() {
  const [dni, setDni] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/cliente/${dni}`);
  };

  return (
    <>
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
      <div className="bg-neutral-100 min-h-screen flex items-center justify-center p-4">
        <div className="bg-[#0f1c3f] rounded-lg shadow-dmz w-full max-w-sm p-8 flex flex-col items-center">
          
          {/* Logo at the top (added for better aesthetic flow) */}
          <img src={logo} alt="Exentra Logo" className="w-28 mb-8" /> 

          <h1 className="text-white text-center text-xl font-bold mb-8">
            INGRESE SU DNI <br /> PARA VER SU RUTINA
          </h1>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 items-center w-full"
          >
            <input
              type="text"
              placeholder="DNI"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              className="p-3 rounded w-full max-w-xs text-center bg-gray-300 placeholder-gray-600 text-black font-medium focus:outline-none"
              required
              />
            <button
              type="submit"
              className="text-black text-xl font-semibold bg-white rounded py-2 px-4 shadow-sm hover:shadow-md transition"
              >
              Ingresar
            </button>
          </form>

          <div className="mt-12 flex flex-col items-center">
            {/* 💡 CORRECCIÓN: Usar el logo solo una vez en la parte superior para un mejor foco */}
            <p className="text-white/90 font-semibold tracking-wider text-3xl">
              TRAINING
            </p>
          </div>
        </div>
      </div>
    </>
  );
}