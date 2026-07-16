import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { ChevronLeft, Smartphone, Copy, QrCode as QrIcon, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRoomStore } from "@/lib/roomStore";
import { toast } from "sonner";
import { createBus, type IPeerBus, type BusMsg } from "@/lib/realtimeBus";
import type { PeerPresence, PeerReport } from "@/lib/multiPeer";
import { estimateSource } from "@/lib/multiPeer";
import { useMosquitoDetection } from "@/hooks/useMosquitoDetection";
import { z } from "zod";

const searchSchema = z.object({ code: z.string().optional() });

export const Route = createFileRoute("/multi")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Multi-appareils — MosquitoRadar" },
      { name: "description", content: "Triangulation en temps réel entre plusieurs smartphones synchronisés." },
    ],
  }),
  component: MultiPage,
});

const DEFAULT_ROOM = { width: 4, length: 5 };
const PEER_TIMEOUT_MS = 15_000;

function loadPeerId(): string {
  if (typeof window === "undefined") return "peer-ssr";
  const k = "mosquito_peer_id";
  let v = localStorage.getItem(k);
  if (!v) {
    v = "p_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(k, v);
  }
  return v;
}

function loadSessionCode(joined?: string): string {
  if (typeof window === "undefined") return joined ?? "000000";
  if (joined) {
    sessionStorage.setItem("mosquito_session_code", joined);
    return joined;
  }
  const stored = sessionStorage.getItem("mosquito_session_code");
  if (stored) return stored;
  const fresh = String(Math.floor(100000 + Math.random() * 900000));
  sessionStorage.setItem("mosquito_session_code", fresh);
  return fresh;
}

