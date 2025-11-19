import Section from "./Section";
import CheckItem from "./CheckItem";

interface HowItWorksProps {
  videoUrl?: string; // si tenés YouTube/Vimeo lo ponés acá
}

export default function HowItWorks({ videoUrl }: HowItWorksProps) {
  return (
    <Section className="bg-white">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            Mirá cómo funciona Exentra IT - Gym Manager
          </h3>
          <p className="mt-2 text-gray-600 max-w-xl">
            En menos de 2 minutos vas a entender cómo administrar socios, pagos
            y rutinas desde tu PC.
          </p>

          <ul className="mt-6 space-y-3">
            <CheckItem>Registrar clientes en segundos</CheckItem>
            <CheckItem>Control automático de pagos</CheckItem>
            <CheckItem>Rutinas accesibles por QR en el celular</CheckItem>
          </ul>
        </div>

        {/* Video o placeholder */}
        <div className="w-full">
          {videoUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5">
              <iframe
                className="h-full w-full"
                src={videoUrl}
                title="Video de cómo usar Exentra IT"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 grid place-items-center">
              <div className="text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow ring-1 ring-black/5">
                  {/* Play icon */}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6 text-gray-600"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="font-semibold">video de cómo usarlo</p>
                <p className="text-sm text-gray-500">Próximamente</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
