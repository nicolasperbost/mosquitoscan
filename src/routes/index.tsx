import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout, MapPin, Smartphone, Bell, FileText, LogOut } from "lucide-react";
import { useAuth } from "../components/AuthGate";

// Import types & mock data
import { Site, RiskZone, Device, AlertEvent, TimelineEvent } from "../types/mosquitoscan";
import { SITES_DATA, INITIAL_ZONES, INITIAL_DEVICES, INITIAL_ALERTS, INITIAL_TIMELINE } from "../data/mockData";

// Import subcomponents
import { SitesTab } from "../components/mosquitoscan/SitesTab";
import { ZonesTab } from "../components/mosquitoscan/ZonesTab";
import { CapteursTab } from "../components/mosquitoscan/CapteursTab";
import { AlertesTab } from "../components/mosquitoscan/AlertesTab";
import { RapportsTab } from "../components/mosquitoscan/RapportsTab";
import { AddDeviceModal } from "../components/mosquitoscan/AddDeviceModal";
import { ExportModal } from "../components/mosquitoscan/ExportModal";
import { OnboardingWizard } from "../components/mosquitoscan/OnboardingWizard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MosquitoScan™ Pro — Détection acoustique de moustiques" },
      { name: "description", content: "La solution de surveillance passive bio-acoustique pour les professionnels de l'hôtellerie et du contrôle 3D." },
      { property: "og:title", content: "MosquitoScan™ Pro" },
      { property: "og:description", content: "Surveillance passive bio-acoustique et diagnostic 3D." },
    ],
  }),
  component: Index,
});

