import React from "react";
import { ChevronRight, ShieldAlert, FileSpreadsheet, BadgeCheck, Info } from "lucide-react";

interface RapportsTabProps {
  currentSiteName: string;
  triggerExport: (type: "intervention" | "haccp" | "client") => void;
}

export function RapportsTab({
  currentSiteName,
  triggerExport,
}: RapportsTabProps) {
  return (
    <div className="space-y-6 text-left animate-fadeIn">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Weekly comparison & Activity Peaks (Tracking) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
          
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="space-y-1">
              <span className="text-[10px] text-teal-600 font-bold uppercase block tracking-wider">Anticipation & Analyse Biologique</span>
              <h3 className="text-base font-bold text-slate-800">Suivi des Pics d'Activité & Comparaison Hebdomadaire</h3>
            </div>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
              Saison 2026
            </span>
          </div>

          {/* COMPARATIVE SVG CHART (Aesthetic custom-designed chart representational lines) */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Indicateur hebdomadaire d'éclosion des œufs
            </span>
            
            <div className="h-56 w-full border border-slate-100 rounded-xl bg-slate-50/50 p-4 relative overflow-hidden flex flex-col justify-between">
              {/* Grid Lines */}
              <div className="absolute inset-0 grid grid-rows-4 pointer-events-none opacity-20">
                <div className="border-b border-slate-300" />
                <div className="border-b border-slate-300" />
                <div className="border-b border-slate-300" />
                <div className="border-b border-slate-300" />
              </div>

              {/* SVG Chart Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none px-6 py-8" viewBox="0 0 500 200">
                <defs>
                  <linearGradient id="rose-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="teal-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Weekly average season (Grey dashed) */}
                <path
                  d="M 10,140 Q 90,130 180,100 T 360,70 T 480,40"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* Previous week (Teal line) */}
                <path
                  d="M 10,170 Q 90,120 180,140 T 360,90 T 480,50"
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="3"
                />

                {/* Current week - peaking high (Rose line) */}
                <path
                  d="M 10,130 Q 90,160 180,80 T 360,40 T 480,20"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                />
              </svg>

              {/* Labels and legends */}
              <div className="flex justify-between items-end text-[9px] text-slate-400 font-mono z-10">
                <span>Lundi</span>
                <span>Mercredi</span>
                <span>Vendredi</span>
                <span>Dimanche (Aujourd'hui)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-[10px] justify-center pt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-rose-500 rounded-full inline-block" />
                <span className="text-slate-600 font-semibold">Semaine en cours (Vague de chaleur)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-teal-500 rounded-full inline-block" />
                <span className="text-slate-600 font-semibold">Semaine précédente (Météo douce)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-1 border-b border-dashed border-slate-400 inline-block" />
                <span>Moyenne Saisonnière Tri-annuelle</span>
              </div>
            </div>
          </div>

          {/* Peak hours matrix tracking - proactive protection scheduling */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Densité de capture horaire passive
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
              <div className="bg-slate-50 border p-2 rounded-lg">
                <span className="block text-[8px] text-slate-400">00h - 04h</span>
                <strong className="text-slate-700">12 vols</strong>
              </div>
              <div className="bg-slate-50 border p-2 rounded-lg">
                <span className="block text-[8px] text-slate-400">04h - 08h</span>
                <strong className="text-slate-700">45 vols</strong>
              </div>
              <div className="bg-slate-50 border p-2 rounded-lg">
                <span className="block text-[8px] text-slate-400">08h - 12h</span>
                <strong className="text-slate-700">88 vols</strong>
              </div>
              <div className="bg-slate-50 border p-2 rounded-lg">
                <span className="block text-[8px] text-slate-400">12h - 16h</span>
                <strong className="text-slate-700">32 vols</strong>
              </div>
              <div className="bg-slate-100 border-amber-300 border p-2 rounded-lg">
                <span className="block text-[8px] text-amber-600 font-bold">16h - 20h</span>
                <strong className="text-amber-800 font-extrabold block">240 vols 🔥</strong>
              </div>
              <div className="bg-slate-50 border p-2 rounded-lg">
                <span className="block text-[8px] text-slate-400">20h - 00h</span>
                <strong className="text-slate-700">65 vols</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: PDF deliverable exports generator */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-teal-600 font-bold uppercase block tracking-wider">Aide au Diagnostic & Traçabilité</span>
            <h3 className="text-sm font-bold text-slate-800">Éditeur de Rapports Professionnels</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Générez des bilans de vigilance acoustique pour la traçabilité interne de l'établissement et pour optimiser l'application des traitements curatifs de terrain.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => triggerExport("intervention")}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 border rounded-xl text-left transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex gap-2.5 items-center">
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="space-y-0.5">
                  <strong className="text-xs text-slate-800 block leading-tight">Rapport d'Intervention & Traitement</strong>
                  <span className="text-[10px] text-slate-400">Actions de lutte antivectorielle (Larvicides, Adulticides)</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => triggerExport("haccp")}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 border rounded-xl text-left transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex gap-2.5 items-center">
                <FileSpreadsheet className="w-5 h-5 text-teal-500 shrink-0" />
                <div className="space-y-0.5">
                  <strong className="text-xs text-slate-800 block leading-tight">Bilan de Vigilance & Suivi Acoustique</strong>
                  <span className="text-[10px] text-slate-400">Relevés de pression acoustique pour le dossier de suivi</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => triggerExport("client")}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 border rounded-xl text-left transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex gap-2.5 items-center">
                <BadgeCheck className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="space-y-0.5">
                  <strong className="text-xs text-slate-800 block leading-tight">Attestation d'Effort Préventif Continu</strong>
                  <span className="text-[10px] text-slate-400">Preuve d'engagement de veille passive permanente</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-800 leading-relaxed flex gap-2">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-[10px]">
              Un diagnostic d'écoute continu atteste de la surveillance proactive de l'établissement, facilitant l'élaboration de plans d'éradication par le technicien 3D.
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
