import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { ChevronLeft, Upload, FileAudio, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { roomStore, useRoomStore } from "@/lib/roomStore";
import {
  computeBinRanges,
  analyseFrame,
  classifyInsect,
  estimateHarmonicRatio,
  confidenceFromSnr,
  DetectionTracker,
  DEFAULT_BANDS,
  WIDE_BANDS,
} from "@/lib/spectralAnalysis";
import { isWideBandEnabled } from "@/hooks/useMosquitoDetection";
import type { DetectionEvent } from "@/types/room";
import { toast } from "sonner";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import logger — MosquitoRadar" },
      { name: "description", content: "Importez les enregistrements WAV d'un boîtier autonome pour analyse hors-ligne." },
    ],
  }),
  component: ImportPage,
});

// Very small, dependency-free radix-2 FFT (Cooley-Tukey), operating in place
// on parallel real/imag Float64Arrays. `n` must be a power of two.
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

const FFT_SIZE = 4096;
const HOP = 2048; // 50% overlap

/** Try to recover a real timestamp from common logger filename patterns like
 *  "20260711_143205.wav" or "REC-2026-07-11T14-32-05.wav". Returns null (and
 *  the caller falls back to import time, flagged approximate) if unmatched. */
function tryParseFilenameTimestamp(name: string): Date | null {
  const m1 = name.match(/(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (m1) {
    const [, y, mo, d, h, mi, s] = m1;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

/** Analyse one decoded mono channel with a sliding FFT window, returning
 *  every detected burst as a partial DetectionEvent (source: "sd_import"). */
function analyseBuffer(
  channelData: Float32Array,
  sampleRate: number,
): { bursts: ReturnType<DetectionTracker["push"]>[]; durationSec: number } {
  // CORRECTIF: applique la même bande large (si activée dans Réglages) que
  // le mode live, au lieu de toujours utiliser la bande par défaut
  // (300-800Hz) — sinon un fichier importé ne peut jamais donner lieu à une
  // classification mouche/abeille non plus.
  const ranges = computeBinRanges(sampleRate, FFT_SIZE, isWideBandEnabled() ? WIDE_BANDS : DEFAULT_BANDS);
  const tracker = new DetectionTracker();
  // Hann window coefficients, precomputed once
  const hann = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));

  const results: NonNullable<ReturnType<DetectionTracker["push"]>>[] = [];
  const noiseEma = { value: -80 };

  for (let start = 0; start + FFT_SIZE <= channelData.length; start += HOP) {
    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) re[i] = channelData[start + i] * hann[i];
    fft(re, im);

    const bins = FFT_SIZE / 2;
    const dbBins = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
      const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (FFT_SIZE / 2);
      // Approximate dBFS; not bit-exact vs getFloatFrequencyData but uses the
      // same downstream thresholds — expect to retune SNR_THRESHOLD against
      // real logger recordings before relying on this in production.
      dbBins[i] = 20 * Math.log10(Math.max(mag, 1e-8));
    }

    const frame = analyseFrame(dbBins, ranges, noiseEma.value);
    noiseEma.value = frame.noiseFloor;
    const atMs = (start / sampleRate) * 1000;
    // CORRECTIF: calcule le ratio harmonique par fenêtre et le transmet au
    // tracker (3e argument, auparavant absent) — sans ça, DetectedBurst
    // renvoie toujours harmonicRatio=0 et classifyInsect() ne peut jamais
    // distinguer mouche/abeille même si le pic tombe dans leur bande.
    const harmonicRatio = estimateHarmonicRatio(dbBins, frame.peakFreq, ranges.binHz);
    const finished = tracker.push(frame, atMs, harmonicRatio);
    if (finished) results.push(finished);
  }
  const totalMs = (channelData.length / sampleRate) * 1000;
  const finalFlush = tracker.flush(totalMs);
  if (finalFlush) results.push(finalFlush);

  return { bursts: results, durationSec: channelData.length / sampleRate };
}

interface FileResult {
  name: string;
  detections: number;
  durationSec: number;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
}

