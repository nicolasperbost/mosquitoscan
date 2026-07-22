import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Play,
  Pause,
  Check,
  X,
  HelpCircle,
  Moon,
  Info,
  Lock,
} from "lucide-react";
import { useMosquitoDetection } from "@/hooks/useMosquitoDetection";
import { useAuth } from "@/hooks/useAuth";
import { RadarVisualization } from "@/components/radar/RadarVisualization";
import { HeatmapGrid } from "@/components/radar/HeatmapGrid";
import { FrequencySpectrum } from "@/components/audio/FrequencySpectrum";
import { ConfidenceScore } from "@/components/ui-radar/ConfidenceScore";
import { BottomNav } from "@/components/BottomNav";
import { IsometricRoomView } from "@/components/room/IsometricRoomView";
import { useRoomStore, roomStore } from "@/lib/roomStore";
import type { DetectionEvent, Face } from "@/types/room";
import { learningStore, surfaceBias } from "@/lib/learning";
import {
  TRIAL_SESSION_LIMIT,
  getTrialSessionsRemaining,
  hasTrialRemaining,
  recordTrialSessionUsed,
} from "@/lib/trialLimit";
import { toast } from "sonner";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-x text-foreground text-right">{value}</span>
    </div>
  );
}

export const Route = createFileRoute("/detection")({
  head: () => ({
    meta: [
      { title: "Détection — MosquitoRadar" },
      { name: "description", content: "Analyse acoustique en temps réel pour localiser un moustique dans la pièce." },
    ],
  }),
  component: DetectionPage,
});

