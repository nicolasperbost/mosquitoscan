import { Site, RiskZone, Device, AlertEvent, TimelineEvent } from "../types/mosquitoscan";

export const SITES_DATA: Site[] = [
  {
    id: "site-1",
    name: "Terrasse Étoile - Hôtel Royal",
    clientName: "Groupe SBM Hotels",
    address: "24 Avenue des Belges, Cannes",
    riskScore: 78,
    activeTraps: 4,
    totalDetections: 142,
    healthScore: 82,
    lastInspection: "2026-07-10",
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: "site-2",
    name: "Jardin d'Hiver - Bistrot du Port",
    clientName: "Société des Brasseries du Sud",
    address: "Quai Saint-Pierre, Saint-Tropez",
    riskScore: 45,
    activeTraps: 2,
    totalDetections: 58,
    healthScore: 91,
    lastInspection: "2026-07-12",
    imageUrl: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: "site-3",
    name: "Espace Piscine - Club Privé Les Pins",
    clientName: "Les Pins Leisure Ltd",
    address: "Chemin du Sémaphore, Antibes",
    riskScore: 92,
    activeTraps: 5,
    totalDetections: 289,
    healthScore: 59,
    lastInspection: "2026-07-08",
    imageUrl: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&q=80&w=400"
  }
];

export const INITIAL_ZONES: RiskZone[] = [
  { 
    id: "zone-1", 
    name: "Abords de la fontaine centrale", 
    level: "CRITIQUE", 
    riskFactor: "Eaux stagnantes décoratives", 
    recommandation: "Vidanger ou verser du larvicide biologique Bti tous les 7 jours.", 
    stagnantWaterScore: 9, 
    trapInstalled: true, 
    coordinates: { x: 48, y: 35 } 
  },
  { 
    id: "zone-2", 
    name: "Sous-bois Terrasse Nord", 
    level: "ÉLEVÉ", 
    riskFactor: "Humidité persistante & végétation dense", 
    recommandation: "Tailler les haies basses à 50cm et installer un piège aspirateur CO2 BG-Mosquitaire.", 
    stagnantWaterScore: 4, 
    trapInstalled: true, 
    coordinates: { x: 15, y: 22 } 
  },
  { 
    id: "zone-3", 
    name: "Stockage technique & poubelles", 
    level: "MODÉRÉ", 
    riskFactor: "Récipients d'eau de pluie accidentels", 
    recommandation: "Retourner tous les seaux vides et vérifier l'étanchéité des bâches.", 
    stagnantWaterScore: 6, 
    trapInstalled: false, 
    coordinates: { x: 82, y: 75 } 
  },
  { 
    id: "zone-4", 
    name: "Haie de lauriers ouest", 
    level: "FAIBLE", 
    riskFactor: "Zone de repos diurne", 
    recommandation: "Pulvérisation d'extrait d'ail répulsif naturel en barrière périphérique.", 
    stagnantWaterScore: 2, 
    trapInstalled: false, 
    coordinates: { x: 50, y: 88 } 
  }
];

export const INITIAL_DEVICES: Device[] = [
  { id: "dev-master", name: "Console CHR (Maître)", role: "Maître", battery: 94, noiseDb: -42, status: "synced", position: { x: 15, y: 15 }, directionAngle: 45, listeningConeWidth: 80 },
  { id: "dev-slave1", name: "iPad Cuisine (Esclave 1)", role: "Esclave 1", battery: 82, noiseDb: -46, status: "synced", position: { x: 85, y: 20 }, directionAngle: 210, listeningConeWidth: 70 },
  { id: "dev-slave2", name: "Phone Réserve (Esclave 2)", role: "Esclave 2", battery: 67, noiseDb: -39, status: "synced", position: { x: 50, y: 80 }, directionAngle: 315, listeningConeWidth: 90 },
  { id: "dev-nomad", name: "Balise Extérieure Nomade", role: "Nomade", battery: 31, noiseDb: -35, status: "syncing", position: { x: 72, y: 45 }, directionAngle: 120, listeningConeWidth: 60 }
];

