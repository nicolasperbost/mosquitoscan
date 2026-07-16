import React from "react";
import { Activity, MapPin, Sliders, X, ChevronRight, ChevronLeft } from "lucide-react";

interface OnboardingWizardProps {
  showOnboarding: boolean;
  setShowOnboarding: (val: boolean) => void;
  onboardingStep: number;
  setOnboardingStep: React.Dispatch<React.SetStateAction<number>>;
  setOnboardingCompleted: (val: boolean) => void;
}

export function OnboardingWizard({
  showOnboarding,
  setShowOnboarding,
  onboardingStep,
  setOnboardingStep,
  setOnboardingCompleted,
}: OnboardingWizardProps) {
  if (!showOnboarding) return null;

  const handleNext = () => {
    if (onboardingStep === 3) {
      setOnboardingCompleted(true);
      setShowOnboarding(false);
    } else {
      setOnboardingStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (onboardingStep > 1) {
      setOnboardingStep((prev) => prev - 1);
    }
  };

  return (
    <div className="bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-950 border border-teal-800/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden text-left shadow-lg">
      
      {/* Absolute closure */}
      <button
        onClick={() => setShowOnboarding(false)}
        className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
        title="Fermer le guide"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-white text-xs">
        
        <div className="flex gap-4 items-start max-w-2xl">
          {/* Animated step icon */}
          <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/35 text-teal-400 flex items-center justify-center shrink-0">
            {onboardingStep === 1 ? (
              <Activity className="w-5 h-5 animate-pulse" />
            ) : onboardingStep === 2 ? (
              <MapPin className="w-5 h-5" />
            ) : (
              <Sliders className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-teal-400 font-extrabold uppercase tracking-widest font-mono">
                GUIDE DE PRISE EN MAIN ACOUSTIQUE — ÉTAPE {onboardingStep}/3
              </span>
            </div>

            {onboardingStep === 1 && (
              <>
                <h4 className="text-sm font-bold text-slate-100">Principe 1 : L'Écoute Passive MEMS Continuous</h4>
                <p className="text-slate-400 leading-relaxed">
                  MosquitoScan n'enregistre aucune voix humaine. Les balises MEMS analysent en continu le spectre sonore ambiant pour isoler le sifflement d'aile de l'Aedes Albopictus (moustique Tigre) oscillant entre 500Hz et 600Hz.
                </p>
              </>
            )}

            {onboardingStep === 2 && (
              <>
                <h4 className="text-sm font-bold text-slate-100">Principe 2 : Triangulation SNR (Signal-to-Noise Ratio)</h4>
                <p className="text-slate-400 leading-relaxed">
                  En comparant les décalages de phase et l'énergie du bruit de fond entre la Console Maître et les Terminaux Esclaves, l'algorithme géolocalise instantanément l'emplacement de l'alerte pour cibler les larvicides de manière chirurgicale.
                </p>
              </>
            )}

            {onboardingStep === 3 && (
              <>
                <h4 className="text-sm font-bold text-slate-100">Principe 3 : Vigilance HACCP & Traçabilité Réglementaire</h4>
                <p className="text-slate-400 leading-relaxed">
                  Générez des rapports datés et chiffrés attestant de vos efforts de surveillance continus. Ces pièces justificatives permettent d'attester de la conformité de l'établissement devant les auditeurs d'hygiène et les techniciens 3D.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Wizard Controls */}
        <div className="flex gap-2 items-center self-end md:self-auto">
          {onboardingStep > 1 && (
            <button
              onClick={handlePrev}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-all cursor-pointer flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            {onboardingStep === 3 ? "Terminer le guide" : "Suivant"}
            {onboardingStep < 3 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </div>
  );
}
