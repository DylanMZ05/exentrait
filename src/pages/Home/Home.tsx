// src/pages/Home/index.tsx (o la ruta que uses)
import Hero from "../../components/landing/Hero";
import DownloadStrip from "../../components/landing/DownloadStrip";
// import HowItWorks from "../../components/landing/HowItWorks";
import FAQ from "../../components/landing/FAQ";
import Section from "../../components/landing/Section";

// URL del instalador (en public/updates/...). Cambiá si renombrás el archivo.
const INSTALLER_WIN = encodeURI(
  "/updates/Exentra-Gym-Setup-1.0.29-x64.exe"
);

export default function Home() {
  // Si más adelante subís video a YouTube, pegá el embed aquí:
  // const VIDEO_URL = ""; // por ej.: "https://www.youtube.com/embed/xxxxxxxx"

  return ( 
    <div className="bg-white">
      {/* HERO: tu componente ya tiene el link directo adentro.
          Si quisieras pasarlo por props, agregá onPrimaryClickHref={INSTALLER_WIN} */}
      <Hero devicesImgSrc="/assets/HOME/dispositivos.webp" />

      {/* Tira de descarga: mismo .exe */}
      <DownloadStrip href={INSTALLER_WIN} />

      {/* Cómo funciona + Video */}
      {/* <HowItWorks videoUrl={VIDEO_URL} /> */}

      {/* Mini-separador visual */}
      <Section contained={false} className="bg-gray-100">
        <div className="max-w-7xl mx-auto py-4"></div>
      </Section>

      {/* FAQ */}
      <FAQ />

      {/* CTA final */}
      <Section className="bg-gray-50">
        <div className="grid gap-6 items-center justify-between text-center sm:text-left sm:grid-cols-[1fr_auto]">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              ¿Listo para simplificar la gestión de tu gimnasio?
            </h3>
            <p className="mt-1 text-gray-600">
              Descargá Exentra IT y empezá en minutos.
            </p>
          </div>
          <a
            href={INSTALLER_WIN}
            download
            className="inline-flex items-center rounded-md bg-emerald-700 px-6 py-3 text-white font-semibold shadow-sm hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            Descargar ahora
          </a>
        </div>
      </Section>
    </div>
  );
}
