import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { ChevronLeft, Download, Radio, Check, X, ChevronDown, Smartphone, HardDrive, Wifi } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { roomStore, useRoomStore } from "@/lib/roomStore";
import { learningStore } from "@/lib/learning";
import type { DetectionEvent, DetectionSource, InsectCategory } from "@/types/room";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historique — MosquitoRadar" },
      { name: "description", content: "Vos détections passées avec signature fréquentielle et zone estimée." },
    ],
  }),
  component: HistoryPage,
});

type FilterKey =
  | "all"
  | "validated"
  | "unvalidated"
  | "highconf"
  | "week"
  | DetectionSource
  | `cat:${InsectCategory}`;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "validated", label: "Validés" },
  { key: "unvalidated", label: "Non validés" },
  { key: "highconf", label: "Haute confiance (>80%)" },
  { key: "week", label: "Cette semaine" },
  { key: "live", label: "Micro live" },
  { key: "sd_import", label: "Import SD" },
  { key: "wifi_sensor", label: "Capteur WiFi" },
  { key: "cat:mosquito", label: "Moustiques" },
  { key: "cat:fly", label: "Mouches" },
  { key: "cat:bee_wasp", label: "Abeilles/guêpes" },
  { key: "cat:unknown", label: "Non identifiés" },
];

const SOURCE_META: Record<DetectionSource, { label: string; Icon: typeof Smartphone }> = {
  live: { label: "Live", Icon: Smartphone },
  sd_import: { label: "Import SD", Icon: HardDrive },
  wifi_sensor: { label: "WiFi", Icon: Wifi },
};

function statusColor(d: DetectionEvent) {
  if (d.validatedBy === "user_confirmed") return "var(--green)";
  if (d.validatedBy === "user_denied") return "var(--red)";
  return "var(--amber)";
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function SourceBadge({ source }: { source?: DetectionSource }) {
  const meta = SOURCE_META[source ?? "live"];
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
      style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
      title={meta.label}
    >
      <meta.Icon size={9} /> {meta.label}
    </span>
  );
}

