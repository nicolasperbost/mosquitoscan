import { Activity, MapPin, Sliders, X, ChevronRight, ChevronLeft } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

// CORRECTIF (lot 8 / Phase 2c) :
//  - Étape 1 : la fourchette de fréquence citée (500-600Hz) ne correspondait
//    pas à celle réellement utilisée par classifyInsect() (620-780Hz pour
//    Aedes albopictus, bande globale 300-800Hz) — corrigée pour rester
//    cohérente avec le reste de l'app.
//  - Étape 2 : "cibler les larvicides de manière chirurgicale" adouci — la
//    triangulation par centroïde SNR reste une estimation, pas une
//    précision chirurgicale.
//  - Étape 3 : "Vigilance HACCP & Traçabilité Réglementaire" et la
//    prétention à "attester de la conformité devant les auditeurs
//    d'hygiène" retirées — remplacées par un principe honnête de journal de
//    vigilance interne, sans valeur réglementaire affirmée.

interface OnboardingWizardProps {
  showOnboarding: boolean;
  setShowOnboarding: (val: boolean) => void;
  onboardingStep: number;
  setOnboardingStep: Dispatch<SetStateAction<number>>;
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
      <button
        onClick={() => setShowOnboarding(false)}
        className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
        title="Fermer le guide"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-white text-xs">
        <div className="flex gap-4 items-start max-w-2xl">
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
                GUIDE DE PRISE EN MAIN — ÉTAPE {onboardingStep}/3
              </span>
            </div>

            {onboardingStep === 1 && (
              <>
                <h4 className="text-sm font-bold text-slate-100">Principe 1 : l'écoute passive par micro MEMS</h4>
                <p className="text-slate-400 leading-relaxed">
                  MosquitoRadar n'enregistre aucune voix humaine. L'analyse spectrale isole le battement d'aile d'un
                  moustique dans la bande 300-800Hz — Aedes albopictus se situe typiquement entre 620 et 780Hz.
                </p>
              </>
            )}

            {onboardingStep === 2 && (
              <>
                <h4 className="text-sm font-bold text-slate-100">Principe 2 : triangulation par rapport signal/bruit (SNR)</h4>
                <p className="text-slate-400 leading-relaxed">
                  En comparant le SNR reçu par plusieurs capteurs omnidirectionnels, l'algorithme estime la zone la
                  plus probable de la détection — une aide au repérage, pas une localisation au centimètre près.
                </p>
              </>
            )}

            {onboardingStep === 3 && (
              <>
                <h4 className="text-sm font-bold text-slate-100">Principe 3 : journal de vigilance interne</h4>
                <p className="text-slate-400 leading-relaxed">
                  Génère des rapports datés de ton activité de surveillance acoustique, utiles pour ton suivi interne
                  et pour informer tes clients — ces documents ne remplacent pas une certification réglementaire
                  officielle ni les directives d'une agence de santé publique.
                </p>
              </>
            )}
          </div>
        </div>

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
