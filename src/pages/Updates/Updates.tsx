import { useEffect, useState } from "react";

declare global {
  interface Window {
    electronAPI: {
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      restartApp: () => void;
    };
  }
}

const Updates = () => {
  const [status, setStatus] = useState<string>("Buscando actualizaciones...");

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable(() => {
      setStatus("🔄 Nueva actualización disponible, descargando...");
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setStatus("✅ Actualización lista para instalar.");
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Actualizaciones</h1>
      <p>{status}</p>
      {status.includes("lista") && (
        <button
          onClick={() => window.electronAPI.restartApp()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reiniciar y actualizar
        </button>
      )}
    </div>
  );
};

export default Updates;
