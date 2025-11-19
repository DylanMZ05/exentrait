// src/barber-manager/pages/Dashboard.tsx
import React from "react";
import { signOut } from "firebase/auth";
import { barberAuth } from "../services/firebaseBarber";
import { useNavigate } from "react-router-dom";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(barberAuth);
    navigate("/barber-manager/login", { replace: true });
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const summaryCards = [
    {
      label: "CLIENTES ACTIVOS",
      value: 48,
      helper: "Registrados en tu barbería",
    },
    {
      label: "EMPLEADOS",
      value: 4,
      helper: "Barberos trabajando hoy",
    },
    {
      label: "INGRESOS DEL MES",
      value: "$ 520.800",
      helper: "Actualizado al día de hoy",
    },
    {
      label: "TURNOS PROGRAMADOS",
      value: 19,
      helper: "Para el día de hoy",
    },
  ];

  const recentActivity = [
    {
      id: 1,
      client: "Corte Juan Pérez",
      detail: "Corte + Barba",
      amount: "$ 7.000",
      timeAgo: "hace 10 min",
    },
    {
      id: 2,
      client: "Corte Lucas Romero",
      detail: "Corte clásico",
      amount: "$ 5.000",
      timeAgo: "hace 30 min",
    },
    {
      id: 3,
      client: "Corte Nicolás Díaz",
      detail: "Corte + Diseño",
      amount: "$ 8.500",
      timeAgo: "hace 1 h",
    },
    {
      id: 4,
      client: "Corte Mateo Silva",
      detail: "Corte infantil",
      amount: "$ 4.500",
      timeAgo: "hace 2 h",
    },
    {
      id: 5,
      client: "Corte Franco López",
      detail: "Corte + Afeitado",
      amount: "$ 7.500",
      timeAgo: "hace 3 h",
    },
  ];

  const todayAppointments = [
    {
      id: 1,
      hour: "09:00 - 09:30",
      barber: "Ezequiel",
      client: "Juan Pérez",
      service: "Corte clásico",
      attendees: "1 turno",
    },
    {
      id: 2,
      hour: "09:30 - 10:00",
      barber: "Martín",
      client: "Lucas Romero",
      service: "Corte + Barba",
      attendees: "1 turno",
    },
    {
      id: 3,
      hour: "10:00 - 11:00",
      barber: "",
      client: "",
      service: "LIBRE",
      attendees: "Disponible",
    },
    {
      id: 4,
      hour: "11:00 - 11:30",
      barber: "Agustín",
      client: "Nicolás Díaz",
      service: "Corte + Diseño",
      attendees: "1 turno",
    },
    {
      id: 5,
      hour: "11:30 - 12:00",
      barber: "Ezequiel",
      client: "Mateo Silva",
      service: "Corte infantil",
      attendees: "1 turno",
    },
    {
      id: 6,
      hour: "12:00 - 13:00",
      barber: "",
      client: "",
      service: "LIBRE",
      attendees: "Disponible",
    },
    {
      id: 7,
      hour: "13:00 - 13:30",
      barber: "Martín",
      client: "Franco López",
      service: "Corte + Afeitado",
      attendees: "1 turno",
    },
    {
      id: 8,
      hour: "13:30 - 14:00",
      barber: "Agustín",
      client: "Turno online",
      service: "Corte rápido",
      attendees: "1 turno",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto space-y-6 p-2 pt-10">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            Panel general
          </h2>

        </div>

        {/* Welcome banner */}
        <div className="w-full rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-8 py-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-white mb-1">
            Bienvenido/a a Exentra - Barber Manager
          </h1>
          <p className="text-sm text-slate-200">
            Gestioná tu barbería de manera inteligente y eficiente.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 tracking-wide">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {card.value}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-lg">
                  {/* Simple icon placeholder */}
                  {card.label === "CLIENTES ACTIVOS" && "👥"}
                  {card.label === "EMPLEADOS" && "💈"}
                  {card.label === "INGRESOS DEL MES" && "💵"}
                  {card.label === "TURNOS PROGRAMADOS" && "📅"}
                </div>
              </div>

              <p className="text-xs text-slate-500">{card.helper}</p>
            </div>
          ))}
        </div>

        {/* Main bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[460px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Actividad reciente
                </h3>
              </div>

              <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                Ver todo
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-2">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                      <span role="img" aria-label="cliente">
                        💇‍♂️
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {item.client}
                      </p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.timeAgo}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      {item.amount}
                    </p>
                    <p className="text-[11px] text-slate-400">Pagado</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming appointments */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[460px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Próximos turnos
              </h3>

              <div className="flex items-center gap-2 text-xs">
                <button className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">
                  &lt;
                </button>
                <span className="px-3 py-1 rounded-md border border-slate-200 text-slate-700">
                  {formattedDate}
                </span>
                <button className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">
                  &gt;
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-3">
              {todayAppointments.map((turno) => (
                <div key={turno.id} className="space-y-1">
                  <p className="text-[11px] font-medium text-emerald-600">
                    {turno.hour}
                  </p>
                  <div className="border border-slate-100 rounded-xl px-3 py-2 hover:border-emerald-200 hover:bg-emerald-50/30 transition">
                    {turno.service === "LIBRE" ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-500">
                          LIBRE
                        </p>
                        <p className="text-xs text-slate-400">
                          {turno.attendees}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">
                            {turno.client}
                          </p>
                          <p className="text-xs text-slate-500">
                            {turno.attendees}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {turno.service} · Barber:{" "}
                          <span className="font-medium text-slate-800">
                            {turno.barber}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
