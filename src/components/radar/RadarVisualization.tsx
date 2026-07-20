import { Target, ShieldAlert, Wifi } from "lucide-react";

// CORRECTIF (lot 10) :
//  - Le texte d'état au repos affichait "SYNTAX_ERROR: SYS_OFFLINE" — ça
//    ressemble à une vraie erreur, pas à de la décoration. Remplacé par un
//    libellé neutre.
//  - La position de la cible (distance en mètres, angle en degrés) était
//    entièrement fabriquée à partir du nom de la zone ("Gauche"/"Droite"/
//    autre → coordonnées et distance fixes codées en dur) — aucune mesure
//    de distance n'existe réellement dans le système (seulement une zone
//    nommée parmi 9). Affiché maintenant sans distance/angle inventés.
//  - Le repli par défaut sur "Aedes"/"545Hz" quand speciesHint/frequency
//    sont vides a été retiré — affiche "—" plutôt qu'une valeur plausible
//    mais fausse.

interface Props {
  isActive: boolean;
  isDetecting: boolean;
  confidence: number;
  frequency?: number;
  zone?: string;
  speciesHint?: string;
}

export function RadarVisualization({
  isActive,
  isDetecting,
  confidence,
  frequency,
  zone,
  speciesHint,
}: Props) {
  const centerColor = !isActive
    ? "#4B5563"
    : isDetecting
      ? confidence > 75
        ? "#F43F5E"
        : "#F59E0B"
      : "#00E5C3";

  // Position d'affichage du marqueur, dérivée du nom de zone pour donner un
  // repère visuel approximatif (gauche/droite/centre) — ce n'est PAS une
  // triangulation, juste un placement indicatif sur le cadran.
  const getTargetPosition = () => {
    if (!isDetecting) return null;
    if (zone?.includes("Gauche") || zone?.includes("Left")) {
      return { x: 55, y: 75 };
    } else if (zone?.includes("Droite") || zone?.includes("Right")) {
      return { x: 145, y: 65 };
    }
    return { x: 135, y: 125 };
  };

  const target = getTargetPosition();

  return (
    <div className="relative w-80 h-80 mx-auto flex flex-col items-center justify-center bg-[#070B14] rounded-full border border-teal-500/10 p-2 shadow-[0_0_40px_rgba(0,229,195,0.05)] select-none overflow-hidden">

      {/* Outer compass rim */}
      <div className="absolute inset-0 rounded-full border border-teal-500/10 pointer-events-none">
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-teal-400/50 font-bold">N 000°</div>
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-mono text-teal-400/50 font-bold">E 090°</div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-teal-400/50 font-bold">S 180°</div>
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-mono text-teal-400/50 font-bold">W 270°</div>
      </div>

      {/* Sonar expanding ripples for active state */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none">
          {[0, 1.2, 2.4].map((delay, i) => (
            <span
              key={i}
              className="absolute inset-0 rounded-full border border-teal-500/10 animate-sonar"
              style={{
                animationDelay: `${delay}s`,
                animationDuration: "3.6s",
              }}
            />
          ))}
        </div>
      )}

      {/* Grid Overlay with Ranges and Graticules */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none">
        {[85, 65, 45, 25].map((r) => (
          <circle
            key={r}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="rgba(0, 229, 195, 0.08)"
            strokeWidth="0.5"
          />
        ))}
        <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(0, 229, 195, 0.12)" strokeWidth="0.5" />
        <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(0, 229, 195, 0.12)" strokeWidth="0.5" />
        <line x1="36" y1="36" x2="164" y2="164" stroke="rgba(0, 229, 195, 0.04)" strokeWidth="0.3" />
        <line x1="36" y1="164" x2="164" y2="36" stroke="rgba(0, 229, 195, 0.04)" strokeWidth="0.3" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = 100 + 82 * Math.cos(angle);
          const y1 = 100 + 82 * Math.sin(angle);
          const x2 = 100 + 85 * Math.cos(angle);
          const y2 = 100 + 85 * Math.sin(angle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0, 229, 195, 0.3)" strokeWidth="0.5" />
          );
        })}
      </svg>

      {/* Rotating Sweep Beam */}
      {isActive && (
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="sweep-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#00E5C3" stopOpacity="0.25" />
              <stop offset="30%" stopColor="#00E5C3" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#00E5C3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g style={{ transformOrigin: "100px 100px", animation: "radar-spin 4s linear infinite" }}>
            <path d="M100 100 L100 15 A85 85 0 0 1 181.2 74.4 Z" fill="url(#sweep-gradient)" />
          </g>
        </svg>
      )}

      {/* Target Lock-On Indicators */}
      {isActive && isDetecting && target && (
        <div
          className="absolute z-20 pointer-events-none animate-fadeIn"
          style={{
            left: `${(target.x / 200) * 100}%`,
            top: `${(target.y / 200) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-rose-500 opacity-75 animate-ping" />
            <div className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-white shadow-[0_0_10px_#F43F5E]" />

            <div className="absolute -inset-4 border border-rose-500/30 rounded flex items-center justify-center animate-[pulse_1s_infinite]">
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-rose-500" />
              <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-rose-500" />
              <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-rose-500" />
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-rose-500" />
            </div>

            <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-slate-950/90 border border-rose-500/45 rounded-lg px-2 py-1 text-[8px] font-mono text-slate-100 whitespace-nowrap shadow-lg shadow-black/80 backdrop-blur-md">
              <div className="flex items-center gap-1 text-[9px] font-bold text-rose-400">
                <Target size={10} className="text-rose-400 animate-pulse" />
                <span>SIGNAL DÉTECTÉ</span>
              </div>
              <div className="mt-0.5 border-t border-rose-500/20 pt-0.5 space-y-0.5">
                <div>ESPÈCE: <span className="text-teal-300 font-bold">{speciesHint?.split(" ")[0] || "—"}</span></div>
                <div>FREQ: <span className="text-teal-300">{frequency ? `${Math.round(frequency)}Hz` : "—"}</span></div>
                <div>ZONE: <span className="text-teal-300">{zone || "—"}</span></div>
                <div className="flex items-center gap-1 text-[7px] text-amber-400 font-extrabold animate-pulse">
                  <ShieldAlert size={8} /> CONF: {confidence}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Center base/micro receiver dot */}
      <div className="relative z-10 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-750 flex items-center justify-center shadow-md">
        <div
          className="w-3 h-3 rounded-full transition-colors duration-500 relative flex items-center justify-center"
          style={{
            backgroundColor: centerColor,
            boxShadow: isActive ? `0 0 16px ${centerColor}` : "none",
          }}
        >
          {isActive && (
            <span className="absolute w-2 h-2 rounded-full bg-white opacity-40 animate-ping" />
          )}
        </div>
      </div>

      {/* Lower Status Indicator Overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/85 border border-white/5 rounded-full px-3 py-1 flex items-center gap-1.5 text-[9px] font-mono text-slate-300 backdrop-blur-sm pointer-events-none">
        <Wifi size={10} className={isActive ? "text-teal animate-pulse" : "text-muted-foreground"} />
        <span>
          {isActive
            ? isDetecting
              ? "ANALYSE ACOUSTIQUE EN COURS..."
              : "RECHERCHE DE SIGNAL..."
            : "EN VEILLE"}
        </span>
      </div>

      <style>{`
        @keyframes radar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
