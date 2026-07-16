// Real image/video analysis for room configuration.
// Extracts brightness, dominant hue, edge density (for surface complexity)
// and infers plausible acoustic properties from photos of the room.

import type { RoomModel, RoomSurface, Face } from "@/types/room";

export interface PhotoAnalysis {
  face: Face | "ceiling" | "floor";
  brightness: number; // 0..1
  saturation: number; // 0..1
  edgeDensity: number; // 0..1, proxy for clutter / furniture
  dominantHue: number; // 0..360
  width: number;
  height: number;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function analyzeImageData(data: ImageData): Omit<PhotoAnalysis, "face" | "width" | "height"> {
  const { data: px, width, height } = data;
  let sumL = 0;
  let sumS = 0;
  let hueBuckets = new Array(36).fill(0);
  const luma = new Float32Array(width * height);
  const N = width * height;
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const r = px[i] / 255;
    const g = px[i + 1] / 255;
    const b = px[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1) || 1);
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    sumL += l;
    sumS += s;
    hueBuckets[Math.min(35, Math.floor(h / 10))]++;
    luma[p] = l;
  }
  // Edge density via simple Sobel-lite on downsampled luma
  let edges = 0;
  const stride = Math.max(1, Math.floor(width / 128));
  let count = 0;
  for (let y = stride; y < height - stride; y += stride) {
    for (let x = stride; x < width - stride; x += stride) {
      const c = luma[y * width + x];
      const dx = Math.abs(luma[y * width + x + stride] - luma[y * width + x - stride]);
      const dy = Math.abs(luma[(y + stride) * width + x] - luma[(y - stride) * width + x]);
      edges += (dx + dy) / 2;
      count++;
      void c;
    }
  }
  const edgeDensity = Math.min(1, (edges / Math.max(1, count)) * 3);
  let bestBucket = 0;
  hueBuckets.forEach((v, i) => {
    if (v > hueBuckets[bestBucket]) bestBucket = i;
  });
  return {
    brightness: sumL / N,
    saturation: sumS / N,
    edgeDensity,
    dominantHue: bestBucket * 10 + 5,
  };
}

export async function analyzePhotoFile(
  file: File | string,
  face: PhotoAnalysis["face"],
): Promise<PhotoAnalysis> {
  const url = typeof file === "string" ? file : URL.createObjectURL(file);
  const img = await loadImage(url);
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const metrics = analyzeImageData(data);
  if (typeof file !== "string") URL.revokeObjectURL(url);
  return { face, ...metrics, width: img.width, height: img.height };
}

/** Sample N frames from a video file for a rough 360° scan. */
export async function analyzeVideoFile(file: File, samples = 8): Promise<PhotoAnalysis[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = rej;
  });
  const canvas = document.createElement("canvas");
  const w = 320;
  const h = Math.round((320 * video.videoHeight) / Math.max(1, video.videoWidth));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const faces: PhotoAnalysis["face"][] = ["north", "east", "south", "west", "ceiling", "floor"];
  const out: PhotoAnalysis[] = [];
  const duration = video.duration || 1;
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * duration * 0.98;
    await new Promise<void>((res) => {
      video.onseeked = () => res();
      video.currentTime = t;
    });
    ctx.drawImage(video, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const m = analyzeImageData(data);
    out.push({
      face: faces[i % faces.length],
      ...m,
      width: video.videoWidth,
      height: video.videoHeight,
    });
  }
  URL.revokeObjectURL(url);
  return out;
}

function pickMaterial(a: PhotoAnalysis): RoomSurface["material"] {
  // Very rough heuristic
  if (a.saturation < 0.15 && a.brightness > 0.55) return "smooth_wall";
  if (a.saturation > 0.3 && a.brightness < 0.4) return "wood";
  if (a.dominantHue > 20 && a.dominantHue < 60 && a.saturation > 0.25) return "wood";
  if (a.brightness > 0.7 && a.edgeDensity < 0.15) return "smooth_wall";
  if (a.edgeDensity > 0.35) return "fabric";
  return "rough_wall";
}

/** Combined analysis → RoomModel. Uses provided dimensions when known. */
export function buildRoomFromAnalyses(
  analyses: PhotoAnalysis[],
  dimensions: { width: number; length: number; height: number },
  name = "Ma pièce",
): RoomModel {
  const { width, length, height } = dimensions;

  const bright = analyses.length
    ? analyses.reduce((s, a) => s + a.brightness, 0) / analyses.length
    : 0.5;
  const clutter = analyses.length
    ? analyses.reduce((s, a) => s + a.edgeDensity, 0) / analyses.length
    : 0.3;

  // Sabine-inspired: dark, cluttered rooms absorb more → shorter RT60
  // volume-based baseline, then modulate by absorption proxy
  const V = width * length * height;
  const absorption = 0.15 + clutter * 0.35 + (1 - bright) * 0.15;
  const surfaceArea = 2 * (width * length + width * height + length * height);
  const rt60 = Math.max(0.15, Math.min(1.6, (0.161 * V) / (absorption * surfaceArea)));

  const surfaces: RoomSurface[] = [];
  const findFace = (f: Face | "ceiling" | "floor") =>
    analyses.find((a) => a.face === f);

  const faces: { key: Face; label: string; w: number; h: number; pos: { x: number; y: number; z: number } }[] = [
    { key: "north", label: "Mur Nord", w: width, h: height, pos: { x: width / 2, y: length, z: height / 2 } },
    { key: "south", label: "Mur Sud", w: width, h: height, pos: { x: width / 2, y: 0, z: height / 2 } },
    { key: "east", label: "Mur Est", w: length, h: height, pos: { x: width, y: length / 2, z: height / 2 } },
    { key: "west", label: "Mur Ouest", w: length, h: height, pos: { x: 0, y: length / 2, z: height / 2 } },
  ];
  for (const f of faces) {
    const a = findFace(f.key);
    surfaces.push({
      id: `wall_${f.key}`,
      type: "wall",
      label: f.label,
      face: f.key,
      dimensions: { width: f.w, height: f.h },
      position: f.pos,
      material: a ? pickMaterial(a) : "smooth_wall",
      aiConfidence: a ? (a.edgeDensity > 0.5 ? "medium" : "high") : "low",
    });
  }
  const ceilA = findFace("ceiling");
  surfaces.push({
    id: "ceiling",
    type: "ceiling",
    label: "Plafond",
    dimensions: { width, height: length },
    position: { x: width / 2, y: length / 2, z: height },
    material: ceilA ? pickMaterial(ceilA) : "smooth_wall",
    aiConfidence: ceilA ? "high" : "low",
  });
  const floorA = findFace("floor");
  surfaces.push({
    id: "floor",
    type: "floor",
    label: "Sol",
    dimensions: { width, height: length },
    position: { x: width / 2, y: length / 2, z: 0 },
    material: floorA ? pickMaterial(floorA) : "tile",
    aiConfidence: floorA ? "high" : "low",
  });

  return {
    id: `room_${Date.now()}`,
    name,
    dimensions,
    reverbTime: Number(rt60.toFixed(2)),
    photoCount: analyses.length,
    devicePositions: [
      {
        deviceId: "phone_1",
        label: "Téléphone 1",
        position: { x: width / 2, y: length * 0.25 },
        facingAngle: 0,
        role: "primary",
      },
    ],
    createdAt: new Date(),
    surfaces,
  };
}