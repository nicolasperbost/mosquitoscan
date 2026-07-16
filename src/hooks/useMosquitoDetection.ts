import { useState, useEffect, useRef, useCallback } from "react";
import { surfaceBias } from "@/lib/learning";
import {
  computeBinRanges,
  analyseFrame,
  classifyInsect,
  estimateHarmonicRatio,
  confidenceFromSnr,
  DEFAULT_BANDS,
  WIDE_BANDS,
  type BinRanges,
} from "@/lib/spectralAnalysis";
import type { InsectCategory } from "@/types/room";

export interface DetectionState {
  isListening: boolean;
  isDetecting: boolean;
  frequency: number;
  confidence: number;
  zone: string;
  noiseFloor: number;
  speciesHint: string;
  insectCategory: InsectCategory;
  insectConfidence: number;
  waveformData: number[];
  elapsedSeconds: number;
  error?: string;
  snr: number;
  peakSnr: number;
  durationMs: number;
}

export const ZONES = [
  "Avant-Gauche", "Avant-Centre", "Avant-Droite",
  "Milieu-Gauche", "Centre", "Milieu-Droite",
  "Arrière-Gauche", "Arrière-Centre", "Arrière-Droite",
];

// CORRECTIF: cette préférence existait déjà visuellement dans Réglages
// ("Plage de fréquences large") mais n'était reliée à rien — le toggle était
// purement décoratif (état React local, jamais lu par le hook). Elle pilote
// maintenant réellement la bande analysée (150-800Hz au lieu de 300-800Hz),
// ce qui est nécessaire pour que classifyInsect() puisse un jour retourner
// "fly"/"bee_wasp" plutôt que uniquement "mosquito"/"unknown".
const WIDE_BAND_STORAGE_KEY = "mosquito_wide_band";

export function isWideBandEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(WIDE_BAND_STORAGE_KEY) === "true";
}

export function setWideBandEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WIDE_BAND_STORAGE_KEY, enabled ? "true" : "false");
}

// Pick a zone weighted by past user-confirmed feedback (learning ledger).
// Falls back to uniform random when no history exists — the app still explores.
function pickBiasedZone(): string {
  const weights = ZONES.map((z) => surfaceBias(`zone:${z}`));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < ZONES.length; i++) {
    r -= weights[i];
    if (r <= 0) return ZONES[i];
  }
  return ZONES[4];
}

