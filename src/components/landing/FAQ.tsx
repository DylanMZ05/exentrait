import Section from "./Section";

type QA = { q: string; a: string };

const defaultItems: QA[] = [
  {
    q: "¿Necesito conocimientos técnicos para usar la app?",
    a: "No. La app está diseñada para que cualquier dueño o administrador de gimnasio pueda usarla de forma intuitiva, sin conocimientos previos de tecnología.",
  },
  {
    q: "¿Los alumnos pueden ver su rutina desde el celular?",
    a: "Sí. A cada gimnasio se le otorga un enlace y código QR que los alumnos pueden escanear desde su teléfono. Allí ingresan su número de documento y acceden directamente a su rutina actualizada, sin necesidad de instalar ninguna app.",
  },
  {
    q: "¿Se puede usar la app en varias sucursales?",
    a: "Sí. La misma cuenta puede iniciarse en diferentes computadoras de manera simultánea, lo que permite que varios administradores trabajen al mismo tiempo sin inconvenientes.",
  },
];

export default function FAQ({ items = defaultItems }: { items?: QA[] }) {
  return (
    <Section className="bg-white">
      <h3 className="text-2xl font-bold text-gray-900">Preguntas frecuentes</h3>

      <div className="mt-6 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {items.map((it, i) => (
          <details
            key={i}
            className="group px-5 py-4 open:bg-gray-50 open:rounded-xl"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-gray-900">
              <span>{it.q}</span>
              <span className="text-gray-400 transition group-open:rotate-180">
                {/* Chevron */}
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                  <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" />
                </svg>
              </span>
            </summary>
            <p className="mt-2 text-gray-700">{it.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
