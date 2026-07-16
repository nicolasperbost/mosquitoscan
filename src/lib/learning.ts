import { useSyncExternalStore } from "react";

// Simple per-surface / per-frequency-bucket feedback ledger used to bias
// future localization proposals. Everything lives in localStorage so the
// app improves over time on the device that produced the feedback.

export type FeedbackKind = "confirmed" | "false" | "unsure";

interface SurfaceStat {
  confirmed: number;
  false: number;
  unsure: number;
  lastFreq?: number;
  updatedAt: number;
}

interface LearningState {
  bySurface: Record<string, SurfaceStat>;
  byFrequencyBucket: Record<string, { confirmed: number; false: number }>;
  totalFeedback: number;
}

const KEY = "mosquito_learning_v1";

function empty(): LearningState {
  return { bySurface: {}, byFrequencyBucket: {}, totalFeedback: 0 };
}

function load(): LearningState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

let state: LearningState = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function bucketFor(freq: number) {
  return `${Math.round(freq / 50) * 50}`;
}

export const learningStore = {
  getState: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  record({
    surfaceId,
    frequency,
    kind,
  }: {
    surfaceId: string;
    frequency: number;
    kind: FeedbackKind;
  }) {
    const prev = state.bySurface[surfaceId] ?? {
      confirmed: 0,
      false: 0,
      unsure: 0,
      updatedAt: 0,
    };
    const nextSurface: SurfaceStat = {
      ...prev,
      [kind]: prev[kind] + 1,
      lastFreq: frequency,
      updatedAt: Date.now(),
    };
    const b = bucketFor(frequency);
    const prevB = state.byFrequencyBucket[b] ?? { confirmed: 0, false: 0 };
    const nextB = {
      confirmed: prevB.confirmed + (kind === "confirmed" ? 1 : 0),
      false: prevB.false + (kind === "false" ? 1 : 0),
    };
    state = {
      bySurface: { ...state.bySurface, [surfaceId]: nextSurface },
      byFrequencyBucket: { ...state.byFrequencyBucket, [b]: nextB },
      totalFeedback: state.totalFeedback + 1,
    };
    emit();
  },
  reset() {
    state = empty();
    emit();
  },
};

/**
 * Returns a bias score in [0.5, 2.0] for a given surface, computed from
 * user feedback history. Values > 1 mean "likely mosquito zone", < 1 mean
 * "user has flagged false alerts here in the past".
 */
export function surfaceBias(surfaceId: string): number {
  const s = state.bySurface[surfaceId];
  if (!s) return 1;
  const score = s.confirmed - s.false * 1.5 + s.unsure * 0.25;
  return Math.max(0.5, Math.min(2, 1 + score * 0.15));
}

/**
 * Given a list of candidate surface ids, returns the one whose weighted
 * score is highest for a small pseudo-random draw. Ensures the app still
 * explores but favours zones the user has confirmed before.
 */
export function pickBiasedSurface<T extends { id: string }>(
  candidates: T[],
  seed = Math.random(),
): T {
  if (candidates.length === 0) throw new Error("no candidates");
  const weights = candidates.map((c) => surfaceBias(c.id));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seed * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

const SERVER_SNAPSHOT: LearningState = empty();
export function useLearningStore<T>(selector: (s: LearningState) => T): T {
  return useSyncExternalStore(
    learningStore.subscribe,
    () => selector(learningStore.getState()),
    () => selector(SERVER_SNAPSHOT),
  );
}