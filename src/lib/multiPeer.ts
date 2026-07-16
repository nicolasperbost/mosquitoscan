// Real peer messaging via BroadcastChannel (works across tabs / same-origin
// windows on the same device) + a weighted-triangulation solver from
// per-device SNR reports.
//
// For true cross-device sync a signaling server is required (WebRTC);
// this module is written so the transport can be swapped without touching
// the UI (all reads/writes go through `PeerBus`).

export interface PeerPresence {
  peerId: string;
  label: string;
  role: "primary" | "secondary" | "tertiary";
  position: { x: number; y: number };
  facingAngle: number;
  heightMeters: number;
  lastSeen: number;
}

export interface PeerReport {
  peerId: string;
  ts: number;
  snr: number; // dB
  peakFreq: number; // Hz
  confidence: number; // 0..1
}

type MsgHello = { type: "hello"; presence: PeerPresence };
type MsgBye = { type: "bye"; peerId: string };
type MsgReport = { type: "report"; report: PeerReport };
type Msg = MsgHello | MsgBye | MsgReport;

export class PeerBus {
  private ch: BroadcastChannel | null = null;
  private listeners = new Set<(msg: Msg) => void>();
  readonly sessionCode: string;

  constructor(sessionCode: string) {
    this.sessionCode = sessionCode;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.ch = new BroadcastChannel(`mosquito-session-${sessionCode}`);
      this.ch.onmessage = (e) => this.listeners.forEach((l) => l(e.data));
    }
  }
  post(msg: Msg) {
    this.ch?.postMessage(msg);
  }
  onMessage(cb: (msg: Msg) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  close() {
    this.ch?.close();
    this.ch = null;
    this.listeners.clear();
  }
}

/**
 * Weighted-centroid triangulation. Each peer contributes its position
 * weighted by its most recent SNR (linear from dB). Higher SNR → closer.
 * We invert weights: mosquito is pulled toward the loudest microphone.
 */
export function estimateSource(
  peers: PeerPresence[],
  reports: Record<string, PeerReport>,
): { x: number; y: number; confidence: number } | null {
  const usable = peers
    .map((p) => ({ p, r: reports[p.peerId] }))
    .filter((x) => x.r && x.r.snr > 3);
  if (usable.length === 0) return null;
  // linear amplitude weight
  const weights = usable.map((u) => Math.pow(10, u.r!.snr / 20));
  const total = weights.reduce((s, w) => s + w, 0);
  const x = usable.reduce((s, u, i) => s + u.p.position.x * weights[i], 0) / total;
  const y = usable.reduce((s, u, i) => s + u.p.position.y * weights[i], 0) / total;
  // Confidence: mean per-peer confidence scaled by geometry (more spread = better)
  const meanConf = usable.reduce((s, u) => s + u.r!.confidence, 0) / usable.length;
  const spread =
    usable.length >= 2
      ? Math.min(
          1,
          Math.max(
            ...usable.map((a, i) =>
              Math.max(
                ...usable
                  .slice(i + 1)
                  .map((b) =>
                    Math.hypot(a.p.position.x - b.p.position.x, a.p.position.y - b.p.position.y),
                  ),
                0,
              ),
            ),
          ) / 3,
        )
      : 0.3;
  return { x, y, confidence: Math.min(1, meanConf * (0.5 + 0.5 * spread)) };
}

/**
 * Optimal placement suggestions for N devices in a WxL room.
 * Uses a modified GDOP approach: maximise pairwise distance while
 * keeping devices ~40cm from the walls.
 */
export function suggestPlacements(
  W: number,
  L: number,
  count: number,
): { x: number; y: number; role: "primary" | "secondary" | "tertiary" }[] {
  const inset = 0.4;
  const roles: ("primary" | "secondary" | "tertiary")[] = ["primary", "secondary", "tertiary"];
  if (count <= 1) return [{ x: W / 2, y: L / 2, role: "primary" }];
  if (count === 2) {
    return [
      { x: inset, y: inset, role: "primary" },
      { x: W - inset, y: L - inset, role: "secondary" },
    ];
  }
  // 3 devices → non-collinear triangle covering the room
  return [
    { x: inset, y: inset, role: "primary" },
    { x: W - inset, y: inset, role: "secondary" },
    { x: W / 2, y: L - inset, role: "tertiary" },
  ].slice(0, count).map((p, i) => ({ ...p, role: roles[i] }));
}

/** Score current placement quality (0..1) to warn users of bad geometry. */
export function scorePlacement(
  positions: { x: number; y: number }[],
  W: number,
  L: number,
): { score: number; reason: string } {
  if (positions.length < 2) return { score: 0.3, reason: "1 seul appareil : localisation impossible." };
  const diag = Math.hypot(W, L);
  const dists: number[] = [];
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++)
      dists.push(Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y));
  const minD = Math.min(...dists);
  const meanD = dists.reduce((s, v) => s + v, 0) / dists.length;
  if (minD < 1.2) return { score: 0.25, reason: "Appareils trop proches (< 1,2 m)." };
  // Collinearity check for 3 points
  let colScore = 1;
  if (positions.length === 3) {
    const [a, b, c] = positions;
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
    const maxA = (W * L) / 4;
    colScore = Math.min(1, area / maxA);
    if (colScore < 0.25) return { score: 0.35, reason: "Appareils presque alignés : triangulation faible." };
  }
  const score = Math.min(1, ((meanD / diag) * 1.4) * colScore);
  return { score, reason: score > 0.7 ? "Excellente géométrie." : "Placement acceptable." };
}