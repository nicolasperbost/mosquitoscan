import { useRef, useState } from "react";
import { Smartphone, Plus, Trash2, Crosshair, Sparkles, Compass } from "lucide-react";
import type { RoomModel, DevicePosition } from "@/types/room";
import { suggestPlacements, scorePlacement } from "@/lib/multiPeer";

interface Props {
  room: RoomModel;
  devices: DevicePosition[];
  onChange: (devices: DevicePosition[]) => void;
}

const ROLE_LABELS: Record<DevicePosition["role"], string> = {
  primary: "Primaire",
  secondary: "Secondaire",
  tertiary: "Tertiaire",
};
const ROLES: DevicePosition["role"][] = ["primary", "secondary", "tertiary"];

export function DevicePlacementMap({ room, devices, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string>(
    devices[0]?.deviceId ?? "",
  );
  const [dragging, setDragging] = useState(false);

  const W = room.dimensions.width;
  const L = room.dimensions.length;
  const scale = 60;
  const ox = 20;
  const oy = 20;

  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => oy + (L - y) * scale;

  const svgPointToRoom = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    const x = Math.max(0.1, Math.min(W - 0.1, (local.x - ox) / scale));
    const y = Math.max(0.1, Math.min(L - 0.1, L - (local.y - oy) / scale));
    return { x, y };
  };

  const placeOrMove = (clientX: number, clientY: number) => {
    const pos = svgPointToRoom(clientX, clientY);
    if (!pos) return;
    if (!selectedId) return;
    onChange(
      devices.map((d) =>
        d.deviceId === selectedId ? { ...d, position: pos } : d,
      ),
    );
  };

  const addDevice = () => {
    if (devices.length >= 3) return;
    const roleUsed = new Set(devices.map((d) => d.role));
    const role = ROLES.find((r) => !roleUsed.has(r)) ?? "secondary";
    const idx = devices.length + 1;
    const next: DevicePosition = {
      deviceId: `phone_${idx}_${Date.now().toString(36)}`,
      label: `Téléphone ${idx}`,
      position: { x: W / 2, y: L / 2 },
      facingAngle: 0,
      role,
    };
    onChange([...devices, next]);
    setSelectedId(next.deviceId);
  };

  const removeDevice = (id: string) => {
    const next = devices.filter((d) => d.deviceId !== id);
    onChange(next);
    if (selectedId === id) setSelectedId(next[0]?.deviceId ?? "");
  };

  const centerSelected = () => {
    if (!selectedId) return;
    onChange(
      devices.map((d) =>
        d.deviceId === selectedId
          ? { ...d, position: { x: W / 2, y: L / 2 } }
          : d,
      ),
    );
  };

  const applySuggestion = () => {
    const count = Math.max(1, devices.length || 3);
    const sugg = suggestPlacements(W, L, count);
    const next: DevicePosition[] = sugg.map((s, i) => ({
      deviceId: devices[i]?.deviceId ?? `phone_${i + 1}_${Date.now().toString(36)}`,
      label: devices[i]?.label ?? `Téléphone ${i + 1}`,
      position: { x: s.x, y: s.y },
      facingAngle: devices[i]?.facingAngle ?? (i === 0 ? 45 : i === 1 ? 135 : 270),
      role: s.role,
      heightMeters: devices[i]?.heightMeters ?? 1.5,
    }));
    onChange(next);
    setSelectedId(next[0]?.deviceId ?? "");
  };

  const updateSelected = (patch: Partial<DevicePosition>) => {
    onChange(devices.map((d) => (d.deviceId === selectedId ? { ...d, ...patch } : d)));
  };

  const placementScore = scorePlacement(devices.map((d) => d.position), W, L);
  const selectedDevice = devices.find((d) => d.deviceId === selectedId);

  return (
    <div>
      <div className="glass-panel p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W * scale + 40} ${L * scale + 40}`}
          className="w-full h-auto block touch-none select-none"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDragging(true);
            placeOrMove(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (dragging) placeOrMove(e.clientX, e.clientY);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          {/* room */}
          <rect
            x={ox}
            y={oy}
            width={W * scale}
            height={L * scale}
            fill="#0F172A"
            stroke="#374151"
            strokeWidth="4"
          />
          {/* grid */}
          {Array.from({ length: Math.floor(W) }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={sx(i + 1)}
              y1={oy}
              x2={sx(i + 1)}
              y2={oy + L * scale}
              stroke="rgba(0,229,195,0.08)"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: Math.floor(L) }).map((_, i) => (
            <line
              key={`h${i}`}
              x1={ox}
              y1={sy(i + 1)}
              x2={ox + W * scale}
              y2={sy(i + 1)}
              stroke="rgba(0,229,195,0.08)"
              strokeWidth="0.5"
            />
          ))}
          {/* furniture */}
          {room.surfaces
            .filter(
              (s) =>
                s.type === "furniture" ||
                s.type === "window" ||
                s.type === "curtain",
            )
            .map((s) => {
              const w = s.dimensions.width;
              const d = s.dimensions.depth ?? 0.2;
              const x = sx(s.position.x - w / 2);
              const y = sy(s.position.y + d / 2);
              return (
                <g key={s.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w * scale}
                    height={d * scale}
                    fill="#1f2937"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1"
                  />
                  <text
                    x={x + 4}
                    y={y + 12}
                    fill="rgba(255,255,255,0.55)"
                    fontSize="9"
                    pointerEvents="none"
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}

          {/* coverage circles + triangulation polygon */}
          {devices.length >= 2 && (
            <polygon
              points={devices
                .map((d) => `${sx(d.position.x)},${sy(d.position.y)}`)
                .join(" ")}
              fill="rgba(0,229,195,0.10)"
              stroke="var(--teal)"
              strokeWidth="1"
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}
          {devices.map((d) => (
            <circle
              key={`r-${d.deviceId}`}
              cx={sx(d.position.x)}
              cy={sy(d.position.y)}
              r={2.5 * scale}
              fill="none"
              stroke="var(--teal)"
              strokeOpacity="0.18"
              strokeWidth="1"
              pointerEvents="none"
            />
          ))}

          {/* devices */}
          {devices.map((d) => {
            const isSel = d.deviceId === selectedId;
            const ang = ((d.facingAngle ?? 0) - 90) * (Math.PI / 180);
            const cx = sx(d.position.x);
            const cy = sy(d.position.y);
            const armLen = 26;
            return (
              <g
                key={d.deviceId}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedId(d.deviceId);
                  setDragging(true);
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  placeOrMove(e.clientX, e.clientY);
                }}
                style={{ cursor: "grab" }}
              >
                {/* facing direction arm */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(ang) * armLen}
                  y2={cy + Math.sin(ang) * armLen}
                  stroke="var(--teal)"
                  strokeWidth={isSel ? 2 : 1}
                  strokeOpacity={isSel ? 0.9 : 0.5}
                  pointerEvents="none"
                />
                <circle
                  cx={sx(d.position.x)}
                  cy={sy(d.position.y)}
                  r={isSel ? 14 : 10}
                  fill="var(--teal)"
                  opacity={isSel ? 1 : 0.7}
                  style={{
                    filter: isSel
                      ? "drop-shadow(0 0 8px var(--teal))"
                      : undefined,
                  }}
                />
                <text
                  x={sx(d.position.x)}
                  y={sy(d.position.y) + 3}
                  fill="#0A0F1E"
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {d.label.replace(/[^0-9]/g, "") || "•"}
                </text>
                <text
                  x={sx(d.position.x) + 16}
                  y={sy(d.position.y) - 8}
                  fill="var(--teal)"
                  fontSize="9"
                  fontFamily="monospace"
                  pointerEvents="none"
                >
                  {d.position.x.toFixed(1)},{d.position.y.toFixed(1)} m
                </text>
              </g>
            );
          })}

          {/* compass */}
          <text
            x={ox + W * scale}
            y={oy - 6}
            fill="var(--teal)"
            fontSize="9"
            textAnchor="end"
          >
            N ↑
          </text>
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
        <span className="text-muted-foreground">
          Touchez le plan pour placer · glissez pour ajuster.
        </span>
        <span
          className="font-mono-x"
          style={{
            color:
              placementScore.score > 0.7
                ? "var(--green)"
                : placementScore.score > 0.45
                  ? "var(--amber)"
                  : "var(--red)",
          }}
          title={placementScore.reason}
        >
          Géo {Math.round(placementScore.score * 100)}%
        </span>
      </div>

      <button
        type="button"
        onClick={applySuggestion}
        className="btn-ghost w-full mt-2 text-xs flex items-center justify-center gap-2"
      >
        <Sparkles size={13} /> Suggérer un placement optimal
      </button>

      {selectedDevice && (
        <div className="glass-panel p-3 mt-3 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-display">Réglages · {selectedDevice.label}</span>
            <span className="text-muted-foreground text-[10px]">
              {ROLE_LABELS[selectedDevice.role]}
            </span>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">Rôle</div>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              {ROLES.map((r) => {
                const active = selectedDevice.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => updateSelected({ role: r })}
                    className="px-2 py-1 rounded-md border transition"
                    style={{
                      borderColor: active ? "var(--teal)" : "rgba(255,255,255,0.08)",
                      background: active ? "rgba(0,229,195,0.15)" : "transparent",
                      color: active ? "var(--teal)" : "var(--muted-foreground)",
                    }}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span className="flex items-center gap-1"><Compass size={10} /> Orientation</span>
              <span className="font-mono-x text-teal">{Math.round(selectedDevice.facingAngle)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={359}
              value={selectedDevice.facingAngle}
              onChange={(e) => updateSelected({ facingAngle: Number(e.target.value) })}
              className="w-full accent-teal"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Hauteur au-dessus du sol</span>
              <span className="font-mono-x text-teal">
                {(selectedDevice.heightMeters ?? 1.5).toFixed(2)} m
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={Math.max(2.5, room.dimensions.height - 0.1)}
              step={0.05}
              value={selectedDevice.heightMeters ?? 1.5}
              onChange={(e) => updateSelected({ heightMeters: Number(e.target.value) })}
              className="w-full accent-teal"
            />
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {devices.map((d) => {
          const isSel = d.deviceId === selectedId;
          return (
            <div
              key={d.deviceId}
              onClick={() => setSelectedId(d.deviceId)}
              className="glass-panel p-3 flex items-center gap-3 cursor-pointer transition"
              style={{
                borderColor: isSel ? "var(--teal)" : undefined,
                boxShadow: isSel ? "0 0 12px var(--teal-glow)" : undefined,
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: isSel ? "var(--teal)" : "rgba(0,229,195,0.15)",
                  color: isSel ? "#0A0F1E" : "var(--teal)",
                }}
              >
                <Smartphone size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display">{d.label}</div>
                <div className="text-[10px] text-muted-foreground font-mono-x">
                  {ROLE_LABELS[d.role]} · {d.position.x.toFixed(1)},{d.position.y.toFixed(1)} m · h=
                  {(d.heightMeters ?? 1.5).toFixed(1)} · {Math.round(d.facingAngle)}°
                </div>
              </div>
              {isSel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    centerSelected();
                  }}
                  className="text-muted-foreground hover:text-teal p-1"
                  title="Recentrer"
                >
                  <Crosshair size={14} />
                </button>
              )}
              {devices.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDevice(d.deviceId);
                  }}
                  className="text-muted-foreground hover:text-red-400 p-1"
                  title="Retirer"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addDevice}
        disabled={devices.length >= 3}
        className="btn-ghost w-full mt-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={14} /> Ajouter un appareil ({devices.length}/3)
      </button>

      <div className="mt-3 text-[10px] text-muted-foreground leading-relaxed px-1">
        <strong className="text-teal">Conseil géométrie :</strong> {placementScore.reason}{" "}
        Idéal : triangle non aligné, ≥ 1,5 m entre appareils, orientation vers le centre de la pièce.
      </div>
    </div>
  );
}