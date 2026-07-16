import type { RoomModel, RoomSurface, DetectionEvent, Face } from "@/types/room";

type ViewMode = "3d" | "floorplan" | "elevation";

interface Props {
  roomModel: RoomModel;
  detectionEvent?: DetectionEvent | null;
  viewMode: ViewMode;
  elevationFace?: Face;
}

const MATERIAL_COLOR: Record<string, string> = {
  smooth_wall: "#1E293B",
  rough_wall: "#1F2937",
  glass: "#0E4F66",
  fabric: "#3F2A52",
  wood: "#3A2A1F",
  tile: "#1C1917",
};

const TYPE_FALLBACK: Record<string, string> = {
  wall: "#1E293B",
  ceiling: "#0F172A",
  floor: "#1C1917",
  furniture: "#27272A",
  window: "#0E4F66",
  door: "#2A1F14",
  curtain: "#3F2A52",
};

function surfaceColor(s: RoomSurface) {
  return MATERIAL_COLOR[s.material] ?? TYPE_FALLBACK[s.type] ?? "#1E293B";
}

/* Isometric projection: x→right, y→back, z→up */
function iso(x: number, y: number, z: number, scale = 36, ox = 220, oy = 230) {
  const px = ox + (x - y) * Math.cos(Math.PI / 6) * scale;
  const py = oy + ((x + y) * Math.sin(Math.PI / 6) - z) * scale;
  return [px, py] as const;
}

export function IsometricRoomView({
  roomModel,
  detectionEvent,
  viewMode,
  elevationFace = "east",
}: Props) {
  if (viewMode === "floorplan") return <FloorPlan room={roomModel} ev={detectionEvent} />;
  if (viewMode === "elevation")
    return <ElevationView room={roomModel} ev={detectionEvent} face={elevationFace} />;
  return <Isometric3D room={roomModel} ev={detectionEvent} />;
}

/* ---------------- 3D Isometric ---------------- */
function Isometric3D({ room, ev }: { room: RoomModel; ev?: DetectionEvent | null }) {
  const W = room.dimensions.width;
  const L = room.dimensions.length;
  const H = room.dimensions.height;
  const detectedId = ev?.estimatedZone.surfaceId;

  // Floor polygon
  const floor = [iso(0, 0, 0), iso(W, 0, 0), iso(W, L, 0), iso(0, L, 0)];
  // Back walls (north y=L, west x=0)
  const wallNorth = [iso(0, L, 0), iso(W, L, 0), iso(W, L, H), iso(0, L, H)];
  const wallWest = [iso(0, 0, 0), iso(0, L, 0), iso(0, L, H), iso(0, 0, H)];

  const path = (pts: readonly (readonly [number, number])[]) =>
    pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ") + " Z";

  // Sort furniture back to front (higher y first)
  const furniture = room.surfaces
    .filter((s) => s.type === "furniture" || s.type === "curtain")
    .slice()
    .sort((a, b) => b.position.y - a.position.y);

  return (
    <svg viewBox="0 0 440 360" className="w-full h-auto block">
      <defs>
        <radialGradient id="hot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(239,68,68,0.85)" />
          <stop offset="50%" stopColor="rgba(245,158,11,0.55)" />
          <stop offset="100%" stopColor="rgba(0,229,195,0)" />
        </radialGradient>
      </defs>

      {/* Floor */}
      <path
        d={path(floor)}
        fill={TYPE_FALLBACK.floor}
        stroke="rgba(0,229,195,0.25)"
        strokeWidth="0.8"
      />

      {/* Back walls */}
      <path d={path(wallNorth)} fill={TYPE_FALLBACK.wall} stroke="rgba(0,229,195,0.25)" strokeWidth="0.8" />
      <path d={path(wallWest)} fill="#172033" stroke="rgba(0,229,195,0.25)" strokeWidth="0.8" />

      {/* Detection overlay on highlighted wall */}
      {ev && (detectedId === "wall_north" || detectedId === "wall_west") && (
        <DetectionPatchWall room={room} ev={ev} />
      )}

      {/* Furniture as boxes */}
      {furniture.map((s) => (
        <IsoBox key={s.id} s={s} highlight={s.id === detectedId} />
      ))}

      {/* Detection on furniture overlay handled inside IsoBox */}

      {/* Device markers */}
      {room.devicePositions.map((d) => {
        const [px, py] = iso(d.position.x, d.position.y, 0.02);
        return (
          <g key={d.deviceId}>
            <circle cx={px} cy={py} r="6" fill="var(--teal)" opacity="0.9" />
            <circle cx={px} cy={py} r="12" fill="none" stroke="var(--teal)" strokeOpacity="0.4" />
            <text x={px + 10} y={py - 8} fill="var(--teal)" fontSize="9" fontFamily="monospace">
              {d.label}
            </text>
          </g>
        );
      })}

      {/* Front walls — translucent so we see inside */}
      <path
        d={path([iso(0, 0, 0), iso(W, 0, 0), iso(W, 0, H), iso(0, 0, H)])}
        fill="rgba(30,41,59,0.25)"
        stroke="rgba(0,229,195,0.4)"
        strokeWidth="0.8"
      />
      <path
        d={path([iso(W, 0, 0), iso(W, L, 0), iso(W, L, H), iso(W, 0, H)])}
        fill="rgba(30,41,59,0.18)"
        stroke="rgba(0,229,195,0.35)"
        strokeWidth="0.8"
      />
      {ev && (detectedId === "wall_south" || detectedId === "wall_east") && (
        <DetectionPatchWall room={room} ev={ev} />
      )}

      {/* Scan line */}
      {ev && (
        <line
          x1="10"
          y1="0"
          x2="430"
          y2="0"
          stroke="var(--teal)"
          strokeWidth="1"
          opacity="0.4"
          style={{
            animation: "scanY 3.5s ease-in-out infinite alternate",
          }}
        />
      )}
      <style>{`@keyframes scanY { from { transform: translateY(20px); } to { transform: translateY(330px); } }`}</style>
    </svg>
  );
}

