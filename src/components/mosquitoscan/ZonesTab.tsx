import React from "react";
import { MapPin, Sliders, Volume2, PlusCircle, Cpu, CheckCircle2 } from "lucide-react";
import { RiskZone, Device } from "../../types/mosquitoscan";

interface ZonesTabProps {
  zones: RiskZone[];
  setZones: React.Dispatch<React.SetStateAction<RiskZone[]>>;
  devices: Device[];
  selectedZone: RiskZone | null;
  setSelectedZone: (zone: RiskZone | null) => void;
  triangulateTarget: { x: number; y: number };
  setTriangulateTarget: (coords: { x: number; y: number }) => void;
  isTriangulating: boolean;
  setIsTriangulating: (val: boolean) => void;
  triangulateResult: string | null;
  setTriangulateResult: (val: string | null) => void;
}

export function ZonesTab({
  zones,
  setZones,
  devices,
  selectedZone,
  setSelectedZone,
  triangulateTarget,
  setTriangulateTarget,
  isTriangulating,
  setIsTriangulating,
  triangulateResult,
  setTriangulateResult,
}: ZonesTabProps) {

  // Color functions helpers matching blueprint exactly
  const getLevelColor = (level: string) => {
    switch (level) {
      case "CRITIQUE":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "ÉLEVÉ":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "MODÉRÉ":
        return "bg-teal-100 text-teal-800 border-teal-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  const getUrgencyTextBg = (level: string) => {
    switch (level) {
      case "CRITIQUE":
        return "text-rose-600";
      case "ÉLEVÉ":
        return "text-amber-600";
      case "MODÉRÉ":
        return "text-teal-600";
      default:
        return "text-slate-500";
    }
  };

  // Perform geometric distance search to triangulate closest risk zone
  const handleTriangulate = () => {
    setIsTriangulating(true);
    setTriangulateResult(null);

    setTimeout(() => {
      let closestZone: RiskZone | null = null;
      let minDistance = Infinity;

      zones.forEach((z) => {
        const dx = z.coordinates.x - triangulateTarget.x;
        const dy = z.coordinates.y - triangulateTarget.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
          closestZone = z;
        }
      });

      setIsTriangulating(false);
      if (closestZone) {
        setTriangulateResult((closestZone as RiskZone).name);
        setSelectedZone(closestZone);
      }
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
        
        {/* Left Area: Vector Map & Simulated Triangulation */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] text-teal-600 font-bold uppercase block tracking-wider">Cartographie Biologique</span>
              <h3 className="text-sm font-bold text-slate-800">
                Localisation des Zones à Risques & Triangulation SNR
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded font-medium border">
              💡 Cliquez sur le plan ci-dessous pour déplacer le ciblage bio-acoustique.
            </span>
          </div>

          {/* Interactive Map Visual Vector Container */}
          <div className="relative border border-slate-200 bg-slate-950 rounded-2xl aspect-[16/9] w-full overflow-hidden flex items-center justify-center select-none shadow-inner">
            
            {/* Blueprint Grid Blueprint Background Lines */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" 
              style={{ 
                backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px), linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)", 
                backgroundSize: "20px 20px" 
              }} 
            />

            {/* Click Handler Overlay to change triangulation coordinate targets */}
            <div 
              className="absolute inset-0 z-10 cursor-crosshair"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                setTriangulateTarget({ x, y });
                setTriangulateResult(null);
              }}
            />

            {/* Simulated Vector Walls / Pool Representation */}
            <div className="absolute left-[30%] top-[25%] w-[40%] h-[35%] rounded-full bg-blue-900/10 border border-blue-500/15 pointer-events-none flex items-center justify-center">
              <span className="text-[9px] text-blue-400 font-mono">BASSIN D'EAU</span>
            </div>
            <div className="absolute left-[10%] bottom-[15%] w-[25%] h-[20%] rounded-lg bg-green-950/10 border border-green-700/15 pointer-events-none flex items-center justify-center">
              <span className="text-[9px] text-green-500 font-mono">SOUS-BOIS NORD</span>
            </div>

            {/* Risk zones coordinates markers on map */}
            {zones.map((zone) => (
              <div
                key={zone.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedZone(zone);
                  setTriangulateTarget(zone.coordinates);
                }}
                className={`absolute z-20 w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  selectedZone?.id === zone.id
                    ? "scale-125 border-white shadow-lg shadow-teal-500/20"
                    : "hover:scale-110"
                } ${
                  zone.level === "CRITIQUE"
                    ? "bg-rose-500 text-white"
                    : zone.level === "ÉLEVÉ"
                    ? "bg-amber-500 text-white"
                    : "bg-teal-500 text-slate-950"
                }`}
                style={{ left: `${zone.coordinates.x}%`, top: `${zone.coordinates.y}%` }}
                title={`${zone.name} (${zone.level})`}
              >
                <span className="text-[9px] font-extrabold font-mono">
                  {zone.id.replace("zone-", "Z")}
                </span>
              </div>
            ))}

            {/* Connected devices (sensors) positions and direction cones */}
            {devices.map((dev) => (
              <div
                key={dev.id}
                className="absolute pointer-events-none -ml-3 -mt-3 text-center"
                style={{ left: `${dev.position.x}%`, top: `${dev.position.y}%` }}
              >
                {/* Listening cone */}
                <div 
                  className="absolute w-24 h-24 -left-9 -top-9 rounded-full border border-teal-500/10 bg-teal-500/[0.02] transform origin-center opacity-30"
                  style={{
                    clipPath: `polygon(50% 50%, 0 0, 100% 0)`,
                    transform: `rotate(${dev.directionAngle}deg)`
                  }}
                />
                
                {/* Device circle */}
                <div className="w-6 h-6 rounded-lg bg-slate-900 border border-teal-400 text-teal-400 flex items-center justify-center relative shadow-md">
                  <Cpu className="w-3 h-3" />
                  <span className="absolute -bottom-3 text-[7px] text-teal-300 font-mono font-bold whitespace-nowrap bg-slate-950/80 px-1 rounded border border-slate-800">
                    {dev.name.split(" ")[0]}
                  </span>
                </div>
              </div>
            ))}

            {/* Triangulate coordinate target pointer crosshair */}
            <div
              className="absolute z-20 w-6 h-6 -ml-3 -mt-3 pointer-events-none flex items-center justify-center animate-pulse"
              style={{ left: `${triangulateTarget.x}%`, top: `${triangulateTarget.y}%` }}
            >
              <div className="w-2 h-2 bg-rose-500 rounded-full border border-white" />
              <div className="absolute w-6 h-6 rounded-full border-2 border-dashed border-rose-500/60 animate-spin" />
            </div>
          </div>

          {/* Map Footer: Interactive action buttons to process simulation */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 border p-3 rounded-xl gap-3 text-xs">
            <div className="space-y-0.5 text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Ciblage bio-acoustique actuel</span>
              <strong className="text-slate-700 font-mono">
                X: {triangulateTarget.x}% / Y: {triangulateTarget.y}%
              </strong>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTriangulate}
                disabled={isTriangulating}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 disabled:opacity-50 text-teal-400 border border-teal-500/20 rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                <Volume2 className="w-4 h-4" />
                {isTriangulating ? "Triangulation..." : "Simuler Émission (Test Sonore)"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Area: Risk Zone Details & Intervention Prescription */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
            Fiche Diagnostic de Zone
          </h3>

          {selectedZone ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-0.5">
                  <span className="text-[8px] text-slate-400 font-bold uppercase">Nom de l'espace ciblé</span>
                  <h4 className="text-xs font-bold text-slate-800 leading-tight">{selectedZone.name}</h4>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase shrink-0 ${getLevelColor(selectedZone.level)}`}>
                  {selectedZone.level}
                </span>
              </div>

              {/* Stagnant water scale indicators */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-[11px] text-slate-500 font-bold">
                  <span>Facteur Eau Stagnante :</span>
                  <span className={`${getUrgencyTextBg(selectedZone.level)}`}>{selectedZone.stagnantWaterScore}/10</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      selectedZone.stagnantWaterScore > 7
                        ? "bg-rose-500"
                        : selectedZone.stagnantWaterScore > 4
                        ? "bg-amber-500"
                        : "bg-teal-500"
                    }`}
                    style={{ width: `${selectedZone.stagnantWaterScore * 10}%` }}
                  />
                </div>
                <span className="block text-[10px] text-slate-400 leading-tight">
                  Risque principal : <strong className="text-slate-600">{selectedZone.riskFactor}</strong>
                </span>
              </div>

              {/* Expert clinical recommendations */}
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Prescription de traitement préconisé</span>
                <p className="text-xs text-slate-600 leading-relaxed font-mono bg-amber-50/60 border border-amber-200/50 p-3 rounded-lg">
                  {selectedZone.recommandation}
                </p>
              </div>

              {/* State control trap toggle */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Dispositif Physique</span>
                  <span className="text-xs text-slate-700 font-semibold">
                    {selectedZone.trapInstalled ? "✓ Piège CO2 raccordé" : "Aucun piège associé"}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setZones((prev) =>
                      prev.map((z) =>
                        z.id === selectedZone.id
                          ? { ...z, trapInstalled: !z.trapInstalled }
                          : z
                      )
                    );
                    setSelectedZone({
                      ...selectedZone,
                      trapInstalled: !selectedZone.trapInstalled,
                    });
                  }}
                  className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg uppercase tracking-wider cursor-pointer transition-colors ${
                    selectedZone.trapInstalled
                      ? "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200"
                      : "bg-teal-600 hover:bg-teal-500 text-white"
                  }`}
                >
                  {selectedZone.trapInstalled ? "Déposer" : "Installer piège"}
                </button>
              </div>

              {triangulateResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex gap-2 animate-scaleUp">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <span className="block text-[9px] text-emerald-800 font-bold uppercase">Résultat de la Triangulation</span>
                    <p className="text-emerald-700 leading-relaxed font-semibold">
                      Le signal concorde à 94% avec l'empreinte de la zone : <strong className="underline">{triangulateResult}</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Sélectionnez une zone sur la carte pour consulter les diagnostics B2B.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
