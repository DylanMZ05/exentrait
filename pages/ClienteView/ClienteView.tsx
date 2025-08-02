// src/pages/ClienteView.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebase";
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

export default function ClienteView() {
  const { dni } = useParams<{ dni: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCliente = async () => {
      setLoading(true);
      try {
        if (!dni) return;

        const dniBuscado = String(dni).trim();
        console.log("🔍 Buscando cliente con DNI:", dniBuscado);

        // Buscar en TODAS las subcolecciones "clientes"
        const q = query(
          collectionGroup(db, "clientes"),
          where("dni", "==", dniBuscado)
        );
        const snapshot = await getDocs(q);

        console.log("📌 Documentos encontrados:", snapshot.size);
        snapshot.forEach((doc) => console.log("➡️ Cliente:", doc.data()));

        if (!snapshot.empty) {
          const clienteDoc = snapshot.docs[0];
          const clienteData = clienteDoc.data() as Cliente;

          // Buscar rutinas
          const rutinasRef = collection(db, `${clienteDoc.ref.path}/rutinas`);
          const rutinasSnap = await getDocs(rutinasRef);

          console.log("📌 Rutinas encontradas:", rutinasSnap.size);
          rutinasSnap.forEach((doc) => console.log("➡️ Rutina:", doc.data()));

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

  if (loading) {
    return <p className="p-6 text-center">Cargando...</p>;
  }

  if (!cliente) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <p>No se encontró un cliente con el DNI {dni}</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 bg-gray-400 hover:bg-gray-500 px-4 py-2 rounded text-white"
        >
          Volver
        </button>
      </div>
    );
  }

  // Calcular días restantes
  const hoy = new Date();
  const [anio, mes, dia] = cliente.fechaVencimiento.split("-").map(Number);
  const vencimiento = new Date(anio, mes - 1, dia);
  const diffMs = vencimiento.getTime() - hoy.getTime();
  const diasRestantes = Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);

  const diasSemana = ["L", "M", "X", "J", "V", "S", "D"];
  const nombresDias = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];

  return (
    <div className="bg-gray-100 min-h-screen">
      <header className="bg-[#0f1c3f] text-white p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <h1 className="font-bold text-lg">
          Hola {cliente.nombre?.toUpperCase()}
        </h1>
        <div className="mt-2 sm:mt-0 flex flex-col sm:flex-row sm:items-center gap-2">
          <span>{cliente.dias?.length || 0} veces x semana</span>
          <span className="text-green-400">Días restantes: {diasRestantes}</span>
          <span>{cliente.dias?.join(" - ")}</span>
        </div>
      </header>

      <div className="bg-white shadow m-4 p-4 rounded">
        <p className="text-gray-600">
          <span className="font-semibold">Horario: </span>
          {cliente.horario}
        </p>
        <p className="text-sm text-gray-500">
          Última actualización:{" "}
          {cliente.ultimaActualizacion
            ? new Date(cliente.ultimaActualizacion).toLocaleDateString()
            : "No disponible"}
        </p>
      </div>

      <div className="m-4 flex flex-col gap-3">
        {diasSemana.map((clave, idx) => (
          <details key={idx} className="bg-white shadow rounded overflow-hidden">
            <summary className="cursor-pointer px-4 py-3 font-semibold bg-gray-200 flex justify-between items-center">
              <span>{nombresDias[idx]}</span>
              <span className="text-lg">∨</span>
            </summary>
            <div className="p-4">
              {cliente.rutina && cliente.rutina[clave] && cliente.rutina[clave].length > 0 ? (
                <ul className="space-y-2">
                  {cliente.rutina[clave].map((ej, i) => (
                    <li key={i} className="flex justify-between border-b py-1">
                      <span>{ej.ejercicio}</span>
                      <span>{ej.peso}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">Sin ejercicios asignados</p>
              )}
            </div>
          </details>
        ))}
      </div>

      <div className="text-center my-4">
        <button
          onClick={() => navigate("/")}
          className="bg-gray-400 hover:bg-gray-500 px-4 py-2 rounded text-white"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