function IsoBox({ s, highlight }: { s: RoomSurface; highlight: boolean }) {
  const w = s.dimensions.width;
  const h = s.dimensions.height; // along z for furniture? In our data: height = z size for curtain, but for bed height=0.55 z size. depth = y. width = x.
  const d = s.dimensions.depth ?? 0.2;
  // position is center: derive corner
  const cx = s.position.x - w / 2;
  const cy = s.position.y - d / 2;
  const cz = 0;
  const top = h;

  const corners = {
    flb: iso(cx, cy, cz),
    frb: iso(cx + w, cy, cz),
    brb: iso(cx + w, cy + d, cz),
    blb: iso(cx, cy + d, cz),
    flt: iso(cx, cy, cz + top),
    frt: iso(cx + w, cy, cz + top),
    brt: iso(cx + w, cy + d, cz + top),
    blt: iso(cx, cy + d, cz + top),
  };
  const path = (pts: (readonly [number, number])[]) =>
    pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ") + " Z";

  const base = surfaceColor(s);
  const stroke = highlight ? "var(--teal)" : "rgba(0,229,195,0.25)";
  const sw = highlight ? 1.2 : 0.6;
  const filter = highlight ? "drop-shadow(0 0 6px var(--teal))" : undefined;

  return (
    <g style={{ filter }}>
      {/* right face */}
      <path d={path([corners.frb, corners.brb, corners.brt, corners.frt])} fill={shade(base, -10)} stroke={stroke} strokeWidth={sw} />
      {/* front face */}
      <path d={path([corners.flb, corners.frb, corners.frt, corners.flt])} fill={shade(base, 0)} stroke={stroke} strokeWidth={sw} />
      {/* top */}
      <path d={path([corners.flt, corners.frt, corners.brt, corners.blt])} fill={shade(base, 14)} stroke={stroke} strokeWidth={sw} />
      {highlight && (
        <path d={path([corners.flt, corners.frt, corners.brt, corners.blt])} fill="url(#hot)" opacity="0.9" />
      )}
    </g>
  );
}

