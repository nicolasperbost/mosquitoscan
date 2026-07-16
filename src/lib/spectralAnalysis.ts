// Shared spectral analysis core, factored out of useMosquitoDetection so the
// exact same math (noise floor, peak detection, species heuristic) can be
// reused by the live microphone hook AND by batch analysis of imported WAV
// files from an autonomous SD logger. Keeping this pure and side-effect free
// (no refs, no state) is what makes it safely reusable in both contexts.

export interface BandConfig {
  bandLow: number; // Hz
  bandHigh: number; // Hz
  nfLow: number; // Hz
  nfHigh: number; // Hz
  specLow: number; // Hz
  specHigh: number; // Hz
}

export const DEFAULT_BANDS: BandConfig = {
  bandLow: 300,
  bandHigh: 800,
  nfLow: 150,
  nfHigh: 2000,
  specLow: 100,
  specHigh: 1500,
};

// CORRECTIF: bande élargie pour permettre à classifyInsect() de recevoir des
// fréquences de mouche/abeille (~150-280Hz), qui sont sous la borne basse de
// DEFAULT_BANDS (300Hz). Sans ça, le pic recherché dans analyseFrame() ne
// peut jamais tomber sous 300Hz, et la classification mouche/abeille de
// classifyInsect() ne se déclenche donc jamais, quelle que soit la qualité
// du signal réel. bandHigh reste à 800 (la plage moustique la plus haute
// couverte par classifyInsect est ~780Hz, pas besoin d'aller plus haut).
export const WIDE_BANDS: BandConfig = {
  ...DEFAULT_BANDS,
  bandLow: 150,
};

export interface BinRanges {
  specLow: number;
  specHigh: number;
  bandLow: number;
  bandHigh: number;
  nfLow: number;
  nfHigh: number;
  binHz: number;
}

export function computeBinRanges(sampleRate: number, fftSize: number, bands: BandConfig = DEFAULT_BANDS): BinRanges {
  const bins = fftSize / 2;
  const binHz = sampleRate / fftSize;
  return {
    specLow: Math.floor(bands.specLow / binHz),
    specHigh: Math.min(bins - 1, Math.floor(bands.specHigh / binHz)),
    bandLow: Math.floor(bands.bandLow / binHz),
    bandHigh: Math.min(bins - 1, Math.floor(bands.bandHigh / binHz)),
    nfLow: Math.floor(bands.nfLow / binHz),
    nfHigh: Math.min(bins - 1, Math.floor(bands.nfHigh / binHz)),
    binHz,
  };
}

export interface FrameAnalysis {
  peakFreq: number;
  peakDb: number;
  noiseFloor: number;
  snr: number;
  waveform: number[]; // 64-bucket display spectrum, 0..100
}

/**
 * Analyse a single FFT frame (dBFS magnitudes from getFloatFrequencyData or
 * an offline equivalent) and return peak frequency, SNR and a display
 * waveform. Does not carry state between calls — persistence/burst tracking
 * is the caller's responsibility (see DetectionTracker below).
 */
export function analyseFrame(
  bins: Float32Array | number[],
  ranges: BinRanges,
  prevNoiseEma: number,
): FrameAnalysis {
  const { bandLow, bandHigh, nfLow, nfHigh, specLow, specHigh, binHz } = ranges;

  const nfSamples: number[] = [];
  for (let i = nfLow; i <= nfHigh; i++) {
    if (i >= bandLow && i <= bandHigh) continue;
    nfSamples.push(bins[i]);
  }
  nfSamples.sort((a, b) => a - b);
  const median = nfSamples[Math.floor(nfSamples.length / 2)] ?? -100;
  const noiseFloor = prevNoiseEma * 0.9 + median * 0.1;

  let peakBin = bandLow;
  let peakDb = -Infinity;
  for (let i = bandLow; i <= bandHigh; i++) {
    if (bins[i] > peakDb) {
      peakDb = bins[i];
      peakBin = i;
    }
  }
  let refinedBin = peakBin;
  if (peakBin > bandLow && peakBin < bandHigh) {
    const l = bins[peakBin - 1];
    const c = bins[peakBin];
    const r = bins[peakBin + 1];
    const denom = l - 2 * c + r;
    if (denom !== 0) refinedBin = peakBin + (0.5 * (l - r)) / denom;
  }
  const peakFreq = refinedBin * binHz;
  const snr = peakDb - noiseFloor;

  const NUM_BUCKETS = 64;
  const waveform = new Array(NUM_BUCKETS).fill(0);
  const step = (specHigh - specLow) / NUM_BUCKETS;
  for (let k = 0; k < NUM_BUCKETS; k++) {
    const s0 = Math.floor(specLow + k * step);
    const s1 = Math.floor(specLow + (k + 1) * step);
    let m = -Infinity;
    for (let i = s0; i < s1; i++) if (bins[i] > m) m = bins[i];
    waveform[k] = Math.max(0, Math.min(100, (m + 100) * 1.2));
  }

  return { peakFreq, peakDb, noiseFloor, snr, waveform };
}

