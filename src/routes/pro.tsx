import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import {
  ChevronLeft, Building2, MapPin, Bell, FileText, Thermometer, Droplets,
  ShieldAlert, Check, X, Printer, Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoomStore } from "@/lib/roomStore";
import { supabase } from "@/integrations/supabase/client";
import { categoryFromSpeciesHint } from "@/lib/spectralAnalysis";
import { fetchCurrentWeather, computeRiskScore, computeHealthScore, riskLevelFromScore, type WeatherSnapshot } from "@/lib/weather";
import type { DetectionEvent } from "@/types/room";
import { SitesTab, type SiteView, type TimelineItem } from "@/components/mosquitoscan/SitesTab";
import { ZonesTab, type ZoneView, type RiskLevel } from "@/components/mosquitoscan/ZonesTab";
import { toast } from "sonner";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "Tableau de bord pro — MosquitoRadar" },
      { name: "description", content: "Gestion multi-sites pour professionnels : zones à risque, alertes, interventions et rapports." },
    ],
  }),
  component: ProDashboardPage,
});

// ─── DB row shapes (pro_sites / pro_zones / pro_interventions, lot 5) ──────
interface ProSiteRow {
  id: string; name: string; client_name: string | null; address: string | null;
  lat: number | null; lng: number | null; active_traps: number; last_inspection: string | null;
}
interface ProZoneRow {
  id: string; site_id: string; name: string; risk_level: RiskLevel;
  risk_factor: string | null; recommendation: string | null; trap_installed: boolean;
  rel_x: number | null; rel_y: number | null;
}
interface ProInterventionRow {
  id: string; site_id: string; type: "treatment" | "inspection" | "sensor" | "note";
  title: string; description: string | null; operator: string | null; created_at: string;
}

function ProDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const detections = useRoomStore((s) => s.detections);

  const [tab, setTab] = useState<"sites" | "zones" | "alertes" | "rapports">("sites");
  const [siteRows, setSiteRows] = useState<ProSiteRow[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [zoneRows, setZoneRows] = useState<ProZoneRow[]>([]);
  const [interventionRows, setInterventionRows] = useState<ProInterventionRow[]>([]);
  const [weatherBySite, setWeatherBySite] = useState<Record<string, WeatherSnapshot | null>>({});
  const [loadingSites, setLoadingSites] = useState(false);

  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [pendingZonePos, setPendingZonePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── Data loading ─────────────────────────────────────────────────────
  const loadSites = async () => {
    if (!user) return;
    setLoadingSites(true);
    const { data, error } = await supabase.from("pro_sites").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Échec du chargement des sites : " + error.message);
    setSiteRows(data ?? []);
    if (!selectedSiteId && data && data.length > 0) setSelectedSiteId(data[0].id);
    setLoadingSites(false);
  };

  useEffect(() => {
    if (user) loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!selectedSiteId) return;
    supabase.from("pro_zones").select("*").eq("site_id", selectedSiteId).then(({ data, error }) => {
      if (error) toast.error("Échec du chargement des zones : " + error.message);
      setZoneRows(data ?? []);
    });
    supabase
      .from("pro_interventions")
      .select("*")
      .eq("site_id", selectedSiteId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Échec du chargement des interventions : " + error.message);
        setInterventionRows(data ?? []);
      });
  }, [selectedSiteId]);

  useEffect(() => {
    for (const site of siteRows) {
      if (site.lat == null || site.lng == null) continue;
      if (weatherBySite[site.id] !== undefined) continue;
      fetchCurrentWeather(site.lat, site.lng).then((w) => setWeatherBySite((prev) => ({ ...prev, [site.id]: w })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteRows]);

  // ─── Real risk/health per site ─────────────────────────────────────────
  const recentHighConfidenceCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return detections.filter((d) => d.confidence > 70 && new Date(d.timestamp).getTime() > weekAgo).length;
  }, [detections]);

  const siteViews: SiteView[] = useMemo(
    () =>
      siteRows.map((s) => {
        const weather = weatherBySite[s.id] ?? null;
        const risk = computeRiskScore(weather, recentHighConfidenceCount);
        return {
          id: s.id, name: s.name, clientName: s.client_name, address: s.address,
          activeTraps: s.active_traps, lastInspection: s.last_inspection,
          riskScore: risk, healthScore: computeHealthScore(risk), weather,
        };
      }),
    [siteRows, weatherBySite, recentHighConfidenceCount],
  );
  const currentSiteView = siteViews.find((s) => s.id === selectedSiteId) ?? null;

  const timelineItems: TimelineItem[] = useMemo(
    () =>
      interventionRows.map((it) => ({
        id: it.id,
        timestamp: new Date(it.created_at).toLocaleString("fr-FR"),
        type: it.type,
        title: it.title,
        description: it.description,
        operator: it.operator,
      })),
    [interventionRows],
  );

  const zoneViews: ZoneView[] = useMemo(
    () =>
      zoneRows.map((z) => ({
        id: z.id, name: z.name, level: z.risk_level, riskFactor: z.risk_factor,
        recommendation: z.recommendation, trapInstalled: z.trap_installed,
        relX: z.rel_x ?? 50, relY: z.rel_y ?? 50,
      })),
    [zoneRows],
  );
  const selectedZoneView = zoneViews.find((z) => z.id === selectedZoneId) ?? null;

  // ─── Mutations ─────────────────────────────────────────────────────────
  const addSite = async (form: { name: string; client_name: string; address: string; lat: string; lng: string }) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("pro_sites")
      .insert({
        user_id: user.id, name: form.name, client_name: form.client_name || null, address: form.address || null,
        lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null,
      })
      .select().single();
    if (error) { toast.error("Échec de la création : " + error.message); return; }
    setSiteRows((prev) => [data, ...prev]);
    setSelectedSiteId(data.id);
    setShowAddSite(false);
    toast.success("Site créé");
  };

  const addZone = async (form: { name: string; risk_level: RiskLevel; risk_factor: string; recommendation: string }) => {
    if (!user || !selectedSiteId || !pendingZonePos) return;
    const { data, error } = await supabase
      .from("pro_zones")
      .insert({
        user_id: user.id, site_id: selectedSiteId, trap_installed: false,
        rel_x: pendingZonePos.x, rel_y: pendingZonePos.y, ...form,
      })
      .select().single();
    if (error) { toast.error("Échec de la création : " + error.message); return; }
    setZoneRows((prev) => [data, ...prev]);
    setShowAddZone(false);
    setPendingZonePos(null);
    toast.success("Zone ajoutée");
  };

  const toggleTrap = async (zoneId: string, installed: boolean) => {
    const { error } = await supabase.from("pro_zones").update({ trap_installed: installed }).eq("id", zoneId);
    if (error) { toast.error("Échec de la mise à jour : " + error.message); return; }
    setZoneRows((prev) => prev.map((z) => (z.id === zoneId ? { ...z, trap_installed: installed } : z)));
  };

  const deleteZone = async (zoneId: string) => {
    const { error } = await supabase.from("pro_zones").delete().eq("id", zoneId);
    if (error) { toast.error("Échec de la suppression : " + error.message); return; }
    setZoneRows((prev) => prev.filter((z) => z.id !== zoneId));
    if (selectedZoneId === zoneId) setSelectedZoneId(null);
  };

  const addIntervention = async (form: { type: ProInterventionRow["type"]; title: string; description: string; operator: string }) => {
    if (!user || !selectedSiteId) return;
    const { data, error } = await supabase
      .from("pro_interventions")
      .insert({ user_id: user.id, site_id: selectedSiteId, ...form })
      .select().single();
    if (error) { toast.error("Échec de l'ajout : " + error.message); return; }
    setInterventionRows((prev) => [data, ...prev]);
    setShowAddIntervention(false);
    toast.success("Intervention enregistrée");
  };

  // ─── Alerts (real DetectionEvent feed) ────────────────────────────────
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const enrichedAlerts = useMemo(() => {
    const periodOf = (d: Date) => {
      const h = d.getHours();
      if (h >= 6 && h < 12) return "Matin";
      if (h >= 12 && h < 18) return "Après-midi";
      if (h >= 18 && h < 23) return "Soir";
      return "Nuit";
    };
    return detections
      .map((d) => ({ ...d, period: periodOf(new Date(d.timestamp)) }))
      .filter((d) => filterPeriod === "all" || d.period === filterPeriod);
  }, [detections, filterPeriod]);

  if (authLoading) {
    return <main className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Chargement…</main>;
  }
  if (!user) {
    return (
      <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
        <header className="grid grid-cols-3 items-center mb-6">
          <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
            <ChevronLeft size={18} /> Accueil
          </Link>
          <h1 className="text-base font-display font-semibold text-center">Tableau de bord pro</h1>
          <span />
        </header>
        <section className="glass-panel p-5 text-center">
          <Building2 size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-display mb-2">Réservé aux comptes connectés</p>
          <p className="text-xs text-muted-foreground mb-4">Le tableau de bord pro gère plusieurs sites/clients — il nécessite un compte.</p>
          <Link to="/account" className="btn-primary inline-block text-sm">Se connecter</Link>
        </section>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-4">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Tableau de bord pro</h1>
        <span />
      </header>

      <div className="flex gap-1 mb-4 glass-panel p-1 text-[11px] overflow-x-auto no-scrollbar">
        {([
          { key: "sites", label: "Sites", Icon: Building2 },
          { key: "zones", label: "Zones", Icon: MapPin },
          { key: "alertes", label: "Alertes", Icon: Bell },
          { key: "rapports", label: "Rapports", Icon: FileText },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-1.5 rounded-md transition font-display flex items-center justify-center gap-1 whitespace-nowrap px-2"
            style={{ background: tab === t.key ? "var(--teal)" : "transparent", color: tab === t.key ? "#0A0F1E" : "var(--muted-foreground)" }}
          >
            <t.Icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "sites" && (
        loadingSites ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Chargement…</div>
        ) : (
          <SitesTab
            sites={siteViews}
            selectedSiteId={selectedSiteId}
            setSelectedSiteId={setSelectedSiteId}
            currentSite={currentSiteView}
            timeline={timelineItems}
            onAddSite={() => setShowAddSite(true)}
            onExportClient={() => setShowExport(true)}
          />
        )
      )}

      {tab === "zones" && (
        !selectedSiteId ? (
          <p className="text-center text-xs text-muted-foreground py-10">Sélectionne d'abord un site dans l'onglet Sites.</p>
        ) : (
          <ZonesTab
            zones={zoneViews}
            selectedZone={selectedZoneView}
            setSelectedZone={(z) => setSelectedZoneId(z?.id ?? null)}
            onToggleTrap={toggleTrap}
            onAddZone={(x, y) => { setPendingZonePos({ x, y }); setShowAddZone(true); }}
            onDeleteZone={deleteZone}
          />
        )
      )}

      {tab === "alertes" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
            {["all", "Matin", "Après-midi", "Soir", "Nuit"].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPeriod(p)}
                className="shrink-0 text-[11px] px-3 py-1 rounded-full border transition"
                style={{
                  background: filterPeriod === p ? "var(--teal)" : "transparent",
                  color: filterPeriod === p ? "#0A0F1E" : "var(--muted-foreground)",
                  borderColor: filterPeriod === p ? "var(--teal)" : "rgba(255,255,255,0.1)",
                }}
              >
                {p === "all" ? "Toute la journée" : p}
              </button>
            ))}
          </div>
          {enrichedAlerts.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">Aucune détection pour ce filtre.</p>
          ) : (
            <ul className="space-y-2">
              {enrichedAlerts.slice(0, 30).map((a) => (
                <li key={a.id} className="glass-panel p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-display text-sm">{a.speciesHint || "Non identifié"}</div>
                      <div className="text-[10px] text-muted-foreground">{a.period} · {a.estimatedZone.surfaceLabel}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-x text-sm text-teal">{a.confidence}%</div>
                      <div className="text-[9px] text-muted-foreground">{Math.round(a.dominantFrequency)} Hz</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "rapports" && (
        !selectedSiteId ? (
          <p className="text-center text-xs text-muted-foreground py-10">Sélectionne d'abord un site dans l'onglet Sites.</p>
        ) : (
          <>
            <section className="glass-panel p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-display">Journal d'interventions</span>
                <button onClick={() => setShowAddIntervention(true)} className="text-teal text-xs flex items-center gap-1">
                  + Ajouter
                </button>
              </div>
              {interventionRows.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Aucune intervention enregistrée.</p>
              ) : (
                <ul className="space-y-2">
                  {interventionRows.map((it) => (
                    <li key={it.id} className="text-xs border-l-2 pl-3" style={{ borderColor: "rgba(0,229,195,0.4)" }}>
                      <div className="font-display">{it.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(it.created_at).toLocaleString("fr-FR")} {it.operator ? `· ${it.operator}` : ""}
                      </div>
                      {it.description && <div className="text-[11px] text-muted-foreground mt-0.5">{it.description}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <button onClick={() => setShowExport(true)} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
              <FileText size={15} /> Générer le rapport d'intervention
            </button>
          </>
        )
      )}

      {/* Modals */}
      {showAddSite && <AddSiteModal onClose={() => setShowAddSite(false)} onSubmit={addSite} />}
      {showAddZone && (
        <AddZoneModal
          onClose={() => { setShowAddZone(false); setPendingZonePos(null); }}
          onSubmit={addZone}
        />
      )}
      {showAddIntervention && <AddInterventionModal onClose={() => setShowAddIntervention(false)} onSubmit={addIntervention} />}
      {showExport && currentSiteView && (
        <ExportReportModal
          site={currentSiteView}
          zones={zoneViews}
          interventions={interventionRows}
          detections={detections}
          exporting={exporting}
          setExporting={setExporting}
          onClose={() => setShowExport(false)}
        />
      )}

      <BottomNav />
    </main>
  );
}

// ─── Modals (unchanged in spirit from lot 5, kept inline for now — will
//     move to their own files in Phase 2c alongside the Gemini-styled
//     AddDeviceModal/ExportModal/OnboardingWizard rework) ──────────────────

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="glass-panel w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function AddSiteModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: { name: string; client_name: string; address: string; lat: string; lng: string }) => void }) {
  const [form, setForm] = useState({ name: "", client_name: "", address: "", lat: "", lng: "" });
  return (
    <ModalShell onClose={onClose}>
      <h3 className="font-display text-sm mb-3">Nouveau site</h3>
      <div className="space-y-2 text-xs">
        <input placeholder="Nom du site" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <input placeholder="Nom du client (optionnel)" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <input placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Latitude" type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
          <input placeholder="Longitude" type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        </div>
        <p className="text-[10px] text-muted-foreground">Les coordonnées GPS activent le score de risque basé sur la météo réelle du site.</p>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="btn-ghost flex-1 text-xs">Annuler</button>
        <button onClick={() => onSubmit(form)} disabled={!form.name} className="btn-primary flex-1 text-xs">Créer</button>
      </div>
    </ModalShell>
  );
}

function AddZoneModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: { name: string; risk_level: RiskLevel; risk_factor: string; recommendation: string }) => void }) {
  const [form, setForm] = useState<{ name: string; risk_level: RiskLevel; risk_factor: string; recommendation: string }>({
    name: "", risk_level: "modere", risk_factor: "", recommendation: "",
  });
  return (
    <ModalShell onClose={onClose}>
      <h3 className="font-display text-sm mb-3">Nouvelle zone</h3>
      <div className="space-y-2 text-xs">
        <input placeholder="Nom de la zone" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <select value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value as RiskLevel })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <option value="critique">Critique</option>
          <option value="eleve">Élevé</option>
          <option value="modere">Modéré</option>
          <option value="faible">Faible</option>
        </select>
        <input placeholder="Facteur de risque (ex: eau stagnante)" value={form.risk_factor} onChange={(e) => setForm({ ...form, risk_factor: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <textarea placeholder="Recommandation" value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} rows={2} />
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="btn-ghost flex-1 text-xs">Annuler</button>
        <button onClick={() => onSubmit(form)} disabled={!form.name} className="btn-primary flex-1 text-xs">Ajouter</button>
      </div>
    </ModalShell>
  );
}

function AddInterventionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: { type: ProInterventionRow["type"]; title: string; description: string; operator: string }) => void }) {
  const [form, setForm] = useState<{ type: ProInterventionRow["type"]; title: string; description: string; operator: string }>({
    type: "treatment", title: "", description: "", operator: "",
  });
  return (
    <ModalShell onClose={onClose}>
      <h3 className="font-display text-sm mb-3">Nouvelle intervention</h3>
      <div className="space-y-2 text-xs">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProInterventionRow["type"] })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <option value="treatment">Traitement</option>
          <option value="inspection">Inspection</option>
          <option value="sensor">Capteur</option>
          <option value="note">Note</option>
        </select>
        <input placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} rows={2} />
        <input placeholder="Opérateur (ton nom)" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="btn-ghost flex-1 text-xs">Annuler</button>
        <button onClick={() => onSubmit(form)} disabled={!form.title} className="btn-primary flex-1 text-xs">Enregistrer</button>
      </div>
    </ModalShell>
  );
}