function Index() {
  const { currentUser, logout } = useAuth();
  // Navigation tabs: sites -> zones -> capteurs -> alertes -> rapports
  const [activeSubTab, setActiveSubTab] = useState<"sites" | "zones" | "capteurs" | "alertes" | "rapports">("sites");

  // Shared state management
  const [selectedSiteId, setSelectedSiteId] = useState<string>("site-1");
  const [sites, setSites] = useState<Site[]>(SITES_DATA);
  const [zones, setZones] = useState<RiskZone[]>(INITIAL_ZONES);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [alerts, setAlerts] = useState<AlertEvent[]>(INITIAL_ALERTS);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(INITIAL_TIMELINE);

  // Analysis execution states
  const [analysisMode, setAnalysisMode] = useState<"on_demand" | "periodic">("on_demand");
  const [analysisPeriodSec, setAnalysisPeriodSec] = useState<number>(15); // Default 15s for visual simulation
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [nextAnalysisCountdown, setNextAnalysisCountdown] = useState<number>(15);
  const [isPeriodicActive, setIsPeriodicActive] = useState<boolean>(false);

  // New Device creation states
  const [showAddDeviceModal, setShowAddDeviceModal] = useState<boolean>(false);

  // Selected entities for drill-down details
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(INITIAL_ZONES[0]);
  const [selectedAlert, setSelectedAlert] = useState<AlertEvent | null>(INITIAL_ALERTS[0]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("dev-master");

  // Filters for alerts
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterTemp, setFilterTemp] = useState<number>(15); // Show alerts above this temp
  const [filterIntensity, setFilterIntensity] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");

  // Onboarding wizard state
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);

  // Acoustic test generator state
  const [testFreq, setTestFreq] = useState<number>(545);
  const [isGeneratingTest, setIsGeneratingTest] = useState<boolean>(false);
  const [testLog, setTestLog] = useState<string | null>(null);

  // Export engine state
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportType, setExportType] = useState<"intervention" | "haccp" | "client">("intervention");

  // Triangulation live coordinates simulation
  const [triangulateTarget, setTriangulateTarget] = useState<{ x: number; y: number }>({ x: 48, y: 35 });
  const [isTriangulating, setIsTriangulating] = useState<boolean>(false);
  const [triangulateResult, setTriangulateResult] = useState<string | null>(null);

  // Selected site data
  const currentSite = sites.find((s) => s.id === selectedSiteId) || sites[0];

  // Weather configuration values (interactive simulation)
  const [tempCelsius, setTempCelsius] = useState<number>(29);
  const [humidityPercent, setHumidityPercent] = useState<number>(75);

  // Auto calculate dynamic site risk based on temp, hum, active alerts
  const calculateDynamicRisk = (temp: number, hum: number, alertsCount: number) => {
    const climateFactor = (temp * 1.3 + hum * 0.7) / 2;
    const alertFactor = alertsCount * 8;
    return Math.min(100, Math.round(climateFactor + alertFactor));
  };

  const dynamicRiskScore = calculateDynamicRisk(
    tempCelsius,
    humidityPercent,
    alerts.filter((a) => a.status === "active" && a.species.includes("Tigre")).length
  );

  // Update root site risk score on change
  useEffect(() => {
    setSites((prev) =>
      prev.map((s) =>
        s.id === selectedSiteId
          ? { ...s, riskScore: dynamicRiskScore }
          : s
      )
    );
  }, [dynamicRiskScore, selectedSiteId]);

  // Periodic acoustic simulation tracker
  useEffect(() => {
    let timer: any;
    if (isPeriodicActive) {
      timer = setInterval(() => {
        setNextAnalysisCountdown((prev) => {
          if (prev <= 1) {
            setIsAnalyzing(true);
            
            // Random simulation trigger
            setTimeout(() => {
              setIsAnalyzing(false);
              const shouldAlert = Math.random() > 0.4;
              if (shouldAlert) {
                const isTigre = Math.random() > 0.5;
                const speciesName = isTigre ? ("Aedes Albopictus (Tigre)" as const) : ("Culex Pipiens (Commun)" as const);
                const randomZones = ["Abords de la fontaine centrale", "Sous-bois Terrasse Nord", "Stockage technique & poubelles"];
                const loc = randomZones[Math.floor(Math.random() * randomZones.length)];
                
                const newAlert: AlertEvent = {
                  id: `alert-sim-${Date.now()}`,
                  timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
                  timeLabel: "À l'instant",
                  period: "Soir",
                  frequencyHz: isTigre ? 545 : 495,
                  maxVolumeDb: -15 - Math.floor(Math.random() * 25),
                  durationSec: Math.floor(Math.random() * 8) + 2,
                  location: loc,
                  species: speciesName,
                  confidence: 85 + Math.floor(Math.random() * 14),
                  status: "active",
                  urgency: isTigre ? "Critique" : "Normale",
                  intensity: "Élevée",
                  temperature: tempCelsius,
                };

                setAlerts((prevA) => [newAlert, ...prevA]);
                setSelectedAlert(newAlert);

                // Add to timeline
                const newTimelineEvent: TimelineEvent = {
                  id: `tl-sim-${Date.now()}`,
                  timestamp: "À l'instant",
                  type: "detection",
                  title: isTigre ? "Alerte Moustique Tigre !" : "Alerte Moustique Commun",
                  description: `Détection acoustique suspecte sur ${loc} à ${newAlert.frequencyHz}Hz.`,
                  operator: "Météo-IA",
                };
                setTimeline((prevT) => [newTimelineEvent, ...prevT]);
              }
            }, 1500);

            return analysisPeriodSec;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPeriodicActive, analysisPeriodSec, tempCelsius]);

  // Export engine mock timeline
  const triggerExport = (type: "intervention" | "haccp" | "client") => {
    setExportType(type);
    setShowExportModal(true);
    setIsExporting(true);
    setExportProgress(0);

    const interval = setInterval(() => {
      setExportProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          return 100;
        }
        return p + 25;
      });
    }, 300);
  };

  // Filter alerts based on selection criteria
  const filteredAlerts = alerts.filter((alert) => {
    if (filterPeriod !== "all" && alert.period !== filterPeriod) return false;
    if (alert.temperature < filterTemp) return false;
    if (filterIntensity !== "all" && alert.intensity !== filterIntensity) return false;
    if (filterUrgency !== "all" && alert.urgency !== filterUrgency) return false;
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-[#0A0F1E] font-sans text-slate-200 p-4 sm:p-6 md:p-8 space-y-6 relative overflow-hidden select-none">
      
      {/* Decorative bioluminescent lights in background */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header and top tab selectors */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-800 pb-4 relative z-10">
        <div className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white flex items-center gap-1.5">
              Mosquito<span className="text-[#00E5C3]">Scan</span>™
              <span className="text-[10px] bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                Console Pro
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Vigilance bio-acoustique HACCP & Diagnostics d'intervention pour techniciens 3D
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {/* Dynamic navigation tabs */}
          <nav className="flex flex-wrap bg-slate-900/80 border border-slate-800/80 p-1 rounded-xl gap-1 text-xs flex-1 sm:flex-initial">
            <button
              onClick={() => setActiveSubTab("sites")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "sites" ? "bg-[#00E5C3] text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:text-white"
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              Clients & Établissements
            </button>
            
            <button
              onClick={() => {
                setActiveSubTab("zones");
                // Default to fontaine zone on maps tab
                if (!selectedZone && zones.length > 0) setSelectedZone(zones[0]);
              }}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "zones" ? "bg-[#00E5C3] text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:text-white"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Cartographie & Triangulation
            </button>

            <button
              onClick={() => setActiveSubTab("capteurs")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "capteurs" ? "bg-[#00E5C3] text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Capteurs & Spectrogramme
            </button>

            <button
              onClick={() => setActiveSubTab("alertes")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "alertes" ? "bg-[#00E5C3] text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:text-white"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Alertes & Priorisation
            </button>

            <button
              onClick={() => setActiveSubTab("rapports")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === "rapports" ? "bg-[#00E5C3] text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Rapports & HACCP
            </button>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl shrink-0">
            <div className={`w-7 h-7 rounded-lg ${currentUser?.avatarColor || "bg-teal-600"} flex items-center justify-center text-[10px] font-bold font-mono text-white shadow-sm`}>
              {currentUser?.name ? currentUser.name.split(" ").map(n => n[0]).join("") : "U"}
            </div>
            <div className="text-left leading-none">
              <span className="text-[11px] font-bold block text-white mb-0.5 max-w-[100px] truncate">{currentUser?.name || "Nicolas"}</span>
              <span className="text-[8px] text-teal-400 font-bold uppercase tracking-wider block leading-none">{currentUser?.role || "Admin"}</span>
            </div>
            <button
              onClick={logout}
              className="p-1 bg-slate-800 hover:bg-slate-700 hover:text-rose-400 rounded-lg text-slate-400 transition-colors cursor-pointer ml-1"
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Onboarding Guide Widget */}
      <OnboardingWizard
        showOnboarding={showOnboarding}
        setShowOnboarding={setShowOnboarding}
        onboardingStep={onboardingStep}
        setOnboardingStep={setOnboardingStep}
        setOnboardingCompleted={setOnboardingCompleted}
      />

      {/* Central Tab Content views routing */}
      <div className="relative z-10">
        {activeSubTab === "sites" && (
          <SitesTab
            sites={sites}
            selectedSiteId={selectedSiteId}
            setSelectedSiteId={setSelectedSiteId}
            currentSite={currentSite}
            tempCelsius={tempCelsius}
            setTempCelsius={setTempCelsius}
            humidityPercent={humidityPercent}
            setHumidityPercent={setHumidityPercent}
            dynamicRiskScore={dynamicRiskScore}
            timeline={timeline}
            triggerExport={triggerExport}
          />
        )}

        {activeSubTab === "zones" && (
          <ZonesTab
            zones={zones}
            setZones={setZones}
            devices={devices}
            selectedZone={selectedZone}
            setSelectedZone={setSelectedZone}
            triangulateTarget={triangulateTarget}
            setTriangulateTarget={setTriangulateTarget}
            isTriangulating={isTriangulating}
            setIsTriangulating={setIsTriangulating}
            triangulateResult={triangulateResult}
            setTriangulateResult={setTriangulateResult}
          />
        )}

        {activeSubTab === "capteurs" && (
          <CapteursTab
            devices={devices}
            setDevices={setDevices}
            selectedDeviceId={selectedDeviceId}
            setSelectedDeviceId={setSelectedDeviceId}
            setShowAddDeviceModal={setShowAddDeviceModal}
            setTimeline={setTimeline}
            isPeriodicActive={isPeriodicActive}
            setIsPeriodicActive={setIsPeriodicActive}
            nextAnalysisCountdown={nextAnalysisCountdown}
            setNextAnalysisCountdown={setNextAnalysisCountdown}
            analysisPeriodSec={analysisPeriodSec}
            isAnalyzing={isAnalyzing}
            testFreq={testFreq}
            setTestFreq={setTestFreq}
            isGeneratingTest={isGeneratingTest}
            setIsGeneratingTest={setIsGeneratingTest}
            testLog={testLog}
            setTestLog={setTestLog}
          />
        )}

        {activeSubTab === "alertes" && (
          <AlertesTab
            alerts={alerts}
            setAlerts={setAlerts}
            filteredAlerts={filteredAlerts}
            selectedAlert={selectedAlert}
            setSelectedAlert={setSelectedAlert}
            filterPeriod={filterPeriod}
            setFilterPeriod={setFilterPeriod}
            filterTemp={filterTemp}
            setFilterTemp={setFilterTemp}
            filterIntensity={filterIntensity}
            setFilterIntensity={setFilterIntensity}
            filterUrgency={filterUrgency}
            setFilterUrgency={setFilterUrgency}
            setTimeline={setTimeline}
            triggerExport={triggerExport}
            currentSiteName={currentSite.name}
          />
        )}

        {activeSubTab === "rapports" && (
          <RapportsTab
            currentSiteName={currentSite.name}
            triggerExport={triggerExport}
          />
        )}
      </div>

      {/* Auxiliary Dialog Modals */}
      {showAddDeviceModal && (
        <AddDeviceModal
          setShowAddDeviceModal={setShowAddDeviceModal}
          setDevices={setDevices}
          setTimeline={setTimeline}
        />
      )}

      <ExportModal
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportType={exportType}
        currentSite={currentSite}
      />

    </div>
  );
}
