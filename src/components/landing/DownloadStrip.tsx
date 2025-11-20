// src/components/landing/DownloadStrip.tsx
import Section from "./Section";

interface DownloadStripProps {
  /** URL del instalador (por defecto el .exe en /updates). */
  href?: string;
  /** Texto del botón (opcional). */
  label?: string;
}

// Mismo archivo que usás en el Hero; encodeURI evita problemas por espacios.
const DEFAULT_INSTALLER = encodeURI(
  "/updates/Exentra-Gym-Setup-1.0.30-x64.exe"
);

export default function DownloadStrip({
  href = DEFAULT_INSTALLER,
  label = "DESCARGAR",
}: DownloadStripProps) {
  return (
    <Section className="bg-gray-50 border-y border-gray-200">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Descargá Exentra IT y organizá tu gimnasio hoy
          </h2>
          <p className="mt-2 max-w-2xl text-gray-600">
            Exentra Gym Manager te ayuda a administrar tu gimnasio de manera más
            fácil y eficiente.
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end">
          <a
            id="descargar"
            href={href}
            download
            className="inline-flex items-center rounded-md bg-emerald-700 px-7 py-3 text-white font-semibold shadow-sm hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            rel="noopener"
          >
            {label}
          </a>
          <span className="mt-2 text-sm text-gray-600">Windows</span>
        </div>
      </div>
    </Section>
  );
}
