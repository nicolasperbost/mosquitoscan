import { Layout, Plus, ExternalLink, History, Bug, ShieldAlert, Smartphone, Info, Building2, Thermometer, Droplets } from "lucide-react";
import type { WeatherSnapshot } from "@/lib/weather";

// CORRECTIF (lot 7 / Phase 2a) : cette version remplace l'originale issue de
// la maquette Gemini. Changements principaux :
//  - Données réelles (ProSite du lot 5) au lieu de mockData.ts
//  - Météo affichée en LECTURE SEULE depuis Open-Meteo (weather.ts, lot 5),
//    plus de curseurs température/humidité pilotant une fausse "matrice
//    d'anticipation" — la météo n'est pas un paramètre qu'on choisit.
//  - Plus de photo de site (stock Unsplash fictif) — un simple avatar
//    d'initiales à la place.
//  - Thème sombre cohérent avec le reste de l'app (glass-panel), au lieu du
//    mélange clair/sombre de l'original.
//  - Timeline = vraies interventions (pro_interventions), pas de données en dur.

export interface SiteView {
  id: string;
  name: string;
  clientName: string | null;
  address: string | null;
  activeTraps: number;
  lastInspection: string | null;
  riskScore: number;
  healthScore: number;
  weather: WeatherSnapshot | null;
}

export interface TimelineItem {
  id: string;
  timestamp: string;
  type: "treatment" | "inspection" | "sensor" | "note";
  title: string;
  description: string | null;
  operator: string | null;
}

interface SitesTabProps {
  sites: SiteView[];
  selectedSiteId: string | null;
  setSelectedSiteId: (id: string) => void;
  currentSite: SiteView | null;
  timeline: TimelineItem[];
  onAddSite: () => void;
  onExportClient: () => void;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const TYPE_ICON: Record<TimelineItem["type"], typeof Bug> = {
  treatment: ShieldAlert,
  inspection: Bug,
  sensor: Smartphone,
  note: Info,
};
const TYPE_STYLE: Record<TimelineItem["type"], string> = {
  treatment: "bg-emerald-950/60 border-emerald-800 text-emerald-400",
  inspection: "bg-rose-950/60 border-rose-800 text-rose-400",
  sensor: "bg-teal-950/60 border-teal-800 text-teal-400",
  note: "bg-slate-800/60 border-slate-700 text-slate-400",
};

export function SitesTab({
  sites, selectedSiteId, setSelectedSiteId, currentSite, timeline, onAddSite, onExportClient,
}: SitesTabProps) {
  return (
    <div className="space-y-4">
      {/* Site list */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-teal uppercase tracking-wider font-display">Portefeuille</span>
          <button onClick={onAddSite} className="text-teal text-xs flex items-center gap-1">
            <Plus size={13} /> Ajouter
          </button>
        </div>

        {sites.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Aucun site — crée le premier ci-dessus.</p>
        ) : (
          <div className="space-y-2">
            {sites.map((site) => (
              <div
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className="p-3 rounded-xl border cursor-pointer transition-all"
                style={{
                  borderColor: selectedSiteId === site.id ? "var(--teal)" : "rgba(255,255,255,0.08)",
                  background: selectedSiteId === site.id ? "rgba(0,229,195,0.06)" : "transparent",
                }}
              >
                <div className="flex gap-3">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 font-mono-x text-xs font-bold"
                    style={{ background: "rgba(0,229,195,0.1)", color: "var(--teal)" }}
                  >
                    {initials(site.name)}
                  </div>
                  <div className="min-w-0">
                    {site.clientName && <span className="text-[9px] text-muted-foreground uppercase font-bold block truncate">{site.clientName}</span>}
                    <h4 className="text-xs font-display truncate">{site.name}</h4>
                    {site.address && <span className="text-[10px] text-muted-foreground block truncate">{site.address}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-2 mt-2 border-t border-white/5 text-[10px]">
                  <div>
                    <span className="block text-muted-foreground text-[8px] uppercase font-bold">Risque</span>
                    <span className="font-mono-x font-bold" style={{ color: site.riskScore > 75 ? "var(--red)" : site.riskScore > 40 ? "var(--amber)" : "var(--teal)" }}>
                      {site.riskScore}%
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[8px] uppercase font-bold">Pièges</span>
                    <span className="font-semibold">{site.activeTraps} actif(s)</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[8px] uppercase font-bold">Santé</span>
                    <span className="font-semibold font-mono-x text-teal">{site.healthScore}/100</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected site detail */}
      {currentSite && (
        <div className="glass-panel p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[9px] font-bold rounded" style={{ background: "rgba(0,229,195,0.12)", color: "var(--teal)" }}>
                  {currentSite.id.slice(0, 8).toUpperCase()}
                </span>
                {currentSite.lastInspection && (
                  <span className="text-[10px] text-muted-foreground font-mono-x">Dernier passage : {currentSite.lastInspection}</span>
                )}
              </div>
              <h3 className="text-sm font-display">{currentSite.name}</h3>
            </div>
            <button onClick={onExportClient} className="btn-ghost text-xs flex items-center gap-1.5 !py-1.5 !px-3">
              <ExternalLink size={13} /> Livrable client
            </button>
          </div>

          {/* Real weather — read only */}
          <div className="rounded-xl p-3 border" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-teal uppercase tracking-wider font-display">Météo actuelle du site</span>
            </div>
            {currentSite.weather ? (
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><Thermometer size={14} className="text-teal" /> {currentSite.weather.temperatureC.toFixed(0)}°C</span>
                <span className="flex items-center gap-1.5"><Droplets size={14} className="text-teal" /> {currentSite.weather.humidityPercent.toFixed(0)}% humidité</span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Ajoute des coordonnées GPS à ce site (onglet Sites) pour afficher la météo réelle.</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              Le score de risque ({currentSite.riskScore}%) est un indicateur heuristique combinant cette météo et les détections récentes — pas une prévision épidémiologique validée.
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-teal uppercase tracking-wider font-display border-b border-white/5 pb-2">
              <History size={13} /> Journal d'activité
            </div>
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune activité enregistrée pour ce site.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {timeline.map((event) => {
                  const Icon = TYPE_ICON[event.type];
                  return (
                    <div key={event.id} className="flex gap-3 items-start text-xs">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${TYPE_STYLE[event.type]}`}>
                        <Icon size={12} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display">{event.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono-x">{event.timestamp}</span>
                        </div>
                        {event.description && <p className="text-muted-foreground text-[11px] mt-0.5">{event.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