function ImportPage() {
  const room = useRoomStore((s) => s.room);
  const [files, setFiles] = useState<FileResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (fileList: FileList) => {
    const list = Array.from(fileList).filter((f) => /\.wav$/i.test(f.name));
    if (list.length === 0) {
      toast.error("Aucun fichier .wav valide sélectionné");
      return;
    }
    setProcessing(true);
    setFiles(list.map((f) => ({ name: f.name, detections: 0, durationSec: 0, status: "pending" })));

    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();

    let totalDetections = 0;
    let totalMinutes = 0;

    for (let idx = 0; idx < list.length; idx++) {
      const file = list[idx];
      setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, status: "processing" } : f)));
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);
        const fileStart = tryParseFilenameTimestamp(file.name);
        const { bursts, durationSec } = analyseBuffer(channelData, audioBuffer.sampleRate);

        for (const burst of bursts) {
          if (!burst) continue;
          const approxTimestamp = fileStart
            ? new Date(fileStart.getTime() + burst.startMs)
            : new Date(Date.now());
          // CORRECTIF: utilise classifyInsect (avec le ratio harmonique du
          // burst) au lieu de l'ancienne classifySpecies, et renseigne
          // insectCategory/insectConfidence sur le DetectionEvent — ces deux
          // champs existent dans le type mais n'étaient jamais remplis ici,
          // donc toute détection importée s'affichait comme "non identifié"
          // dans les filtres de history.tsx/devices.tsx, y compris pour de
          // vrais moustiques.
          const classification = classifyInsect(burst.peakFreq, burst.harmonicRatio);
          const event: DetectionEvent = {
            id: `sd-${file.name}-${burst.startMs}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: approxTimestamp,
            roomId: room?.id ?? "unassigned",
            dominantFrequency: burst.peakFreq,
            confidence: confidenceFromSnr(burst.peakSnr, burst.peakFreq),
            estimatedZone: {
              surfaceId: "sd-import",
              surfaceLabel: "Import logger SD",
              positionOnSurface: { u: 0.5, v: 0.5 },
            },
            speciesHint: classification.label,
            insectCategory: classification.category,
            insectConfidence: classification.confidence,
            validatedBy: "pending",
            snr: burst.peakSnr,
            durationMs: burst.endMs - burst.startMs,
            waveformSnapshot: burst.waveformSnapshot,
            source: "sd_import",
            deviceLabel: file.name.replace(/\.wav$/i, ""),
            timestampApproximate: !fileStart,
          };
          roomStore.addDetection(event);
          totalDetections++;
        }
        totalMinutes += durationSec / 60;
        setFiles((prev) =>
          prev.map((f, i) => (i === idx ? { ...f, status: "done", detections: bursts.filter(Boolean).length, durationSec } : f)),
        );
      } catch (e) {
        setFiles((prev) =>
          prev.map((f, i) => (i === idx ? { ...f, status: "error", error: e instanceof Error ? e.message : "Erreur de décodage" } : f)),
        );
      }
    }

    await ctx.close().catch(() => {});
    setProcessing(false);
    toast.success(`${totalDetections} détection(s) trouvée(s) sur ${totalMinutes.toFixed(1)} min analysées`);
  };

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-6">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Import logger</h1>
        <span />
      </header>

      <section className="glass-panel p-4 mb-4">
        <p className="text-xs text-muted-foreground mb-3">
          Importez un ou plusieurs fichiers audio (.wav) enregistrés par un boîtier autonome sur carte SD.
          L'analyse se fait entièrement dans votre navigateur, avec la même détection que le mode live.
        </p>
        <p className="text-[11px] text-muted-foreground mb-4">
          Si le nom de fichier contient un horodatage (ex. <code>20260711_143205.wav</code>), il est utilisé comme
          référence temporelle. Sinon, l'horodatage affiché sera approximatif (date d'import).
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".wav,audio/wav"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Upload size={16} /> {processing ? "Analyse en cours…" : "Choisir des fichiers .wav"}
        </button>
      </section>

      {files.length > 0 && (
        <section className="glass-panel p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Fichiers ({files.length})
          </div>
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-xs">
                <FileAudio size={14} className="text-muted-foreground shrink-0" />
                <span className="flex-1 truncate font-mono-x">{f.name}</span>
                {f.status === "processing" && <span className="text-amber-x">Analyse…</span>}
                {f.status === "done" && (
                  <span className="text-teal flex items-center gap-1">
                    <CheckCircle2 size={12} /> {f.detections} détection(s)
                  </span>
                )}
                {f.status === "error" && <span className="text-red-500">{f.error}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
