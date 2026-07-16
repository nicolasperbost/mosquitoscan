import React from "react";
import { Layout, Plus, ExternalLink, History, Bug, ShieldAlert, Smartphone, Info } from "lucide-react";
import { Site, TimelineEvent } from "../../types/mosquitoscan";

interface SitesTabProps {
  sites: Site[];
  selectedSiteId: string;
  setSelectedSiteId: (id: string) => void;
  currentSite: Site;
  tempCelsius: number;
  setTempCelsius: (val: number) => void;
  humidityPercent: number;
  setHumidityPercent: (val: number) => void;
  dynamicRiskScore: number;
  timeline: TimelineEvent[];
  triggerExport: (type: "intervention" | "haccp" | "client") => void;
}

export function SitesTab({
  sites,
  selectedSiteId,
  setSelectedSiteId,
  currentSite,
  tempCelsius,
  setTempCelsius,
  humidityPercent,
  setHumidityPercent,
  dynamicRiskScore,
  timeline,
  triggerExport,
}: SitesTabProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
        {/* Left Column: List of sites */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider block">Portefeuille Client</span>
            <h3 className="text-sm font-bold text-slate-800">Établissements sous Contrat 3D</h3>
          </div>

          <div className="space-y-3">
            {sites.map((site) => (
              <div
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                  selectedSiteId === site.id
                    ? "border-teal-500 bg-teal-50/40 shadow-sm"
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex gap-3">
                  <img 
                    src={site.imageUrl} 
                    alt={site.name} 
                    className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">{site.clientName}</span>
                    <h4 className="text-xs font-bold text-slate-800 leading-tight">{site.name}</h4>
                    <span className="text-[10px] text-slate-500 block">{site.address}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-[10px]">
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase font-bold">Indice Risque</span>
                    <span className={`font-mono font-bold ${site.riskScore > 75 ? "text-red-500" : site.riskScore > 40 ? "text-amber-500" : "text-emerald-500"}`}>
                      {site.riskScore}%
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase font-bold">Pièges CO2</span>
                    <span className="font-semibold text-slate-700">{site.activeTraps} actifs</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase font-bold">Santé B2B</span>
                    <span className="font-semibold text-teal-600 font-mono">{site.healthScore}/100</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={() => alert("Fonctionnalité d'ajout d'établissement réservée aux administrateurs.")}
              className="w-full text-center py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un établissement
            </button>
          </div>
        </div>

        {/* Right Column: Site Detail & Interactive Prevention Plan */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[10px] font-bold rounded">
                  ID CONTRAT: {currentSite.id.toUpperCase()}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Dernier passage pro: {currentSite.lastInspection}</span>
              </div>
              <h3 className="text-base font-bold text-slate-100">{currentSite.name} — Tableau de Synthèse</h3>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => triggerExport("client")}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Livrable Client
              </button>
            </div>
          </div>

          {/* Dynamic Interactive Weather Matrix - Influences general anticipation */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">Matrice d'Anticipation Météo</span>
              <span className="text-[10px] text-slate-500">Mise à jour en temps réel</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Temp control */}
              <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Température</span>
                  <span className="font-mono text-teal-400 font-bold">{tempCelsius}°C</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="38"
                  value={tempCelsius}
                  onChange={(e) => setTempCelsius(Number(e.target.value))}
                  className="w-full accent-teal-500 h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Humidity control */}
              <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Humidité</span>
                  <span className="font-mono text-teal-400 font-bold">{humidityPercent}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="95"
                  value={humidityPercent}
                  onChange={(e) => setHumidityPercent(Number(e.target.value))}
                  className="w-full accent-teal-500 h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Risk prediction block */}
              <div className="flex flex-col justify-center items-center bg-slate-900 p-2 rounded-lg border border-teal-900/30 text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Risque Estimé</span>
                <span className={`text-sm font-extrabold block mt-0.5 ${dynamicRiskScore > 75 ? "text-red-400" : dynamicRiskScore > 40 ? "text-amber-400" : "text-emerald-400"}`}>
                  {dynamicRiskScore > 75 ? "🔴 TRÈS ÉLEVÉ" : dynamicRiskScore > 40 ? "🟡 MOYEN À ÉLEVÉ" : "🟢 FAIBLE"}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-900 p-3 rounded-lg border border-slate-850">
              {tempCelsius > 25 && humidityPercent > 65 ? (
                <span className="text-red-300">
                  ⚠️ <strong>Alerte de Prolifération active :</strong> Les conditions climatiques actuelles stimulent le métabolisme de ponte de l'Aedes Albopictus. L'éclosion des larves se fait en moins de 36 heures. Recommandation : Inspecter le site en priorité B2B et recharger les pièges CO2.
                </span>
              ) : (
                <span className="text-emerald-300">
                  🌿 <strong>Conditions tempérées :</strong> Prolifération lente. L'activité de vol se concentre uniquement aux pics thermiques de l'aube et du crépuscule. Recommandation : Maintien standard des dispositifs passifs.
                </span>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                Timeline de Suivi & Preuve d'Activité
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Historique de Vigilance Interne</span>
            </div>

            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800 max-h-[220px] overflow-y-auto pr-1">
              {timeline.map((event) => (
                <div key={event.id} className="flex gap-4 items-start text-xs text-left relative pl-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border z-10 ${
                    event.type === "detection"
                      ? "bg-rose-950 border-rose-800 text-rose-400"
                      : event.type === "treatment"
                      ? "bg-emerald-950 border-emerald-800 text-emerald-400"
                      : event.type === "sensor"
                      ? "bg-teal-950 border-teal-800 text-teal-400"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}>
                    {event.type === "detection" ? (
                      <Bug className="w-3.5 h-3.5" />
                    ) : event.type === "treatment" ? (
                      <ShieldAlert className="w-3.5 h-3.5" />
                    ) : event.type === "sensor" ? (
                      <Smartphone className="w-3.5 h-3.5" />
                    ) : (
                      <Info className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{event.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{event.timestamp}</span>
                      {event.operator && (
                        <span className="bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded text-[9px] font-mono">
                          {event.operator}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
