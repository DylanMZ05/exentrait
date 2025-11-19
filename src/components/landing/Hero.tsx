import Section from "./Section";
import CheckItem from "./CheckItem";

interface HeroProps {
  onPrimaryClickHref?: string;
  devicesImgSrc?: string;
}

export default function Hero({
  devicesImgSrc = "/assets/HOME/dispositivos.webp",
}: HeroProps) {
  return (
    <Section className="bg-white">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-1">
        {/* Texto */}
        <div>
          <h1 className="text-4xl/tight sm:text-5xl/tight font-bold text-gray-900">
            Controla pagos, clientes y rutinas
            <br />
            de tu GYM desde
            <br />
            una sola app.
          </h1>

          <div className="mt-7">
            <a
              href="/updates/Exentra-Gym-Setup-1.0.29-x64.exe" download
              className="inline-flex items-center rounded-md bg-emerald-600 px-5 py-3 text-white font-semibold shadow-sm hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Descargar la aplicación
            </a>
          </div>

          <ul className="mt-8 space-y-3">
            <CheckItem>Control de pagos y deudas</CheckItem>
            <CheckItem>Gestión de clientes y rutinas</CheckItem>
            <CheckItem>Notificaciones automáticas</CheckItem>
          </ul>
        </div>

        {/* Imagen de dispositivos */}
        <div className="relative">
          <div className="relative mx-auto max-w-xl">
            <img
              src={devicesImgSrc}
              alt="Exentra IT en múltiples dispositivos"
              className="w-full rounded-xl"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