function HistoryPage() {
  const detections = useRoomStore((s) => s.detections);
  const room = useRoomStore((s) => s.room);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<Record<string, HTMLLIElement | null>>({});

  const filtered = useMemo(() => {
    const now = Date.now();
    return detections.filter((d) => {
      if (filter === "validated") return d.validatedBy === "user_confirmed";
      if (filter === "unvalidated") return !d.validatedBy || d.validatedBy === "pending";
      if (filter === "highconf") return d.confidence > 80;
      if (filter === "week") return now - new Date(d.timestamp).getTime() < 7 * 24 * 3600 * 1000;
      if (filter === "live" || filter === "sd_import" || filter === "wifi_sensor") {
        return (d.source ?? "live") === filter;
      }
      if (typeof filter === "string" && filter.startsWith("cat:")) {
        const cat = filter.slice(4) as InsectCategory;
        return (d.insectCategory ?? "unknown") === cat;
      }
      return true;
    });
  }, [detections, filter]);

  // Zone risk aggregation
  const zoneCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of detections) map[d.estimatedZone.surfaceId] = (map[d.estimatedZone.surfaceId] ?? 0) + 1;
    return map;
  }, [detections]);

  const scrollTo = (id: string) => {
    setExpanded(id);
    setTimeout(() => {
      listRef.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ room, detections }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mosquitoradar_history.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Historique exporté");
  };

  const validate = (d: DetectionEvent, kind: "user_confirmed" | "user_denied") => {
    roomStore.validateDetection(d.id, kind);
    learningStore.record({
      surfaceId: d.estimatedZone.surfaceId,
      frequency: d.dominantFrequency,
      kind: kind === "user_confirmed" ? "confirmed" : "false",
    });
    toast(kind === "user_confirmed" ? "✓ Détection validée" : "✗ Fausse alerte enregistrée", {
      duration: 2000,
    });
  };

  const hasRoom = !!room;

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-4">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Historique</h1>
        <button
          onClick={exportJson}
          className="text-muted-foreground hover:text-teal flex items-center justify-end gap-1 text-xs"
          title="Exporter en JSON"
        >
          <Download size={14} /> Export
        </button>
      </header>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3 -mx-1 px-1">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="shrink-0 text-[11px] px-3 py-1 rounded-full border transition"
              style={{
                background: active ? "var(--teal)" : "transparent",
                color: active ? "#0A0F1E" : "var(--muted-foreground)",
                borderColor: active ? "var(--teal)" : "rgba(255,255,255,0.1)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Room heat map */}
      {hasRoom && detections.length > 0 && (
        <div className="glass-panel p-3 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Carte des détections
          </div>
          <div
            className="relative rounded-lg border border-dashed"
            style={{
              aspectRatio: `${room!.dimensions.width} / ${room!.dimensions.length}`,
              borderColor: "rgba(0,229,195,0.25)",
              background: "rgba(10,15,30,0.5)",
            }}
          >
            {detections.map((d, i) => {
              const surface = room!.surfaces.find((s) => s.id === d.estimatedZone.surfaceId);
              if (!surface) return null;
              // Map surface position (m) onto plan percent
              const x = ((surface.position.x + room!.dimensions.width / 2) / room!.dimensions.width) * 100;
              const y = ((surface.position.y + room!.dimensions.length / 2) / room!.dimensions.length) * 100;
              const r = 4 + (d.confidence / 100) * 6;
              const zoneRisk = zoneCounts[d.estimatedZone.surfaceId] >= 3;
              return (
                <button
                  key={d.id}
                  onClick={() => scrollTo(d.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition hover:scale-125"
                  style={{
                    left: `${Math.max(4, Math.min(96, x))}%`,
                    top: `${Math.max(4, Math.min(96, y))}%`,
                    width: `${r * 2}px`,
                    height: `${r * 2}px`,
                    background: statusColor(d),
                    boxShadow: `0 0 ${r * 2}px ${statusColor(d)}88`,
                    opacity: 0.7 + (i === 0 ? 0.3 : 0),
                  }}
                  aria-label={`Détection ${d.estimatedZone.surfaceLabel}`}
                >
                  {zoneRisk && i === 0 && (
                    <span
                      className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: "var(--red)", color: "white" }}
                    >
                      Zone à risque 🔴
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-around mt-2 text-[9px] font-mono-x">
            <span className="text-[color:var(--green)]">● Validé</span>
            <span className="text-[color:var(--amber)]">● En attente</span>
            <span className="text-[color:var(--red)]">● Fausse alerte</span>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg viewBox="0 0 48 48" className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.2">
            <ellipse cx="24" cy="26" rx="3" ry="6" />
            <path d="M21 22 Q12 14 6 18 Q10 22 18 24 Z" />
            <path d="M27 22 Q36 14 42 18 Q38 22 30 24 Z" />
            <line x1="22" y1="20" x2="18" y2="14" />
            <line x1="26" y1="20" x2="30" y2="14" />
          </svg>
          {detections.length === 0 ? (
            <>
              <p className="text-sm">Aucune détection.</p>
              <p className="text-xs mt-1">Lancez votre première analyse depuis l'accueil.</p>
              <Link to="/detection" className="btn-ghost inline-block mt-4 text-xs">Démarrer</Link>
            </>
          ) : (
            <p className="text-sm">Aucun résultat pour ce filtre.</p>
          )}
          {detections.length === 0 && <Radio size={0} className="hidden" />}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => {
            const isOpen = expanded === d.id;
            const dt = new Date(d.timestamp);
            return (
              <li
                key={d.id}
                ref={(el) => { listRef.current[d.id] = el; }}
                className="glass-panel p-4 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : d.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-sm">{d.estimatedZone.surfaceLabel}</span>
                      <SourceBadge source={d.source} />
                    </div>
                    <div className="font-mono-x text-[11px] text-muted-foreground mt-0.5">
                      {fmtDate(dt)} · {fmtTime(dt)}{d.timestampApproximate ? " (approx.)" : ""} · {Math.round(d.dominantFrequency)} Hz
                    </div>
                  </div>
                  <div className="text-right flex items-start gap-2">
                    <div>
                      <div
                        className="font-mono-x text-lg"
                        style={{
                          color:
                            d.confidence > 80 ? "var(--green)" :
                            d.confidence > 60 ? "var(--teal)" : "var(--amber)",
                        }}
                      >
                        {d.confidence}%
                      </div>
                      <div
                        className="text-[9px] uppercase tracking-wider mt-0.5"
                        style={{ color: statusColor(d) }}
                      >
                        {d.validatedBy === "user_confirmed" ? "✓ Validé"
                          : d.validatedBy === "user_denied" ? "✗ Fausse"
                          : "En attente"}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className="text-muted-foreground mt-1 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
                    />
                  </div>
                </div>
                {/* mini spectrogram */}
                <div className="flex items-end gap-[2px] h-6 mt-3">
                  {d.waveformSnapshot && d.waveformSnapshot.length > 0 ? (
                    d.waveformSnapshot.map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${Math.max(4, Math.min(100, v))}%`,
                          background: "rgba(0,229,195,0.4)",
                        }}
                      />
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[9px] text-muted-foreground rounded-sm h-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                      aperçu non disponible
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-xs animate-slide-down overflow-hidden">
                    <Row label="Fréquence" value={`${Math.round(d.dominantFrequency)} Hz`} />
                    <Row
                      label="Durée du signal"
                      value={d.durationMs && d.durationMs > 0 ? `${(d.durationMs / 1000).toFixed(2)} s` : "—"}
                    />
                    <Row
                      label="SNR"
                      value={typeof d.snr === "number" && d.snr > 0 ? `+${d.snr.toFixed(1)} dB` : "—"}
                    />
                    <Row
                      label="Bruit de fond"
                      value={typeof d.noiseFloorDb === "number" ? `${Math.round(d.noiseFloorDb)} dB` : "—"}
                    />
                    <Row label="Espèce" value={d.speciesHint || "—"} />
                    <Row
                      label="Hauteur estimée"
                      value={d.estimatedZone.heightMeters ? `${d.estimatedZone.heightMeters.toFixed(1)} m` : "—"}
                    />
                    <Row label="Source" value={SOURCE_META[d.source ?? "live"].label} />
                    <Row label="Appareil" value={d.deviceLabel || "—"} />
                    <Row label="Appareils actifs" value={String(room?.devicePositions.length ?? 1)} />
                    <div className="flex gap-2 pt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => validate(d, "user_confirmed")}
                        className="flex-1 py-2 rounded-full text-xs font-display flex items-center justify-center gap-1"
                        style={{ background: "rgba(16,185,129,0.18)", color: "var(--green)" }}
                      >
                        <Check size={12} /> Valider
                      </button>
                      <button
                        onClick={() => validate(d, "user_denied")}
                        className="flex-1 py-2 rounded-full text-xs font-display flex items-center justify-center gap-1"
                        style={{ background: "rgba(239,68,68,0.18)", color: "var(--red)" }}
                      >
                        <X size={12} /> Fausse alerte
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <BottomNav />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-x text-foreground text-right">{value}</span>
    </div>
  );
}
