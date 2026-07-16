import { ZONES } from "@/hooks/useMosquitoDetection";

interface Props {
  activeZone: string;
  confidence: number;
}

export function HeatmapGrid({ activeZone, confidence }: Props) {
  return (
    <div className="glass-panel p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Carte de présence</span>
        <span className="text-[10px] font-mono-x text-teal">{activeZone}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 aspect-square">
        {ZONES.map((zone) => {
          const active = zone === activeZone && confidence > 0;
          const opacity = active ? Math.max(0.3, confidence / 100) : 0.06;
          return (
            <div
              key={zone}
              className="rounded-md flex items-center justify-center text-[9px] text-center px-1 transition-all relative"
              style={{
                background: `rgba(0, 229, 195, ${opacity})`,
                border: active ? "1px solid var(--teal)" : "1px solid rgba(255,255,255,0.05)",
                boxShadow: active ? "0 0 16px var(--teal-glow)" : "none",
              }}
            >
              <span className={active ? "text-foreground font-mono-x" : "text-muted-foreground"}>
                {zone}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}