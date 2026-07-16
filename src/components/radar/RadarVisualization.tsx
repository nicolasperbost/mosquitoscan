interface Props {
  isActive: boolean;
  isDetecting: boolean;
  confidence: number;
}

export function RadarVisualization({ isActive, isDetecting, confidence }: Props) {
  const centerColor = !isActive
    ? "#6B7280"
    : isDetecting
      ? confidence > 75
        ? "var(--green)"
        : "var(--amber)"
      : "var(--teal)";

  return (
    <div className="relative w-72 h-72 mx-auto flex items-center justify-center">
      {/* Sonar rings */}
      {isActive && (
        <>
          {[0, 0.8, 1.6].map((delay, i) => (
            <span
              key={i}
              className="absolute inset-0 rounded-full border-2 animate-sonar"
              style={{
                borderColor: isDetecting ? "var(--amber)" : "var(--teal)",
                animationDelay: `${delay}s`,
                animationDuration: isDetecting ? "1.2s" : "2.4s",
              }}
            />
          ))}
        </>
      )}
      {/* Static rings */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full opacity-30">
        {[80, 60, 40, 20].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--teal)" strokeWidth="0.5" />
        ))}
        <line x1="100" y1="20" x2="100" y2="180" stroke="var(--teal)" strokeWidth="0.3" />
        <line x1="20" y1="100" x2="180" y2="100" stroke="var(--teal)" strokeWidth="0.3" />
      </svg>
      {/* Sweep */}
      {isActive && (
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="sweep" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g style={{ transformOrigin: "100px 100px", animation: "spin 3s linear infinite" }}>
            <path d="M100 100 L100 20 A80 80 0 0 1 175 75 Z" fill="url(#sweep)" />
          </g>
        </svg>
      )}
      {/* Center dot */}
      <div
        className="relative w-6 h-6 rounded-full transition-colors"
        style={{ backgroundColor: centerColor, boxShadow: `0 0 24px ${centerColor}` }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}