// Wing-beat fundamental frequency ranges (Hz) — approximate, overlapping.
//   Fly (housefly / drosophila) ..... ~150–250 Hz, weaker harmonics
//   Bee / wasp ...................... ~200–280 Hz, stronger harmonics
//   Mosquito (Culex/Aedes/Anopheles). ~300–800 Hz
// Because the bands overlap, we return a probabilistic result rather than
// a hard label — the UI must display a confidence, not a certainty.
export type InsectCategory = "mosquito" | "fly" | "bee_wasp" | "unknown";

export interface InsectClassification {
  category: InsectCategory;
  /** Human-readable French label including species hint for mosquitoes. */
  label: string;
  /** 0..1 — how confident the discrimination between categories is. Below
   *  ~0.45 the caller should fall back to "insecte volant non identifié". */
  confidence: number;
}

function gauss(x: number, mu: number, sigma: number) {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

/**
 * Classify a wing-beat peak into an insect category. `harmonicRatio` is the
 * ratio of energy near 2·f0 relative to f0 (0..1+, higher = more harmonic
 * content). When unknown, pass 0 — the model just leans on the fundamental.
 */
export function classifyInsect(
  freq: number,
  harmonicRatio = 0,
): InsectClassification {
  // Overlapping band likelihoods (unnormalised)
  const pFly = gauss(freq, 200, 45) * (1 - Math.min(0.6, harmonicRatio) * 0.4);
  const pBee = gauss(freq, 240, 45) * (0.6 + Math.min(1, harmonicRatio) * 0.6);
  const pMosquito =
    (gauss(freq, 400, 70) + gauss(freq, 550, 90) + gauss(freq, 700, 80)) *
    (1 - Math.min(0.5, harmonicRatio) * 0.3);
  const total = pFly + pBee + pMosquito;
  if (total <= 1e-6 || freq < 100 || freq > 1200) {
    return { category: "unknown", label: "Insecte volant non identifié", confidence: 0.2 };
  }
  const probs = {
    fly: pFly / total,
    bee_wasp: pBee / total,
    mosquito: pMosquito / total,
  };
  const entries = Object.entries(probs) as [InsectCategory, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [top, topP] = entries[0];
  const [, secondP] = entries[1];
  // Discrimination confidence: distance between top and 2nd probability.
  const disc = topP - secondP;
  if (disc < 0.12) {
    return {
      category: "unknown",
      label: "Insecte volant non identifié",
      confidence: Math.max(0.25, disc + 0.2),
    };
  }
  let label = "Insecte volant non identifié";
  if (top === "mosquito") {
    if (freq >= 340 && freq <= 470) label = "Moustique — Culex pipiens probable";
    else if (freq >= 470 && freq <= 620) label = "Moustique — Anopheles / Culex possible";
    else if (freq >= 620 && freq <= 780) label = "Moustique — Aedes albopictus possible";
    else label = "Moustique (espèce indéterminée)";
  } else if (top === "fly") {
    label = "Mouche probable";
  } else if (top === "bee_wasp") {
    label = "Abeille / guêpe probable";
  }
  return { category: top, label, confidence: Math.min(0.95, 0.5 + disc) };
}

/** Legacy label-only helper kept for backwards compatibility. */
export function classifySpecies(freq: number): string {
  return classifyInsect(freq).label;
}

/**
 * Estimate harmonic-to-fundamental energy ratio around a peak (in dB spectrum).
 * Returns a linear ratio in [0..~2]. Safe to call with any peak frequency.
 */
export function estimateHarmonicRatio(
  bins: Float32Array | number[],
  peakFreq: number,
  binHz: number,
): number {
  if (peakFreq <= 0 || binHz <= 0) return 0;
  const f0Bin = Math.round(peakFreq / binHz);
  const f1Bin = Math.round((peakFreq * 2) / binHz);
  if (f0Bin < 1 || f1Bin >= bins.length) return 0;
  const win = 2;
  let m0 = -Infinity;
  let m1 = -Infinity;
  for (let i = Math.max(0, f0Bin - win); i <= Math.min(bins.length - 1, f0Bin + win); i++)
    if (bins[i] > m0) m0 = bins[i];
  for (let i = Math.max(0, f1Bin - win); i <= Math.min(bins.length - 1, f1Bin + win); i++)
    if (bins[i] > m1) m1 = bins[i];
  // Convert dB delta to linear ratio
  const dbDelta = m1 - m0;
  return Math.max(0, Math.pow(10, dbDelta / 20));
}

export interface DetectedBurst {
  startMs: number;
  endMs: number;
  peakFreq: number;
  peakSnr: number;
  waveformSnapshot: number[];
  /** CORRECTIF: ratio harmonique au moment du pic de SNR du burst — absent
   *  auparavant, ce qui empêchait import.tsx de jamais appeler
   *  classifyInsect() avec autre chose que harmonicRatio=0. */
  harmonicRatio: number;
}

/**
 * Stateful persistence tracker for a stream of frame analyses — used by the
 * live hook frame-by-frame, and by the batch importer as it slides a window
 * across a decoded audio file. Encapsulates the "N consecutive frames above
 * threshold" logic that used to live directly in useMosquitoDetection.
 */
export class DetectionTracker {
  private detectFrames = 0;
  private burstStartMs: number | null = null;
  private peakSnr = 0;
  private peakFreqAtBurst = 0;
  private harmonicRatioAtPeak = 0;
  private waveformAtPeak: number[] = [];
  private readonly persistThreshold: number;
  private readonly snrThreshold: number;

  constructor(persistThreshold = 4, snrThreshold = 8) {
    this.persistThreshold = persistThreshold;
    this.snrThreshold = snrThreshold;
  }

  /** Feed one frame's analysis at a given timestamp (ms), plus this frame's
   *  harmonic ratio (pass 0 if not computed — CORRECTIF: new 3rd param,
   *  previously harmonic ratio wasn't tracked at all here). Returns a
   *  finished burst if this frame just ended one, otherwise null. */
  push(frame: FrameAnalysis, atMs: number, harmonicRatio = 0): DetectedBurst | null {
    const isPeak = frame.snr >= this.snrThreshold && frame.peakDb > -75;
    if (isPeak) this.detectFrames = Math.min(60, this.detectFrames + 1);
    else this.detectFrames = Math.max(0, this.detectFrames - 2);

    const persistent = this.detectFrames >= this.persistThreshold;
    let finished: DetectedBurst | null = null;

    if (persistent) {
      if (this.burstStartMs === null) this.burstStartMs = atMs;
      if (frame.snr > this.peakSnr) {
        this.peakSnr = frame.snr;
        this.peakFreqAtBurst = frame.peakFreq;
        this.harmonicRatioAtPeak = harmonicRatio;
        this.waveformAtPeak = frame.waveform;
      }
    } else if (this.burstStartMs !== null) {
      // Burst just ended
      finished = {
        startMs: this.burstStartMs,
        endMs: atMs,
        peakFreq: this.peakFreqAtBurst,
        peakSnr: this.peakSnr,
        waveformSnapshot: this.waveformAtPeak,
        harmonicRatio: this.harmonicRatioAtPeak,
      };
      this.burstStartMs = null;
      this.peakSnr = 0;
      this.peakFreqAtBurst = 0;
      this.harmonicRatioAtPeak = 0;
      this.waveformAtPeak = [];
    }

    return finished;
  }

  get isPersistent() {
    return this.detectFrames >= this.persistThreshold;
  }

  get currentDurationMs() {
    return this.burstStartMs === null ? 0 : null; // caller supplies "now" externally in the live hook
  }

  /** Force-flush an in-progress burst at end-of-stream (used by batch import
   *  so the last detection isn't dropped just because the file ended). */
  flush(atMs: number): DetectedBurst | null {
    if (this.burstStartMs === null) return null;
    const finished: DetectedBurst = {
      startMs: this.burstStartMs,
      endMs: atMs,
      peakFreq: this.peakFreqAtBurst,
      peakSnr: this.peakSnr,
      waveformSnapshot: this.waveformAtPeak,
      harmonicRatio: this.harmonicRatioAtPeak,
    };
    this.burstStartMs = null;
    this.peakSnr = 0;
    return finished;
  }
}

/** Map SNR (dB, gated by persistence) to a 40..97 confidence score, with a
 *  small boost when the peak sits in the strongest sub-band. Identical
 *  formula to what useMosquitoDetection used inline before extraction. */
export function confidenceFromSnr(snr: number, peakFreq: number): number {
  const base = Math.max(0, Math.min(1, (snr - 8) / 17));
  let confidence = Math.round(40 + base * 55);
  if (peakFreq >= 400 && peakFreq <= 650) confidence = Math.min(97, confidence + 5);
  return confidence;
}
