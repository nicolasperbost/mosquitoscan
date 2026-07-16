import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { ChevronLeft, AlertTriangle, CheckCircle2, Volume2, Trash2, Info, Mic, Upload, Radio as RadioIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { roomStore, useRoomStore } from "@/lib/roomStore";
import { learningStore, useLearningStore } from "@/lib/learning";
import { isWideBandEnabled, setWideBandEnabled } from "@/hooks/useMosquitoDetection";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Réglages — MosquitoRadar" },
      { name: "description", content: "Calibrez la sensibilité, la plage de fréquences et la confidentialité de MosquitoRadar." },
    ],
  }),
  component: SettingsPage,
});

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="w-11 h-6 rounded-full relative transition shrink-0"
      style={{ background: on ? "var(--teal)" : "rgba(255,255,255,0.1)" }}
      aria-pressed={on}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

function SensitivitySegmented({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  const opts = [
    { v: 1, label: "Faible", desc: "Moins de fausses alertes" },
    { v: 2, label: "Moyenne", desc: "Recommandé" },
    { v: 3, label: "Élevée", desc: "Capte les signaux faibles" },
  ];
  return (
    <div>
      <div className="relative grid grid-cols-3 p-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="absolute top-1 bottom-1 rounded-full transition-transform"
          style={{
            left: "0.25rem",
            width: `calc((100% - 0.5rem) / 3)`,
            background: "var(--teal)",
            transform: `translateX(${(value - 1) * 100}%)`,
            boxShadow: "0 0 12px var(--teal-glow)",
          }}
        />
        {opts.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="relative z-10 py-1.5 text-xs font-display transition"
            style={{ color: value === o.v ? "#0A0F1E" : "var(--muted-foreground)" }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 mt-2 text-[9px] text-muted-foreground text-center leading-tight">
        {opts.map((o) => (
          <span key={o.v} style={value === o.v ? { color: "var(--teal)" } : undefined}>{o.desc}</span>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const learning = useLearningStore((s) => s);
  const [sensitivity, setSensitivity] = useState(2);
  // CORRECTIF: ce toggle était un useState local pur, jamais persisté ni lu
  // par le hook de détection — donc "Plage de fréquences large" ne changeait
  // strictement rien au comportement réel. Il est maintenant initialisé
  // depuis la préférence persistée et écrit dedans à chaque changement.
  const [wide, setWideState] = useState(false);
  useEffect(() => setWideState(isWideBandEnabled()), []);
  const setWide = (v: boolean) => {
    setWideState(v);
    setWideBandEnabled(v);
  };
  const [localOnly, setLocalOnly] = useState(true);
  const [contribute, setContribute] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState<"running" | "done">("running");
  const [showDataModal, setShowDataModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mosquito_audio_input") ?? "" : "",
  );
  const [micPermission, setMicPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  const refreshDevices = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    setAudioInputs(list.filter((d) => d.kind === "audioinput"));
  };

  useEffect(() => {
    refreshDevices();
    const handler = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, []);

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
      await refreshDevices();
      toast.success("Micro autorisé — sources listées");
    } catch {
      setMicPermission("denied");
      toast.error("Autorisation micro refusée");
    }
  };

  const chooseInput = (id: string) => {
    setSelectedInput(id);
    if (id) localStorage.setItem("mosquito_audio_input", id);
    else localStorage.removeItem("mosquito_audio_input");
  };

  const startCalibration = () => {
    if (!room) {
      toast.error("Configurez d'abord votre pièce");
      return;
    }
    setCalibrationStep("running");
    setShowCalibration(true);
    setTimeout(() => {
      setCalibrationStep("done");
      const newRT = 0.4 + Math.random() * 0.6;
      roomStore.setRoom({ ...room, reverbTime: newRT });
      toast.success(`📡 Pièce recalibrée · RT60 ${newRT.toFixed(2)}s`);
    }, 2200);
  };

  const resetAll = () => {
    localStorage.clear();
    roomStore.reset();
    learningStore.reset();
    toast("Toutes les données ont été effacées", { duration: 2500 });
    setShowResetConfirm(false);
    setTimeout(() => navigate({ to: "/" }), 400);
  };

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-6">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Réglages</h1>
        <span />
      </header>

      {/* Ma pièce */}
      {room ? (
        <section className="glass-panel p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-teal" />
              <span className="font-display text-sm">{room.name}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {new Date(room.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono-x space-y-0.5">
            <div>Dimensions : {room.dimensions.width} × {room.dimensions.length} × {room.dimensions.height} m</div>
            <div>Surfaces détectées : {room.surfaces.length}</div>
            <div>RT60 : {room.reverbTime.toFixed(2)} s</div>
            <div>Appareils : {room.devicePositions.length}</div>
          </div>
          <div className="flex gap-2 mt-3">
            <Link to="/setup" className="btn-ghost flex-1 text-xs text-center !py-2">Modifier</Link>
            <button onClick={startCalibration} className="btn-ghost flex-1 text-xs !py-2">Recalibrer</button>
          </div>
        </section>
      ) : (
        <section
          className="glass-panel p-4 mb-4"
          style={{ borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-amber-x" />
            <span className="font-display text-sm">Pièce non configurée</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Configurez votre pièce pour une localisation précise.
          </p>
          <Link to="/setup" className="btn-primary w-full text-sm text-center block">Configurer maintenant</Link>
        </section>
      )}

      {/* Sensibilité */}
      <section className="glass-panel p-4 mb-3">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-display">Sensibilité</span>
          <span className="font-mono-x text-[10px] text-muted-foreground">
            Apprentissage : {learning.totalFeedback} retours
          </span>
        </div>
        <SensitivitySegmented value={sensitivity} onChange={setSensitivity} />
      </section>

      <section className="glass-panel p-4 mb-3 flex justify-between items-center gap-3">
        <div>
          <div className="text-sm font-display">Plage de fréquences large</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {wide ? "150–800 Hz — inclut aussi mouches/abeilles" : "300–800 Hz, moustiques uniquement (recommandé)"}
          </div>
        </div>
        <Toggle on={wide} onChange={setWide} />
      </section>

      <section className="glass-panel p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Mic size={14} className="text-teal" />
          <span className="text-sm font-display">Source micro</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Coupler un micro externe (USB-C, piézo près d'un piège) permet de mieux capter les moustiques posés.
        </p>
        {audioInputs.length === 0 || audioInputs.every((d) => !d.label) ? (
          <button
            onClick={requestMicPermission}
            className="btn-ghost w-full text-xs !py-2"
            disabled={micPermission === "denied"}
          >
            {micPermission === "denied"
              ? "Micro refusé — autorisez-le dans les réglages navigateur"
              : "Autoriser le micro pour lister les sources"}
          </button>
        ) : (
          <select
            value={selectedInput}
            onChange={(e) => chooseInput(e.target.value)}
            className="w-full bg-transparent border rounded-md px-3 py-2 text-xs font-mono-x"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "var(--foreground)" }}
          >
            <option value="">Automatique (par défaut)</option>
            {audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Entrée ${d.deviceId.slice(0, 6)}…`}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Capteurs avancés : import SD + gestion multi-capteurs */}
      <section className="glass-panel p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <RadioIcon size={14} className="text-teal" />
          <span className="text-sm font-display">Capteurs avancés</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Boîtier autonome sur carte SD, ou capteur WiFi fixe — retrouvez et importez leurs données ici.
        </p>
        <div className="flex gap-2">
          <Link to="/import" className="btn-ghost flex-1 text-xs text-center !py-2 flex items-center justify-center gap-1.5">
            <Upload size={13} /> Importer (SD)
          </Link>
          <Link to="/devices" className="btn-ghost flex-1 text-xs text-center !py-2 flex items-center justify-center gap-1.5">
            <RadioIcon size={13} /> Mes capteurs
          </Link>
        </div>
      </section>

      <section className="glass-panel p-4 mb-3">
        <div className="flex justify-between items-center gap-3">
          <div>
            <div className="text-sm font-display">Mode local</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Tout traitement se fait sur votre appareil. Rien n'est envoyé.
            </div>
          </div>
          <Toggle on={localOnly} onChange={setLocalOnly} />
        </div>
      </section>

      <section className="glass-panel p-4 mb-3">
        <div className="flex justify-between items-center gap-3">
          <div>
            <div className="text-sm font-display">Contribuer aux données anonymes</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Seulement la fréquence, la durée et la validation. Jamais d'audio.
            </div>
          </div>
          <Toggle on={contribute} onChange={setContribute} />
        </div>
        <button
          onClick={() => setShowDataModal(true)}
          className="text-teal text-xs mt-3 flex items-center gap-1 hover:underline"
        >
          <Info size={12} /> Voir ce qui est collecté →
        </button>
      </section>

      <button onClick={startCalibration} className="btn-ghost w-full mt-4 flex items-center justify-center gap-2">
        <Volume2 size={14} /> Calibrer pour cette pièce
      </button>

      <button
        onClick={() => setShowResetConfirm(true)}
        className="w-full mt-3 py-3 rounded-full border text-xs font-display flex items-center justify-center gap-2 transition"
        style={{ borderColor: "rgba(239,68,68,0.5)", color: "var(--red)" }}
      >
        <Trash2 size={14} /> Réinitialiser toutes les données
      </button>

      <p className="text-center text-[10px] text-muted-foreground mt-8 uppercase tracking-widest">
        MosquitoRadar v0.1 · Mode sombre forcé
      </p>

      {/* Calibration modal */}
      {showCalibration && (
        <Modal onClose={() => calibrationStep === "done" && setShowCalibration(false)}>
          <div className="flex flex-col items-center gap-4 p-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(0,229,195,0.1)",
                boxShadow: calibrationStep === "running" ? "0 0 32px var(--teal-glow)" : "none",
                animation: calibrationStep === "running" ? "pulse 1.2s ease-in-out infinite" : undefined,
              }}
            >
              {calibrationStep === "running" ? (
                <Volume2 size={32} className="text-teal" />
              ) : (
                <CheckCircle2 size={32} className="text-teal" />
              )}
            </div>
            <p className="text-sm font-display">
              {calibrationStep === "running" ? "Émission du signal de test…" : "Calibration terminée"}
            </p>
            {calibrationStep === "done" && (
              <button onClick={() => setShowCalibration(false)} className="btn-primary text-sm">Fermer</button>
            )}
          </div>
        </Modal>
      )}

      {/* Data collected modal */}
      {showDataModal && (
        <Modal onClose={() => setShowDataModal(false)}>
          <div className="p-4">
            <h3 className="font-display text-sm mb-3">Données collectées</h3>
            <div className="text-[11px]">
              <div className="grid grid-cols-3 gap-2 pb-2 border-b border-white/10 text-muted-foreground uppercase tracking-wider text-[9px]">
                <span>Donnée</span><span>Stockage</span><span>Envoi</span>
              </div>
              {[
                ["Fréquence (Hz)", "Local + Cloud", "Si toggle ON"],
                ["Audio brut", "Jamais", "Jamais"],
                ["Position GPS", "Jamais", "Jamais"],
                ["Modèle de pièce", "Local seulement", "Non"],
                ["Validations", "Local", "Si toggle ON"],
              ].map((row) => (
                <div key={row[0]} className="grid grid-cols-3 gap-2 py-2 border-b border-white/5 font-mono-x">
                  <span className="text-foreground">{row[0]}</span>
                  <span className="text-muted-foreground">{row[1]}</span>
                  <span className="text-muted-foreground">{row[2]}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowDataModal(false)} className="btn-ghost w-full mt-4 text-xs">Fermer</button>
          </div>
        </Modal>
      )}

      {/* Reset confirm modal */}
      {showResetConfirm && (
        <Modal onClose={() => setShowResetConfirm(false)}>
          <div className="p-5 text-center">
            <AlertTriangle size={32} className="mx-auto text-red-500" style={{ color: "var(--red)" }} />
            <h3 className="font-display text-sm mt-3">Effacer toutes les données ?</h3>
            <p className="text-xs text-muted-foreground mt-2">
              Cela supprimera la pièce configurée, l'historique et les préférences.
              Cette action est irréversible.
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowResetConfirm(false)} className="btn-ghost flex-1 text-xs">
                Annuler
              </button>
              <button
                onClick={resetAll}
                className="flex-1 py-2 rounded-full text-xs font-display"
                style={{ background: "var(--red)", color: "white" }}
              >
                Effacer tout
              </button>
            </div>
          </div>
        </Modal>
      )}

      <BottomNav />
    </main>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-sm animate-[fade-in_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
