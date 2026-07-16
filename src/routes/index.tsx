import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Smartphone,
  Clock,
  SlidersHorizontal,
  VolumeX,
  Moon,
  Lightbulb,
  X,
  Lock,
  CheckCircle2,
  Camera,
  Map,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useRoomStore } from "@/lib/roomStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MosquitoRadar — Détection acoustique de moustiques" },
      { name: "description", content: "Analyse acoustique en temps réel et triangulation multi-appareils pour localiser les moustiques." },
      { property: "og:title", content: "MosquitoRadar" },
      { property: "og:description", content: "Détection acoustique et triangulation des moustiques." },
    ],
  }),
  component: Index,
});

function Index() {
  const room = useRoomStore((s) => s.room);
  const detections = useRoomStore((s) => s.detections);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("mosquito_onboarded")) setShowOnboarding(true);
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem("mosquito_onboarded", "true");
    setShowOnboarding(false);
  };

  const nightMode = false;

  return (
    <main className="min-h-screen pb-32 px-5 pt-10 max-w-md mx-auto flex flex-col">
      <h1 className="text-4xl font-display font-bold text-center tracking-tight">
        Mosquito<span className="text-teal">Radar</span>
      </h1>
      <p className="text-center text-muted-foreground mt-2 text-sm">
        Détection acoustique nocturne · Triangulation multi-appareils
      </p>

      {/* 3-metric status bar */}
      <div className="glass-panel mt-6 px-2 py-3 flex items-stretch justify-around text-center">
        <div className="flex-1 flex flex-col items-center gap-1">
          <Smartphone size={14} className="text-teal" />
          <div className="font-mono-x text-teal text-sm">
            {room?.devicePositions.length ?? 1}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Connecté
          </div>
        </div>
        <div className="w-px bg-white/5" />
        <div className="flex-1 flex flex-col items-center gap-1">
          <VolumeX size={14} className="text-teal" />
          <div className="font-mono-x text-teal text-sm">−42 dB</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Ambiant
          </div>
        </div>
        <div className="w-px bg-white/5" />
        <div className="flex-1 flex flex-col items-center gap-1">
          <Moon size={14} className={nightMode ? "text-amber-x" : "text-muted-foreground"} />
          <div className={`font-mono-x text-sm ${nightMode ? "text-amber-x" : "text-muted-foreground"}`}>
            {nightMode ? "ON" : "OFF"}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Mode nuit
          </div>
        </div>
      </div>

      {/* Sonar with mosquito icon */}
      <div className="relative w-40 h-40 mx-auto my-8 flex items-center justify-center">
        {[0, 0.8, 1.6].map((d, i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border-2 animate-sonar"
            style={{
              borderColor: "var(--teal)",
              opacity: 0.6 - i * 0.2,
              animationDelay: `${d}s`,
              animationDuration: "2.5s",
            }}
          />
        ))}
        <svg
          viewBox="0 0 48 48"
          className="relative w-14 h-14"
          fill="none"
          stroke="var(--teal)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 8px var(--teal-glow))" }}
        >
          <ellipse cx="24" cy="26" rx="3" ry="6" fill="var(--teal)" />
          <path d="M21 22 Q12 14 6 18 Q10 22 18 24 Z" fill="rgba(0,229,195,0.25)" />
          <path d="M27 22 Q36 14 42 18 Q38 22 30 24 Z" fill="rgba(0,229,195,0.25)" />
          <line x1="22" y1="20" x2="18" y2="14" />
          <line x1="26" y1="20" x2="30" y2="14" />
          <line x1="23" y1="32" x2="21" y2="40" />
          <line x1="25" y1="32" x2="27" y2="40" />
        </svg>
      </div>

      {/* Primary CTA */}
      <Link
        to="/detection"
        className="btn-primary text-center text-lg !py-5 animate-cta-pulse"
      >
        Démarrer la détection
      </Link>

      {showOnboarding && (
        <div
          className="glass-panel mt-3 p-3 flex items-start gap-2 animate-[fade-in_0.3s_ease-out]"
          style={{ borderColor: "rgba(245,158,11,0.4)" }}
        >
          <Lightbulb size={16} className="text-amber-x mt-0.5 shrink-0" />
          <div className="flex-1 text-xs">
            <span className="text-foreground">
              💡 Commencez par configurer votre pièce pour des résultats précis.
            </span>
            <Link to="/setup" className="text-teal block mt-1 hover:underline">
              Configurer ma pièce →
            </Link>
          </div>
          <button
            onClick={dismissOnboarding}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {!room && !showOnboarding && (
        <Link
          to="/setup"
          className="text-center text-xs text-teal mt-3 hover:underline underline-offset-4"
        >
          ✨ Configurer ma pièce (modèle 3D)
        </Link>
      )}

      {/* Secondary actions */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Link to="/multi" className="glass-panel p-4 flex flex-col items-center gap-2 text-xs text-center hover:border-teal transition">
          <Smartphone size={20} className="text-teal" />
          Multi-appareils
        </Link>
        <Link to="/history" className="glass-panel p-4 flex flex-col items-center gap-2 text-xs text-center hover:border-teal transition">
          <Clock size={20} className="text-teal" />
          Historique
        </Link>
        <Link to="/settings" className="glass-panel p-4 flex flex-col items-center gap-2 text-xs text-center hover:border-teal transition">
          <SlidersHorizontal size={20} className="text-teal" />
          Réglages
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Link to="/expertise" className="glass-panel p-4 flex flex-col items-center gap-2 text-xs text-center hover:border-teal transition">
          <Camera size={20} className="text-teal" />
          Expertise visuelle
        </Link>
        <Link to="/site-map" className="glass-panel p-4 flex flex-col items-center gap-2 text-xs text-center hover:border-teal transition">
          <Map size={20} className="text-teal" />
          Plan de site
        </Link>
      </div>

      <div className="mt-auto pt-8 flex flex-col items-center gap-1">
        {room && (
          <p className="text-[10px] text-teal flex items-center gap-1">
            <CheckCircle2 size={11} /> {room.name} configurée
            {detections.length > 0 && (
              <span className="text-muted-foreground">
                {" "}· {detections.length} détection(s)
              </span>
            )}
          </p>
        )}
        <p
          className="text-[10px] uppercase tracking-widest flex items-center gap-1"
          style={{ color: "#6B7280" }}
        >
          <Lock size={10} /> Mode local · Aucune donnée envoyée
        </p>
      </div>

      <BottomNav />
    </main>
  );
}