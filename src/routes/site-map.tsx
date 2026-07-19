import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Upload, Download, MapPin, Trash2, Save, Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { SiteMap, SitePoint, SiteMapKind, DetectionSource } from "@/types/room";

// Leaflet is a browser-only library (touches window/document). Import
// lazily so SSR / build:dev never executes it.
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

// CORRECTIF (lot 9) : suite au durcissement RLS appliqué par l'agent de
// sécurité Lovable sur `site_maps` (colonne user_id + policies scopées
// auth.uid() = user_id, lecture anonyme révoquée), cette page était cassée :
// createNew() insérait sans user_id (violerait désormais la policy
// d'insertion) et loadMaps() ne filtrait pas explicitement par utilisateur.
// Comme la table n'accepte plus du tout l'accès anonyme, la page est
// maintenant réservée aux comptes connectés — ce n'était pas prévu à
// l'origine (le Volet B était en accès libre), mais c'est la conséquence
// directe et nécessaire du correctif de sécurité, pas un choix arbitraire.
//
// ⚠️ Les plans de site créés AVANT ce correctif ont probablement un
// user_id NULL en base — ils sont désormais inaccessibles à qui que ce
// soit via l'app (RLS bloque tout NULL, y compris pour l'auteur d'origine).
// Ce ne sont pas des données perdues, juste orphelines : un administrateur
// peut les réattribuer manuellement via une requête SQL du type
// `UPDATE public.site_maps SET user_id = '<uuid-du-compte>' WHERE user_id IS NULL;`
// dans l'éditeur SQL Supabase, si nécessaire.

export const Route = createFileRoute("/site-map")({
  head: () => ({
    meta: [
      { title: "Plan de site — MosquitoRadar" },
      { name: "description", content: "Plan indoor ou carte géoréférencée avec pins capteurs, exportable en GeoJSON." },
    ],
  }),
  component: SiteMapPage,
});

