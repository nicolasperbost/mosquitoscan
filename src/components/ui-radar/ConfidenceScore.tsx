interface Props { value: number }

export function ConfidenceScore({ value }: Props) {
  const color = value < 30 ? "var(--red)" : value < 60 ? "var(--amber)" : value < 85 ? "var(--teal)" : "var(--green)";
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s, stroke 0.3s", filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-mono-x" style={{ color }}>{value}%</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Confiance</span>
      </div>
    </div>
  );
}