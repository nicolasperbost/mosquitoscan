import { ChevronRight, ShieldAlert, FileSpreadsheet, BadgeCheck, Info } from "lucide-react";
import { useMemo } from "react";
import type { DetectionEvent } from "@/types/room";

// CORRECTIF (lot 8 / Phase 2c) : remplace l'original de la maquette Gemini.
//  - Le graphique de "pics d'activité" et la densité horaire ("240 vols 🔥")
//    étaient entièrement fabriqués en dur. Remplacés par une vraie
//    distribution horaire calculée sur les détections réelles, et une
//    comparaison semaine courante/précédente honnête (nombres bruts, pas
//    une courbe lissée qui suggérerait une précision that les données
//    éparses ne permettent pas).
//  - Export "haccp" renommé en "vigilance" (le bouton affichait déjà un
//    libellé correct, seule la clé interne restait HACCP).
//  - "Attestation d'Effort Préventif Continu" renommée en langage factuel,
//    sans prétendre certifier quoi que ce soit.
//  - Thème sombre cohérent avec le reste de l'app.

export type ReportExportType = "intervention" | "vigilance" | "client";

interface RapportsTabProps {
  currentSiteName: string;
  detections: DetectionEvent[];
  triggerExport: (type: ReportExportType) => void;
}

const HOUR_BUCKETS = [
  { label: "00h–04h", from: 0, to: 4 },
  { label: "04h–08h", from: 4, to: 8 },
  { label: "08h–12h", from: 8, to: 12 },
  { label: "12h–16h", from: 12, to: 16 },
  { label: "16h–20h", from: 16, to: 20 },
  { label: "20h–00h", from: 20, to: 24 },
];

export function RapportsTab({ currentSiteName, detections, triggerExport }: RapportsTabProps) {
  const hourlyCounts = useMemo(() => {
    const counts = HOUR_BUCKETS.map(() => 0);
    for (const d of detections) {
      const h = new Date(d.timestamp).getHours();
      const idx = HOUR_BUCKETS.findIndex((b) => h >= b.from && h < b.to);
      if (idx >= 0) counts[idx]++;
    }
    return counts;
  }, [detections]);
  const maxHourly = Math.max(1, ...hourlyCounts);

  const { thisWeek, lastWeek } = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 3600 * 1000;
    let thisWeekCount = 0;
    let lastWeekCount = 0;
    for (const d of detections) {
      const age = now - new Date(d.timestamp).getTime();
      if (age < weekMs) thisWeekCount++;
      else if (age < 2 * weekMs) lastWeekCount++;
    }
    return { thisWeek: thisWeekCount, lastWeek: lastWeekCount };
  }, [detections]);

  const hasEnoughData = detections.length >= 5;

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 space-y-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div>
            <span className="text-[10px] text-teal uppercase tracking-wider font-display block">Activité — {currentSiteName}</span>
            <h3 className="text-sm font-display">Comparaison hebdomadaire</h3>
          </div>
        </div>

        {!hasEnoughData ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Pas encore assez de détections pour une comparaison fiable (minimum 5).
          </p>
        ) : (
          <>
            <div className="flex items-end gap-6 justify-center py-2">
              <div className="text-center">
                <div className="font-mono-x text-2xl text-teal">{lastWeek}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Semaine précédente</div>
              </div>
              <div className="text-center">
                <div className="font-mono-x text-2xl" style={{ color: thisWeek > lastWeek ? "var(--red)" : "var(--teal)" }}>
                  {thisWeek}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Cette semaine</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Répartition horaire (toutes détections)</span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                {HOUR_BUCKETS.map((b, i) => (
                  <div key={b.label} className="p-2 rounded-lg border" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <span className="block text-[8px] text-muted-foreground">{b.label}</span>
                    <strong className="font-mono-x">{hourlyCounts[i]}</strong>
                    <div className="h-1 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-1 rounded-full"
                        style={{ width: `${(hourlyCounts[i] / maxHourly) * 100}%`, background: "var(--teal)" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="glass-panel p-4 space-y-3">
        <div className="space-y-1">
          <span className="text-[10px] text-teal uppercase tracking-wider font-display block">Rapports</span>
          <h3 className="text-sm font-display">Éditeur de rapports</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Génère des documents de suivi à partir des vraies détections et interventions enregistrées pour ce site.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => triggerExport("intervention")}
            className="w-full p-3 rounded-xl text-left transition-all flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex gap-2.5 items-center">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="space-y-0.5">
                <strong className="text-xs block leading-tight">Rapport d'intervention</strong>
                <span className="text-[10px] text-muted-foreground">Traitements et actions enregistrées sur le site</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => triggerExport("vigilance")}
            className="w-full p-3 rounded-xl text-left transition-all flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex gap-2.5 items-center">
              <FileSpreadsheet className="w-5 h-5 text-teal shrink-0" />
              <div className="space-y-0.5">
                <strong className="text-xs block leading-tight">Bilan de vigilance acoustique</strong>
                <span className="text-[10px] text-muted-foreground">Relevés de détection pour le suivi interne</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => triggerExport("client")}
            className="w-full p-3 rounded-xl text-left transition-all flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex gap-2.5 items-center">
              <BadgeCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="space-y-0.5">
                <strong className="text-xs block leading-tight">Résumé d'activité pour le client</strong>
                <span className="text-[10px] text-muted-foreground">Synthèse à partager, sans jargon technique</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-3 rounded-xl flex gap-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-[10px] text-amber-100 leading-relaxed">
            Ces documents résument une activité de détection acoustique. Ils ne constituent ni un diagnostic sanitaire,
            ni un certificat de conformité réglementaire (HACCP, ARS ou autre) — à faire valider par un professionnel si besoin.
          </span>
        </div>
      </div>
    </div>
  );
}