const SENSOR_TYPES: { key: DetectionSource; label: string }[] = [
  { key: "live", label: "Micro live" },
  { key: "sd_import", label: "Logger SD" },
  { key: "wifi_sensor", label: "Capteur WiFi" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SiteMapPage() {
  const { user, loading: authLoading } = useAuth();
  const [maps, setMaps] = useState<SiteMap[]>([]);
  const [selected, setSelected] = useState<SiteMap | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) void loadMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadMaps = async () => {
    if (!user) return;
    // Le filtre explicite ci-dessous est redondant avec la RLS (qui ne
    // renverrait de toute façon que les lignes de cet utilisateur) mais le
    // garder rend l'intention explicite dans le code, plutôt que de
    // dépendre silencieusement du comportement serveur.
    const { data, error } = await supabase
      .from("site_maps")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Impossible de charger les plans");
      return;
    }
    setMaps(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind as SiteMapKind,
        backgroundImageUrl: row.background_image_url ?? undefined,
        sensors: (row.sensors as unknown as SitePoint[]) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    );
  };

  const createNew = async (kind: SiteMapKind) => {
    if (!user) return;
    const name = window.prompt("Nom du plan de site :", kind === "outdoor_geo" ? "Nouveau site (GPS)" : "Nouveau plan intérieur");
    if (!name) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("site_maps")
      .insert({ name, kind, sensors: [], user_id: user.id })
      .select()
      .single();
    setLoading(false);
    if (error || !data) {
      toast.error("Création impossible : " + (error?.message ?? "erreur inconnue"));
      return;
    }
    toast.success("Plan créé");
    await loadMaps();
    setSelected({
      id: data.id,
      name: data.name,
      kind: data.kind as SiteMapKind,
      backgroundImageUrl: data.background_image_url ?? undefined,
      sensors: [],
    });
  };

  const persist = async (m: SiteMap) => {
    const { error } = await supabase
      .from("site_maps")
      .update({
        name: m.name,
        background_image_url: m.backgroundImageUrl ?? null,
        sensors: m.sensors as unknown as never,
      })
      .eq("id", m.id);
    if (error) toast.error("Sauvegarde impossible : " + error.message);
    else toast.success("Plan sauvegardé");
    await loadMaps();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce plan ?")) return;
    const { error } = await supabase.from("site_maps").delete().eq("id", id);
    if (error) toast.error("Suppression impossible : " + error.message);
    if (selected?.id === id) setSelected(null);
    await loadMaps();
  };

  const exportGeo = (m: SiteMap) => {
    if (m.kind === "outdoor_geo") {
      const fc = {
        type: "FeatureCollection",
        features: m.sensors
          .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
          .map((s) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lng, s.lat] },
            properties: {
              name: s.name,
              type: s.sensorType,
              lastSeen: s.lastSeen ?? null,
              notes: s.notes ?? null,
            },
          })),
      };
      downloadBlob(JSON.stringify(fc, null, 2), `${m.name.replace(/\s+/g, "_")}.geojson`, "application/geo+json");
    } else {
      const doc = {
        format: "MosquitoRadar Indoor SiteMap v1",
        description:
          "Coordinates x/y are expressed in percent (0-100) of the background image. Import into any GIS tool by treating the image as a raster overlay and converting %s to pixels.",
        name: m.name,
        backgroundImageUrl: m.backgroundImageUrl ?? null,
        sensors: m.sensors,
      };
      downloadBlob(JSON.stringify(doc, null, 2), `${m.name.replace(/\s+/g, "_")}.json`, "application/json");
    }
    toast.success("Exporté");
  };

  if (authLoading) {
    return <main className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Chargement…</main>;
  }

  if (!user) {
    return (
      <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
        <header className="grid grid-cols-3 items-center mb-6">
          <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
            <ChevronLeft size={18} /> Accueil
          </Link>
          <h1 className="text-base font-display font-semibold text-center">Plan de site</h1>
          <span />
        </header>
        <section className="glass-panel p-5 text-center">
          <Building2 size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-display mb-2">Réservé aux comptes connectés</p>
          <p className="text-xs text-muted-foreground mb-4">
            Les plans de site sont désormais liés à ton compte (renforcement de sécurité) — connecte-toi pour les créer ou les retrouver.
          </p>
          <Link to="/account" className="btn-primary inline-block text-sm">Se connecter</Link>
        </section>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-4">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Plan de site</h1>
        <span />
      </header>

      {!selected ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              className="btn-primary text-xs !py-2.5"
              onClick={() => createNew("indoor_plan")}
              disabled={loading}
            >
              + Plan intérieur
            </button>
            <button
              className="btn-primary text-xs !py-2.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--foreground)" }}
              onClick={() => createNew("outdoor_geo")}
              disabled={loading}
            >
              + Carte GPS
            </button>
          </div>

          {maps.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Aucun plan enregistré. Créez-en un pour placer vos capteurs.
            </p>
          ) : (
            <ul className="space-y-2">
              {maps.map((m) => (
                <li key={m.id} className="glass-panel p-3 flex items-center gap-2">
                  <MapPin size={16} className="text-teal shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display truncate">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.kind === "outdoor_geo" ? "Géoréférencé" : "Plan intérieur"} · {m.sensors.length} capteur(s)
                    </div>
                  </div>
                  <button className="text-teal text-xs" onClick={() => setSelected(m)}>
                    Ouvrir
                  </button>
                  <button className="text-muted-foreground p-1" onClick={() => remove(m.id)} aria-label="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <SiteMapEditor
          map={selected}
          onClose={() => setSelected(null)}
          onSave={persist}
          onExport={exportGeo}
        />
      )}

      <BottomNav />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function SiteMapEditor({
  map,
  onClose,
  onSave,
  onExport,
}: {
  map: SiteMap;
  onClose: () => void;
  onSave: (m: SiteMap) => Promise<void>;
  onExport: (m: SiteMap) => void;
}) {
  const [local, setLocal] = useState<SiteMap>(map);
  const [nextType, setNextType] = useState<DetectionSource>("live");

  const addPointAtRelative = (x: number, y: number) => {
    const name = window.prompt("Nom du capteur :", `Capteur ${local.sensors.length + 1}`);
    if (!name) return;
    const pt: SitePoint = {
      id: `pt_${Date.now()}`,
      name,
      sensorType: nextType,
      x,
      y,
    };
    setLocal({ ...local, sensors: [...local.sensors, pt] });
  };

  const addPointAtGps = (lat: number, lng: number) => {
    const name = window.prompt("Nom du capteur :", `Capteur ${local.sensors.length + 1}`);
    if (!name) return;
    const pt: SitePoint = {
      id: `pt_${Date.now()}`,
      name,
      sensorType: nextType,
      lat,
      lng,
    };
    setLocal({ ...local, sensors: [...local.sensors, pt] });
  };

  const removePoint = (id: string) =>
    setLocal({ ...local, sensors: local.sensors.filter((s) => s.id !== id) });

  const uploadBg = async (file: File) => {
    // For simplicity we inline the image as a data URL. In production this
    // should upload to Storage.
    const dataUrl = await fileToDataUrl(file);
    setLocal({ ...local, backgroundImageUrl: dataUrl });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button className="text-xs text-muted-foreground" onClick={onClose}>← Retour</button>
        <span className="text-sm font-display truncate mx-2">{local.name}</span>
        <div className="flex gap-1">
          <button
            className="text-xs text-teal flex items-center gap-1"
            onClick={() => onSave(local)}
            title="Sauvegarder"
          >
            <Save size={13} /> Save
          </button>
          <button
            className="text-xs text-teal flex items-center gap-1 ml-2"
            onClick={() => onExport(local)}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-muted-foreground self-center mr-1">Type à ajouter :</span>
        {SENSOR_TYPES.map((t) => {
          const active = t.key === nextType;
          return (
            <button
              key={t.key}
              onClick={() => setNextType(t.key)}
              className="text-[10px] px-2 py-0.5 rounded-full border shrink-0"
              style={{
                background: active ? "var(--teal)" : "transparent",
                color: active ? "#0A0F1E" : "var(--muted-foreground)",
                borderColor: active ? "var(--teal)" : "rgba(255,255,255,0.1)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {local.kind === "indoor_plan" ? (
        <IndoorPlanEditor
          map={local}
          onAddPoint={addPointAtRelative}
          onRemovePoint={removePoint}
          onUploadBg={uploadBg}
        />
      ) : (
        <OutdoorGeoEditor
          map={local}
          onAddPoint={addPointAtGps}
          onRemovePoint={removePoint}
        />
      )}

      {local.sensors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {local.sensors.map((s) => (
            <li key={s.id} className="glass-panel px-2 py-1.5 flex items-center gap-2 text-[11px]">
              <MapPin size={11} className="text-teal shrink-0" />
              <span className="flex-1 truncate">
                {s.name} <span className="text-muted-foreground">· {s.sensorType}</span>
              </span>
              <span className="text-muted-foreground font-mono-x text-[10px]">
                {s.lat != null ? `${s.lat.toFixed(4)}, ${s.lng?.toFixed(4)}` : `${s.x?.toFixed(0)}%, ${s.y?.toFixed(0)}%`}
              </span>
              <button onClick={() => removePoint(s.id)} className="text-muted-foreground p-0.5">
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IndoorPlanEditor({
  map,
  onAddPoint,
  onRemovePoint,
  onUploadBg,
}: {
  map: SiteMap;
  onAddPoint: (x: number, y: number) => void;
  onRemovePoint: (id: string) => void;
  onUploadBg: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onClickPlan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!map.backgroundImageUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddPoint(x, y);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadBg(f);
        }}
      />
      {!map.backgroundImageUrl ? (
        <button
          className="btn-primary text-xs !py-3 w-full flex items-center justify-center gap-2"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={14} /> Importer un plan (PNG / JPG)
        </button>
      ) : (
        <>
          <div
            className="relative w-full rounded-lg overflow-hidden border cursor-crosshair"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
            onClick={onClickPlan}
          >
            <img src={map.backgroundImageUrl} alt={map.name} className="w-full block" />
            {map.sensors.map((s) => (
              <button
                key={s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Supprimer "${s.name}" ?`)) onRemovePoint(s.id);
                }}
                className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                title={s.name}
              >
                <span className="text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                  {s.name}
                </span>
                <MapPin size={18} className="text-teal drop-shadow-lg" fill="var(--teal)" />
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Cliquez sur le plan pour placer un capteur.
          </p>
          <button
            className="text-[11px] text-teal underline mt-1"
            onClick={() => inputRef.current?.click()}
          >
            Remplacer l'image
          </button>
        </>
      )}
    </div>
  );
}

function OutdoorGeoEditor({
  map,
  onAddPoint,
  onRemovePoint,
}: {
  map: SiteMap;
  onAddPoint: (lat: number, lng: number) => void;
  onRemovePoint: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const [ready, setReady] = useState(false);
  const onAddRef = useRef(onAddPoint);
  onAddRef.current = onAddPoint;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const initial = map.sensors.find((s) => s.lat != null && s.lng != null);
      const center: [number, number] = initial
        ? [initial.lat!, initial.lng!]
        : [48.8566, 2.3522];
      const lmap = L.map(containerRef.current).setView(center, initial ? 17 : 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(lmap);
      lmap.on("click", (e) => {
        onAddRef.current(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = lmap;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const lmap = mapRef.current!;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      for (const s of map.sensors) {
        if (s.lat == null || s.lng == null) continue;
        const marker = L.marker([s.lat, s.lng]).addTo(lmap).bindPopup(
          `<div style="font-family:sans-serif;font-size:12px"><strong>${escapeHtml(s.name)}</strong><br/>${s.sensorType}<br/><button data-id="${s.id}" style="color:#c00;background:none;border:none;padding:0;cursor:pointer">Supprimer</button></div>`,
        );
        marker.on("popupopen", () => {
          const el = document.querySelector(`button[data-id="${s.id}"]`);
          el?.addEventListener("click", () => onRemovePoint(s.id), { once: true });
        });
        markersRef.current.push(marker);
      }
    })();
  }, [map.sensors, ready, onRemovePoint]);

  return (
    <div>
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border"
        style={{ height: 380, borderColor: "rgba(255,255,255,0.1)" }}
      />
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Cliquez sur la carte pour poser un capteur.
      </p>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