export const INITIAL_ALERTS: AlertEvent[] = [
  {
    id: "alert-1",
    timestamp: "2026-07-14 10:14:05",
    timeLabel: "Il y a 15 min",
    period: "Matin",
    frequencyHz: 545,
    maxVolumeDb: -26,
    durationSec: 4.2,
    location: "Abords de la fontaine centrale",
    species: "Aedes Albopictus (Tigre)",
    confidence: 96,
    status: "active",
    urgency: "Critique",
    intensity: "Élevée",
    temperature: 28.5,
    operatorNotes: "Détection sonore confirmée par deux esclaves simultanément."
  },
  {
    id: "alert-2",
    timestamp: "2026-07-14 06:45:12",
    timeLabel: "Il y a 4 heures",
    period: "Matin",
    frequencyHz: 495,
    maxVolumeDb: -32,
    durationSec: 2.1,
    location: "Sous-bois Terrasse Nord",
    species: "Culex Pipiens (Commun)",
    confidence: 89,
    status: "active",
    urgency: "Normale",
    intensity: "Modérée",
    temperature: 21.0,
    operatorNotes: "Bruit de fond élevé (vent léger sur microphone)."
  },
  {
    id: "alert-3",
    timestamp: "2026-07-13 22:15:30",
    timeLabel: "Hier soir",
    period: "Soir",
    frequencyHz: 562,
    maxVolumeDb: -19,
    durationSec: 6.8,
    location: "Abords de la fontaine centrale",
    species: "Aedes Albopictus (Tigre)",
    confidence: 94,
    status: "treated",
    urgency: "Haute",
    intensity: "Élevée",
    temperature: 24.8,
    operatorNotes: "Larvicide Bti appliqué par l'équipe de nuit après l'alerte."
  },
  {
    id: "alert-4",
    timestamp: "2026-07-13 14:30:00",
    timeLabel: "Hier après-midi",
    period: "Après-midi",
    frequencyHz: 580,
    maxVolumeDb: -38,
    durationSec: 1.5,
    location: "Stockage technique & poubelles",
    species: "Non identifié",
    confidence: 61,
    status: "ignored",
    urgency: "Basse",
    intensity: "Faible",
    temperature: 31.2,
    operatorNotes: "Faux positif probable. Fréquence aberrante suite à passage de chariot métallique."
  },
  {
    id: "alert-5",
    timestamp: "2026-07-12 02:10:44",
    timeLabel: "Il y a 2 jours",
    period: "Nuit",
    frequencyHz: 535,
    maxVolumeDb: -29,
    durationSec: 3.9,
    location: "Sous-bois Terrasse Nord",
    species: "Aedes Albopictus (Tigre)",
    confidence: 91,
    status: "treated",
    urgency: "Haute",
    intensity: "Modérée",
    temperature: 19.5,
    operatorNotes: "Piège CO2 vidé et filet nettoyé."
  }
];

export const INITIAL_TIMELINE: TimelineEvent[] = [
  { id: "tl-1", timestamp: "10:14", type: "detection", title: "Alerte Moustique Tigre", description: "Détection critique de moustique Tigre (545Hz) près de la Fontaine par le capteur Esclave 1.", operator: "Système" },
  { id: "tl-2", timestamp: "09:00", type: "treatment", title: "Inspection journalière", description: "Vérification des pièges physiques et vidange de 2 soucoupes sous les lauriers.", operator: "Jean-Paul (Technicien)" },
  { id: "tl-3", timestamp: "Hier 22:30", type: "treatment", title: "Traitement Biocide ciblé", description: "Application de barrière répulsive végétale autour de l'espace de restauration.", operator: "Equipe de Nuit" },
  { id: "tl-4", timestamp: "Hier 14:30", type: "sensor", title: "Nouveau Capteur Associé", description: "Balise Nomade extérieure connectée au hub central de la terrasse.", operator: "Marie (Gérante)" },
  { id: "tl-5", timestamp: "12 Juil 18:00", type: "system", title: "Pic de prolifération météo", description: "Indice d'activité élevé causé par une humidité à 85% et 28°C.", operator: "Météo-IA" }
];
