// src/barber-manager/pages/Empleados.tsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";

/* ============================================================
   EMPLEADOS
   Crear, editar y eliminar empleados con mejor UI/UX
=============================================================== */
export const Empleados: React.FC = () => {
  const user = barberAuth.currentUser;
  const uid = user?.uid;

  const empleadosRef = collection(barberDb, `barber_users/${uid}/empleados`);

  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Crear
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");

  // Modal contraseña
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<"create" | "delete" | "edit" | null>(null);
  const [empleadoAEliminar, setEmpleadoAEliminar] = useState<any>(null);

  // Modal edición
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [empleadoEdit, setEmpleadoEdit] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editPorcentaje, setEditPorcentaje] = useState("");

  /* ============================================================
     Cargar empleados
  ============================================================ */
  const loadEmpleados = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(empleadosRef);
      const list: any[] = [];

      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));

      setEmpleados(list);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (uid) loadEmpleados();
  }, [uid]);

  /* ============================================================
     Modal Contraseña
  ============================================================ */
  const openPasswordModal = (action: "create" | "delete" | "edit") => {
    setPendingAction(action);
    setPasswordInput("");
    setPasswordModalOpen(true);
  };

  const confirmarPassword = async () => {
    if (!barberAuth.currentUser) return;
    setModalLoading(true);

    try {
      const cred = EmailAuthProvider.credential(
        barberAuth.currentUser.email!,
        passwordInput
      );

      await reauthenticateWithCredential(barberAuth.currentUser, cred);

      if (pendingAction === "create") await crearEmpleadoConfirmado();
      if (pendingAction === "delete") await eliminarEmpleadoConfirmado();
      if (pendingAction === "edit") await guardarEdicionConfirmada();

      setPasswordModalOpen(false);
    } catch {
      alert("❌ Contraseña incorrecta.");
    } finally {
      setModalLoading(false);
    }
  };

  /* ============================================================
     Crear empleado
  ============================================================ */
  const crearEmpleado = () => {
    if (!nuevoNombre || !nuevoPorcentaje) {
      alert("Completa nombre y porcentaje.");
      return;
    }
    openPasswordModal("create");
  };

  const crearEmpleadoConfirmado = async () => {
    await addDoc(empleadosRef, {
      nombre: nuevoNombre.trim(),
      porcentaje: Number(nuevoPorcentaje),
      createdAt: serverTimestamp(),
    });

    setNuevoNombre("");
    setNuevoPorcentaje("");
    loadEmpleados();
  };

  /* ============================================================
     Editar empleado
  ============================================================ */
  const abrirEditarEmpleado = (emp: any) => {
    setEmpleadoEdit(emp);
    setEditNombre(emp.nombre);
    setEditPorcentaje(String(emp.porcentaje));
    setEditModalOpen(true);
  };

  const guardarEdicion = () => {
    if (!editNombre || !editPorcentaje) {
      alert("Completá los campos.");
      return;
    }
    openPasswordModal("edit");
  };

  const guardarEdicionConfirmada = async () => {
    await updateDoc(
      doc(barberDb, `barber_users/${uid}/empleados/${empleadoEdit.id}`),
      {
        nombre: editNombre,
        porcentaje: Number(editPorcentaje),
        updatedAt: serverTimestamp(),
      }
    );

    setEditModalOpen(false);
    setEmpleadoEdit(null);
    loadEmpleados();
  };

  /* ============================================================
     Eliminar
  ============================================================ */
  const eliminarEmpleado = (emp: any) => {
    setEmpleadoAEliminar(emp);
    openPasswordModal("delete");
  };

  const eliminarEmpleadoConfirmado = async () => {
    await deleteDoc(
      doc(barberDb, `barber_users/${uid}/empleados/${empleadoAEliminar.id}`)
    );
    loadEmpleados();
  };

  /* ============================================================
     CSS helpers
  ============================================================ */
  const inputClass =
    "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-600 outline-none bg-white";
  const btnPrimary =
    "px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.97] transition";
  const btnLight =
    "px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 active:scale-[0.97] transition";
  const btnDanger =
    "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.97] transition";

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className="space-y-6 animate-fadeIn p-2 pt-10">

      <h2 className="text-xl font-semibold">Empleados</h2>
      <p className="text-sm text-gray-600 -mt-2">
        Administrá los empleados de tu barbería.
      </p>

      {/* ========================== CREAR ============================== */}
      <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">

        <h3 className="font-medium text-gray-900 text-lg">Crear nuevo empleado</h3>

        <div className="grid gap-4">
          <input
            type="text"
            autoComplete="off"
            placeholder="Nombre"
            className={inputClass}
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
          />

          <input
            type="number"
            autoComplete="off"
            placeholder="Porcentaje (%)"
            className={inputClass}
            value={nuevoPorcentaje}
            onChange={(e) => setNuevoPorcentaje(e.target.value)}
          />

          <button className={btnPrimary} onClick={crearEmpleado}>
            Crear empleado
          </button>
        </div>
      </div>

      {/* ========================== LISTA ============================== */}
      <div className="bg-white border rounded-xl shadow-sm p-5">

        <h3 className="font-medium text-gray-900 mb-3 text-lg">Lista de empleados</h3>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : empleados.length === 0 ? (
          <p className="text-sm text-gray-500">No tenés empleados creados todavía.</p>
        ) : (
          <div className="space-y-3">
            {empleados.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between border rounded-lg bg-gray-50 p-4 hover:bg-gray-100 transition"
              >
                <div>
                  <p className="font-medium text-gray-900">{emp.nombre}</p>
                  <p className="text-sm text-gray-600">
                    Comisión: <span className="font-semibold">{emp.porcentaje}%</span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <button className={btnLight} onClick={() => abrirEditarEmpleado(emp)}>
                    Editar
                  </button>
                  <button className={btnDanger} onClick={() => eliminarEmpleado(emp)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================== MODAL EDITAR ============================== */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-[90%] max-w-sm rounded-xl p-6 shadow-lg space-y-4 animate-fadeIn">

            <h3 className="text-lg font-semibold text-center">Editar empleado</h3>

            <input
              type="text"
              autoComplete="off"
              className={inputClass}
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
            />

            <input
              type="number"
              autoComplete="off"
              className={inputClass}
              value={editPorcentaje}
              onChange={(e) => setEditPorcentaje(e.target.value)}
            />

            <div className="flex justify-between pt-2">
              <button className={btnLight} onClick={() => setEditModalOpen(false)}>
                Cancelar
              </button>

              <button className={btnPrimary} onClick={guardarEdicion}>
                Guardar cambios
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================== MODAL CONTRASEÑA ============================== */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white w-[90%] max-w-sm rounded-xl p-6 shadow-lg space-y-4 animate-fadeIn">

            <h3 className="text-lg font-semibold text-center">Confirmar contraseña</h3>
            <p className="text-sm text-gray-600 text-center">
              Solo el dueño puede realizar esta acción.
            </p>

            <input
              type="password"
              autoComplete="off"
              placeholder="Contraseña"
              className={inputClass}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />

            <div className="flex justify-between">
              <button className={btnLight} onClick={() => setPasswordModalOpen(false)}>
                Cancelar
              </button>

              <button className={btnPrimary} disabled={modalLoading} onClick={confirmarPassword}>
                {modalLoading ? "Verificando..." : "Confirmar"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
