import { useState } from "react";
import { MapPin, PlusCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";

// CORRECTIF (lot 7 / Phase 2a) : remplace l'original de la maquette Gemini.
// Changements principaux :
//  - Les "cônes d'écoute directionnels" (directionAngle/listeningConeWidth)
//    ont disparu : un micro MEMS omnidirectionnel n'a pas de cône d'écoute.
//  - La "triangulation" ne prétend plus donner un pourcentage de
//    correspondance fabriqué ("94%") — cliquer sur le plan sélectionne
//    simplement la zone la plus proche, présenté honnêtement comme un
//    outil de repérage, pas une mesure acoustique en temps réel.
//  - Données réelles (pro_zones du lot 5) au lieu de mockData.ts.
//  - Thème sombre cohérent avec le reste de l'app.

export type RiskLevel = "critique" | "eleve" | "modere" | "faible";

export interface ZoneView {
  id: string;
  name: string;
  level: RiskLevel;
  riskFactor: string | null;
  recommendation: string | null;
  trapInstalled: boolean;
  relX: number; // 0..100
  relY: number; // 0..100
}

const LEVEL_META: Record<RiskLevel, { label: string; badge: string; text: string; dot: string }> = {
  critique: { label: "Critique", badge: "rgba(239,68,68,0.15)", text: "var(--red)", dot: "bg-rose-500" },
  eleve: { label: "Élevé", badge: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "bg-amber-500" },
  modere: { label: "Modéré", badge: "rgba(245,197,24,0.12)", text: "var(--amber)", dot: "bg-amber-300" },
  faible: { label: "Faible", badge: "rgba(0,229,195,0.12)", text: "var(--teal)", dot: "bg-teal-400" },
};

interface ZonesTabProps {
  zones: ZoneView[];
  selectedZone: ZoneView | null;
  setSelectedZone: (zone: ZoneView | null) => void;
  onToggleTrap: (zoneId: string, installed: boolean) => void;
  onAddZone: (relX: number, relY: number) => void;
  onDeleteZone: (zoneId: string) => void;
}

export function ZonesTab({ zones, selectedZone, setSelectedZone, onToggleTrap, onAddZone, onDeleteZone }: ZonesTabProps) {
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="space-y-4">
      {/* Plan */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-teal uppercase tracking-wider font-display">Zones à risque</span>
          <span className="text-[10px] text-muted-foreground">Tape sur le plan pour ajouter une zone</span>
        </div>

        <div
          className="relative rounded-xl aspect-[16/9] w-full overflow-hidden cursor-crosshair select-none"
          style={{ background: "rgba(2,6,23,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
            setPendingPoint({ x, y });
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          {zones.map((zone) => {
            const meta = LEVEL_META[zone.level];
            return (
              <div
                key={zone.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedZone(zone);
                  setPendingPoint(null);
                }}
                className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center cursor-pointer transition-transform"
                style={{
                  left: `${zone.relX}%`,
                  top: `${zone.relY}%`,
                  background: meta.text,
                  transform: selectedZone?.id === zone.id ? "scale(1.25)" : undefined,
                  boxShadow: selectedZone?.id === zone.id ? `0 0 0 2px white` : undefined,
                }}
                title={`${zone.name} (${meta.label})`}
              >
                <MapPin size={14} className="text-slate-950" />
              </div>
            );
          })}

          {pendingPoint && (
            <div
              className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-dashed border-white/60 flex items-center justify-center animate-pulse"
              style={{ left: `${pendingPoint.x}%`, top: `${pendingPoint.y}%` }}
            >
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
        </div>

        {pendingPoint && (
          <button
            onClick={() => {
              onAddZone(pendingPoint.x, pendingPoint.y);
              setPendingPoint(null);
            }}
            className="btn-primary w-full text-xs flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Ajouter une zone ici (X:{pendingPoint.x}% Y:{pendingPoint.y}%)
          </button>
        )}
      </div>

      {/* Zone detail */}
      <div className="glass-panel p-4">
        <h3 className="text-xs font-display uppercase tracking-wide border-b border-white/5 pb-2 mb-3">
          Fiche de zone
        </h3>

        {selectedZone ? (
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-display">{selectedZone.name}</h4>
              <span
                className="px-2 py-0.5 text-[9px] font-bold rounded-full uppercase shrink-0"
                style={{ background: LEVEL_META[selectedZone.level].badge, color: LEVEL_META[selectedZone.level].text }}
              >
                {LEVEL_META[selectedZone.level].label}
              </span>
            </div>

            {selectedZone.riskFactor && (
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="text-muted-foreground">Facteur de risque : </span>
                <strong>{selectedZone.riskFactor}</strong>
              </div>
            )}

            {selectedZone.recommendation && (
              <div>
                <span className="text-[9px] text-muted-foreground uppercase block tracking-wider mb-1">Recommandation</span>
                <p
                  className="leading-relaxed p-3 rounded-lg"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
                >
                  {selectedZone.recommendation}
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase">Dispositif</span>
                <span>{selectedZone.trapInstalled ? "✓ Piège installé" : "Aucun piège"}</span>
              </div>
              <button
                onClick={() => onToggleTrap(selectedZone.id, !selectedZone.trapInstalled)}
                className="px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider"
                style={{
                  background: selectedZone.trapInstalled ? "rgba(239,68,68,0.15)" : "var(--teal)",
                  color: selectedZone.trapInstalled ? "var(--red)" : "#0A0F1E",
                }}
              >
                {selectedZone.trapInstalled ? "Retirer" : "Installer"}
              </button>
            </div>

            <button
              onClick={() => onDeleteZone(selectedZone.id)}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-red-500 py-1"
            >
              <Trash2 size={12} /> Supprimer cette zone
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground py-8">
            Sélectionne une zone sur le plan pour voir son détail.
          </p>
        )}
      </div>
    </div>
  );
}