function MultiPage() {
  const { code: joinedCode } = Route.useSearch();
  const room = useRoomStore((s) => s.room);
  const dims = room?.dimensions ?? { width: DEFAULT_ROOM.width, length: DEFAULT_ROOM.length, height: 2.5 };

  const peerIdRef = useRef<string>(loadPeerId());
  const [sessionCode] = useState(() => loadSessionCode(joinedCode));
  const busRef = useRef<IPeerBus | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<string | null>(null);

  const [peers, setPeers] = useState<Record<string, PeerPresence>>({});
  const [reports, setReports] = useState<Record<string, PeerReport>>({});
  const [sessionStarted, setSessionStarted] = useState(false);

  // Local device presence — position is what the user drags.
  const [selfPos, setSelfPos] = useState<{ x: number; y: number }>({
    x: dims.width / 2,
    y: dims.length / 2,
  });
  const selfPosRef = useRef(selfPos);
  selfPosRef.current = selfPos;

  const { state: detState, startListening, stopListening } = useMosquitoDetection();
  const lastReportRef = useRef(0);

  // Bootstrap bus + local presence
  useEffect(() => {
    const bus = createBus(sessionCode);
    busRef.current = bus;

    const selfPresence = (): PeerPresence => ({
      peerId: peerIdRef.current,
      label: `Phone ${peerIdRef.current.slice(-3).toUpperCase()}`,
      role: "primary",
      position: { x: selfPosRef.current.x, y: selfPosRef.current.y },
      facingAngle: 0,
      heightMeters: 1.0,
      lastSeen: Date.now(),
    });

    const off = bus.onMessage((msg: BusMsg) => {
      if (msg.type === "hello") {
        const p = msg.presence;
        setPeers((prev) => ({ ...prev, [p.peerId]: { ...p, lastSeen: Date.now() } }));
        // Reply so late joiners learn about us
        if (p.peerId !== peerIdRef.current) {
          bus.post({ type: "hello", presence: selfPresence() });
        }
      } else if (msg.type === "bye") {
        setPeers((prev) => {
          const next = { ...prev };
          delete next[msg.peerId];
          return next;
        });
        setReports((prev) => {
          const next = { ...prev };
          delete next[msg.peerId];
          return next;
        });
      } else if (msg.type === "report") {
        const r = msg.report;
        setReports((prev) => ({ ...prev, [r.peerId]: r }));
        setPeers((prev) =>
          prev[r.peerId] ? { ...prev, [r.peerId]: { ...prev[r.peerId], lastSeen: Date.now() } } : prev,
        );
      }
    });

    // Announce self
    bus.post({ type: "hello", presence: selfPresence() });
    // Re-announce periodically so newcomers pick us up and stale peers time out
    const helloTimer = setInterval(() => {
      bus.post({ type: "hello", presence: selfPresence() });
    }, 5000);

    // Prune peers past timeout
    const pruneTimer = setInterval(() => {
      const now = Date.now();
      setPeers((prev) => {
        let changed = false;
        const next: Record<string, PeerPresence> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (k === peerIdRef.current || now - v.lastSeen < PEER_TIMEOUT_MS) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 3000);

    const onUnload = () => bus.post({ type: "bye", peerId: peerIdRef.current });
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(helloTimer);
      clearInterval(pruneTimer);
      window.removeEventListener("beforeunload", onUnload);
      off();
      bus.post({ type: "bye", peerId: peerIdRef.current });
      bus.close();
      busRef.current = null;
    };
  }, [sessionCode]);

  // Broadcast an updated hello when the user drags the local marker
  useEffect(() => {
    const bus = busRef.current;
    if (!bus) return;
    const t = setTimeout(() => {
      bus.post({
        type: "hello",
        presence: {
          peerId: peerIdRef.current,
          label: `Phone ${peerIdRef.current.slice(-3).toUpperCase()}`,
          role: "primary",
          position: { x: selfPos.x, y: selfPos.y },
          facingAngle: 0,
          heightMeters: 1.0,
          lastSeen: Date.now(),
        },
      });
    }, 150);
    return () => clearTimeout(t);
  }, [selfPos.x, selfPos.y]);

  // Broadcast a detection report whenever a real persistent burst appears
  useEffect(() => {
    if (!sessionStarted) return;
    if (!detState.isDetecting || detState.peakSnr <= 0) return;
    const now = Date.now();
    if (now - lastReportRef.current < 400) return;
    lastReportRef.current = now;
    const bus = busRef.current;
    if (!bus) return;
    const report: PeerReport = {
      peerId: peerIdRef.current,
      ts: now,
      snr: detState.peakSnr,
      peakFreq: detState.frequency,
      confidence: detState.confidence / 100,
    };
    setReports((prev) => ({ ...prev, [peerIdRef.current]: report }));
    bus.post({ type: "report", report });
  }, [
    sessionStarted,
    detState.isDetecting,
    detState.peakSnr,
    detState.frequency,
    detState.confidence,
  ]);

  // Merge self into peers so it always appears on the map
  const allPeers = useMemo<PeerPresence[]>(() => {
    const list = Object.values(peers);
    if (!list.find((p) => p.peerId === peerIdRef.current)) {
      list.push({
        peerId: peerIdRef.current,
        label: "Cet appareil",
        role: "primary",
        position: selfPos,
        facingAngle: 0,
        heightMeters: 1.0,
        lastSeen: Date.now(),
      });
    }
    return list;
  }, [peers, selfPos]);

  const detection = useMemo(() => {
    if (!sessionStarted) return null;
    const est = estimateSource(allPeers, reports);
    if (!est) return null;
    return {
      xPct: (est.x / dims.width) * 100,
      yPct: (est.y / dims.length) * 100,
      confidence: est.confidence,
    };
  }, [sessionStarted, allPeers, reports, dims.width, dims.length]);

  const pointerToMeters = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0.1, Math.min(dims.width - 0.1, xPct * dims.width)),
      y: Math.max(0.1, Math.min(dims.length - 0.1, yPct * dims.length)),
    };
  };

  const onDown = (peerId: string) => (e: React.PointerEvent) => {
    if (peerId !== peerIdRef.current) return; // only drag your own device
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = peerId;
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragRef.current == null) return;
    const m = pointerToMeters(e);
    if (!m) return;
    setSelfPos(m);
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const startSession = async () => {
    setSessionStarted(true);
    const deviceId =
      typeof window !== "undefined"
        ? localStorage.getItem("mosquito_audio_input") || undefined
        : undefined;
    await startListening(deviceId);
    toast.success("🔗 Session multi-appareils démarrée", { duration: 2500 });
  };

  const stopSession = () => {
    setSessionStarted(false);
    stopListening();
  };

  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : "https://mosquitoscan.lovable.app"}/join/${sessionCode}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast.success("Lien copié dans le presse-papier");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const now = Date.now();
  const deviceRows = allPeers.map((p) => {
    const isSelf = p.peerId === peerIdRef.current;
    const online = isSelf || now - p.lastSeen < PEER_TIMEOUT_MS;
    const r = reports[p.peerId];
    return { peer: p, isSelf, online, snr: r?.snr };
  });

  const syncedPositions = allPeers.map((p) => ({
    xPct: (p.position.x / dims.width) * 100,
    yPct: (p.position.y / dims.length) * 100,
  }));

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-4">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Triangulation</h1>
        <span />
      </header>

      <div className="glass-panel p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Vue de la pièce</span>
          <span className="font-mono-x text-[10px] text-muted-foreground">
            {dims.width}m × {dims.length}m {room ? "" : "· défaut"}
          </span>
        </div>
        <div
          className="relative w-full rounded-lg border border-dashed touch-none select-none"
          style={{
            aspectRatio: `${dims.width} / ${dims.length}`,
            borderColor: "rgba(0,229,195,0.3)",
            background:
              "radial-gradient(ellipse at center, rgba(0,229,195,0.05), transparent 70%), rgba(10,15,30,0.6)",
          }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            {[25, 50, 75].map((p) => (
              <line key={`v${p}`} x1={p} y1="0" x2={p} y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
            ))}
            {[25, 50, 75].map((p) => (
              <line key={`h${p}`} x1="0" y1={p} x2="100" y2={p} stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
            ))}

            {syncedPositions.length === 2 && (
              <line
                x1={syncedPositions[0].xPct} y1={syncedPositions[0].yPct}
                x2={syncedPositions[1].xPct} y2={syncedPositions[1].yPct}
                stroke="var(--teal)" strokeWidth="0.5" strokeDasharray="2 1.5"
              />
            )}
            {syncedPositions.length >= 3 && (
              <polygon
                points={syncedPositions.slice(0, 3).map((d) => `${d.xPct},${d.yPct}`).join(" ")}
                fill="rgba(0,229,195,0.10)"
                stroke="var(--teal)"
                strokeWidth="0.4"
                strokeDasharray="2 1.5"
              />
            )}

            {detection && (
              <g>
                <circle
                  cx={detection.xPct} cy={detection.yPct}
                  r={6 + detection.confidence * 12}
                  fill="rgba(245,158,11,0.22)" stroke="var(--amber)" strokeWidth="0.4"
                  style={{ transition: "cx 0.4s ease, cy 0.4s ease, r 0.4s ease" }}
                />
                <circle cx={detection.xPct} cy={detection.yPct} r="1.4" fill="var(--amber)" />
              </g>
            )}
          </svg>

          {detection && (
            <div
              className="absolute -translate-x-1/2 -translate-y-[130%] px-2 py-0.5 rounded-full text-[9px] font-mono-x pointer-events-none whitespace-nowrap"
              style={{
                left: `${detection.xPct}%`,
                top: `${detection.yPct}%`,
                background: "rgba(245,158,11,0.9)",
                color: "#0A0F1E",
                transition: "left 0.4s ease, top 0.4s ease",
              }}
            >
              Zone probable · {Math.round(detection.confidence * 100)}%
            </div>
          )}

          {allPeers.map((p) => {
            const isSelf = p.peerId === peerIdRef.current;
            const online = isSelf || now - p.lastSeen < PEER_TIMEOUT_MS;
            const xPct = (p.position.x / dims.width) * 100;
            const yPct = (p.position.y / dims.length) * 100;
            return (
              <div
                key={p.peerId}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center touch-none ${isSelf ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
                onPointerDown={onDown(p.peerId)}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center transition"
                  style={{
                    background: online ? "var(--teal)" : "rgba(255,255,255,0.15)",
                    color: "#0A0F1E",
                    boxShadow: online ? "0 0 14px var(--teal-glow)" : "none",
                    outline: isSelf ? "2px solid var(--amber)" : "none",
                    outlineOffset: 2,
                  }}
                >
                  <Smartphone size={16} />
                </div>
                <span className="text-[9px] font-mono-x mt-0.5 text-foreground">{isSelf ? "Vous" : p.label}</span>
                <span className="text-[8px] font-mono-x text-muted-foreground">
                  {p.position.x.toFixed(1)}m · {p.position.y.toFixed(1)}m
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-around mt-3 text-[10px] font-mono-x">
          <span className="text-teal">● Online</span>
          <span className="text-muted-foreground">● Offline</span>
        </div>
      </div>

      {allPeers.length === 1 && (
        <div className="glass-panel p-6 text-center text-xs text-muted-foreground mb-4">
          <Smartphone size={28} className="mx-auto mb-2 opacity-40" />
          Scannez le QR code avec un autre téléphone pour commencer.
        </div>
      )}

      <div className="space-y-2 mb-4">
        {deviceRows.map((row) => (
          <div key={row.peer.peerId} className="glass-panel p-3 flex justify-between items-center text-sm">
            <span className="font-display">{row.isSelf ? "Cet appareil" : row.peer.label}</span>
            <span
              className="font-mono-x text-xs flex items-center gap-2"
              style={{ color: row.online ? "var(--teal)" : "var(--muted-foreground)" }}
            >
              <span>{row.online ? "Online ✓" : "Offline"}</span>
              <span>·</span>
              <span>{row.snr != null ? `SNR ${row.snr.toFixed(1)} dB` : "—"}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="glass-panel p-5 text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-center gap-1">
          <QrIcon size={11} /> Code de session
        </div>
        <div className="font-mono-x text-4xl tracking-[0.3em] text-teal mb-4">{sessionCode}</div>
        <div className="w-36 h-36 mx-auto rounded-lg p-3 mb-3" style={{ background: "white" }}>
          <QRCodeSVG value={joinUrl} size={120} bgColor="#ffffff" fgColor="#0A0F1E" level="M" />
        </div>
        <button
          onClick={copyLink}
          className="btn-ghost w-full flex items-center justify-center gap-2 !py-2 text-xs mb-2"
        >
          <Copy size={12} /> Copier le lien
        </button>
        <button
          onClick={sessionStarted ? stopSession : startSession}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Play size={14} /> {sessionStarted ? "Arrêter la session" : "Démarrer la session"}
        </button>
      </div>

      <BottomNav />
    </main>
  );
}