import React, { useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { Device, TimelineEvent } from "../../types/mosquitoscan";

interface AddDeviceModalProps {
  setShowAddDeviceModal: (val: boolean) => void;
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
}

export function AddDeviceModal({
  setShowAddDeviceModal,
  setDevices,
  setTimeline,
}: AddDeviceModalProps) {
  const [newDeviceName, setNewDeviceName] = useState<string>("");
  const [newDeviceRole, setNewDeviceRole] = useState<"Maître" | "Esclave 1" | "Esclave 2" | "Nomade">("Nomade");
  const [newDeviceBattery, setNewDeviceBattery] = useState<number>(100);
  const [newDeviceNoiseDb, setNewDeviceNoiseDb] = useState<number>(-45);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    const newDev: Device = {
      id: `dev-${Date.now()}`,
      name: newDeviceName,
      role: newDeviceRole,
      battery: newDeviceBattery,
      noiseDb: newDeviceNoiseDb,
      status: "synced",
      position: { x: Math.floor(Math.random() * 80 + 10), y: Math.floor(Math.random() * 80 + 10) },
      directionAngle: Math.floor(Math.random() * 360),
      listeningConeWidth: 80,
    };

    setDevices((prev) => [...prev, newDev]);

    // Log to timeline
    const newTimelineEvent: TimelineEvent = {
      id: `tl-add-${Date.now()}`,
      timestamp: "À l'instant",
      type: "sensor",
      title: "Nouveau Capteur Associé",
      description: `L'appareil ${newDeviceName} a été jumelé avec succès en tant qu'${newDeviceRole}.`,
      operator: "Marie (Gérante)",
    };
    setTimeline((prev) => [newTimelineEvent, ...prev]);

    // Reset fields
    setNewDeviceName("");
    setShowAddDeviceModal(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-scaleUp text-left">
        
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-teal-600" />
            <h4 className="text-sm font-bold text-slate-800">Ajouter un Capteur Associé</h4>
          </div>
          <button 
            onClick={() => setShowAddDeviceModal(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              Nom du Capteur / Mobile Recyclé
            </label>
            <input
              type="text"
              required
              placeholder="ex: iPhone 8 Recyclé - Fontaine Est"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Rôle Acoustique</label>
              <select
                value={newDeviceRole}
                onChange={(e) => setNewDeviceRole(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-semibold"
              >
                <option value="Esclave 1">Esclave 1</option>
                <option value="Esclave 2">Esclave 2</option>
                <option value="Nomade">Nomade</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Seuil Bruit (dB)</label>
              <input
                type="number"
                min="-60"
                max="-10"
                value={newDeviceNoiseDb}
                onChange={(e) => setNewDeviceNoiseDb(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-mono font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Niveau de Batterie Initial (%)</label>
            <input
              type="range"
              min="10"
              max="100"
              value={newDeviceBattery}
              onChange={(e) => setNewDeviceBattery(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[9px] text-slate-400 mt-0.5">
              <span>10%</span>
              <span className="font-bold text-teal-600">{newDeviceBattery}%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-200 text-teal-800 p-2.5 rounded-lg text-[10px] leading-relaxed">
            <strong>Appairage instantané :</strong> Le terminal émettra une trame d'initialisation chiffrée vers la Console Maître et se connectera automatiquement.
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddDeviceModal(false)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer text-center"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg cursor-pointer text-center shadow-sm"
            >
              Valider
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
