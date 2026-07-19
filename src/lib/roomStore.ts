import { useSyncExternalStore } from "react";
import type { RoomModel, DetectionEvent, DevicePosition } from "@/types/room";
import { pushRoomToCloud, pushDetectionToCloud, pullCloudSnapshot } from "@/lib/cloudSync";

interface State {
  room: RoomModel | null;
  detections: DetectionEvent[];
}

const STORAGE_KEY = "mosquito_radar_room_state_v1";

function load(): State {
  if (typeof window === "undefined") return { room: null, detections: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { room: null, detections: [] };
    const parsed = JSON.parse(raw);
    return {
      room: parsed.room
        ? { ...parsed.room, createdAt: new Date(parsed.room.createdAt) }
        : null,
      detections: (parsed.detections ?? []).map((d: DetectionEvent) => ({
        ...d,
        timestamp: new Date(d.timestamp),
      })),
    };
  } catch {
    return { room: null, detections: [] };
  }
}

let state: State = load();
const listeners = new Set<() => void>();

// Set by useCloudSync() (new hook, see below) once a user signs in. When
// null, the app behaves exactly as before this change — fully local, no
// network calls from this store at all. This is what keeps sign-in
// additive rather than a breaking change for existing free/local usage.
let cloudUserId: string | null = null;
// Detections captured locally with no account cap at 100 (see
// addDetection below, unchanged from before). Once signed in, the cloud
// table has no such cap — only the local mirror is capped for storage/
// performance reasons on-device.
const LOCAL_CAP = 100;

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function mergeDetections(local: DetectionEvent[], cloud: DetectionEvent[]): DetectionEvent[] {
  const byId = new Map<string, DetectionEvent>();
  // Cloud first, then local overwrites on id collision — local is the more
  // "live"/recent copy in the rare case both exist (e.g. a detection made
  // right as sign-in completes).
  for (const d of cloud) byId.set(d.id, d);
  for (const d of local) byId.set(d.id, d);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export const roomStore = {
  getState: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setRoom(room: RoomModel | null) {
    state = { ...state, room };
    emit();
    if (cloudUserId && room) pushRoomToCloud(cloudUserId, room);
  },
  setDevicePositions(devices: DevicePosition[]) {
    if (!state.room) return;
    state = { ...state, room: { ...state.room, devicePositions: devices } };
    emit();
    if (cloudUserId) pushRoomToCloud(cloudUserId, state.room);
  },
  addDetection(d: DetectionEvent) {
    state = { ...state, detections: [d, ...state.detections].slice(0, LOCAL_CAP) };
    emit();
    if (cloudUserId) pushDetectionToCloud(cloudUserId, d);
  },
  validateDetection(id: string, kind: DetectionEvent["validatedBy"]) {
    state = {
      ...state,
      detections: state.detections.map((d) =>
        d.id === id ? { ...d, validatedBy: kind } : d,
      ),
    };
    emit();
    if (cloudUserId) {
      const updated = state.detections.find((d) => d.id === id);
      if (updated) pushDetectionToCloud(cloudUserId, updated);
    }
  },
  reset() {
    state = { room: null, detections: [] };
    emit();
    // Deliberately does NOT delete cloud data — a local reset (e.g. via the
    // "Réinitialiser toutes les données" button in Réglages) should not
    // silently destroy a paying account's cloud history. Account-level
    // deletion, if ever needed, should be its own explicit, confirmed
    // action — not a side effect of the existing local reset button.
  },

  /** Called once by useCloudSync() when a user signs in: pulls their cloud
   *  data, merges it with whatever's already local (dedup by detection id,
   *  most recent wins on collision), and starts routing future writes to
   *  the cloud too. Called with null on sign-out, which simply stops
   *  pushing further writes — it does NOT clear local state, so a
   *  just-signed-out user doesn't lose what's on their device. */
  async setCloudUser(userId: string | null) {
    cloudUserId = userId;
    if (!userId) return;
    try {
      const snapshot = await pullCloudSnapshot(userId);
      state = {
        room: state.room ?? snapshot.room,
        detections: mergeDetections(state.detections, snapshot.detections),
      };
      emit();
      // Push whatever was purely local (captured before sign-in existed on
      // this device) up to the cloud now, so it isn't stranded locally.
      if (state.room) pushRoomToCloud(userId, state.room);
      for (const d of state.detections) pushDetectionToCloud(userId, d);
    } catch (e) {
      console.warn("[roomStore] cloud hydration failed", e);
    }
  },
};

const SERVER_SNAPSHOT: State = { room: null, detections: [] };

export function useRoomStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    roomStore.subscribe,
    () => selector(roomStore.getState()),
    () => selector(SERVER_SNAPSHOT),
  );
}
