// src/App.tsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import Login from "./pages/ClienteView/Login";
import ClienteView from "./pages/ClienteView/ClienteView";
import Home from "./pages/Home/Home";
import Updates from "./pages/Updates/Updates";

import Header from "./components/Header";
import Footer from "./components/Footer";

// Módulo Barber Manager
import { BarberApp } from "./barber-manager/BarberApp";

function AppContent() {
  const location = useLocation();

  // Ocultamos el Header y Footer normales si estamos dentro de Barber Manager
  const hideLayout = location.pathname.startsWith("/barber-manager");

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* HEADER GENERAL (solo para Gym Manager y Home) */}
      {!hideLayout && <Header />}

      <main className="flex-1">
        <Routes>
          {/* ---- APP PRINCIPAL ---- */}
          <Route path="/" element={<Home />} />
          <Route path="/gym-manager/" element={<Login />} />
          <Route path="/cliente/:dni" element={<ClienteView />} />
          <Route path="/gym-manager/updates" element={<Updates />} />

          {/* ---- BARBER MANAGER ---- */}
          {/* TODAS LAS RUTAS INTERNAS USAN BarberApp */}
          <Route path="/barber-manager/*" element={<BarberApp />} />
        </Routes>
      </main>

      {/* FOOTER GENERAL */}
      {!hideLayout && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
