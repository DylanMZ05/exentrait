// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/ClienteView/Login";
import ClienteView from "./pages/ClienteView/ClienteView";
import Header from "./components/Header";
import Footer from "./components/Footer";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-100">
        {/* Header visible en todas las páginas */}
        <Header />

        {/* Contenido principal */}
        <main className="flex-1">
          <Routes>
            <Route path="/gym-manager/" element={<Login />} />
            <Route path="/cliente/:dni" element={<ClienteView />} />
          </Routes>
        </main>

        {/* Footer visible en todas las páginas */}
        <Footer />
      </div>
    </Router>
  );
}
