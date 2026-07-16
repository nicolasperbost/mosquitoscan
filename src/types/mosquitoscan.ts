// Types & Interfaces for MosquitoScan
export interface Site {
  id: string;
  name: string;
  clientName: string;
  address: string;
  riskScore: number; // 0 to 100
  activeTraps: number;
  totalDetections: number;
  healthScore: number; // 0 to 100
  lastInspection: string;
  imageUrl: string;
}

export interface RiskZone {
  id: string;
  name: string;
  level: "CRITIQUE" | "ÉLEVÉ" | "MODÉRÉ" | "FAIBLE";
  riskFactor: string; // e.g., "Eaux stagnantes", "Végétation dense"
  recommandation: string;
  stagnantWaterScore: number; // 0-10
  trapInstalled: boolean;
  coordinates: { x: number; y: number };
}

export interface Device {
  id: string;
  name: string;
  role: "Maître" | "Esclave 1" | "Esclave 2" | "Nomade";
  battery: number;
  noiseDb: number;
  status: "synced" | "syncing" | "offline";
  position: { x: number; y: number };
  directionAngle: number;
  listeningConeWidth: number;
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  timeLabel: string; // e.g. "Il y a 10 min"
  period: "Matin" | "Après-midi" | "Soir" | "Nuit";
  frequencyHz: number;
  maxVolumeDb: number;
  durationSec: number;
  location: string;
  species: "Aedes Albopictus (Tigre)" | "Culex Pipiens (Commun)" | "Non identifié";
  confidence: number;
  status: "active" | "treated" | "ignored";
  urgency: "Critique" | "Haute" | "Normale" | "Basse";
  intensity: "Élevée" | "Modérée" | "Faible";
  temperature: number;
  operatorNotes?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: "system" | "detection" | "treatment" | "sensor";
  title: string;
  description: string;
  operator?: string;
}
