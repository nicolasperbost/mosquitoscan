import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Check, Volume2, AlertCircle } from "lucide-react";
import { PhotoCaptureWizard } from "@/components/room/PhotoCaptureWizard";
import { IsometricRoomView } from "@/components/room/IsometricRoomView";
import { DevicePlacementMap } from "@/components/room/DevicePlacementMap";
import { useRoomAnalysis, type CapturedPhoto } from "@/hooks/useRoomAnalysis";
import { measureRT60, type CalibrationResult } from "@/lib/acousticCalibration";
import { roomStore } from "@/lib/roomStore";
import type { RoomModel, DevicePosition } from "@/types/room";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Configuration de la pièce — MosquitoRadar" },
      { name: "description", content: "Capturez votre pièce pour générer un modèle 3D et calibrer la détection acoustique." },
    ],
  }),
  component: SetupPage,
});

type Step = 1 | 2 | 3 | 4;

function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [model, setModel] = useState<RoomModel | null>(null);
  const { isAnalyzing, progress, statusMessage, analyze } = useRoomAnalysis();
  const [calibration, setCalibration] = useState<"idle" | "running" | "done">("idle");
  const [calibResult, setCalibResult] = useState<CalibrationResult | null>(null);
  const [calibError, setCalibError] = useState<string | null>(null);

  const startAnalysis = async (payload: {
    photos: CapturedPhoto[];
    video: File | null;
    dimensions: { width: number; length: number; height: number };
  }) => {
    const m = await analyze(payload);
    setModel(m);
    toast.success(`✓ Modèle généré · RT60 ≈ ${m.reverbTime}s`);
    setStep(2);
  };

  const runCalibration = async () => {
    setCalibError(null);
    setCalibration("running");
    try {
      const res = await measureRT60();
      setCalibResult(res);
      if (model) {
        setModel({ ...model, reverbTime: res.rt60 });
      }
      setCalibration("done");
      toast.success(`✓ RT60 mesuré : ${res.rt60}s`);
    } catch (e: any) {
      setCalibError(e?.message || "Impossible d'accéder au microphone");
      setCalibration("idle");
    }
  };

  const finish = () => {
    if (model) {
      roomStore.setRoom(model);
      toast.success("📍 Pièce configurée avec succès");
    }
    navigate({ to: "/detection" });
  };

  return (
    <main className="min-h-screen pb-16 px-5 pt-6 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-4">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <span className="font-mono-x text-xs text-teal">Étape {step}/4</span>
      </header>

      <div className="flex gap-1 mb-6">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="flex-1 h-1 rounded-full transition-all"
            style={{
              background: n <= step ? "var(--teal)" : "rgba(255,255,255,0.08)",
              boxShadow: n === step ? "0 0 8px var(--teal-glow)" : "none",
            }}
          />
        ))}
      </div>

      {step === 1 && (
        <section>
          <h1 className="text-2xl font-display font-bold">Photographiez la pièce</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Capturez chaque mur, le plafond et le sol. L'IA reconstruira un modèle 3D.
          </p>
          {isAnalyzing ? (
            <AnalyzingScreen progress={progress} message={statusMessage} />
          ) : (
            <PhotoCaptureWizard onComplete={startAnalysis} />
          )}
        </section>
      )}

      {step === 2 && model && (
        <section>
          <h1 className="text-2xl font-display font-bold">Plan généré</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Vérifiez les éléments détectés.
          </p>
          <div className="glass-panel p-2">
            <IsometricRoomView roomModel={model} viewMode="floorplan" />
          </div>
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Éléments détectés
            </div>
            <div className="flex flex-wrap gap-1.5">
              {model.surfaces.map((s) => (
                <span
                  key={s.id}
                  className="text-[10px] px-2 py-1 rounded-full border"
                  style={{
                    borderColor:
                      s.aiConfidence === "high"
                        ? "rgba(16,185,129,0.5)"
                        : s.aiConfidence === "medium"
                          ? "rgba(245,158,11,0.5)"
                          : "rgba(239,68,68,0.5)",
                    color: "var(--foreground)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground mt-3 font-mono-x">
              Dimensions : {model.dimensions.width} × {model.dimensions.length} × {model.dimensions.height} m
            </div>
          </div>
          <button onClick={() => setStep(3)} className="btn-primary w-full mt-6">
            Continuer
          </button>
        </section>
      )}

      {step === 3 && model && (
        <section>
          <h1 className="text-2xl font-display font-bold">Placement des appareils</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Touchez le plan pour placer chaque smartphone. La triangulation
            permet de localiser précisément le moustique.
          </p>
          <DevicePlacementMap
            room={model}
            devices={model.devicePositions}
            onChange={(devices: DevicePosition[]) =>
              setModel({ ...model, devicePositions: devices })
            }
          />
          <button onClick={() => setStep(4)} className="btn-primary w-full mt-6">
            Continuer
          </button>
        </section>
      )}

      {step === 4 && model && (
        <section>
          <h1 className="text-2xl font-display font-bold">Calibration acoustique</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Un bruit large-bande est émis par le haut-parleur puis mesuré par le micro pour estimer le RT60 (méthode Schroeder).
          </p>
          <div className="glass-panel p-6 flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(0,229,195,0.1)",
                boxShadow: calibration === "running" ? "0 0 32px var(--teal-glow)" : "none",
                animation: calibration === "running" ? "pulse 1.2s ease-in-out infinite" : undefined,
              }}
            >
              {calibration === "done" ? (
                <Check size={32} className="text-teal" />
              ) : (
                <Volume2 size={32} className="text-teal" />
              )}
            </div>
            {calibration === "idle" && (
              <>
                <button onClick={runCalibration} className="btn-primary">
                  Lancer la calibration
                </button>
                {calibError && (
                  <div className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {calibError}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground text-center">
                  Montez le volume et restez silencieux ~2 s.
                </p>
              </>
            )}
            {calibration === "running" && (
              <div className="text-sm text-muted-foreground">Émission & mesure du signal…</div>
            )}
            {calibration === "done" && calibResult && (
              <div className="text-center">
                <div className="text-sm text-teal font-mono-x">
                  RT60 : {calibResult.rt60.toFixed(2)} s
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Acoustique {calibResult.qualifier}
                </div>
                <div className="text-[10px] font-mono-x text-muted-foreground mt-2">
                  Peak {calibResult.peakDb} dB · Bruit {calibResult.noiseFloorDb} dB
                </div>
                <button
                  onClick={() => {
                    setCalibration("idle");
                    setCalibResult(null);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-teal underline mt-3"
                >
                  Refaire la mesure
                </button>
              </div>
            )}
          </div>
          <button
            onClick={finish}
            disabled={calibration !== "done"}
            className="btn-primary w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Commencer la détection
          </button>
        </section>
      )}
    </main>
  );
}

function AnalyzingScreen({ progress, message }: { progress: number; message: string }) {
  return (
    <div className="glass-panel p-6 flex flex-col items-center text-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--teal)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 44}
            strokeDashoffset={2 * Math.PI * 44 - (progress / 100) * 2 * Math.PI * 44}
            style={{ transition: "stroke-dashoffset 0.4s", filter: "drop-shadow(0 0 6px var(--teal))" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono-x text-teal text-2xl">
          {progress}%
        </div>
      </div>
      <p className="text-sm text-foreground mt-4 font-display">{message}</p>
      <p className="text-[10px] text-muted-foreground mt-1 tracking-wider uppercase">
        Analyse en cours…
      </p>
    </div>
  );
}