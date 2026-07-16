import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { ChevronLeft, Smartphone, HardDrive, Wifi, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { useRoomStore } from "@/lib/roomStore";
import type { DetectionSource, InsectCategory } from "@/types/room";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Capteurs — MosquitoRadar" },
      { name: "description", content: "Vue d'ensemble des capteurs live, import SD et WiFi ayant produit des détections." },
    ],
  }),
  component: DevicesPage,
});

const SOURCE_META: Record<DetectionSource, { label: string; Icon: typeof Smartphone }> = {
  live: { label: "Micro live (téléphone)", Icon: Smartphone },
  sd_import: { label: "Logger SD (import)", Icon: HardDrive },
  wifi_sensor: { label: "Capteur WiFi", Icon: Wifi },
};

const RENAME_STORAGE_KEY = "mosquito_device_renames_v1";

function loadRenames(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(RENAME_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveRenames(renames: Record<string, string>) {
  localStorage.setItem(RENAME_STORAGE_KEY, JSON.stringify(renames));
}

interface DeviceRow {
  key: string;
  source: DetectionSource;
  label: string;
  lastSeen: Date;
  count: number;
}

function DevicesPage() {
  const detections = useRoomStore((s) => s.detections);
  const [renames, setRenames] = useState<Record<string, string>>(() => loadRenames());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | InsectCategory>("all");

  const filteredDetections = useMemo(
    () =>
      catFilter === "all"
        ? detections
        : detections.filter((d) => (d.insectCategory ?? "unknown") === catFilter),
    [detections, catFilter],
  );

  const devices = useMemo<DeviceRow[]>(() => {
    const map = new Map<string, DeviceRow>();
    for (const d of filteredDetections) {
      const source: DetectionSource = d.source ?? "live";
      const key = `${source}:${d.deviceLabel ?? (source === "live" ? "phone" : "unknown")}`;
      const existing = map.get(key);
      const ts = new Date(d.timestamp);
      if (!existing) {
        map.set(key, {
          key,
          source,
          label: d.deviceLabel ?? (source === "live" ? "Ce téléphone" : "Capteur sans nom"),
          lastSeen: ts,
          count: 1,
        });
      } else {
        existing.count += 1;
        if (ts > existing.lastSeen) existing.lastSeen = ts;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }, [filteredDetections]);

  const commitRename = (key: string) => {
    const next = { ...renames, [key]: draft.trim() };
    if (!draft.trim()) delete next[key];
    setRenames(next);
    saveRenames(next);
    setEditing(null);
  };

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-6">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Capteurs</h1>
        <span />
      </header>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3 -mx-1 px-1">
        {([
          ["all", "Tout"],
          ["mosquito", "Moustiques"],
          ["fly", "Mouches"],
          ["bee_wasp", "Abeilles/guêpes"],
          ["unknown", "Non identifiés"],
        ] as const).map(([key, label]) => {
          const active = key === catFilter;
          return (
            <button
              key={key}
              onClick={() => setCatFilter(key as "all" | InsectCategory)}
              className="shrink-0 text-[11px] px-3 py-1 rounded-full border transition"
              style={{
                background: active ? "var(--teal)" : "transparent",
                color: active ? "#0A0F1E" : "var(--muted-foreground)",
                borderColor: active ? "var(--teal)" : "rgba(255,255,255,0.1)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Aucun capteur détecté pour l'instant.</p>
          <p className="text-xs mt-1">
            Les capteurs apparaissent ici dès qu'ils produisent une détection (live, import SD, ou WiFi).
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {devices.map((dev) => {
            const meta = SOURCE_META[dev.source];
            const displayLabel = renames[dev.key] || dev.label;
            const isEditing = editing === dev.key;
            return (
              <li key={dev.key} className="glass-panel p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(0,229,195,0.1)" }}
                  >
                    <meta.Icon size={16} className="text-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitRename(dev.key)}
                        onKeyDown={(e) => e.key === "Enter" && commitRename(dev.key)}
                        className="w-full bg-transparent border rounded-md px-2 py-1 text-sm"
                        style={{ borderColor: "rgba(255,255,255,0.15)" }}
                      />
                    ) : (
                      <div className="font-display text-sm truncate">{displayLabel}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground">{meta.label}</div>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(dev.key);
                      setDraft(displayLabel);
                    }}
                    className="text-muted-foreground hover:text-teal p-1 shrink-0"
                    aria-label="Renommer"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <div className="flex justify-between mt-3 text-[11px] font-mono-x text-muted-foreground">
                  <span>{dev.count} détection(s)</span>
                  <span>
                    Dernière activité :{" "}
                    {dev.lastSeen.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ·{" "}
                    {dev.lastSeen.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <BottomNav />
    </main>
  );
}
