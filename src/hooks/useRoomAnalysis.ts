import { useState } from "react";
import type { RoomModel } from "@/types/room";
import {
  analyzePhotoFile,
  analyzeVideoFile,
  buildRoomFromAnalyses,
  type PhotoAnalysis,
} from "@/lib/roomAnalysis";

export interface CapturedPhoto {
  face: PhotoAnalysis["face"];
  file: File;
}

export function buildMockRoom(photoCount: number): RoomModel {
  return {
    id: `room_${Date.now()}`,
    name: "Chambre principale",
    dimensions: { width: 4.2, length: 5.1, height: 2.65 },
    reverbTime: 0.28,
    photoCount,
    devicePositions: [
      {
        deviceId: "phone_1",
        label: "Téléphone 1",
        position: { x: 2.1, y: 2.5 },
        facingAngle: 0,
        role: "primary",
      },
    ],
    createdAt: new Date(),
    surfaces: [
      { id: "wall_north", type: "wall", label: "Mur Nord", face: "north", dimensions: { width: 4.2, height: 2.65 }, position: { x: 2.1, y: 5.1, z: 1.325 }, material: "smooth_wall", aiConfidence: "high" },
      { id: "wall_east", type: "wall", label: "Mur Est", face: "east", dimensions: { width: 5.1, height: 2.65 }, position: { x: 4.2, y: 2.55, z: 1.325 }, material: "smooth_wall", aiConfidence: "high" },
      { id: "wall_south", type: "wall", label: "Mur Sud (fenêtre)", face: "south", dimensions: { width: 4.2, height: 2.65 }, position: { x: 2.1, y: 0, z: 1.325 }, material: "smooth_wall", aiConfidence: "high" },
      { id: "wall_west", type: "wall", label: "Mur Ouest", face: "west", dimensions: { width: 5.1, height: 2.65 }, position: { x: 0, y: 2.55, z: 1.325 }, material: "smooth_wall", aiConfidence: "high" },
      { id: "ceiling", type: "ceiling", label: "Plafond", dimensions: { width: 4.2, height: 5.1 }, position: { x: 2.1, y: 2.55, z: 2.65 }, material: "smooth_wall", aiConfidence: "high" },
      { id: "floor", type: "floor", label: "Sol", dimensions: { width: 4.2, height: 5.1 }, position: { x: 2.1, y: 2.55, z: 0 }, material: "tile", aiConfidence: "high" },
      { id: "window_south", type: "window", label: "Fenêtre Sud", face: "south", dimensions: { width: 1.2, height: 1.4 }, position: { x: 2.1, y: 0, z: 1.2 }, material: "glass", aiConfidence: "high" },
      { id: "curtain_south", type: "curtain", label: "Rideau fenêtre Sud", face: "south", dimensions: { width: 1.6, height: 2.2, depth: 0.1 }, position: { x: 2.1, y: 0.05, z: 1.1 }, material: "fabric", aiConfidence: "medium" },
      { id: "bed", type: "furniture", label: "Lit", dimensions: { width: 1.6, height: 0.55, depth: 2.0 }, position: { x: 0.9, y: 3.8, z: 0.275 }, material: "fabric", aiConfidence: "high" },
      { id: "wardrobe", type: "furniture", label: "Armoire", dimensions: { width: 1.2, height: 2.1, depth: 0.6 }, position: { x: 3.6, y: 4.5, z: 1.05 }, material: "wood", aiConfidence: "high" },
      { id: "desk", type: "furniture", label: "Bureau", dimensions: { width: 1.4, height: 0.75, depth: 0.7 }, position: { x: 3.5, y: 1.5, z: 0.375 }, material: "wood", aiConfidence: "medium" },
    ],
  };
}

export function useRoomAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const analyze = async (
    input: {
      photos?: CapturedPhoto[];
      video?: File | null;
      dimensions: { width: number; length: number; height: number };
      name?: string;
    },
  ): Promise<RoomModel> => {
    setIsAnalyzing(true);
    setProgress(5);
    setStatusMessage("Lecture des captures...");

    const analyses: PhotoAnalysis[] = [];
    const photos = input.photos ?? [];
    for (let i = 0; i < photos.length; i++) {
      setStatusMessage(`Analyse ${photos[i].face}…`);
      try {
        const a = await analyzePhotoFile(photos[i].file, photos[i].face);
        analyses.push(a);
      } catch {
        // Skip unreadable files
      }
      setProgress(5 + Math.round(((i + 1) / Math.max(1, photos.length)) * 55));
    }

    if (input.video) {
      setStatusMessage("Analyse vidéo (échantillonnage de frames)…");
      try {
        const v = await analyzeVideoFile(input.video, 8);
        analyses.push(...v);
      } catch {
        // ignored
      }
      setProgress(75);
    }

    setStatusMessage("Estimation acoustique (Sabine)…");
    await new Promise((r) => setTimeout(r, 250));
    setProgress(90);

    const model = buildRoomFromAnalyses(analyses, input.dimensions, input.name);
    setProgress(100);
    setStatusMessage("Modèle prêt");
    setIsAnalyzing(false);
    return model;
  };

  return { isAnalyzing, progress, statusMessage, analyze };
}