function DetectionPatchWall({ room, ev }: { room: RoomModel; ev: DetectionEvent }) {
  const W = room.dimensions.width;
  const L = room.dimensions.length;
  const H = room.dimensions.height;
  const { u, v } = ev.estimatedZone.positionOnSurface;
  let cx = 0, cy = 0;
  switch (ev.estimatedZone.surfaceId) {
    case "wall_north": [cx, cy] = iso(u * W, L, v * H); break;
    case "wall_south": [cx, cy] = iso(u * W, 0, v * H); break;
    case "wall_east": [cx, cy] = iso(W, u * L, v * H); break;
    case "wall_west": [cx, cy] = iso(0, u * L, v * H); break;
    case "ceiling": [cx, cy] = iso(u * W, v * L, H); break;
    default: return null;
  }
  return (
    <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "pulse 1.6s ease-in-out infinite" }}>
      <circle cx={cx} cy={cy} r="36" fill="url(#hot)" opacity={Math.max(0.3, ev.confidence / 100)} />
      <style>{`@keyframes pulse { 0%,100% { opacity:0.7 } 50% { opacity: 1 } }`}</style>
    </g>
  );
}

function shade(hex: string, amt: number) {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

/* ---------------- 2D Floor Plan ---------------- */
function FloorPlan({ room, ev }: { room: RoomModel; ev?: DetectionEvent | null }) {
  const W = room.dimensions.width;
  const L = room.dimensions.length;
  const scale = 60;
  const ox = 20;
  const oy = 20;
  const detectedId = ev?.estimatedZone.surfaceId;

  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => oy + (L - y) * scale;

  return (
    <svg viewBox={`0 0 ${W * scale + 40} ${L * scale + 40}`} className="w-full h-auto block">
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
      {/* furniture */}
      {room.surfaces
        .filter((s) => s.type === "furniture" || s.type === "window" || s.type === "curtain")
        .map((s) => {
          const w = s.dimensions.width;
          const d = s.dimensions.depth ?? 0.2;
          const x = sx(s.position.x - w / 2);
          const y = sy(s.position.y + d / 2);
          const hi = s.id === detectedId;
          return (
            <g key={s.id}>
              <rect
                x={x}
                y={y}
                width={w * scale}
                height={d * scale}
                fill={surfaceColor(s)}
                stroke={hi ? "var(--teal)" : "rgba(255,255,255,0.15)"}
                strokeWidth={hi ? 2 : 1}
              />
              <text x={x + 4} y={y + 12} fill="rgba(255,255,255,0.7)" fontSize="9">
                {s.label}
              </text>
            </g>
          );
        })}
      {/* wall highlight */}
      {ev && detectedId?.startsWith("wall_") && (
        <WallHighlight2D room={room} ev={ev} sx={sx} sy={sy} scale={scale} />
      )}
      {/* devices */}
      {room.devicePositions.map((d) => (
        <g key={d.deviceId}>
          <circle cx={sx(d.position.x)} cy={sy(d.position.y)} r="7" fill="var(--teal)" />
          <text x={sx(d.position.x) + 10} y={sy(d.position.y) + 3} fill="var(--teal)" fontSize="9">
            {d.label}
          </text>
        </g>
      ))}
      {/* detection on furniture as polygon overlay */}
      {ev && !detectedId?.startsWith("wall_") && (() => {
        const surface = room.surfaces.find((s) => s.id === detectedId);
        if (!surface) return null;
        return (
          <circle
            cx={sx(surface.position.x)}
            cy={sy(surface.position.y)}
            r="34"
            fill="url(#hot2d)"
            opacity={Math.max(0.3, ev.confidence / 100)}
          />
        );
      })()}
      <defs>
        <radialGradient id="hot2d">
          <stop offset="0%" stopColor="rgba(239,68,68,0.7)" />
          <stop offset="50%" stopColor="rgba(245,158,11,0.4)" />
          <stop offset="100%" stopColor="rgba(0,229,195,0)" />
        </radialGradient>
      </defs>
      {/* compass */}
      <g transform={`translate(${W * scale + 20}, ${oy + 4})`}>
        <text fill="var(--teal)" fontSize="9" textAnchor="end">
          N ↑
        </text>
      </g>
    </svg>
  );
}

function WallHighlight2D({
  room,
  ev,
  sx,
  sy,
  scale,
}: {
  room: RoomModel;
  ev: DetectionEvent;
  sx: (x: number) => number;
  sy: (y: number) => number;
  scale: number;
}) {
  const W = room.dimensions.width;
  const L = room.dimensions.length;
  const { u } = ev.estimatedZone.positionOnSurface;
  const id = ev.estimatedZone.surfaceId;
  const thickness = 8;
  let x = 0, y = 0, w = 0, h = 0;
  if (id === "wall_north") { x = sx(u * W) - 30; y = sy(L) - 4; w = 60; h = thickness; }
  if (id === "wall_south") { x = sx(u * W) - 30; y = sy(0) - thickness + 4; w = 60; h = thickness; }
  if (id === "wall_east") { x = sx(W) - 4; y = sy(u * L) - 30; w = thickness; h = 60; }
  if (id === "wall_west") { x = sx(0) - thickness + 4; y = sy(u * L) - 30; w = thickness; h = 60; }
  if (w === 0) return null;
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="var(--amber)"
      opacity={Math.max(0.4, ev.confidence / 100)}
      rx="2"
      style={{ filter: "drop-shadow(0 0 8px var(--amber))" }}
    />
  );
}

