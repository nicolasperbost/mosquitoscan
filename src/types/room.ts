export type Face = "north" | "south" | "east" | "west";
export type SurfaceType =
  | "wall"
  | "ceiling"
  | "floor"
  | "furniture"
  | "window"
  | "door"
  | "curtain";
export type Material =
  | "smooth_wall"
  | "rough_wall"
  | "glass"
  | "fabric"
  | "wood"
  | "tile";
export type Confidence = "high" | "medium" | "low";

export interface RoomPhoto {
  id: string;
  face: Face | "ceiling" | "floor";
  uri: string;
  analyzedAt?: Date;
}

export interface RoomSurface {
  id: string;
  type: SurfaceType;
  label: string;
  face?: Face;
  dimensions: { width: number; height: number; depth?: number };
  position: { x: number; y: number; z: number };
  material: Material;
  aiConfidence: Confidence;
}

export interface DevicePosition {
  deviceId: string;
  label: string;
  position: { x: number; y: number };
  facingAngle: number;
  role: "primary" | "secondary" | "tertiary";
  heightMeters?: number;
}

export interface RoomModel {
  id: string;
  name: string;
  dimensions: { width: number; length: number; height: number };
  surfaces: RoomSurface[];
  reverbTime: number;
  devicePositions: DevicePosition[];
  createdAt: Date;
  photoCount: number;
}

// Where a detection originated from. "live" = phone microphone in real time,
// "sd_import" = batch-imported WAV recorded by an autonomous SD logger,
// "wifi_sensor" = pushed live by a fixed WiFi sensor via the ingest-sensor
// edge function. Existing detections predate this field and simply omit it —
// treat a missing source as "live" for display purposes.
export type DetectionSource = "live" | "sd_import" | "wifi_sensor";

/** Broad insect category assigned by wing-beat classifier. Missing on legacy
 *  entries — treat as "unknown" for filtering. */
export type InsectCategory = "mosquito" | "fly" | "bee_wasp" | "unknown";

export interface DetectionEvent {
  id: string;
  timestamp: Date;
  roomId: string;
  dominantFrequency: number;
  confidence: number;
  estimatedZone: {
    surfaceId: string;
    surfaceLabel: string;
    positionOnSurface: { u: number; v: number };
    heightMeters?: number;
  };
  speciesHint: string;
  validatedBy?: "user_confirmed" | "user_denied" | "pending";
  audioSnapshot?: number[];
  snr?: number;
  durationMs?: number;
  noiseFloorDb?: number;
  waveformSnapshot?: number[];
  /** Absent on pre-existing detections; treat as "live" when undefined. */
  source?: DetectionSource;
  /** Human-readable label of the physical sensor that produced this event. */
  deviceLabel?: string;
  /** True when the timestamp comes from device clock/RTC or import time
   *  rather than a live capture — used to caveat the display. */
  timestampApproximate?: boolean;
  /** Broad classification (mosquito / fly / bee_wasp / unknown). */
  insectCategory?: InsectCategory;
  /** Classifier confidence 0..1 for the assigned category. */
  insectConfidence?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Site maps — distinct from RoomModel (single acoustic room). A SiteMap
// covers a wider property (garden, hotel exterior, campsite) and pins
// individual sensors onto a plan image or a geo-referenced map.
// ─────────────────────────────────────────────────────────────────────────

export type SiteMapKind = "indoor_plan" | "outdoor_geo";

export interface SitePoint {
  id: string;
  name: string;
  /** Which kind of physical sensor this pin represents. Reuses the same
   *  labels as DetectionEvent.source. */
  sensorType: DetectionSource;
  /** Relative coordinates in % of the background image (0..100). Only used
   *  for `indoor_plan` maps. */
  x?: number;
  y?: number;
  /** GPS coordinates. Only used for `outdoor_geo` maps. */
  lat?: number;
  lng?: number;
  lastSeen?: string;
  notes?: string;
}

export interface SiteMap {
  id: string;
  name: string;
  kind: SiteMapKind;
  /** Data URL or storage URL of the plan image (indoor_plan only). */
  backgroundImageUrl?: string;
  sensors: SitePoint[];
  createdAt?: string;
  updatedAt?: string;
}