function ExportReportModal({
  site, zones, interventions, detections, exporting, setExporting, onClose,
}: {
  site: SiteView; zones: ZoneView[]; interventions: ProInterventionRow[]; detections: DetectionEvent[];
  exporting: boolean; setExporting: (v: boolean) => void; onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  const recentDetections = detections.filter((d) => Date.now() - new Date(d.timestamp).getTime() < 30 * 24 * 3600 * 1000);

  useEffect(() => {
    setExporting(true);
    const t = setTimeout(() => { setExporting(false); setReady(true); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalShell onClose={onClose}>
      {exporting ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-teal mx-auto animate-spin mb-3" />
          <p className="text-xs text-muted-foreground">Compilation du rapport…</p>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-display text-sm flex items-center gap-2"><ShieldAlert size={15} className="text-teal" /> Rapport d'intervention</h3>
            <button onClick={onClose}><X size={15} className="text-muted-foreground" /></button>
          </div>
          <div className="bg-black/20 rounded-lg p-3 text-[11px] font-mono-x space-y-1.5">
            <div className="text-center border-b border-dashed border-white/10 pb-2 mb-2">
              <div className="font-bold uppercase">Rapport d'intervention — MosquitoRadar</div>
              <div className="text-[9px] text-muted-foreground">Document généré, à valider par un professionnel — ne constitue pas un certificat de conformité sanitaire</div>
            </div>
            <div><strong>Site :</strong> {site.name}</div>
            {site.clientName && <div><strong>Client :</strong> {site.clientName}</div>}
            <div><strong>Date :</strong> {new Date().toLocaleDateString("fr-FR")}</div>
            <div><strong>Score de risque (indicatif) :</strong> {site.riskScore}/100</div>
            <div><strong>Score de santé du site :</strong> {site.healthScore}/100</div>
            {site.weather && <div><strong>Météo au moment du rapport :</strong> {site.weather.temperatureC.toFixed(0)}°C, {site.weather.humidityPercent.toFixed(0)}% humidité</div>}
            <div><strong>Détections (30 derniers jours) :</strong> {recentDetections.length}</div>
            <div><strong>Zones à risque suivies :</strong> {zones.length}</div>
            <div><strong>Interventions enregistrées :</strong> {interventions.length}</div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => window.print()} className="btn-ghost flex-1 text-xs flex items-center justify-center gap-1.5"><Printer size={13} /> Imprimer / PDF</button>
            <button onClick={onClose} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5"><Check size={13} /> Fermer</button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