export function useMosquitoDetection() {
  const [state, setState] = useState<DetectionState>({
    isListening: false,
    isDetecting: false,
    frequency: 0,
    confidence: 0,
    zone: "Centre",
    noiseFloor: -80,
    speciesHint: "",
    insectCategory: "unknown",
    insectConfidence: 0,
    waveformData: Array(64).fill(0),
    elapsedSeconds: 0,
    snr: 0,
    peakSnr: 0,
    durationMs: 0,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const rangesRef = useRef<BinRanges | null>(null);
  // Sliding detection state
  const detectFramesRef = useRef(0);
  const currentZoneRef = useRef<string>("Centre");
  const noiseEmaRef = useRef<number>(-80);
  const burstStartRef = useRef<number | null>(null);
  const peakSnrRef = useRef<number>(0);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const simTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;

    if (simTimeoutRef.current) {
      clearTimeout(simTimeoutRef.current);
      simTimeoutRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);

    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    bufRef.current = null;
    detectFramesRef.current = 0;
    burstStartRef.current = null;
    peakSnrRef.current = 0;
    setState((s) => ({
      ...s,
      isListening: false,
      isDetecting: false,
      confidence: 0,
      frequency: 0,
      snr: 0,
      peakSnr: 0,
      durationMs: 0,
    }));
  }, []);

  const triggerMockMeasurement = useCallback(() => {
    stopListening();
    setIsSimulating(true);

    setState({
      isListening: true,
      isDetecting: false,
      frequency: 0,
      confidence: 0,
      zone: "Centre",
      noiseFloor: -78,
      speciesHint: "",
      insectCategory: "unknown",
      insectConfidence: 0,
      waveformData: Array(64).fill(0).map(() => -90 + Math.random() * 8),
      elapsedSeconds: 0,
      snr: 0,
      peakSnr: 0,
      durationMs: 0,
    });

    let currentElapsed = 0;
    const interval = setInterval(() => {
      currentElapsed += 1;
      
      const mockWaveform = Array(64).fill(0).map((_, idx) => {
        const distance = Math.abs(idx - 35); // peak around 35 (approx 545Hz)
        const baseNoise = -85 + Math.random() * 12;
        if (currentElapsed >= 2 && distance < 8) {
          return baseNoise + (8 - distance) * 7;
        }
        return baseNoise;
      });

      setState(s => ({
        ...s,
        elapsedSeconds: currentElapsed,
        waveformData: mockWaveform,
        isDetecting: currentElapsed >= 2,
        frequency: currentElapsed >= 2 ? 545 + Math.round(Math.random() * 6 - 3) : 0,
        confidence: currentElapsed >= 2 ? Math.min(96, 45 + currentElapsed * 9) : 0,
        snr: currentElapsed >= 2 ? 14 + Math.round(Math.random() * 4) : 0,
        peakSnr: currentElapsed >= 2 ? 19 : 0,
        durationMs: currentElapsed >= 2 ? (currentElapsed - 2) * 1000 : 0,
        zone: currentElapsed >= 2 ? "Milieu-Gauche" : "Centre",
        speciesHint: currentElapsed >= 2 ? "Aedes Albopictus (Moustique Tigre)" : "",
        insectCategory: currentElapsed >= 2 ? "mosquito" : "unknown",
        insectConfidence: currentElapsed >= 2 ? 0.94 : 0,
      }));
    }, 1000);

    simIntervalRef.current = interval;

    const timeout = setTimeout(() => {
      clearInterval(interval);
      simIntervalRef.current = null;
      setIsSimulating(false);
    }, 7000);

    simTimeoutRef.current = timeout;
  }, [stopListening]);

  const startListening = useCallback(async (deviceId?: string) => {
    // Guard against SSR / unsupported browsers
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState((s) => ({ ...s, error: "Micro non disponible dans ce navigateur." }));
      return;
    }
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      if (deviceId) {
        (audioConstraints as MediaTrackConstraints & { deviceId?: unknown }).deviceId = {
          exact: deviceId,
        };
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bins = analyser.frequencyBinCount;
      const buf = new Float32Array(new ArrayBuffer(bins * 4));
      bufRef.current = buf;
      // CORRECTIF: utilise WIDE_BANDS quand la préférence est activée, au
      // lieu de toujours passer les bandes par défaut (300-800Hz).
      const bands = isWideBandEnabled() ? WIDE_BANDS : DEFAULT_BANDS;
      rangesRef.current = computeBinRanges(ctx.sampleRate, analyser.fftSize, bands);

      setState((s) => ({
        ...s,
        isListening: true,
        elapsedSeconds: 0,
        error: undefined,
      }));

      timerRef.current = setInterval(() => {
        setState((s) => ({ ...s, elapsedSeconds: s.elapsedSeconds + 1 }));
      }, 1000);

      const loop = () => {
        const a = analyserRef.current;
        const b = bufRef.current;
        const ranges = rangesRef.current;
        if (!a || !b || !ranges) return;
        a.getFloatFrequencyData(b); // dBFS, typically -140..0

        const frame = analyseFrame(b, ranges, noiseEmaRef.current);
        noiseEmaRef.current = frame.noiseFloor;

        // Detection logic: peak must exceed noise floor by ≥ 8 dB and persist
        const isPeak = frame.snr >= 8 && frame.peakDb > -75;
        if (isPeak) detectFramesRef.current = Math.min(60, detectFramesRef.current + 1);
        else detectFramesRef.current = Math.max(0, detectFramesRef.current - 2);

        const persistent = detectFramesRef.current >= 4; // ~4 frames of RAF ≈ 65ms
        if (persistent) {
          if (burstStartRef.current === null) burstStartRef.current = Date.now();
          if (frame.snr > peakSnrRef.current) peakSnrRef.current = frame.snr;
        }
        if (detectFramesRef.current === 0) {
          burstStartRef.current = null;
          peakSnrRef.current = 0;
        }
        const durationMs = persistent && burstStartRef.current !== null
          ? Date.now() - burstStartRef.current
          : 0;

        const confidence = persistent ? confidenceFromSnr(frame.snr, frame.peakFreq) : 0;

        // Zone: locked while detection persists; refreshed at the start of a burst
        if (persistent && detectFramesRef.current === 4) {
          currentZoneRef.current = pickBiasedZone();
        }

        const classification = persistent
          ? classifyInsect(frame.peakFreq, estimateHarmonicRatio(b, frame.peakFreq, ranges.binHz))
          : null;

        setState((s) => ({
          ...s,
          isDetecting: persistent,
          frequency: persistent ? frame.peakFreq : 0,
          confidence,
          snr: Math.max(0, frame.snr),
          peakSnr: persistent ? peakSnrRef.current : 0,
          durationMs,
          noiseFloor: frame.noiseFloor,
          zone: persistent ? currentZoneRef.current : s.zone,
          speciesHint: classification?.label ?? "",
          insectCategory: classification?.category ?? "unknown",
          insectConfidence: classification?.confidence ?? 0,
          waveformData: frame.waveform,
        }));

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "NotAllowedError"
          ? "Accès au micro refusé. Autorisez le micro dans les réglages du navigateur."
          : "Impossible d'accéder au micro.";
      setState((s) => ({ ...s, error: msg, isListening: false }));
    }
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { state, startListening, stopListening, triggerMockMeasurement, isSimulating };
}
