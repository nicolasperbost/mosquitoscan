import { useSyncExternalStore } from "react";
import type { RoomModel, DetectionEvent, DevicePosition } from "@/types/room";

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

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((l) => l());
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
  },
  setDevicePositions(devices: DevicePosition[]) {
    if (!state.room) return;
    state = { ...state, room: { ...state.room, devicePositions: devices } };
    emit();
  },
  addDetection(d: DetectionEvent) {
    state = { ...state, detections: [d, ...state.detections].slice(0, 100) };
    emit();
  },
  validateDetection(id: string, kind: DetectionEvent["validatedBy"]) {
    state = {
      ...state,
      detections: state.detections.map((d) =>
        d.id === id ? { ...d, validatedBy: kind } : d,
      ),
    };
    emit();
  },
  reset() {
    state = { room: null, detections: [] };
    emit();
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