function DetectionPage() {
  const { state, startListening, stopListening } = useMosquitoDetection();
  const { user, loading: authLoading } = useAuth();
  const [started, setStarted] = useState(false);
  const [sweep, setSweep] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [sheetDismissed, setSheetDismissed] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const room = useRoomStore((s) => s.room);
  const [viewMode, setViewMode] = useState<"radar" | "3d" | "floorplan" | "elevation">("radar");
  const [elevationFace, setElevationFace] = useState<Face>("east");
  // Recalculé à chaque montage plutôt qu'une seule fois, pour refléter un
  // essai consommé dans un autre onglet/session récemment.
  const [trialRemaining, setTrialRemaining] = useState(() => getTrialSessionsRemaining());

  useEffect(() => () => stopListening(), [stopListening]);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error, { duration: 4000 });
    }
  }, [state.error]);

  const handleStart = async () => {
    // CORRECTIF (lot 12) : sans compte, l'essai gratuit est limité à
    // TRIAL_SESSION_LIMIT sessions. Un utilisateur connecté n'a aucune
    // limite (pas de palier payant construit pour l'instant — avoir un
    // compte suffit à lever la limite).
    if (!user && !hasTrialRemaining()) {
      toast.error("Essais gratuits épuisés — crée un compte pour continuer.");
      return;
    }
    if (!user) {
      recordTrialSessionUsed();
      setTrialRemaining(getTrialSessionsRemaining());
    }
    setStarted(true);
    setSweep(true);
    setTimeout(() => setSweep(false), 1200);
    const deviceId =
      typeof window !== "undefined"
        ? localStorage.getItem("mosquito_audio_input") || undefined
        : undefined;
    await startListening(deviceId);
  };

  const mm = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, "0");
  const ss = String(state.elapsedSeconds % 60).padStart(2, "0");

  // ÉTAT C détection confirmée
  const confirmed = state.isDetecting && state.confidence >= 70;

  useEffect(() => {
    if (!confirmed) setSheetDismissed(false);
  }, [confirmed]);

  const detectionEvent = useMemo<DetectionEvent | null>(() => {
    if (!room || !state.isDetecting || state.confidence < 30) return null;
    const candidates = room.surfaces.filter(
      (s) => s.type !== "floor" && s.type !== "ceiling",
    );
    // Learning-biased pick: base index from zone hash, then boost with prior feedback
    const baseIdx = Math.abs(hash(state.zone)) % candidates.length;
    const scored = candidates.map((c, i) => ({
      c,
      score: (1 / (1 + Math.abs(i - baseIdx))) * surfaceBias(c.id),
    }));
    scored.sort((a, b) => b.score - a.score);
    const surface = scored[0].c;
    return {
      id: `live_${state.zone}`,
      timestamp: new Date(),
      roomId: room.id,
      dominantFrequency: state.frequency,
      confidence: state.confidence,
      estimatedZone: {
        surfaceId: surface.id,
        surfaceLabel: surface.label,
        positionOnSurface: { u: 0.55, v: 0.7 },
        heightMeters: surface.type === "wall" ? 1.9 : surface.position.z,
      },
      speciesHint: state.speciesHint,
      validatedBy: "pending",
      snr: state.peakSnr,
      durationMs: state.durationMs,
      noiseFloorDb: state.noiseFloor,
      waveformSnapshot: state.waveformData.slice(),
      insectCategory: state.insectCategory,
      insectConfidence: state.insectConfidence,
    };
  }, [
    room,
    state.isDetecting,
    state.confidence,
    state.zone,
    state.frequency,
    state.speciesHint,
    state.peakSnr,
    state.durationMs,
    state.noiseFloor,
    state.waveformData,
    state.insectCategory,
    state.insectConfidence,
  ]);

  const handleValidate = (kind: string) => {
    setValidation(kind);
    if (detectionEvent) {
      roomStore.addDetection({
        ...detectionEvent,
        id: `det_${Date.now()}`,
        validatedBy:
          kind === "confirmed" ? "user_confirmed"
          : kind === "false" ? "user_denied"
          : "pending",
      });
      learningStore.record({
        surfaceId: detectionEvent.estimatedZone.surfaceId,
        frequency: detectionEvent.dominantFrequency,
        kind: kind === "confirmed" ? "confirmed" : kind === "false" ? "false" : "unsure",
      });
      // Also record at the 9-zone grid level so the audio hook can bias
      // its zone proposal on future detections.
      learningStore.record({
        surfaceId: `zone:${state.zone}`,
        frequency: detectionEvent.dominantFrequency,
        kind: kind === "confirmed" ? "confirmed" : kind === "false" ? "false" : "unsure",
      });
      toast(
        kind === "confirmed" ? "✓ Détection validée"
        : kind === "false" ? "✗ Fausse alerte enregistrée"
        : "Retour incertain noté",
        { duration: 2200 },
      );
    }
    setSheetDismissed(true);
    setTimeout(() => setValidation(null), 1500);
  };

  // EN ATTENTE — pas encore démarré
  if (!started) {
    const trialExhausted = !authLoading && !user && trialRemaining <= 0;

    return (
      <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto flex flex-col">
        <header className="flex items-center justify-between mb-6">
          <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
            <ChevronLeft size={18} /> Accueil
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            En attente
          </span>
        </header>

        {trialExhausted ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.1)" }}
            >
              <Lock size={26} className="text-amber-x" />
            </div>
            <div>
              <p className="text-sm font-display mb-1">Essais gratuits épuisés</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Tu as utilisé tes {TRIAL_SESSION_LIMIT} sessions d'essai sans compte. Crée un compte gratuit pour
                continuer à utiliser MosquitoRadar sans limite.
              </p>
            </div>
            <Link to="/account" className="btn-primary text-sm">Créer un compte</Link>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="relative w-48 h-48 flex items-center justify-center">
              {[0, 0.9].map((d, i) => (
                <span
                  key={i}
                  className="absolute inset-0 rounded-full border-2 animate-sonar"
                  style={{
                    borderColor: "rgba(0,229,195,0.4)",
                    animationDelay: `${d}s`,
                    animationDuration: "3s",
                  }}
                />
              ))}
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  Microphone prêt
                </p>
              </div>
            </div>

            <button
              onClick={handleStart}
              className="btn-primary text-lg !py-5 !px-10 flex items-center gap-2 animate-cta-pulse"
            >
              <Play size={20} /> Démarrer l'écoute
            </button>

            <p className="text-[10px] text-muted-foreground text-center max-w-xs">
              Posez le smartphone, micro vers le haut. L'analyse cible la bande 300–800 Hz.
            </p>
            {!authLoading && !user && (
              <p className="text-[10px] text-teal text-center">
                {trialRemaining} essai{trialRemaining > 1 ? "s" : ""} gratuit{trialRemaining > 1 ? "s" : ""} restant{trialRemaining > 1 ? "s" : ""} sans compte
              </p>
            )}
          </div>
        )}

        <BottomNav />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen pb-36 px-4 pt-6 max-w-md mx-auto transition-colors"
      style={nightMode ? { background: "#020408" } : undefined}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${state.isListening ? "bg-teal animate-pulse" : "bg-muted"}`} />
          <span className="font-mono-x text-xs text-muted-foreground">{mm}:{ss}</span>
          <button
            onClick={() => setNightMode((v) => !v)}
            className="p-1.5 rounded-full hover:bg-white/5 transition"
            title="Mode nuit"
          >
            <Moon size={14} className={nightMode ? "text-amber-x" : "text-muted-foreground"} />
          </button>
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className="p-1.5 rounded-full hover:bg-white/5 transition"
            title="Détails"
          >
            <Info size={14} className={infoOpen ? "text-teal" : "text-muted-foreground"} />
          </button>
        </div>
      </header>

      <div className={nightMode ? "opacity-30 transition-opacity" : "transition-opacity"}>
        {/* Spectrum with optional sweep overlay */}
        <div className="relative overflow-hidden rounded-xl">
          <FrequencySpectrum data={state.waveformData} highlight={state.isDetecting} />
          {sweep && (
            <span
              aria-hidden
              className="absolute inset-y-0 w-1/3 animate-sweep pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(0,229,195,0.4), transparent)",
              }}
            />
          )}
        </div>

        {/* Room view or radar fallback */}
        {room ? (
          <>
            <div className="mt-4 flex gap-1 glass-panel p-1 text-[11px]">
              {(["radar", "3d", "floorplan", "elevation"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className="flex-1 py-1.5 rounded-md transition font-display text-center"
                  style={{
                    background: viewMode === m ? "var(--teal)" : "transparent",
                    color: viewMode === m ? "#0A0F1E" : "var(--muted-foreground)",
                  }}
                >
                  {m === "radar" ? "Radar" : m === "3d" ? "Vue 3D" : m === "floorplan" ? "Plan" : m === "elevation" ? "Élévation" : m}
                </button>
              ))}
            </div>
            {viewMode === "elevation" && (
              <div className="mt-2 flex gap-1 text-[10px] justify-center">
                {(["north", "south", "east", "west"] as Face[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setElevationFace(f)}
                    className="px-2 py-0.5 rounded-full border transition"
                    style={{
                      borderColor: elevationFace === f ? "var(--teal)" : "rgba(255,255,255,0.1)",
                      color: elevationFace === f ? "var(--teal)" : "var(--muted-foreground)",
                    }}
                  >
                    Mur {f.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <div className="glass-panel mt-2 p-2">
              {viewMode === "radar" ? (
                <RadarVisualization
                  isActive={state.isListening}
                  isDetecting={state.isDetecting}
                  confidence={state.confidence}
                  frequency={state.frequency}
                  zone={state.zone}
                  speciesHint={state.speciesHint}
                />
              ) : (
                <IsometricRoomView
                  roomModel={room}
                  detectionEvent={detectionEvent}
                  viewMode={viewMode}
                  elevationFace={elevationFace}
                />
              )}
            </div>
          </>
        ) : (
          <div className="mt-6">
            <RadarVisualization
              isActive={state.isListening}
              isDetecting={state.isDetecting}
              confidence={state.confidence}
              frequency={state.frequency}
              zone={state.zone}
              speciesHint={state.speciesHint}
            />
          </div>
        )}
      </div>

      {/* Confidence + frequency — kept visible even in night mode */}
      <div className="flex items-center justify-around mt-4">
        <ConfidenceScore value={state.confidence} />
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fréquence</div>
          <div className="font-mono-x text-2xl text-teal">
            {state.frequency ? Math.round(state.frequency) : "—"}
            <span className="text-xs"> Hz</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Zone</div>
          <div className="font-mono-x text-sm text-foreground">
            {state.isDetecting ? state.zone : "—"}
          </div>
        </div>
      </div>

      {!room && !confirmed && (
        <div className={nightMode ? "opacity-30 transition-opacity" : ""}>
          <div className="mt-4">
            <HeatmapGrid activeZone={state.zone} confidence={state.confidence} />
          </div>
        </div>
      )}

      {!state.isDetecting && (
        <div className="glass-panel mt-4 p-3 text-center text-xs text-muted-foreground animate-pulse">
          En écoute…
        </div>
      )}

      {state.isDetecting && !confirmed && (
        <div
          className="glass-panel mt-4 p-3 text-center text-xs"
          style={{ borderColor: "var(--amber)", color: "var(--amber)" }}
        >
          Signal détecté — analyse…
        </div>
      )}

      {/* Bottom sheet result */}
      {confirmed && !sheetDismissed && (
        <div className="fixed inset-x-0 bottom-32 z-40 px-4 animate-sheet-up">
          <div
            className="max-w-md mx-auto glass-panel p-4"
            style={{ borderColor: "var(--teal)", boxShadow: "0 0 24px var(--teal-glow)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🦟</span>
                <span className="font-display text-sm text-teal">Moustique détecté</span>
              </div>
              <button
                onClick={() => setSheetDismissed(true)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1 text-xs">
              <Row label="Zone" value={detectionEvent?.estimatedZone.surfaceLabel ?? state.zone} />
              <Row label="Fréquence" value={`${Math.round(state.frequency)} Hz`} />
              <Row label="Confiance" value={`${state.confidence}%`} />
              <Row label="Espèce probable" value={state.speciesHint || "—"} />
              {detectionEvent?.estimatedZone.heightMeters && (
                <Row
                  label="Hauteur"
                  value={`${(detectionEvent.estimatedZone.heightMeters - 0.2).toFixed(1)} – ${(detectionEvent.estimatedZone.heightMeters + 0.2).toFixed(1)} m`}
                />
              )}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
              <button
                onClick={() => handleValidate("confirmed")}
                className="flex-1 py-2 rounded-full text-xs font-display flex items-center justify-center gap-1"
                style={{ background: "rgba(16,185,129,0.18)", color: "var(--green)" }}
              >
                <Check size={13} /> Confirmer
              </button>
              <button
                onClick={() => handleValidate("false")}
                className="flex-1 py-2 rounded-full text-xs font-display flex items-center justify-center gap-1"
                style={{ background: "rgba(239,68,68,0.18)", color: "var(--red)" }}
              >
                <X size={13} /> Fausse alerte
              </button>
              <button
                onClick={() => handleValidate("unsure")}
                className="flex-1 py-2 rounded-full text-xs font-display flex items-center justify-center gap-1"
                style={{ background: "rgba(245,158,11,0.18)", color: "var(--amber)" }}
              >
                <HelpCircle size={13} /> Incertain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info slide-in panel */}
      {infoOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-72 glass-panel rounded-none border-l p-5 animate-[slide-in-right_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm text-teal">Détails techniques</h3>
            <button onClick={() => setInfoOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <Row label="Fréquence dominante" value={state.frequency ? `${Math.round(state.frequency)} Hz` : "—"} />
            <Row label="Correspondance moustique" value={state.isDetecting ? `${state.confidence}%` : "—"} />
            <Row label="Bruit de fond" value={`${Math.round(state.noiseFloor)} dB`} />
            <Row label="SNR" value={state.isDetecting && state.peakSnr > 0 ? `+${state.peakSnr.toFixed(1)} dB` : "—"} />
            <Row label="Durée du burst" value={state.isDetecting && state.durationMs > 0 ? `${(state.durationMs / 1000).toFixed(2)} s` : "—"} />
            <Row label="Zone active" value={state.isDetecting ? state.zone : "—"} />
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="fixed bottom-20 inset-x-0 px-4 z-30">
        <div className="max-w-md mx-auto glass-panel p-3 flex items-center justify-center gap-3">
          <button
            onClick={() => (state.isListening ? stopListening() : handleStart())}
            className="btn-ghost flex items-center gap-2 !py-2 !px-4 text-[13px] border border-white/5 hover:border-white/10"
          >
            {state.isListening ? <Pause size={14} /> : <Play size={14} />}
            {state.isListening ? "Pause" : "Écoute Live"}
          </button>
        </div>
        {validation && (
          <div className="max-w-md mx-auto text-center text-xs text-teal mt-2 font-mono-x">
            Retour enregistré ·{" "}
            {validation === "confirmed"
              ? "moustique confirmé"
              : validation === "false"
                ? "fausse alarme"
                : "incertain"}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
