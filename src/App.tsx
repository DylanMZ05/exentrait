import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";

// 🏷️ Pantalla Login
function Login() {
  const [dni, setDni] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (dni.trim() === "") return;

    // Aquí luego conectarás con Firestore
    navigate(`/gym-manager/rutina/${dni}`);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0f1c3f] text-white">
      <h1 className="text-2xl font-bold mb-6">Ingrese su DNI para iniciar sesión</h1>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-80">
        <input
          type="text"
          placeholder="Ingrese su DNI"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          className="w-full p-3 rounded text-black focus:outline-none"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}

// 🏷️ Pantalla Rutina
function Rutina() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#0f1c3f] text-white p-4 flex justify-between items-center">
        <h2 className="font-bold">EXENTRA</h2>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-300 hover:bg-gray-400 text-black px-3 py-1 rounded"
        >
          Volver
        </button>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-4">
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="font-bold text-lg">Hola CELINA CIFARELLI</h3>
          <p className="text-green-600 font-semibold">Días restantes: 20</p>
          <p className="text-sm mb-4">5 veces x semana - L M X J V</p>

          <h4 className="font-bold mb-2">Rutina</h4>
          <div className="bg-gray-50 p-3 rounded mb-2">
            <p className="font-semibold">Lunes</p>
            <ul className="text-sm">
              <li>Bicicleta - 5 minutos</li>
              <li>Jalón al pecho - 3×10/12/15</li>
              <li>Remo con barra - 3×10/12/15</li>
              <li>Bíceps con barra W - 4×15/12/10/8</li>
              <li>Concentrado - 3×10</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

// 🏷️ App Principal
function App() {
  return (
    <Router basename="/">
      <Routes>
        {/* Redirección inicial a /gym-manager */}
        <Route path="/" element={<Navigate to="/gym-manager" replace />} />
        
        {/* Login en /gym-manager */}
        <Route path="/gym-manager" element={<Login />} />
        
        {/* Rutina en /gym-manager/rutina/:dni */}
        <Route path="/gym-manager/rutina/:dni" element={<Rutina />} />
      </Routes>
    </Router>
  );
}

export default App;
