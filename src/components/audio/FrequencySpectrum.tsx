interface Props {
  data: number[];
  highlight?: boolean;
}

export function FrequencySpectrum({ data, highlight }: Props) {
  const max = Math.max(...data, 1);
  return (
    <div className="glass-panel p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Spectre 100Hz–1500Hz</span>
        <span className="text-[10px] font-mono-x text-teal">300–800Hz</span>
      </div>
      <div className="flex items-end gap-[2px] h-16">
        {data.map((v, i) => {
          const inBand = i >= 13 && i <= 36; // ~300-800Hz in 64 bins
          const h = (v / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${h}%`,
                background: inBand && highlight ? "var(--teal)" : inBand ? "rgba(0,229,195,0.4)" : "rgba(255,255,255,0.15)",
                boxShadow: inBand && highlight ? "0 0 6px var(--teal-glow)" : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}