interface LoadingScreenProps {
  message?: string;
  fullscreen?: boolean;
}

export function LoadingScreen({
  message = "Chargement…",
  fullscreen = false,
}: LoadingScreenProps) {
  const wrapCls = fullscreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center"
    : "flex flex-col items-center justify-center py-12";
  return (
    <div
      className={wrapCls}
      style={fullscreen ? { background: "#0A0F1E" } : undefined}
      role="status"
      aria-live="polite"
    >
      <div className="relative w-32 h-32 flex items-center justify-center">
        {[0, 0.8, 1.6].map((d, i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border-2 animate-sonar"
            style={{
              borderColor: "var(--teal)",
              opacity: 0.6 - i * 0.18,
              animationDelay: `${d}s`,
              animationDuration: "2.5s",
            }}
          />
        ))}
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "var(--teal)", boxShadow: "0 0 12px var(--teal-glow)" }}
        />
      </div>
      <p className="text-sm text-foreground mt-6 font-display">{message}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
        Merci de patienter
      </p>
    </div>
  );
}