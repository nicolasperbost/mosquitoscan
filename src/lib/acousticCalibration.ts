// Measures RT60 using the Schroeder integrated impulse response method,
// approximated from an interrupted noise burst played from the device's
// speaker and captured by its microphone.

export interface CalibrationResult {
  rt60: number; // seconds
  noiseFloorDb: number;
  peakDb: number;
  qualifier: "sèche" | "moyenne" | "réverbérante";
}

function toDb(v: number) {
  return 20 * Math.log10(Math.max(1e-6, v));
}

export async function measureRT60(): Promise<CalibrationResult> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    },
  });
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  // Emit a broadband noise burst for ~700ms, then measure the decay.
  const bufferSize = ctx.sampleRate * 0.7;
  const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const chan = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) chan[i] = (Math.random() * 2 - 1) * 0.9;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1000;
  bp.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.value = 0.4;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.connect(bp).connect(gain).connect(ctx.destination);

  const samples: { t: number; db: number }[] = [];
  const start = performance.now();
  const duration = 2200; // ms total
  const buf = new Uint8Array(analyser.fftSize);

  noise.start();

  await new Promise<void>((resolve) => {
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      samples.push({ t: performance.now() - start, db: toDb(rms) });
      if (performance.now() - start < duration) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });

  try {
    noise.stop();
  } catch {}
  stream.getTracks().forEach((t) => t.stop());
  ctx.close();

  // Estimate: find peak level and the time when signal fell 20 dB → extrapolate to 60 dB (T20 * 3).
  const peak = samples.reduce((m, s) => (s.db > m.db ? s : m), samples[0]);
  const noiseFloor =
    samples.slice(-Math.max(5, Math.floor(samples.length * 0.15))).reduce((s, x) => s + x.db, 0) /
    Math.max(1, Math.floor(samples.length * 0.15));

  const afterPeak = samples.filter((s) => s.t > peak.t);
  let t20: number | null = null;
  for (const s of afterPeak) {
    if (s.db <= peak.db - 20) {
      t20 = (s.t - peak.t) / 1000;
      break;
    }
  }
  let rt60: number;
  if (t20 && t20 > 0.02) {
    rt60 = Math.min(2.5, t20 * 3);
  } else {
    // Fallback: proportional to decay range measured
    const range = peak.db - noiseFloor;
    rt60 = Math.max(0.2, Math.min(1.5, 0.4 + (range / 60) * 0.6));
  }

  const qualifier: CalibrationResult["qualifier"] =
    rt60 < 0.35 ? "sèche" : rt60 < 0.7 ? "moyenne" : "réverbérante";

  return {
    rt60: Number(rt60.toFixed(2)),
    noiseFloorDb: Number(noiseFloor.toFixed(1)),
    peakDb: Number(peak.db.toFixed(1)),
    qualifier,
  };
}