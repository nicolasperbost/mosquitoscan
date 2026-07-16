import React from "react";
import { Sliders, ShieldAlert, Trash2, BadgeCheck } from "lucide-react";
import { AlertEvent, TimelineEvent } from "../../types/mosquitoscan";

interface AlertesTabProps {
  alerts: AlertEvent[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertEvent[]>>;
  filteredAlerts: AlertEvent[];
  selectedAlert: AlertEvent | null;
  setSelectedAlert: (alert: AlertEvent | null) => void;
  filterPeriod: string;
  setFilterPeriod: (val: string) => void;
  filterTemp: number;
  setFilterTemp: (val: number) => void;
  filterIntensity: string;
  setFilterIntensity: (val: string) => void;
  filterUrgency: string;
  setFilterUrgency: (val: string) => void;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
  triggerExport: (type: "intervention" | "haccp" | "client") => void;
  currentSiteName: string;
}

export function AlertesTab({
  alerts,
  setAlerts,
  filteredAlerts,
  selectedAlert,
  setSelectedAlert,
  filterPeriod,
  setFilterPeriod,
  filterTemp,
  setFilterTemp,
  filterIntensity,
  setFilterIntensity,
  filterUrgency,
  setFilterUrgency,
  setTimeline,
  triggerExport,
  currentSiteName,
}: AlertesTabProps) {

  // Color functions helpers matching blueprint exactly
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "Critique":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "Haute":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "Normale":
        return "bg-teal-50 text-teal-800 border-teal-200";
      default:
        return "bg-slate-50 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      
      {/* Advanced filters to help pros prioritize interventions */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <Sliders className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Filtres de Priorisation & Planification d'Intervention
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Period Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase block">Période du Jour</label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            >
              <option value="all">Toutes les périodes</option>
              <option value="Matin">Matin (05h - 12h)</option>
              <option value="Après-midi">Après-midi (12h - 18h)</option>
              <option value="Soir">Soir (18h - 22h)</option>
              <option value="Nuit">Nuit (22h - 05h)</option>
            </select>
          </div>

          {/* Temperature threshold slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Température ≥</label>
              <span className="text-[10px] text-teal-400 font-bold font-mono">{filterTemp}°C</span>
            </div>
            <input
              type="range"
              min="10"
              max="35"
              value={filterTemp}
              onChange={(e) => setFilterTemp(Number(e.target.value))}
              className="w-full accent-teal-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Intensity level */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase block">Intensité d'Activité</label>
            <select
              value={filterIntensity}
              onChange={(e) => setFilterIntensity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            >
              <option value="all">Toutes les intensités</option>
              <option value="Élevée">Élevée</option>
              <option value="Modérée">Modérée</option>
              <option value="Faible">Faible</option>
            </select>
          </div>

          {/* Urgence Level */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase block">Niveau d'Urgence</label>
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            >
              <option value="all">Toutes les urgences</option>
              <option value="Critique">Critique (Tigre)</option>
              <option value="Haute">Haute</option>
              <option value="Normale">Normale</option>
              <option value="Basse">Basse</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span>{filteredAlerts.length} alerte(s) correspondent à vos critères</span>
          <button
            onClick={() => {
              setFilterPeriod("all");
              setFilterTemp(15);
              setFilterIntensity("all");
              setFilterUrgency("all");
            }}
            className="text-teal-400 hover:text-white transition-all font-bold cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table or list of alerts */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
            Fichier National des Alertes Acoustiques
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-150 text-slate-400 uppercase text-[9px] font-bold">
                  <th className="py-2.5">Espèce / Statut</th>
                  <th className="py-2.5">Localisation</th>
                  <th className="py-2.5">Fréquence · dB</th>
                  <th className="py-2.5 text-center">Urgence</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlerts.map((alert) => (
                  <tr 
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`hover:bg-slate-50/80 cursor-pointer transition-all ${
                      selectedAlert?.id === alert.id ? "bg-teal-50/40" : ""
                    }`}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${alert.status === "active" ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                        <div>
                          <span className="font-bold text-slate-800 block">{alert.species}</span>
                          <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-semibold text-slate-700">{alert.location}</td>
                    <td className="py-3 font-mono text-slate-600">
                      {alert.frequencyHz}Hz / {alert.maxVolumeDb}dB
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getUrgencyColor(alert.urgency)}`}>
                        {alert.urgency}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {alert.status === "active" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAlerts((prev) =>
                                prev.map((a) => (a.id === alert.id ? { ...a, status: "treated" } : a))
                              );
                              // Timeline log
                              const newTimelineEvent: TimelineEvent = {
                                id: `tl-treat-${Date.now()}`,
                                timestamp: "À l'instant",
                                type: "treatment",
                                title: "Alerte traitée",
                                description: `Signal sonore sur ${alert.location} résolu manuellement.`,
                                operator: "Marie (Gérante)"
                              };
                              setTimeline((prev) => [newTimelineEvent, ...prev]);
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-bold text-[10px] cursor-pointer"
                          >
                            ✓ Traité
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerExport("intervention");
                          }}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border rounded font-bold text-[10px] cursor-pointer"
                        >
                          Exporter
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alert detail sidebar */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
            Détail Alerte & Proof of Activity
          </h3>

          {selectedAlert ? (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-left space-y-1">
                <span className="block text-[8px] text-slate-400 font-bold uppercase">Preuve d'Activité acoustique</span>
                <strong className="text-slate-800 block text-xs">{selectedAlert.species}</strong>
                <span className="text-[10px] text-slate-500 block">Identifié à {selectedAlert.confidence}% de fiabilité.</span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Date & Heure :</span>
                  <strong className="text-slate-800 font-mono">{selectedAlert.timestamp}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Conditions météo :</span>
                  <strong className="text-slate-800">{selectedAlert.temperature}°C (Humidité élevée)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Durée de présence :</span>
                  <strong className="text-slate-800 font-mono">{selectedAlert.durationSec} secondes</strong>
                </div>
              </div>

              {selectedAlert.operatorNotes && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Notes Opérateur</span>
                  <p className="text-slate-600 leading-relaxed font-mono">{selectedAlert.operatorNotes}</p>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAlerts((prev) =>
                        prev.map((a) => (a.id === selectedAlert.id ? { ...a, status: "treated" } : a))
                      );
                      setSelectedAlert({ ...selectedAlert, status: "treated" });
                      // Timeline
                      const newTimelineEvent = {
                        id: `tl-val-${Date.now()}`,
                        timestamp: "À l'instant",
                        type: "treatment" as const,
                        title: "Détection Validée",
                        description: `La détection acoustique de ${selectedAlert.species} à ${selectedAlert.location} a été validée.`,
                        operator: "Marie (Gérante)"
                      };
                      setTimeline((prev) => [newTimelineEvent, ...prev]);
                    }}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer text-center shadow-sm"
                  >
                    ✓ Valider
                  </button>
                  <button
                    onClick={() => {
                      setAlerts((prev) =>
                        prev.map((a) => (a.id === selectedAlert.id ? { ...a, status: "ignored" } : a))
                      );
                      setSelectedAlert({ ...selectedAlert, status: "ignored" });
                      // Timeline
                      const newTimelineEvent = {
                        id: `tl-inf-${Date.now()}`,
                        timestamp: "À l'instant",
                        type: "system" as const,
                        title: "Détection Infirmée",
                        description: `Le signal acoustique de ${selectedAlert.species} à ${selectedAlert.location} a été marqué comme faux positif.`,
                        operator: "Marie (Gérante)"
                      };
                      setTimeline((prev) => [newTimelineEvent, ...prev]);
                    }}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer text-center shadow-sm"
                  >
                    ✕ Infirmer
                  </button>
                </div>

                <button
                  onClick={() => {
                    const note = prompt("Saisir la note d'intervention terrain :");
                    if (note) {
                      setAlerts((prev) =>
                        prev.map((a) => (a.id === selectedAlert.id ? { ...a, operatorNotes: note } : a))
                      );
                      setSelectedAlert({ ...selectedAlert, operatorNotes: note });
                    }
                  }}
                  className="w-full text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer border"
                >
                  Ajouter une note d'intervention
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Sélectionnez une ligne pour analyser l'empreinte sonore et sa traçabilité.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
