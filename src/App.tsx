import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

// IMPORTACIONES CORREGIDAS: Aseguramos la resolución añadiendo la extensión .tsx
import Login from "./pages/ClienteView/Login.tsx";
import ClienteView from "./pages/ClienteView/ClienteView.tsx";
import Home from "./pages/Home/Home.tsx";
import Updates from "./pages/Updates/Updates.tsx";

import Header from "./components/Header.tsx";
import Footer from "./components/Footer.tsx";

// Módulo Barber Manager
import { BarberApp } from "./barber-manager/BarberApp.tsx";

import AccountDayManager from "./barber-manager/pages/AccountDayMaganer.tsx";

function AppContent() {
  const location = useLocation();

  // Ocultamos el Header y Footer normales si estamos dentro de Barber Manager
  // NOTA: La ruta /barber-manager/* ya incluye su propio header (BarberHeader)
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
          {/* TODAS LAS RUTAS INTERNAS USAN BarberApp (incluida /ventas) */}
          <Route path="/barber-manager/*" element={<BarberApp />} />
          <Route path="/barber-manager/admin-master" element={<AccountDayManager />} />
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