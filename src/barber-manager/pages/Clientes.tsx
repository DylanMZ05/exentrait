// src/barber-manager/pages/Clientes.tsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp, // Se importa y se usa para createdAt y updatedAt
  query,
  orderBy, // Se importa y se usa en loadClientes
} from "firebase/firestore";
import { barberDb, barberAuth } from "../services/firebaseBarber";

/* ============================================================
    ICONOS SVG
============================================================ */
const IconSearch = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// ERROR CORREGIDO: IconPhone no se usa en el JSX, por lo tanto se elimina 
// o se comenta para evitar TS6133.
/*
const IconPhone = () => (
  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);
*/

const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconWhatsApp = () => (
  <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* ============================================================
    COMPONENTE PRINCIPAL
============================================================ */
export const Clientes: React.FC = () => {
  const user = barberAuth.currentUser;
  const uid = user?.uid;

  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Estados formularios
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  
  // Estado para sistema de fidelidad
  const [cortes, setCortes] = useState(0);

  const [selectedClient, setSelectedClient] = useState<any>(null);

  /* ============================================================
    CARGAR CLIENTES
  ============================================================ */
  const loadClientes = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(barberDb, `barber_users/${uid}/clientes`),
        orderBy("nombre", "asc")
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

      setClientes(list);
      // Actualizar caché
      localStorage.setItem(`barber_stats_clientes_${uid}`, list.length.toString());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (uid) loadClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  /* ============================================================
    CRUD & LÓGICA
  ============================================================ */
  const handleCreate = async () => {
    if (!nombre.trim()) return alert("El nombre es obligatorio");
    if (!uid) return;

    try {
      await addDoc(collection(barberDb, `barber_users/${uid}/clientes`), {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        notas: notas.trim(),
        cortes: 0,
        createdAt: serverTimestamp(),
      });
      setCreateModalOpen(false);
      resetForm();
      loadClientes(); 
    } catch (e) {
      console.error(e);
      alert("Error al crear cliente");
    }
  };

  const handleEdit = async () => {
    if (!selectedClient || !uid) return;
    try {
      await updateDoc(doc(barberDb, `barber_users/${uid}/clientes/${selectedClient.id}`), {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        notas: notas.trim(),
        cortes: Number(cortes),
        updatedAt: serverTimestamp(),
      });
      setEditModalOpen(false);
      resetForm();
      loadClientes();
    } catch (e) {
      console.error(e);
      alert("Error al editar");
    }
  };

  const handleDelete = async () => {
    if (!selectedClient || !uid) return;
    try {
      await deleteDoc(doc(barberDb, `barber_users/${uid}/clientes/${selectedClient.id}`));
      setDeleteModalOpen(false);
      setSelectedClient(null);
      loadClientes(); 
    } catch (e) {
      console.error(e);
      alert("Error al eliminar");
    }
  };

  /* ============================================================
    SISTEMA DE PUNTOS
  ============================================================ */
  const updateCortes = async (client: any, change: number) => {
    if (!uid) return;
    const current = client.cortes || 0;
    const newVal = current + change;

    if (newVal < 0) return; 

    // Optimista
    const updatedList = clientes.map(c => 
      c.id === client.id ? { ...c, cortes: newVal } : c
    );
    setClientes(updatedList);

    try {
      await updateDoc(doc(barberDb, `barber_users/${uid}/clientes/${client.id}`), {
        cortes: newVal
      });
    } catch (e) {
      console.error("Error al actualizar cortes", e);
    }
  };

  /* ============================================================
    WHATSAPP HELPER
  ============================================================ */
  const getWhatsAppLink = (phone: string) => {
    const cleanNumber = phone.replace(/\D/g, "");
    return `https://wa.me/${cleanNumber}`;
  };

  // Helpers UI
  const resetForm = () => {
    setNombre("");
    setTelefono("");
    setEmail("");
    setNotas("");
    setCortes(0);
    setSelectedClient(null);
  };

  const openEdit = (client: any) => {
    setSelectedClient(client);
    setNombre(client.nombre);
    setTelefono(client.telefono || "");
    setEmail(client.email || "");
    setNotas(client.notas || "");
    setCortes(client.cortes || 0);
    setEditModalOpen(true);
  };

  const openDelete = (client: any) => {
    setSelectedClient(client);
    setDeleteModalOpen(true);
  };

  /* ============================================================
    FILTRADO
  ============================================================ */
  const filteredClients = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.telefono && c.telefono.includes(searchTerm))
  );

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all text-sm";
  const btnPrimary = "w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition font-medium text-sm";
  const btnSecondary = "w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition font-medium text-sm";

  return (
    <div className="space-y-6 animate-fadeIn m-2">
      
      {/* HEADER + BUSCADOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Cartera de Clientes</h2>
          <p className="text-sm text-slate-500">
            {clientes.length} clientes registrados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group flex-1 md:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <IconSearch />
            </div>
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 outline-none w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => { resetForm(); setCreateModalOpen(true); }}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap"
          >
            <IconPlus />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* LISTA DE CLIENTES */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="mt-2 text-sm text-slate-500">Cargando cartera...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
          <p className="text-slate-400 mb-2">No se encontraron clientes</p>
          <button onClick={() => setCreateModalOpen(true)} className="text-sm text-slate-900 font-medium hover:underline">
            Crear el primero ahora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const cortesActuales = client.cortes || 0;
            const esGratis = cortesActuales >= 10;
            const porcentaje = Math.min((cortesActuales / 10) * 100, 100);

            return (
              <div key={client.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden ${esGratis ? 'border-yellow-400/50 ring-1 ring-yellow-400/30' : 'border-slate-200'}`}>
                
                {/* Indicador de GRATIS background */}
                {esGratis && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                    ¡CORTE GRATIS!
                  </div>
                )}

                <div className="flex justify-between items-start mb-3">
                  <div className="max-w-[80%]">
                    <h3 className="font-semibold text-slate-900 truncate">{client.nombre}</h3>
                    
                    {/* TELÉFONO + WHATSAPP LINK */}
                    {client.telefono ? (
                      <a 
                        href={getWhatsAppLink(client.telefono)} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center mt-1 font-medium transition-colors w-fit"
                      >
                        <IconWhatsApp />
                        WhatsApp <span className="text-slate-400 font-normal ml-1">- {client.telefono}</span>
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-1">Sin teléfono</p>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(client)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition">
                      <IconEdit />
                    </button>
                    <button onClick={() => openDelete(client)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition">
                      <IconTrash />
                    </button>
                  </div>
                </div>

                {/* SECCIÓN FIDELIDAD */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fidelidad</span>
                    <span className={`text-xs font-bold ${esGratis ? 'text-yellow-600' : 'text-slate-700'}`}>
                      {cortesActuales} / 10
                    </span>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div 
                      className={`h-full transition-all duration-500 ease-out rounded-full ${esGratis ? 'bg-yellow-400' : 'bg-slate-800'}`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>

                  {/* Botones contador */}
                  <div className="flex items-center justify-between gap-3">
                      <button 
                        onClick={() => updateCortes(client, -1)}
                        className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium transition"
                      >
                        -1
                      </button>

                      {esGratis ? (
                          <button 
                            onClick={() => updateCortes(client, -10)} // Resetear
                            className="flex-[2] py-1.5 rounded-lg bg-yellow-400 text-yellow-900 hover:bg-yellow-500 text-xs font-bold transition shadow-sm animate-pulse"
                          >
                            CANJEAR
                          </button>
                      ) : (
                        <div className="flex-[2] text-center text-[10px] text-slate-400 font-medium">
                          {10 - cortesActuales} para gratis
                        </div>
                      )}

                      <button 
                        onClick={() => updateCortes(client, 1)}
                        className="flex-1 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition shadow-sm"
                      >
                        +1
                      </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* =========================================
          MODAL CREAR / EDITAR
      ========================================= */}
      {(createModalOpen || editModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fadeIn">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {createModalOpen ? "Nuevo Cliente" : "Editar Cliente"}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre completo</label>
                <input 
                  autoFocus
                  type="text" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  className={inputClass}
                  placeholder="Ej. Juan Pérez" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Teléfono</label>
                  <input 
                    type="tel" 
                    value={telefono} 
                    onChange={(e) => setTelefono(e.target.value)} 
                    className={inputClass}
                    placeholder="Ej. 11 1234 5678" 
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Email (Opcional)</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className={inputClass}
                    placeholder="juan@email.com" 
                  />
                </div>
              </div>

              {!createModalOpen && (
                  <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Ajuste manual de cortes</label>
                      <input 
                        type="number" 
                        value={cortes} 
                        onChange={(e) => setCortes(Number(e.target.value))} 
                        className={inputClass}
                      />
                  </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notas internas</label>
                <textarea 
                  rows={3}
                  value={notas} 
                  onChange={(e) => setNotas(e.target.value)} 
                  className={inputClass}
                  placeholder="Preferencias del cliente..." 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setCreateModalOpen(false); setEditModalOpen(false); }}
                  className={btnSecondary}
                >
                  Cancelar
                </button>
                <button 
                  onClick={createModalOpen ? handleCreate : handleEdit}
                  className={btnPrimary}
                >
                  {createModalOpen ? "Guardar Cliente" : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL ELIMINAR
      ========================================= */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fadeIn text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <IconTrash />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">¿Eliminar cliente?</h3>
            <p className="text-sm text-slate-500 mt-2 mb-6">
              Estás a punto de eliminar a <span className="font-semibold text-slate-700">{selectedClient?.nombre}</span>. Esta acción no se puede deshacer.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteModalOpen(false)}
                className={btnSecondary}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition font-medium text-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};