/* ---------------- 2D Elevation ---------------- */
function ElevationView({
  room,
  ev,
  face,
}: {
  room: RoomModel;
  ev?: DetectionEvent | null;
  face: Face;
}) {
  const W = face === "north" || face === "south" ? room.dimensions.width : room.dimensions.length;
  const H = room.dimensions.height;
  const scale = 60;
  const ox = 20;
  const oy = 20;
  const baseY = oy + H * scale;

  const detectedId = ev?.estimatedZone.surfaceId;
  const showWall = detectedId === `wall_${face}`;
  const heightBand = ev?.estimatedZone.heightMeters;

  // human silhouette 1.5m
  const hX = ox + 0.3 * scale;

  return (
    <svg viewBox={`0 0 ${W * scale + 40} ${H * scale + 40}`} className="w-full h-auto block">
      {/* floor */}
      <line x1={ox} y1={baseY} x2={ox + W * scale} y2={baseY} stroke="#374151" strokeWidth="3" />
      {/* wall */}
      <rect x={ox} y={oy} width={W * scale} height={H * scale} fill="#0F172A" stroke="#374151" strokeWidth="2" />
      {/* furniture silhouettes (objects whose y or x aligns with this wall) */}
      {room.surfaces
        .filter((s) => s.type === "furniture" || s.type === "curtain" || s.type === "window")
        .map((s) => {
          const w = s.dimensions.width;
          const z = s.dimensions.height;
          const xs = face === "north" || face === "south" ? s.position.x : s.position.y;
          const x = ox + (xs - w / 2) * scale;
          const y = baseY - (s.position.z + z / 2) * scale;
          return (
            <rect
              key={s.id}
              x={x}
              y={y}
              width={w * scale}
              height={z * scale}
              fill={surfaceColor(s)}
              opacity="0.7"
              stroke="rgba(255,255,255,0.2)"
            />
          );
        })}
      {/* human silhouette */}
      <g fill="rgba(0,229,195,0.5)">
        <circle cx={hX} cy={baseY - 1.4 * scale} r={0.1 * scale} />
        <rect x={hX - 0.05 * scale} y={baseY - 1.3 * scale} width={0.1 * scale} height={1.3 * scale} />
      </g>
      <text x={hX + 10} y={baseY - 1.5 * scale} fill="rgba(0,229,195,0.6)" fontSize="9">
        1,5 m
      </text>
      {/* detection height band */}
      {showWall && heightBand && (
        <>
          <rect
            x={ox}
            y={baseY - (heightBand + 0.2) * scale}
            width={W * scale}
            height={0.4 * scale}
            fill="var(--amber)"
            opacity="0.35"
          />
          <text x={ox + 6} y={baseY - heightBand * scale - 6} fill="var(--amber)" fontSize="10">
            Hauteur estimée : {(heightBand - 0.2).toFixed(1)} – {(heightBand + 0.2).toFixed(1)} m
          </text>
        </>
      )}
      <text x={ox} y={oy - 6} fill="var(--muted-foreground)" fontSize="9" fontFamily="monospace">
        Coupe — Mur {face.toUpperCase()}
      </text>
    </svg>
  );
}