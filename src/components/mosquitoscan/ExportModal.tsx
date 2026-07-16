import React from "react";
import { Loader2, BadgeCheck, X } from "lucide-react";
import { Site } from "../../types/mosquitoscan";

interface ExportModalProps {
  showExportModal: boolean;
  setShowExportModal: (val: boolean) => void;
  isExporting: boolean;
  exportProgress: number;
  exportType: "intervention" | "haccp" | "client";
  currentSite: Site;
}

export function ExportModal({
  showExportModal,
  setShowExportModal,
  isExporting,
  exportProgress,
  exportType,
  currentSite,
}: ExportModalProps) {
  if (!showExportModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
        
        {isExporting ? (
          <div className="space-y-4 text-center py-6">
            <Loader2 className="w-10 h-10 text-teal-600 animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">Génération du Rapport en cours</h4>
              <p className="text-[11px] text-slate-400">Compilation des spectrogrammes et modélisations acoustiques...</p>
            </div>
            
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${exportProgress}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{exportProgress}%</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-bold text-slate-800">Rapport Prêt pour Impression</h4>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3 font-mono">
              <div className="border-b border-dashed pb-2">
                <span className="text-[11px] font-bold block text-slate-800 uppercase text-center">
                  {exportType === "intervention" 
                    ? "RAPPORT D'INTERVENTION & TRAITEMENT" 
                    : exportType === "haccp" 
                    ? "BILAN DE VIGILANCE & SUIVI ACOUSTIQUE" 
                    : "ATTESTATION D'EFFORT PRÉVENTIF CONTINU"}
                </span>
                <span className="text-[9px] text-slate-400 block text-center">MOSQUITOSCAN™ INTERNAL REPORT</span>
              </div>

              <div className="space-y-1.5 text-[10px] text-slate-600">
                <div><strong>Établissement :</strong> {currentSite.name}</div>
                <div><strong>Client final :</strong> {currentSite.clientName}</div>
                <div><strong>Date relevés :</strong> {new Date().toLocaleDateString("fr-FR")}</div>
                <div><strong>Méthode passive :</strong> Analyse spectrographique MEMS 500-600Hz</div>
                <div><strong>Usage préconisé :</strong> Aide au ciblage des traitements physiques/chimiques</div>
              </div>

              <div className="border-t border-dashed pt-2 flex justify-between text-[11px] font-bold text-slate-800">
                <span>Vigilance Score :</span>
                <span>{currentSite.healthScore}/100</span>
              </div>

              <div className="text-[8px] text-slate-400 mt-2 leading-tight border-t border-dashed pt-1.5 font-sans">
                ⚠️ <strong>Avis important :</strong> Ce rapport de mesures physiques complémentaires est fourni à titre indicatif pour l'aide au diagnostic de terrain. Il ne se substitue pas à une certification réglementaire de lutte antivectorielle officielle ou aux directives formelles des agences de santé publiques (ARS).
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Imprimer / PDF
              </button>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  alert("Fichier de relevés .CSV exporté avec succès.");
                }}
                className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Télécharger .CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
