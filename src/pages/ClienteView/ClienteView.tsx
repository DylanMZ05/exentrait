// src/pages/ClienteView.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../../firebase";
import {
  collectionGroup,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

interface Ejercicio {
  ejercicio: string;
  peso: string;
}

interface Cliente {
  nombre: string;
  dni: string;
  dias: string[];
  horario: string;
  fechaVencimiento: string;
  ultimaActualizacion: string;
  rutina?: Record<string, Ejercicio[]>;
}

const ClienteView: React.FC = () => {
  const { dni } = useParams<{ dni: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [openDay, setOpenDay] = useState<string | null>(null);

  useEffect(() => {
    const fetchCliente = async () => {
      setLoading(true);
      try {
        if (!dni) return;

        const dniBuscado = String(dni).trim();
        const q = query(
          collectionGroup(db, "clientes"),
          where("dni", "==", dniBuscado)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const clienteDoc = snapshot.docs[0];
          const clienteData = clienteDoc.data() as Cliente;

          // Rutinas
          const rutinasRef = collection(db, `${clienteDoc.ref.path}/rutinas`);
          const rutinasSnap = await getDocs(rutinasRef);

          if (!rutinasSnap.empty) {
            const rutinaData: Record<string, Ejercicio[]> = {};
            rutinasSnap.forEach((doc) => {
              rutinaData[doc.id] = doc.data().ejercicios || [];
            });
            clienteData.rutina = rutinaData;
          }

          setCliente(clienteData);
        } else {
          setCliente(null);
        }
      } catch (error) {
        console.error("❌ Error cargando cliente:", error);
        setCliente(null);
      }
      setLoading(false);
    };

    fetchCliente();
  }, [dni]);

  if (loading) return <p className="p-6 text-center">Cargando...</p>;

  if (!cliente)
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <p>No se encontró un cliente con el DNI {dni}</p>
        <button
          onClick={() => navigate("/gym-manager/")}
          className="mt-4 bg-gray-400 hover:bg-gray-500 px-4 py-2 rounded text-white"
        >
          Volver
        </button>
      </div>
    );

  // Calcular días restantes
  const hoy = new Date();
  const [anio, mes, dia] = cliente.fechaVencimiento.split("-").map(Number);
  const vencimiento = new Date(anio, mes - 1, dia);
  const diffMs = vencimiento.getTime() - hoy.getTime();
  const diasRestantes = Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);

  const diasSemana: Record<string, string> = {
    L: "Lunes",
    M: "Martes",
    X: "Miércoles",
    J: "Jueves",
    V: "Viernes",
    S: "Sábado",
    D: "Domingo",
  };

  return (
    <div className="bg-gray-100 min-h-screen flex justify-center p-2 sm:p-4">
      <div className="w-full max-w-md">
        {/* Encabezado */}
        <header className="bg-[#0f1c3f] text-white rounded-t-lg shadow p-4">
          <div className="flex flex-col gap-2 text-sm">
            {/* Fila 1 */}
            <div className="flex justify-between items-center">
              <h1 className="font-bold text-lg">
                {cliente.nombre?.toUpperCase()}
              </h1>
              <span>{cliente.dias?.length || 0} veces x semana</span>
            </div>

            {/* Fila 2 */}
            <div className="flex justify-between items-center">
              <span className="text-green-400 font-semibold">
                Días restantes: {diasRestantes}
              </span>
              <span>{cliente.dias?.join(" - ")}</span>
            </div>
          </div>
        </header>

        {/* Rutina */}
        <div className="bg-white shadow rounded-b-lg p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Rutina</h2>
          <div className="flex flex-col gap-2">
            {cliente.dias.map((clave) => (
              <div key={clave} className="bg-gray-100 rounded shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenDay(openDay === clave ? null : clave)}
                  className="w-full flex justify-between items-center px-4 py-3 font-medium cursor-pointer bg-gray-100"
                >
                  <span>{diasSemana[clave]}</span>
                  <span
                    className={`transform transition-transform duration-300 ${
                      openDay === clave ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    ∨
                  </span>
                </button>
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    openDay === clave ? "max-h-96 opacity-100 p-3" : "max-h-0 opacity-0 p-0"
                  }`}
                >
                  {cliente.rutina &&
                  cliente.rutina[clave] &&
                  cliente.rutina[clave].filter(
                    (ej) =>
                      ej.ejercicio?.trim() !== "" && ej.peso?.trim() !== ""
                  ).length > 0 ? (
                    <ul className="space-y-1">
                      {cliente.rutina[clave]
                        .filter(
                          (ej) =>
                            ej.ejercicio?.trim() !== "" &&
                            ej.peso?.trim() !== ""
                        )
                        .map((ej, i) => (
                          <li
                            key={i}
                            className="flex justify-between py-1 text-sm border-b border-gray-200 last:border-b-0"
                          >
                            <span>{ej.ejercicio}</span>
                            <span className="text-gray-700">{ej.peso}</span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Sin ejercicios asignados
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botón Volver */}
        <div className="text-center my-6">
          <button
            onClick={() => navigate("/gym-manager/")}
            className="bg-gray-400 hover:bg-gray-500 px-6 py-2 rounded text-white"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClienteView;
