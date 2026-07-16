// Real cross-device peer bus over Lovable Cloud (Supabase Realtime broadcast).
// Same shape as PeerBus in ./multiPeer — post / onMessage / close — so the UI
// stays transport-agnostic. Falls back to BroadcastChannel-only PeerBus in
// environments without network (e.g. dev offline).
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { PeerBus } from "./multiPeer";
import type { PeerPresence, PeerReport } from "./multiPeer";

type MsgHello = { type: "hello"; presence: PeerPresence };
type MsgBye = { type: "bye"; peerId: string };
type MsgReport = { type: "report"; report: PeerReport };
export type BusMsg = MsgHello | MsgBye | MsgReport;

export interface IPeerBus {
  readonly sessionCode: string;
  post(msg: BusMsg): void;
  onMessage(cb: (msg: BusMsg) => void): () => void;
  close(): void;
}

export class RealtimeBus implements IPeerBus {
  private channel: RealtimeChannel | null = null;
  private listeners = new Set<(msg: BusMsg) => void>();
  // Local echo so multiple tabs on the same device also see each other,
  // and so the sender's own hello populates the presence list immediately.
  private local: BroadcastChannel | null = null;
  readonly sessionCode: string;

  constructor(sessionCode: string) {
    this.sessionCode = sessionCode;
    if (typeof window === "undefined") return;
    const topic = `mosquito-session-${sessionCode}`;
    try {
      this.local = new BroadcastChannel(topic);
      this.local.onmessage = (e) => this.emit(e.data as BusMsg);
    } catch {
      /* no BroadcastChannel */
    }
    this.channel = supabase.channel(topic, {
      config: { broadcast: { self: true, ack: false } },
    });
    this.channel
      .on("broadcast", { event: "peer" }, (payload) => {
        const msg = payload.payload as BusMsg;
        this.emit(msg);
      })
      .subscribe();
  }

  private emit(msg: BusMsg) {
    this.listeners.forEach((l) => l(msg));
  }

  post(msg: BusMsg) {
    this.local?.postMessage(msg);
    this.channel?.send({ type: "broadcast", event: "peer", payload: msg });
  }

  onMessage(cb: (msg: BusMsg) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  close() {
    this.listeners.clear();
    try {
      this.local?.close();
    } catch {
      /* noop */
    }
    this.local = null;
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

/** Pick the real Realtime bus when the Supabase client is available,
 *  otherwise fall back to the local-only PeerBus. */
export function createBus(sessionCode: string): IPeerBus {
  if (typeof window === "undefined") {
    return new PeerBus(sessionCode) as unknown as IPeerBus;
  }
  try {
    return new RealtimeBus(sessionCode);
  } catch {
    return new PeerBus(sessionCode) as unknown as IPeerBus;
  }
}