// src/pages/ClienteView/ClienteView.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../../firebase";
import {
  collectionGroup,
  getDocs,
  query,
  where,
  doc as docRef,
  getDoc,
  onSnapshot,
  setDoc,
  collection,
  deleteDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";

import flechaImg from "../../assets/flecha.png";

const HOMEPAGE_PATH = "/";


/* ────────────────────────────────────────────────────────────────────────────
  Tipos
──────────────────────────────────────────────────────────────────────────── */
interface Ejercicio {
  ejercicio: string;
  peso: string;
  series?: string; // series opcional
}
interface RutinaDia {
  ejercicios: Ejercicio[];
  nombreDia?: string;
}
interface Cliente {
  nombre: string;
  dni: string;
  dias: string[];
  horario: string;
  fechaVencimiento: string;
  ultimaActualizacion: string;
  rutina?: Record<string, RutinaDia>;
}

type CachedCliente = {
  data: Cliente;
  path: string;
  cachedAt: number;
};

/* Catálogo normalizado que usaremos internamente */
type NormCatalogItem = {
  nombre: string;
  grupo?: string;
  aliases: string[];
  img?: string;
  equipamiento?: string[];
};
type NormCatalog = {
  baseMediaUrl: string;
  ejercicios: Record<string, NormCatalogItem>; // slug -> item
};

/* Target para el popup de eliminación */
type DeleteTarget =
  | { type: "day"; dia: string }
  | { type: "exercise"; dia: string; index: number }
  | null;

/* ────────────────────────────────────────────────────────────────────────────
   Constantes
──────────────────────────────────────────────────────────────────────────── */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const cacheKey = (dni: string) => `cliente:${dni}`;

/* Tu JSON público + fallbacks locales */
const CATALOGO_URLS = [
  "https://exentrait.com/exercises/catalog.json",
  "/exercises/catalog.json",
  "/assets/ejercicios/catalogo.json",
];

/* ────────────────────────────────────────────────────────────────────────────
   Componente
──────────────────────────────────────────────────────────────────────────── */
const ClienteView: React.FC = () => {
  const { dni: dniParam } = useParams<{ dni: string }>();
  const navigate = useNavigate();
  const dniFromUrl = useMemo(
    () => (dniParam ? decodeURIComponent(String(dniParam)).trim() : ""),
    [dniParam]
  );

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clienteDocPath, setClienteDocPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado para el Modo Edición
  const [isEditing, setIsEditing] = useState(false);

  // Edición de pesos y series
  const [draftPesos, setDraftPesos] = useState<Record<string, string[]>>({});
  const [draftSeries, setDraftSeries] = useState<Record<string, string[]>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // refs y alturas para animación suave
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [heights, setHeights] = useState<Record<string, number>>({});

  // Catálogo de ejercicios (para popup de imágenes)
  const [catalog, setCatalog] = useState<NormCatalog | null>(null);
  const catalogIndex = useRef<{ id: string; nombre: string; terms: string[] }[]>(
    []
  );
  const [modalEjId, setModalEjId] = useState<string | null>(null);

  // Orden explícito de las rutinas leídas de Firestore (subcolección)
  const [rutinaOrder, setRutinaOrder] = useState<string[]>([]);

  // Marca de días realmente cargados desde Firestore o creados/editados en esta sesión
  const [loadedDias, setLoadedDias] = useState<Record<string, boolean>>({});

  // Popups cuota
  const [showVencidoModal, setShowVencidoModal] = useState(false);
  const [showSoonModal, setShowSoonModal] = useState(false);

  // Popup de eliminación
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  /* ───────────── Utils cache ───────────── */
  const readCache = useCallback((dni: string): CachedCliente | null => {
    try {
      const raw = localStorage.getItem(cacheKey(dni));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedCliente;
      if (!parsed?.data || !parsed?.cachedAt || !parsed?.path) return null;
      if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const writeCache = useCallback(
    (dni: string, payload: Omit<CachedCliente, "cachedAt">) => {
      const toStore: CachedCliente = { ...payload, cachedAt: Date.now() };
      localStorage.setItem(cacheKey(dni), JSON.stringify(toStore));
    },
    []
  );

  const updateCacheRutinaDia = useCallback(
    (dni: string, diaClave: string, diaData: RutinaDia) => {
      const cached = readCache(dni);
      if (!cached) return;
      const current = cached.data.rutina || {};
      const newData: Cliente = {
        ...cached.data,
        rutina: {
          ...current,
          [diaClave]: { ...(current[diaClave] || {}), ...diaData },
        },
      };
      writeCache(dni, { data: newData, path: cached.path });
    },
    [readCache, writeCache]
  );

  /* ───────────── Catálogo: normalización + indexado ───────────── */
  const normalizeText = (s: string) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // ← elimina tildes/acentos
      .replace(/[|()[\],.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Remueve patrones de volumen y deja el "título" usable.
  const baseName = (s: string) => {
    let t = String(s || "");
    t = t.replace(/(\d+(\.\d+)?\s*(x|\*|por)\s*[\d\-–> ]+.*)$/i, "");
    t = t.replace(/\b\d+\s*(kg|kilos?|lb|lbs|min|mins|seg|segs|s)\b/gi, "");
    t = t.replace(/[-–>]{1,2}\s*\d+.*/i, "");
    t = t.replace(/\s{2,}/g, " ").trim();
    return t;
  };

  // Distancia de Levenshtein acotada (early-exit)
  const levenshteinBounded = (a: string, b: string, maxDist: number): number => {
    const al = a.length,
      bl = b.length;
    if (a === b) return 0;
    if (Math.abs(al - bl) > maxDist) return maxDist + 1;

    let prev = new Array<number>(bl + 1);
    let curr = new Array<number>(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;

    for (let i = 1; i <= al; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      const ai = a.charCodeAt(i - 1);
      for (let j = 1; j <= bl; j++) {
        const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > maxDist) return maxDist + 1; // early-exit
      [prev, curr] = [curr, prev];
    }
    return prev[bl];
  };

  // Igualdad "estricta-permisiva": exacto tras normalizar o con 1–2 errores leves
  const equalish = (a: string, b: string): boolean => {
    a = normalizeText(a);
    b = normalizeText(b);
    if (a === b) return true;
    const len = Math.max(a.length, b.length);
    const maxDist = len <= 6 ? 1 : 2;
    return levenshteinBounded(a, b, maxDist) <= maxDist;
  };

  // Normaliza diferentes posibles esquemas de tu JSON a uno único
  const normalizeCatalog = (raw: any): NormCatalog => {
    const base =
      raw?.baseMediaUrl || raw?.baseUrl || raw?.mediaBase || "/exercises/";
    const norm: NormCatalog = { baseMediaUrl: String(base), ejercicios: {} };

    if (raw?.ejercicios && !Array.isArray(raw.ejercicios)) {
      for (const [slug, v] of Object.entries<any>(raw.ejercicios)) {
        norm.ejercicios[String(slug)] = {
          nombre: (v as any)?.nombre || (v as any)?.name || "",
          grupo: (v as any)?.grupo || (v as any)?.group || "",
          aliases: Array.isArray((v as any)?.aliases) ? (v as any).aliases : [],
          img: (v as any)?.img || (v as any)?.image || "",
          equipamiento: Array.isArray((v as any)?.equipamiento)
            ? (v as any).equipamiento
            : [],
        };
      }
    } else if (Array.isArray(raw?.exercises)) {
      raw.exercises.forEach((e: any) => {
        const slug = String(
          e?.slug || e?.id || normalizeText(e?.nombre || e?.name || "")
        )
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        norm.ejercicios[slug] = {
          nombre: e?.nombre || e?.name || "",
          grupo: e?.grupo || e?.group || "",
          aliases: Array.isArray(e?.aliases) ? e.aliases : [],
          img: e?.img || e?.image || "",
          equipamiento: Array.isArray(e?.equipamiento) ? e.equipamiento : [],
        };
      });
    } else if (Array.isArray(raw)) {
      raw.forEach((e: any) => {
        const slug = String(
          e?.slug || normalizeText(e?.nombre || e?.name || "")
        )
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        norm.ejercicios[slug] = {
          nombre: e?.nombre || e?.name || "",
          grupo: e?.grupo || e?.group || "",
          aliases: Array.isArray(e?.aliases) ? e.aliases : [],
          img: e?.img || e?.image || "",
          equipamiento: Array.isArray(e?.equipamiento) ? e.equipamiento : [],
        };
      });
    }
    return norm;
  };

  const indexCatalog = useCallback((file: NormCatalog | null) => {
    catalogIndex.current = [];
    if (!file?.ejercicios) return;
    for (const [id, data] of Object.entries(file.ejercicios)) {
      const terms = new Set<string>();
      if (data.nombre) terms.add(normalizeText(data.nombre));
      (data.aliases || []).forEach((a) => terms.add(normalizeText(a)));
      catalogIndex.current.push({
        id,
        nombre: data.nombre,
        terms: Array.from(terms),
      });
    }
  }, []);

  // Match SOLO si el texto coincide con un nombre o alias (normalizado),
  // permitiendo typos leves. Nada de "contiene".
  const findExerciseId = useCallback((text: string): string | null => {
    const t = normalizeText(baseName(text));
    if (!t || !catalogIndex.current.length) return null;

    for (const it of catalogIndex.current) {
      for (const term of it.terms) {
        if (equalish(t, term)) return it.id; // exacto/near-exact
      }
    }
    return null; // → NO popup: se muestra solo el nombre plano
  }, []);

  const loadCatalog = useCallback(async () => {
    for (const url of CATALOGO_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const normalized = normalizeCatalog(raw);
        setCatalog(normalized);
        indexCatalog(normalized);
        // eslint-disable-next-line no-console
        console.log("✅ Catálogo cargado:", url);
        return;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Catálogo no disponible en", url, e);
      }
    }
    // fallback vacío para no romper la UI
    setCatalog({ baseMediaUrl: "/exercises/", ejercicios: {} });
    indexCatalog(null);
  }, [indexCatalog]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /* ───────────── Construir rutina desde la subcolección ───────────── */
  const buildRutinaFromSubcollection = useCallback(
    async (
      docPath: string
    ): Promise<{
      rutina: Record<string, RutinaDia>;
      order: string[];
    }> => {
      const col = collection(db, `${docPath}/rutinas`);
      const snap = await getDocs(col);

      type Row = { id: string; orden?: number; nombreDia?: string };
      const rows: Row[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          orden: typeof data?.orden === "number" ? data.orden : undefined,
          nombreDia: data?.nombreDia || "",
        });
      });

      rows.sort((a, b) => {
        const ao =
          typeof a.orden === "number" ? a.orden : Number.POSITIVE_INFINITY;
        const bo =
          typeof b.orden === "number" ? b.orden : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return a.id.localeCompare(b.id);
      });

      const rutinaMap: Record<string, RutinaDia> = {};
      const order: string[] = [];
      rows.forEach((r) => {
        rutinaMap[r.id] = { ejercicios: [], nombreDia: r.nombreDia || "" };
        order.push(r.id);
      });

      return { rutina: rutinaMap, order };
    },
    []
  );

  /* ───────────── Cargar cliente (cache + Firestore) ───────────── */
  const fetchCliente = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    // Reset de estructura interna
    setLoadedDias({});
    setRutinaOrder([]);
    setOpenDay(null);
    setDraftPesos({});
    setDraftSeries({});
    
    // Desactivar modo edición al recargar cliente
    setIsEditing(false);

    try {
      if (!dniFromUrl) {
        setCliente(null);
        setClienteDocPath(null);
        setErrorMsg("Falta DNI en la URL.");
        return;
      }

      // 1) Cache
      const cached = readCache(dniFromUrl);
      if (cached) {
        setCliente(cached.data);
        setClienteDocPath(cached.path);
        try {
          const { order } = await buildRutinaFromSubcollection(cached.path);
          setRutinaOrder(order);
        } catch {
          /* noop */
        }
        setLoading(false);
        return;
      }

      // 2) Firestore (cliente)
      const q = query(
        collectionGroup(db, "clientes"),
        where("dni", "==", dniFromUrl)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setCliente(null);
        setClienteDocPath(null);
        setErrorMsg(`No se encontró un cliente con el DNI ${dniFromUrl}.`);
        setLoading(false);
        return;
      }

      const cdoc = snapshot.docs[0];
      const cdata = cdoc.data() as Cliente;
      const base: Cliente = { ...cdata, rutina: {} };
      setClienteDocPath(cdoc.ref.path);

      // 3) Rutinas desde la subcolección
      const { rutina, order } = await buildRutinaFromSubcollection(
        cdoc.ref.path
      );
      const merged: Cliente = { ...base, rutina };
      setCliente(merged);
      setRutinaOrder(order);
      writeCache(dniFromUrl, { data: merged, path: cdoc.ref.path });
    } catch (e) {
      console.error("❌ Error cargando cliente:", e);
      setErrorMsg("Error al cargar el cliente. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [dniFromUrl, readCache, writeCache, buildRutinaFromSubcollection]);

  useEffect(() => {
    fetchCliente();
  }, [fetchCliente]);

  /* ───────────── Suscripción en vivo al documento del cliente (solo cabecera) ───────────── */
  useEffect(() => {
    if (!clienteDocPath || !dniFromUrl) return;

    const unsub = onSnapshot(docRef(db, clienteDocPath), (snap) => {
      if (!snap.exists()) return;
      const fresh = snap.data() as Cliente;

      setCliente((prev) => {
        // Si no había cliente previo, tomamos todo (incluida rutina si existiera)
        if (!prev) {
          const base: Cliente = {
            ...fresh,
            rutina: fresh.rutina ?? {},
          };
          writeCache(dniFromUrl, { data: base, path: clienteDocPath });
          return base;
        }

        // Solo actualizamos datos de cabecera, NO pisamos rutina
        const merged: Cliente = {
          ...prev,
          nombre: fresh.nombre,
          dni: fresh.dni,
          dias: fresh.dias,
          horario: fresh.horario,
          fechaVencimiento: fresh.fechaVencimiento,
          ultimaActualizacion: fresh.ultimaActualizacion,
          rutina: prev.rutina ?? fresh.rutina ?? {},
        };

        writeCache(dniFromUrl, { data: merged, path: clienteDocPath });
        return merged;
      });
    });

    return () => unsub();
  }, [clienteDocPath, dniFromUrl, writeCache]);

  /* ───────────── Carga perezosa de ejercicios al abrir ───────────── */
  const loadRutinaDia = useCallback(
    async (diaClave: string) => {
      if (!dniFromUrl || !clienteDocPath) return;

      const actual = cliente?.rutina || {};
      if (actual[diaClave]?.ejercicios?.length) {
        setLoadedDias((prev) => ({ ...prev, [diaClave]: true }));
        return;
      }

      try {
        const dref = docRef(db, `${clienteDocPath}/rutinas/${diaClave}`);
        const dSnap = await getDoc(dref);
        const diaData: RutinaDia = dSnap.exists()
          ? {
              ejercicios: (dSnap.data() as any).ejercicios || [],
              nombreDia:
                (dSnap.data() as any).nombreDia ||
                actual[diaClave]?.nombreDia ||
                "",
            }
          : { ejercicios: [], nombreDia: actual[diaClave]?.nombreDia || "" };

        setDraftPesos((prev) => ({
          ...prev,
          [diaClave]: (diaData.ejercicios || []).map((e) => e.peso ?? ""),
        }));
        setDraftSeries((prev) => ({
          ...prev,
          [diaClave]: (diaData.ejercicios || []).map((e) => e.series ?? ""),
        }));

        setCliente((prev) =>
          prev
            ? {
                ...prev,
                rutina: { ...(prev.rutina || {}), [diaClave]: diaData },
              }
            : prev
        );
        updateCacheRutinaDia(dniFromUrl, diaClave, diaData);
        setLoadedDias((prev) => ({ ...prev, [diaClave]: true }));
      } catch (e) {
        console.error("❌ Error cargando rutina del día:", e);
      }
    },
    [cliente?.rutina, clienteDocPath, dniFromUrl, updateCacheRutinaDia]
  );

  /* ───────────── Toggle + medición para animación ───────────── */
  const onToggleDay = useCallback(
    async (clave: string) => {
      const willOpen = openDay !== clave;
      if (willOpen) {
        await loadRutinaDia(clave);
      }
      requestAnimationFrame(() => {
        const el = contentRefs.current[clave];
        if (el) {
          const h = el.scrollHeight;
          setHeights((prev) => ({ ...prev, [clave]: h }));
        }
        setOpenDay((prev) => (prev === clave ? null : clave));
      });
    },
    [openDay, loadRutinaDia]
  );

  // Si cambia contenido del día abierto, volvemos a medir
  useEffect(() => {
    if (!openDay) return;
    const el = contentRefs.current[openDay];
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeights((prev) => ({ ...prev, [openDay]: el.scrollHeight }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [openDay, cliente?.rutina, draftPesos, draftSeries]);

  /* ───────────── Badge de vencimiento ───────────── */
  const {
    badgeClass,
    badgeText,
    vencida,
    diasRestantes,
    diasPillClass,
  } = useMemo(() => {
    const msPerDay = 24 * 60 * 60 * 1000;

    if (!cliente?.fechaVencimiento) {
      return {
        badgeClass: "text-green-400 font-semibold",
        badgeText: "Días restantes: 0",
        vencida: false,
        diasRestantes: 0,
        diasPillClass: "bg-emerald-100 text-emerald-700",
      };
    }

    const [anio, mes, dia] = cliente.fechaVencimiento.split("-").map(Number);

    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const vencMid = new Date(anio, (mes || 1) - 1, dia || 1);

    const diffDays = Math.floor(
      (vencMid.getTime() - todayMid.getTime()) / msPerDay
    );

    const dias = Math.max(diffDays, 0);
    const isVencida = diffDays <= 0;

    let cls = "text-green-400 font-semibold";
    if (isVencida) cls = "text-red-500 font-semibold";
    else if (dias <= 7) cls = "text-red-500 font-semibold";
    else if (dias <= 14) cls = "text-yellow-400 font-semibold";

    const pill = isVencida
      ? "bg-red-100 text-red-700"
      : dias <= 7
      ? "bg-red-100 text-red-700"
      : dias <= 14
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

    const text = isVencida ? "CUOTA VENCIDA" : `Días restantes: ${dias}`;

    return {
      badgeClass: cls,
      badgeText: text,
      vencida: isVencida,
      diasRestantes: dias,
      diasPillClass: pill,
    };
  }, [cliente?.fechaVencimiento]);

  // Mostrar popup de vencimiento
  useEffect(() => {
    if (vencida) {
      setShowVencidoModal(true);
      setShowSoonModal(false);
      return;
    }
    if (!vencida && diasRestantes > 0 && diasRestantes <= 7) {
      setShowSoonModal(true);
    } else {
      setShowSoonModal(false);
    }
  }, [vencida, diasRestantes]);

  /* ───────────── Handlers de edición (peso/series) ───────────── */
  const handlePesoChange = (dia: string, index: number, value: string) => {
    setDraftPesos((prev) => {
      const current = prev[dia] ?? [];
      const next = [...current];
      next[index] = value;
      return { ...prev, [dia]: next };
    });
    setLoadedDias((prev) => ({ ...prev, [dia]: true }));
    setIsDirty(true);
    setSaveMsg(null);
  };

  const handleSeriesChange = (dia: string, index: number, value: string) => {
    setDraftSeries((prev) => {
      const current = prev[dia] ?? [];
      const next = [...current];
      next[index] = value;
      return { ...prev, [dia]: next };
    });
    setLoadedDias((prev) => ({ ...prev, [dia]: true }));
    setIsDirty(true);
    setSaveMsg(null);
  };

  /* ───────────── Edición de nombre de día ───────────── */
  const handleNombreDiaChange = (dia: string, value: string) => {
    setCliente((prev) => {
      if (!prev) return prev;
      const rutina = { ...(prev.rutina || {}) };
      const diaData: RutinaDia = rutina[dia] || { ejercicios: [] };
      rutina[dia] = { ...diaData, nombreDia: value };
      return { ...prev, rutina };
    });
    setIsDirty(true);
    setSaveMsg(null);
  };

  /* ───────────── Crear día ───────────── */
  const handleAddDay = () => {
    setCliente((prev) => {
      if (!prev) return prev;
      const newId = `dia_${Date.now()}`;
      const currentRutina = prev.rutina || {};

      const newRutina: Record<string, RutinaDia> = {
        ...currentRutina,
        [newId]: { ejercicios: [], nombreDia: "" },
      };

      setRutinaOrder(Object.keys(newRutina));
      setLoadedDias((prevLoaded) => ({ ...prevLoaded, [newId]: true }));

      setDraftPesos((draftPrev) => ({ ...draftPrev, [newId]: [] }));
      setDraftSeries((draftPrev) => ({ ...draftPrev, [newId]: [] }));
      setOpenDay(newId);

      setTimeout(() => {
        const el = contentRefs.current[newId];
        if (el) {
          setHeights((prevHeights) => ({
            ...prevHeights,
            [newId]: el.scrollHeight,
          }));
        }
      }, 0);

      setIsDirty(true);
      setSaveMsg(null);

      return { ...prev, rutina: newRutina };
    });
  };

  /* ───────────── Reordenar días ───────────── */
  const handleMoveDay = (dia: string, direction: "up" | "down") => {
    setRutinaOrder((prevOrder) => {
      const idx = prevOrder.indexOf(dia);
      if (idx === -1) return prevOrder;
      if (direction === "up" && idx === 0) return prevOrder;
      if (direction === "down" && idx === prevOrder.length - 1) return prevOrder;

      const newOrder = [...prevOrder];
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      [newOrder[idx], newOrder[swapWith]] = [newOrder[swapWith], newOrder[idx]];
      return newOrder;
    });
    setIsDirty(true);
    setSaveMsg(null);
  };

  /* ───────────── Request delete (abre popup) ───────────── */
  const requestDeleteDay = (dia: string) => {
    setDeleteTarget({ type: "day", dia });
  };

  const requestDeleteExercise = (dia: string, index: number) => {
    setDeleteTarget({ type: "exercise", dia, index });
  };

  /* ───────────── Confirmación en popup ───────────── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      if (deleteTarget.type === "day") {
        const dia = deleteTarget.dia;

        // quitar de estado local
        setCliente((prev) => {
          if (!prev) return prev;
          const rutina = { ...(prev.rutina || {}) };
          delete rutina[dia];
          return { ...prev, rutina };
        });

        setRutinaOrder((prev) => prev.filter((k) => k !== dia));
        setDraftPesos((prev) => {
          const copy = { ...prev };
          delete copy[dia];
          return copy;
        });
        setDraftSeries((prev) => {
          const copy = { ...prev };
          delete copy[dia];
          return copy;
        });
        setHeights((prev) => {
          const copy = { ...prev };
          delete copy[dia];
          return copy;
        });
        setLoadedDias((prev) => {
          const copy = { ...prev };
          delete copy[dia];
          return copy;
        });
        if (openDay === dia) setOpenDay(null);

        setIsDirty(true);
        setSaveMsg(null);

        // Firestore
        if (clienteDocPath) {
          try {
            await deleteDoc(docRef(db, `${clienteDocPath}/rutinas/${dia}`));
          } catch (e) {
            console.error("❌ Error eliminando día en Firestore:", e);
          }
        }
      } else {
        const { dia, index } = deleteTarget;

        // Estado local
        setCliente((prev) => {
          if (!prev) return prev;
          const rutina = { ...(prev.rutina || {}) };
          const diaData: RutinaDia = rutina[dia] || { ejercicios: [] };
          const ejercicios = [...(diaData.ejercicios || [])];
          ejercicios.splice(index, 1);
          rutina[dia] = { ...diaData, ejercicios };
          return { ...prev, rutina };
        });

        setDraftPesos((prev) => {
          const arr = prev[dia] ? [...prev[dia]] : [];
          arr.splice(index, 1);
          return { ...prev, [dia]: arr };
        });

        setDraftSeries((prev) => {
          const arr = prev[dia] ? [...prev[dia]] : [];
          arr.splice(index, 1);
          return { ...prev, [dia]: arr };
        });

        setLoadedDias((prev) => ({ ...prev, [dia]: true }));
        setIsDirty(true);
        setSaveMsg(null);
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  /* ───────────── Añadir / editar ejercicios ───────────── */
  const handleEjercicioNombreChange = (
    dia: string,
    index: number,
    value: string
  ) => {
    setCliente((prev) => {
      if (!prev) return prev;
      const rutina = { ...(prev.rutina || {}) };
      const diaData: RutinaDia = rutina[dia] || { ejercicios: [] };
      const ejercicios = [...(diaData.ejercicios || [])];

      if (!ejercicios[index]) {
        ejercicios[index] = { ejercicio: "", peso: "", series: "" };
      }
      ejercicios[index] = { ...ejercicios[index], ejercicio: value };
      rutina[dia] = { ...diaData, ejercicios };
      return { ...prev, rutina };
    });
    setLoadedDias((prev) => ({ ...prev, [dia]: true }));
    setIsDirty(true);
    setSaveMsg(null);
  };

  const handleAddExercise = (dia: string) => {
    setCliente((prev) => {
      if (!prev) return prev;
      const rutina = { ...(prev.rutina || {}) };
      const diaData: RutinaDia = rutina[dia] || {
        ejercicios: [],
        nombreDia: "",
      };
      const ejercicios = [...(diaData.ejercicios || [])];
      ejercicios.push({ ejercicio: "", peso: "", series: "" });
      rutina[dia] = { ...diaData, ejercicios };
      return { ...prev, rutina };
    });

    setDraftPesos((prev) => {
      const arr = prev[dia] ? [...prev[dia]] : [];
      arr.push("");
      return { ...prev, [dia]: arr };
    });
    setDraftSeries((prev) => {
      const arr = prev[dia] ? [...prev[dia]] : [];
      arr.push("");
      return { ...prev, [dia]: arr };
    });

    setLoadedDias((prev) => ({ ...prev, [dia]: true }));
    setIsDirty(true);
    setSaveMsg(null);
  };

  /* ───────────── Reordenar ejercicios ───────────── */
  const handleMoveExercise = (
    dia: string,
    index: number,
    direction: "up" | "down"
  ) => {
    setCliente((prev) => {
      if (!prev) return prev;
      const rutina = { ...(prev.rutina || {}) };
      const diaData: RutinaDia = rutina[dia] || { ejercicios: [] };
      const ejercicios = [...(diaData.ejercicios || [])];
      if (index < 0 || index >= ejercicios.length) return prev;
      if (direction === "up" && index === 0) return prev;
      if (direction === "down" && index === ejercicios.length - 1) return prev;

      const swapWith = direction === "up" ? index - 1 : index + 1;
      [ejercicios[index], ejercicios[swapWith]] = [
        ejercicios[swapWith],
        ejercicios[index],
      ];
      rutina[dia] = { ...diaData, ejercicios };
      return { ...prev, rutina };
    });

    // Reordenar pesos
    setDraftPesos((prev) => {
      const arr = prev[dia] ? [...prev[dia]] : [];
      if (index < 0 || index >= arr.length) return prev;
      if (direction === "up" && index === 0) return prev;
      if (direction === "down" && index === arr.length - 1) return prev;
      const swapWith = direction === "up" ? index - 1 : index + 1;
      [arr[index], arr[swapWith]] = [arr[swapWith], arr[index]];
      return { ...prev, [dia]: arr };
    });

    // Reordenar series
    setDraftSeries((prev) => {
      const arr = prev[dia] ? [...prev[dia]] : [];
      if (index < 0 || index >= arr.length) return prev;
      if (direction === "up" && index === 0) return prev;
      if (direction === "down" && index === arr.length - 1) return prev;
      const swapWith = direction === "up" ? index - 1 : index + 1;
      [arr[index], arr[swapWith]] = [arr[swapWith], arr[index]];
      return { ...prev, [dia]: arr };
    });

    setLoadedDias((prev) => ({ ...prev, [dia]: true }));
    setIsDirty(true);
    setSaveMsg(null);
  };

  /* ───────────── Orden efectivo de días ───────────── */
  const orderedKeys = useMemo(
    () =>
      rutinaOrder.length
        ? rutinaOrder
        : Object.keys(cliente?.rutina || {}),
    [rutinaOrder, cliente?.rutina]
  );

  /* ───────────── Guardar todo ───────────── */
  const onSaveAll = async () => {
    if (!cliente || !clienteDocPath) return;
    setSaving(true);
    setErrorMsg(null);
    setSaveMsg(null);

    try {
      const allDays = orderedKeys;

      await Promise.all(
        allDays.map(async (dia, idx) => {
          const rutinaDiaLocal = cliente.rutina?.[dia];
          if (!rutinaDiaLocal) return;

          const dref = docRef(db, `${clienteDocPath}/rutinas/${dia}`);
          const snap = await getDoc(dref);
          const existingEjercicios: Ejercicio[] = snap.exists()
            ? ((snap.data() as any).ejercicios || [])
            : [];

          // Día que NO se abrió ni se tocó en esta sesión:
          // nunca tocamos ejercicios para no arriesgar borrarlos.
          if (!loadedDias[dia]) {
            await setDoc(
              dref,
              {
                nombreDia: rutinaDiaLocal.nombreDia || "",
                orden: idx + 1,
              },
              { merge: true }
            );
            return;
          }

          // Día cargado/edidato: base = lo que está en memoria si hay datos,
          // y si por algún bug está vacío, usamos el servidor como respaldo.
          const baseEjercicios =
            Array.isArray(rutinaDiaLocal.ejercicios) &&
            rutinaDiaLocal.ejercicios.length > 0
              ? rutinaDiaLocal.ejercicios
              : existingEjercicios;

          const updatedEjercicios = baseEjercicios.map((ej, i) => ({
            ...ej,
            peso: draftPesos[dia]?.[i] ?? ej.peso ?? "",
            series: draftSeries[dia]?.[i] ?? ej.series ?? "",
          }));

          await setDoc(
            dref,
            {
              ejercicios: updatedEjercicios,
              nombreDia: rutinaDiaLocal.nombreDia || "",
              orden: idx + 1,
            },
            { merge: true }
          );

          const diaData: RutinaDia = {
            ...rutinaDiaLocal,
            ejercicios: updatedEjercicios,
          };
          setCliente((prev) =>
            prev
              ? {
                  ...prev,
                  rutina: { ...(prev.rutina || {}), [dia]: diaData },
                }
              : prev
          );
          updateCacheRutinaDia(dniFromUrl, dia, diaData);
        })
      );

      setIsDirty(false);
      setSaveMsg("¡Cambios guardados!");
    } catch (e) {
      console.error("❌ Error guardando cambios:", e);
      setErrorMsg("No se pudieron guardar los cambios. Intenta nuevamente.");
    } finally {
      setSaving(false);
      if (openDay) {
        requestAnimationFrame(() => {
          const el = contentRefs.current[openDay];
          if (el)
            setHeights((prev) => ({
              ...prev,
              [openDay]: el.scrollHeight,
            }));
        });
      }
    }
  };

  /* ───────────── UI ───────────── */
  if (loading) return <p className="p-6 text-center">Cargando...</p>;

  if (!cliente) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4">
        <p className="mb-2">
          No se encontró un cliente con el DNI {dniFromUrl}
        </p>
        {errorMsg && <p className="text-red-600 mb-4">{errorMsg}</p>}
        <button
          onClick={() => navigate("/gym-manager/")}
          className="mt-2 bg-gray-400 hover:bg-gray-500 px-4 py-2 rounded text-white"
        >
          Volver
        </button>
      </div>
    );
  }

  const renderModal = () => {
    if (!modalEjId || !catalog || !catalog.ejercicios[modalEjId]) return null;
    const ej = catalog.ejercicios[modalEjId];
    const base = (catalog.baseMediaUrl || "/exercises/").replace(/\/+$/, "/");
    const imgUrl = ej.img
      ? ej.img.startsWith("http")
        ? ej.img
        : base + ej.img.replace(/^\/+/, "")
      : "";

    return (
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalEjId(null);
        }}
      >
        <div className="bg-white rounded-lg shadow-xl w-[calc(100%-2rem)] max-w-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-[#0f1c3f] font-semibold">{ej.nombre}</h3>
            <button
              className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1"
              onClick={() => setModalEjId(null)}
            >
              Cerrar
            </button>
          </div>
          <div className="p-4">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={ej.nombre}
                className="w-full h-auto aspect-auto rounded border"
              />
            ) : (
              <div className="text-gray-600">Imagen no disponible</div>
            )}
            {ej.grupo ? (
              <p className="mt-3 text-sm text-gray-700">
                <strong>Grupo principal:</strong> {ej.grupo}
              </p>
            ) : null}
            {ej.equipamiento?.length ? (
              <p className="mt-1 text-sm text-gray-600">
                <strong>Equipamiento:</strong> {ej.equipamiento.join(", ")}
              </p>
            ) : null}
            {ej.aliases?.length ? (
              <p className="mt-1 text-sm text-gray-500">
                <strong>También llamado:</strong> {ej.aliases.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Link 
          to={HOMEPAGE_PATH} 
          className="absolute top-4 left-4 p-2 px-3 rounded-full bg-white/80 shadow-md hover:bg-white transition-colors flex items-center space-x-2"
          title="Volver a la página principal"
      >
          {/* 1. Imagen rotada 180 grados */}
          <img 
              src={flechaImg} 
              alt="Página Principal" 
              className="w-5 h-5" 
          />
          {/* 2. Texto "Página Principal" */}
          <span className="text-sm font-medium text-gray-700 hidden sm:inline">
              Página Principal
          </span>
      </Link>
      <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-2 sm:p-4"> 
        <div className="w-full max-w-md">
          {/* Encabezado */}
          <header className="bg-[#0f1c3f] text-white rounded-t-lg shadow p-4">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between items-center">
                <h1 className="font-bold text-lg">
                  {cliente.nombre?.toUpperCase()}
                </h1>
                <span>{cliente.dias?.length || 0} veces x semana</span>
              </div>
              <div className="flex justify-between items-center">
                {vencida ? (
                  <span className={badgeClass}>CUOTA VENCIDA</span>
                ) : (
                  <span className="font-semibold">
                    Días restantes:{" "}
                    <span
                      className={`${diasPillClass} inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-[13px]`}
                      title={badgeText}
                    >
                      {diasRestantes}
                    </span>
                  </span>
                )}

                <span>{(cliente.dias || []).join(" - ")}</span>
              </div>
            </div>
          </header>

          {/* Rutina */}
          <div className="bg-white shadow rounded-b-lg p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h2 className="font-semibold text-gray-700 text-sm sm:text-base">
                Rutina
              </h2>
              
              {/* Botón de Modo Edición / Salir Modo Edición */}
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition shadow-sm ${
                  isEditing
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {isEditing ? "Salir Modo Edición" : "Modo Edición"}
              </button>
            </div>

          	{/* Botón "+ Agregar nuevo día" (Solo en modo Edición) */}
          	{isEditing && (
          		<div className="flex items-center justify-end mb-3">
          			<button
          				type="button"
          				onClick={handleAddDay}
          				className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-green-600 text-white hover:bg-green-700 shadow-sm"
          			>
          				+ Agregar nuevo día
          			</button>
          		</div>
          	)}

            {errorMsg && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {errorMsg}
              </div>
            )}
            {saveMsg && (
              <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                {saveMsg}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {orderedKeys.map((clave, idx) => {
                const rutinaDia = cliente.rutina?.[clave];
                const nombreExtra = rutinaDia?.nombreDia || "";
                const diaLabel = `Día ${idx + 1}`;
                const isOpen = openDay === clave;
                const contentHeight = heights[clave] ?? 0;

                return (
                  <div
                    key={clave}
                    className="bg-gray-100 rounded shadow-sm overflow-hidden"
                  >
                    {/* Header del día */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onToggleDay(clave)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          onToggleDay(clave);
                      }}
                      className="w-full flex flex-col px-4 py-3 font-medium cursor-pointer bg-gray-100" // Cambiado a flex-col para el input debajo
                      aria-expanded={isOpen}
                      aria-controls={`panel-${clave}`}
                    >
                      {/* Fila principal: Nombre del Día + Botones de Edición (Horizontal) */}
                      <div className="flex items-center justify-between w-full gap-2">
                        {/* Nombre del día / Título */}
                        <span className="font-semibold text-sm text-gray-900 flex-grow">
                          {diaLabel}
                          {nombreExtra && (
                            <span className="text-xs text-gray-600 ml-1">
                              - {nombreExtra}
                            </span>
                          )}
                        </span>

                        {/* Botones Mover/Eliminar Día (solo en modo edición) */}
                        {isEditing && (
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()} // Detener propagación para no cerrar el acordeón
                          >
                            {/* Botones mover día */}
                            <button
                              type="button"
                              className="text-[11px] px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50"
                              onClick={() => handleMoveDay(clave, "up")}
                              disabled={idx === 0}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="text-[11px] px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50"
                              onClick={() => handleMoveDay(clave, "down")}
                              disabled={idx === orderedKeys.length - 1}
                            >
                              ↓
                            </button>

                            {/* Eliminar día */}
                            <button
                              type="button"
                              className="text-[11px] text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                              onClick={() => requestDeleteDay(clave)}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                        
                        {/* Flecha de apertura */}
                        <span
                          className={`ml-3 shrink-0 transform transition-transform duration-300 text-gray-700 ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                        >
                          ∨
                        </span>
                      </div>
                      
                      {/* INPUT Nombre Día (debajo, solo en modo edición) */}
                      {isEditing && (
                        <div
                          className="mt-2 w-full" // Ocupa todo el ancho
                          onClick={(e) => e.stopPropagation()} // Evitar toggle al hacer click en el input
                        >
                          <input
                            type="text"
                            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="Nombre del día (ej: Full body, Piernas, Push...)"
                            value={nombreExtra}
                            onChange={(e) =>
                              handleNombreDiaChange(clave, e.target.value)
                            }
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Panel de ejercicios */}
                    <div
                      id={`panel-${clave}`}
                      ref={(el) => {
                        contentRefs.current[clave] = el;
                      }}
                      className="overflow-hidden transition-[height] duration-300 ease-in-out px-4"
                      style={{ height: isOpen ? contentHeight : 0 }}
                    >
                      <div className="py-3">
                        {!rutinaDia && (
                          <p className="text-gray-500 text-sm">
                            Cargando ejercicios...
                          </p>
                        )}

                        {rutinaDia &&
                          Array.isArray(rutinaDia.ejercicios) &&
                          rutinaDia.ejercicios.length === 0 && (
                            <p className="text-gray-500 text-sm">
                              Todavía no hay ejercicios en este día.
                            </p>
                          )}

                        {rutinaDia && Array.isArray(rutinaDia.ejercicios) && (
                          <div className="space-y-3">
                              {/* Etiquetas Series y Peso (solo si no estamos editando) */}
                              {!isEditing && rutinaDia.ejercicios.length > 0 && (
                                  <div className="hidden sm:grid grid-cols-12 gap-2 text-gray-500 text-[10px] font-medium uppercase mb-1 border-b border-gray-300 pb-1">
                                      {/* Ajuste de columnas para que coincida con el modo de visualización */}
                                      <div className="sm:col-span-1"></div> 
                                      <div className="sm:col-span-7 pl-1">Ejercicio</div>
                                      <div className="sm:col-span-2 text-center">Series</div>
                                      <div className="sm:col-span-2 text-right pr-1">Peso</div>
                                  </div>
                              )}

                            {rutinaDia.ejercicios.map((ej, origIndex) => {
                              const nombreEj = ej?.ejercicio ?? "";
                              const pesoValue =
                                draftPesos[clave]?.[origIndex] ??
                                (rutinaDia.ejercicios[origIndex]?.peso ?? "");
                              const seriesValue =
                                draftSeries[clave]?.[origIndex] ??
                                (rutinaDia.ejercicios[origIndex]?.series ?? "");
                              const ejId =
                                nombreEj.trim() !== ""
                                  ? findExerciseId(nombreEj)
                                  : null;

                              
                              return (
                                <div
                                  key={`${clave}-${origIndex}`}
                                  className={`border-b border-gray-200 pb-3 last:border-b-0 ${isEditing ? 'space-y-1' : 'grid grid-cols-12 gap-2 items-start'}`}
                                >
                                  {isEditing ? (
                                      /* ────────── MODO EDICIÓN ────────── */
                                      <div className="flex flex-col gap-1">
                                          {/* Fila 1: Ejercicio */}
                                          <label className="text-[10px] font-medium text-gray-500 uppercase">Ejercicio</label>
                                          <input
                                              type="text"
                                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                              placeholder="Nombre del ejercicio"
                                              value={nombreEj}
                                              onChange={(e) =>
                                                  handleEjercicioNombreChange(
                                                      clave,
                                                      origIndex,
                                                      e.target.value
                                                  )
                                              }
                                          />

                                          {/* Fila 2: Series y Peso (Grid 2/3) + Botones Control (1/3) */}
                                          <div className="grid grid-cols-2 gap-2">
                                              {/* Series (Col 1) */}
                                              <div className="col-span-1 flex flex-col gap-1">
                                                  <label className="text-[10px] font-medium text-gray-500 uppercase">Series</label>
                                                  <input
                                                      type="text"
                                                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-center bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                      placeholder="Series"
                                                      value={seriesValue}
                                                      onChange={(e) =>
                                                          handleSeriesChange(
                                                              clave,
                                                              origIndex,
                                                              e.target.value
                                                          )
                                                      }
                                                  />
                                              </div>
                                              {/* Peso (Col 2) */}
                                              <div className="col-span-1 flex flex-col gap-1">
                                                  <label className="text-[10px] font-medium text-gray-500 uppercase">Peso</label>
                                                  <input
                                                      type="text"
                                                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-center bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                      placeholder="Peso"
                                                      value={pesoValue}
                                                      onChange={(e) =>
                                                          handlePesoChange(
                                                              clave,
                                                              origIndex,
                                                              e.target.value
                                                          )
                                                      }
                                                  />
                                              </div>
                                              {/* Botones de Control (Col 3) */}
                                              <div className="col-span-1 flex items-end justify-between gap-1 h-full">
                                                  <button
                                                      type="button"
                                                      className="text-[10px] w-[100%] px-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 leading-none h-6 disabled:opacity-50"
                                                      onClick={() => handleMoveExercise(clave, origIndex, "up")}
                                                      disabled={origIndex === 0}
                                                  >
                                                      ↑
                                                  </button>
                                                  <button
                                                      type="button"
                                                      className="text-[10px] w-[100%] px-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 leading-none h-6 disabled:opacity-50"
                                                      onClick={() => handleMoveExercise(clave, origIndex, "down")}
                                                      disabled={origIndex === rutinaDia.ejercicios.length - 1}
                                                  >
                                                      ↓
                                                  </button>
                                              </div>
                                              <div className="col-span-1 flex items-end justify-between gap-1 h-full">
                                                  <button
                                                      type="button"
                                                      className="w-[100%] text-red-600 hover:text-red-700 text-[10px] p-1 border border-red-200 rounded leading-none h-6"
                                                      onClick={() => requestDeleteExercise(clave, origIndex)}
                                                  >
                                                      Eliminar
                                                  </button>
                                              </div>

                                          </div>
                                      </div>
                                  ) : (
                                      /* ────────── MODO VISUALIZACIÓN ────────── */
                                      <>
                                          {/* Columna de Movimiento (oculta en visualización) */}
                                          <div className="sm:col-span-1 hidden sm:block"></div> 

                                          {/* Ejercicio */}
                                          <div className="col-span-12 sm:col-span-7 flex flex-col gap-1">
                                              <p className="font-semibold text-sm text-gray-800 break-words pt-1.5">
                                                  {nombreEj}
                                              </p>
                                              {ejId && nombreEj.trim() !== "" && (
                                                  <button
                                                      type="button"
                                                      className="self-start text-[11px] text-indigo-600 hover:text-indigo-700 underline decoration-dotted"
                                                      onClick={() => setModalEjId(ejId)}
                                                  >
                                                      Ver técnica / imagen
                                                  </button>
                                              )}
                                          </div>

                                          {/* Series */}
                                          <div className="col-span-6 sm:col-span-2 flex flex-col items-center">
                                              <p className="font-semibold text-sm text-gray-800 break-words mt-1.5 sm:mt-0">
                                                  {seriesValue || <span className="text-gray-400">-</span>}
                                              </p>
                                              {/* Etiqueta debajo solo en móvil para visualización */}
                                              <p className="sm:hidden text-[10px] text-gray-500 font-medium mt-0.5">Series</p>
                                          </div>

                                          {/* Peso */}
                                          <div className="col-span-6 sm:col-span-2 flex flex-col items-end">
                                              <p className="font-semibold text-sm text-gray-800 break-words mt-1.5 sm:mt-0">
                                                  {pesoValue || <span className="text-gray-400">-</span>}
                                              </p>
                                              {/* Etiqueta debajo solo en móvil para visualización */}
                                              <p className="sm:hidden text-[10px] text-gray-500 font-medium mt-0.5">Peso</p>
                                          </div>
                                          
                                      </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        
                        	{/* Botón Agregar Ejercicio (solo en modo edición) */}
                        	{isEditing && (
                        		<div className="mt-3">
                        			<button
                        				type="button"
                        				className="w-full text-xs font-medium px-3 py-2 rounded border border-dashed border-indigo-400 text-indigo-600 hover:bg-indigo-50"
                        				onClick={() => handleAddExercise(clave)}
                        			>
                        				+ Agregar ejercicio
                        			</button>
                        		</div>
                        	)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {orderedKeys.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  Todavía no tenés días cargados en tu rutina. Podés crear uno al
                  activar el <span className="font-semibold">“Modo Edición”</span>.
                </p>
              )}
            </div>

            {/* Barra sticky de guardado */}
            <div
              className="
                sticky bottom-0 
                mt-4 -mx-4 px-4 
                pt-3 pb-3 
                bg-white/95 backdrop-blur 
                border-t border-gray-200 
                flex items-center justify-between gap-3
              "
            >
              <span className="text-[11px] text-gray-500">
                {isDirty
                  ? "Tenés cambios sin guardar"
                  : "Todos los cambios están guardados"}
              </span>

              <button
                disabled={!isDirty || saving}
                onClick={onSaveAll}
                className={`px-4 py-2 rounded text-white text-xs sm:text-sm font-medium transition
                  ${
                    !isDirty || saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>

          <div className="text-center my-6">
            <button
              onClick={() => navigate("/gym-manager/")}
              className="bg-gray-400 hover:bg-gray-500 px-6 py-2 rounded text-white"
            >
              Volver
            </button>
          </div>
        </div>

        {/* Modal imagen/técnica del ejercicio */}
        {renderModal()}

        {/* Popup de cuota vencida (fuerte, rojo) */}
        {showVencidoModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowVencidoModal(false);
            }}
          >
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
              <div className="px-5 py-3 bg-red-600 text-white font-semibold">
                ⚠️ Aviso importante
              </div>
              <div className="p-5 space-y-3">
                <p className="text-base text-gray-800">
                  Tu cuota se encuentra{" "}
                  <span className="font-semibold text-red-600">VENCIDA</span>.
                </p>
                <p className="text-sm text-gray-600">
                  Para continuar entrenando sin interrupciones, por favor
                  regularizá tu pago en recepción.
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => setShowVencidoModal(false)}
                  >
                    Cerrar
                  </button>
                </div>
                </div>
            </div>
          </div>
        )}

        {/* Popup suave de aviso (<= 7 días, no rojo) */}
        {showSoonModal && !showVencidoModal && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSoonModal(false);
            }}
          >
            <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden border border-amber-200">
              <div className="px-5 py-3 bg-amber-100 text-amber-900 font-medium">
                Recordatorio
              </div>
              <div className="p-5 space-y-3">
                <p className="text-base text-gray-800">
                  Te quedan{" "}
                  <span className="font-semibold">{diasRestantes}</span>{" "}
                  {diasRestantes === 1 ? "día" : "días"} para el vencimiento de tu
                  cuota.
                </p>
                <p className="text-sm text-gray-600">
                  Podés gestionar el pago en recepción para evitar interrupciones.
                </p>
                <div className="mt-3 flex justify-end">
                  <button
                    className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-900 text-white"
                    onClick={() => setShowSoonModal(false)}
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Popup de confirmación de borrado (días / ejercicios) */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleting)
                setDeleteTarget(null);
            }}
          >
            <div className="w-full max-w-sm bg-white rounded-lg shadow-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-100 text-gray-900 font-semibold text-sm">
                {deleteTarget.type === "day"
                  ? "Eliminar día de la rutina"
                  : "Eliminar ejercicio"}
              </div>
              <div className="p-5 space-y-3 text-sm text-gray-700">
                <p>
                  {deleteTarget.type === "day"
                    ? "¿Querés eliminar este día completo de la rutina? Esta acción no se puede deshacer."
                    : "¿Querés eliminar este ejercicio de este día? Esta acción no se puede deshacer."}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
                    disabled={deleting}
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
                    onClick={confirmDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>

  );
};

export default ClienteView;