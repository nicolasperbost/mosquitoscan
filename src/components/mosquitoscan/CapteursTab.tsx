import React, { useEffect, useRef } from "react";
import { Smartphone, Trash2, PlusCircle, Activity, SlidersHorizontal, Volume2 } from "lucide-react";
import { Device, TimelineEvent } from "../../types/mosquitoscan";

interface CapteursTabProps {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  setShowAddDeviceModal: (val: boolean) => void;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
  isPeriodicActive: boolean;
  setIsPeriodicActive: (val: boolean) => void;
  nextAnalysisCountdown: number;
  setNextAnalysisCountdown: (val: number) => void;
  analysisPeriodSec: number;
  isAnalyzing: boolean;
  testFreq: number;
  setTestFreq: (val: number) => void;
  isGeneratingTest: boolean;
  setIsGeneratingTest: (val: boolean) => void;
  testLog: string | null;
  setTestLog: (val: string | null) => void;
}

export function CapteursTab({
  devices,
  setDevices,
  selectedDeviceId,
  setSelectedDeviceId,
  setShowAddDeviceModal,
  setTimeline,
  isPeriodicActive,
  setIsPeriodicActive,
  nextAnalysisCountdown,
  setNextAnalysisCountdown,
  analysisPeriodSec,
  isAnalyzing,
  testFreq,
  setTestFreq,
  isGeneratingTest,
  setIsGeneratingTest,
  testLog,
  setTestLog,
}: CapteursTabProps) {

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const waterfallData = useRef<number[]>([]);

  // Selected device
  const selectedDev = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  // Rolling HTML5 Canvas Spectrogram waterfall animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width;
    let height = canvas.height;

    // Resizing container helper
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 180;
        width = canvas.width;
        height = canvas.height;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize buffer
    const bufferSize = width;
    if (waterfallData.current.length === 0) {
      waterfallData.current = Array(bufferSize).fill(20);
    }

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = "#020617"; // Slate 950
      ctx.fillRect(0, 0, width, height);

      // Render Frequency grid background lines
      ctx.strokeStyle = "rgba(15, 118, 110, 0.15)"; // Teal border line
      ctx.lineWidth = 1;
      
      // Draw grid lines
      for (let i = 50; i < width; i += 80) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();

        ctx.fillStyle = "rgba(13, 148, 136, 0.4)";
        ctx.font = "8px monospace";
        ctx.fillText(`${400 + Math.round((i / width) * 300)}Hz`, i + 3, height - 8);
      }

      // Draw horizontal target frequency guide bounds (Mosquito range: 500Hz to 600Hz)
      const startX = ((500 - 400) / 300) * width;
      const endX = ((600 - 400) / 300) * width;
      ctx.fillStyle = "rgba(13, 148, 136, 0.05)";
      ctx.fillRect(startX, 0, endX - startX, height);
      
      ctx.strokeStyle = "rgba(13, 148, 136, 0.3)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Roll buffer values to simulate continuous data stream
      waterfallData.current = waterfallData.current.map((v, idx) => {
        // Base ambient noise floor
        let val = 15 + Math.random() * 12;

        // Add 500-600Hz simulation bumps (mosquito wings signature)
        const currentHz = 400 + (idx / width) * 300;
        
        // Dynamic test wave
        if (isGeneratingTest && Math.abs(currentHz - testFreq) < 12) {
          const distanceFactor = Math.abs(currentHz - testFreq) / 12;
          val += (1 - distanceFactor) * 110;
        }

        // Ambient spikes around fontaine frequency 545Hz
        if (Math.abs(currentHz - 545) < 8) {
          val += Math.random() * 18;
        }

        // Smooth buffer peak to look highly authentic
        const prev = waterfallData.current[idx] || val;
        return prev * 0.75 + val * 0.25;
      });

      // Render line drawing representing signal frequency
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#00E5C3"; // Bioluminescent teal

      waterfallData.current.forEach((val, idx) => {
        const x = idx;
        const y = height - (val / 150) * height;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw specific target marker flags
      if (isGeneratingTest) {
        const flagX = ((testFreq - 400) / 300) * width;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(flagX, height - 30, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 9px sans-serif";
        ctx.fillText(`TEST: ${testFreq}Hz`, flagX - 30, height - 42);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isGeneratingTest, testFreq]);

  // Perform calibration test
  const handleTestTrigger = () => {
    setIsGeneratingTest(true);
    setTestLog("Initialisation de l'émetteur de calibration...");

    setTimeout(() => {
      setTestLog(`Buzzer piézoélectrique actif à ${testFreq}Hz (Vérification de la trame MEMS)...`);
    }, 800);

    setTimeout(() => {
      setTestLog(`Alerte acoustique simulée reçue ! Confiance : 96% (Aedes Albopictus)`);
      
      // Log timeline
      const newTimelineEvent = {
        id: `tl-cal-${Date.now()}`,
        timestamp: "À l'instant",
        type: "detection" as const,
        title: "Test de Calibration Réussi",
        description: `Signal d'entraînement généré artificiellement à ${testFreq}Hz capté par le terminal "${selectedDev.name}".`,
        operator: "Marie (Gérante)"
      };
      setTimeline((prev) => [newTimelineEvent, ...prev]);
    }, 2000);

    setTimeout(() => {
      setIsGeneratingTest(false);
      setTestLog(null);
    }, 4500);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Diagnostics, settings & controls of selected sensor */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Real-time Rolling Spectrogram Canvas Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Spectrogramme MEMS en direct ({selectedDev.name})
                </h3>
              </div>
              <span className="text-[10px] text-teal-400 font-mono font-bold bg-teal-950/40 px-2 py-0.5 rounded border border-teal-900/40">
                Spectre : 400Hz - 700Hz
              </span>
            </div>

            {/* Spectrogram Canvas Frame */}
            <div className="rounded-xl border border-slate-950 overflow-hidden relative bg-slate-950 h-[180px]">
              <canvas ref={canvasRef} className="block w-full h-full" />
              
              {isGeneratingTest && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-rose-950/80 border border-rose-800 rounded text-[9px] font-mono text-rose-300 animate-pulse uppercase">
                  📡 Signal de Test Injecté
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1.5">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-0.5">Énergie Bruit</span>
                <span className="font-mono text-slate-300 font-bold">{selectedDev.noiseDb} dBFS</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-0.5">Seuil de Déclenchement</span>
                <span className="font-mono text-teal-400 font-bold">-32 dB</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-0.5">Algorithme DSP</span>
                <span className="font-bold text-teal-500">Goertzel 545Hz</span>
              </div>
            </div>
          </div>

          {/* Device settings and diagnostic parameters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Calibrages & Paramétrages Acoustiques
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Sensitivity range selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600">Ouverture Cône d'Écoute :</span>
                  <span className="font-mono font-bold text-teal-600">{selectedDev.listeningConeWidth}°</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="120"
                  value={selectedDev.listeningConeWidth}
                  onChange={(e) => {
                    const widthVal = Number(e.target.value);
                    setDevices((prev) =>
                      prev.map((d) =>
                        d.id === selectedDev.id
                          ? { ...d, listeningConeWidth: widthVal }
                          : d
                      )
                    );
                  }}
                  className="w-full accent-teal-600 cursor-pointer h-1 bg-slate-200 rounded"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Ajuster l'orientation angulaire de la directivité du micro pour filtrer l'écho des parois.
                </p>
              </div>

              {/* Noise floor selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600">Seuil de Bruit de Fond :</span>
                  <span className="font-mono font-bold text-teal-600">{selectedDev.noiseDb} dB</span>
                </div>
                <input
                  type="range"
                  min="-65"
                  max="-25"
                  value={selectedDev.noiseDb}
                  onChange={(e) => {
                    const dbVal = Number(e.target.value);
                    setDevices((prev) =>
                      prev.map((d) =>
                        d.id === selectedDev.id ? { ...d, noiseDb: dbVal } : d
                      )
                    );
                  }}
                  className="w-full accent-teal-600 cursor-pointer h-1 bg-slate-200 rounded"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Filtre coupe-bas pour ignorer les bruits aériens permanents (compresseurs, piscines).
                </p>
              </div>
            </div>

            {/* Simulated test audio waves */}
            <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-slate-700" />
                <strong className="text-xs text-slate-800">Générateur Acoustique de Test Intégré</strong>
              </div>
              <p className="text-[11px] text-slate-400">
                Générez des ondes chiffrées à des fréquences spécifiques pour tester la chaîne d'alerte et calibrer les microphones d'ambiance à distance.
              </p>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setTestFreq(545)}
                  className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs border ${testFreq === 545 ? "bg-teal-50 text-teal-800 border-teal-300" : "bg-white hover:bg-slate-50 border-slate-200"}`}
                >
                  545Hz (Aedes Tigre)
                </button>
                <button
                  onClick={() => setTestFreq(495)}
                  className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs border ${testFreq === 495 ? "bg-teal-50 text-teal-800 border-teal-300" : "bg-white hover:bg-slate-50 border-slate-200"}`}
                >
                  495Hz (Culex Commun)
                </button>
                <button
                  onClick={() => setTestFreq(620)}
                  className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs border ${testFreq === 620 ? "bg-teal-50 text-teal-800 border-teal-300" : "bg-white hover:bg-slate-50 border-slate-200"}`}
                >
                  620Hz (Sifflement Vent)
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleTestTrigger}
                  disabled={isGeneratingTest}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-white font-bold text-xs rounded-lg cursor-pointer transition-all shadow-sm"
                >
                  🚀 Lancer le diagnostic de calibration
                </button>
              </div>

              {testLog && (
                <div className="p-2.5 bg-slate-950 border border-slate-850 rounded text-[10px] font-mono text-teal-400 text-left animate-pulse">
                  🔧 {testLog}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Devices (Sensors) list */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Automatic Periodic Scanning Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-slate-100 space-y-3 text-xs">
            <span className="font-bold block uppercase tracking-wide text-teal-400 text-[10px]">
              Vigilance Continue & Background Scanning
            </span>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Analyse Récurrente</span>
                <span className="text-xs text-slate-300 font-semibold font-mono">
                  {isPeriodicActive ? `Prochain scan : ${nextAnalysisCountdown}s` : "Désactivé"}
                </span>
              </div>

              <button
                onClick={() => {
                  setIsPeriodicActive(!isPeriodicActive);
                  if (!isPeriodicActive) {
                    setNextAnalysisCountdown(analysisPeriodSec);
                  }
                }}
                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg uppercase tracking-wider cursor-pointer transition-colors ${
                  isPeriodicActive
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-teal-600 hover:bg-teal-500 text-white"
                }`}
              >
                {isPeriodicActive ? "Stop" : "Activer"}
              </button>
            </div>

            {isAnalyzing && (
              <div className="p-2 bg-teal-950/30 border border-teal-900 rounded-lg text-[10px] font-mono text-teal-400 text-center animate-pulse">
                ⌛ Analyse récurrente IA en cours d'exécution...
              </div>
            )}
          </div>

          {/* List of active device nodes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Terminaux Jumelés
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                {devices.length} terminaux
              </span>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {devices.map((dev) => (
                <div 
                  key={dev.id} 
                  onClick={() => setSelectedDeviceId(dev.id)}
                  className={`p-3 border rounded-xl text-xs space-y-2 relative cursor-pointer transition-all ${
                    selectedDeviceId === dev.id ? "border-teal-500 bg-teal-50/10 shadow-sm" : "border-slate-100 hover:border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                      {dev.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase ${
                        dev.status === "synced"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800 animate-pulse"
                      }`}>
                        {dev.status === "synced" ? "✓ Sync" : "Syncing"}
                      </span>
                      
                      {/* Delete device node */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Voulez-vous vraiment débrancher le capteur ${dev.name} ?`)) {
                            setDevices((prev) => prev.filter((d) => d.id !== dev.id));
                            
                            // Log
                            const newEvent = {
                              id: `tl-del-${Date.now()}`,
                              timestamp: "À l'instant",
                              type: "sensor" as const,
                              title: "Capteur déconnecté",
                              description: `Le terminal ${dev.name} (${dev.role}) a été débranché.`,
                              operator: "Marie (Gérante)"
                            };
                            setTimeline((prev) => [newEvent, ...prev]);
                          }
                        }}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors"
                        title="Supprimer ce capteur"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Rôle :</span>
                      <strong className="text-slate-600">{dev.role}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Bruit de fond :</span>
                      <strong className="text-slate-600 font-mono">{dev.noiseDb} dB</strong>
                    </div>
                  </div>

                  {/* Battery level status bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Batterie</span>
                      <span className="font-mono">{dev.battery}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${dev.battery > 50 ? "bg-emerald-500" : dev.battery > 20 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${dev.battery}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAddDeviceModal(true)}
              className="w-full text-center py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
            >
              <PlusCircle className="w-4 h-4" />
              Ajouter un capteur associé
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
