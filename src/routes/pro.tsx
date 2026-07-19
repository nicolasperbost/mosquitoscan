import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import {
  ChevronLeft, Building2, MapPin, Bell, FileText, Plus, Thermometer, Droplets,
  ShieldAlert, Check, X, Printer, Loader2, Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoomStore } from "@/lib/roomStore";
import { supabase } from "@/integrations/supabase/client";
import { categoryFromSpeciesHint } from "@/lib/spectralAnalysis";
import { fetchCurrentWeather, computeRiskScore, computeHealthScore, riskLevelFromScore, type WeatherSnapshot } from "@/lib/weather";
import type { DetectionEvent } from "@/types/room";
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

// ─── Types (mirrors the pro_* tables) ──────────────────────────────────────
interface ProSite {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  active_traps: number;
  last_inspection: string | null;
}

interface ProZone {
  id: string;
  site_id: string;
  name: string;
  risk_level: "critique" | "eleve" | "modere" | "faible";
  risk_factor: string | null;
  recommendation: string | null;
  trap_installed: boolean;
}

interface ProIntervention {
  id: string;
  site_id: string;
  type: "treatment" | "inspection" | "sensor" | "note";
  title: string;
  description: string | null;
  operator: string | null;
  created_at: string;
}

const RISK_META: Record<ProZone["risk_level"], { label: string; color: string }> = {
  critique: { label: "Critique", color: "var(--red)" },
  eleve: { label: "Élevé", color: "#f59e0b" },
  modere: { label: "Modéré", color: "var(--amber)" },
  faible: { label: "Faible", color: "var(--teal)" },
};

function periodFromDate(d: Date): "Matin" | "Après-midi" | "Soir" | "Nuit" {
  const h = d.getHours();
  if (h >= 6 && h < 12) return "Matin";
  if (h >= 12 && h < 18) return "Après-midi";
  if (h >= 18 && h < 23) return "Soir";
  return "Nuit";
}

function relativeTimeLabel(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `Il y a ${days} j`;
}

function ProDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const detections = useRoomStore((s) => s.detections);

  const [tab, setTab] = useState<"sites" | "zones" | "alertes" | "rapports">("sites");
  const [sites, setSites] = useState<ProSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [zones, setZones] = useState<ProZone[]>([]);
  const [interventions, setInterventions] = useState<ProIntervention[]>([]);
  const [weatherBySite, setWeatherBySite] = useState<Record<string, WeatherSnapshot | null>>({});
  const [loadingSites, setLoadingSites] = useState(false);

  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null;

  // ─── Data loading ─────────────────────────────────────────────────────
  const loadSites = async () => {
    if (!user) return;
    setLoadingSites(true);
    const { data, error } = await supabase.from("pro_sites").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Échec du chargement des sites : " + error.message);
    setSites(data ?? []);
    if (!selectedSiteId && data && data.length > 0) setSelectedSiteId(data[0].id);
    setLoadingSites(false);
  };

  useEffect(() => {
    if (user) loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!selectedSiteId) return;
    supabase
      .from("pro_zones")
      .select("*")
      .eq("site_id", selectedSiteId)
      .then(({ data, error }) => {
        if (error) toast.error("Échec du chargement des zones : " + error.message);
        setZones(data ?? []);
      });
    supabase
      .from("pro_interventions")
      .select("*")
      .eq("site_id", selectedSiteId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Échec du chargement des interventions : " + error.message);
        setInterventions(data ?? []);
      });
  }, [selectedSiteId]);

  // Fetch real weather once per site that has coordinates
  useEffect(() => {
    for (const site of sites) {
      if (site.lat == null || site.lng == null) continue;
      if (weatherBySite[site.id] !== undefined) continue;
      fetchCurrentWeather(site.lat, site.lng).then((w) => {
        setWeatherBySite((prev) => ({ ...prev, [site.id]: w }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites]);

  // ─── Real risk/health score per site ─────────────────────────────────
  const recentHighConfidenceCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return detections.filter((d) => d.confidence > 70 && new Date(d.timestamp).getTime() > weekAgo).length;
  }, [detections]);

  const scoreForSite = (site: ProSite) => {
    const weather = weatherBySite[site.id] ?? null;
    const risk = computeRiskScore(weather, recentHighConfidenceCount);
    const health = computeHealthScore(risk);
    return { risk, health, weather };
  };

  // ─── Mutations ─────────────────────────────────────────────────────────
  const addSite = async (form: { name: string; client_name: string; address: string; lat: string; lng: string }) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("pro_sites")
      .insert({
        user_id: user.id,
        name: form.name,
        client_name: form.client_name || null,
        address: form.address || null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      })
      .select()
      .single();
    if (error) {
      toast.error("Échec de la création : " + error.message);
      return;
    }
    setSites((prev) => [data, ...prev]);
    setSelectedSiteId(data.id);
    setShowAddSite(false);
    toast.success("Site créé");
  };

  const addZone = async (form: { name: string; risk_level: ProZone["risk_level"]; risk_factor: string; recommendation: string; trap_installed: boolean }) => {
    if (!user || !selectedSiteId) return;
    const { data, error } = await supabase
      .from("pro_zones")
      .insert({ user_id: user.id, site_id: selectedSiteId, ...form })
      .select()
      .single();
    if (error) {
      toast.error("Échec de la création : " + error.message);
      return;
    }
    setZones((prev) => [data, ...prev]);
    setShowAddZone(false);
    toast.success("Zone ajoutée");
  };

  const deleteZone = async (id: string) => {
    const { error } = await supabase.from("pro_zones").delete().eq("id", id);
    if (error) {
      toast.error("Échec de la suppression : " + error.message);
      return;
    }
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  const addIntervention = async (form: { type: ProIntervention["type"]; title: string; description: string; operator: string }) => {
    if (!user || !selectedSiteId) return;
    const { data, error } = await supabase
      .from("pro_interventions")
      .insert({ user_id: user.id, site_id: selectedSiteId, ...form })
      .select()
      .single();
    if (error) {
      toast.error("Échec de l'ajout : " + error.message);
      return;
    }
    setInterventions((prev) => [data, ...prev]);
    setShowAddIntervention(false);
    toast.success("Intervention enregistrée");
  };

  // ─── Alerts (real DetectionEvent feed, enriched) ──────────────────────
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const enrichedAlerts = useMemo(() => {
    return detections
      .map((d) => ({
        ...d,
        period: periodFromDate(new Date(d.timestamp)),
        relativeLabel: relativeTimeLabel(new Date(d.timestamp)),
        category: categoryFromSpeciesHint(d.speciesHint),
      }))
      .filter((d) => filterPeriod === "all" || d.period === filterPeriod)
      .filter((d) => filterCategory === "all" || d.category === filterCategory);
  }, [detections, filterPeriod, filterCategory]);

  // ─── Not signed in: this dashboard is inherently account-based ───────
  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Chargement…
      </main>
    );
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
          <p className="text-xs text-muted-foreground mb-4">
            Le tableau de bord pro gère plusieurs sites/clients — il nécessite un compte pour associer les données à toi.
          </p>
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

      {/* Tabs */}
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
            style={{
              background: tab === t.key ? "var(--teal)" : "transparent",
              color: tab === t.key ? "#0A0F1E" : "var(--muted-foreground)",
            }}
          >
            <t.Icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── SITES TAB ─── */}
      {tab === "sites" && (
        <>
          <button onClick={() => setShowAddSite(true)} className="btn-primary w-full mb-3 flex items-center justify-center gap-2 text-sm">
            <Plus size={15} /> Nouveau site
          </button>
          {loadingSites ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Chargement…</div>
          ) : sites.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">Aucun site — crée le premier ci-dessus.</p>
          ) : (
            <ul className="space-y-2">
              {sites.map((site) => {
                const { risk, health, weather } = scoreForSite(site);
                const isSelected = site.id === selectedSiteId;
                return (
                  <li
                    key={site.id}
                    onClick={() => setSelectedSiteId(site.id)}
                    className="glass-panel p-4 cursor-pointer"
                    style={isSelected ? { borderColor: "var(--teal)" } : undefined}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-display text-sm">{site.name}</div>
                        {site.client_name && <div className="text-[11px] text-muted-foreground">{site.client_name}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-mono-x text-lg" style={{ color: RISK_META[riskLevelFromScore(risk)].color }}>
                          {risk}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase">Risque</div>
                      </div>
                    </div>
                    {site.address && <div className="text-[11px] text-muted-foreground mb-2">{site.address}</div>}
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span>Santé du site : {health}/100</span>
                      {weather && (
                        <span className="flex items-center gap-2">
                          <Thermometer size={10} /> {weather.temperatureC.toFixed(0)}°C
                          <Droplets size={10} /> {weather.humidityPercent.toFixed(0)}%
                        </span>
                      )}
                      {!weather && site.lat == null && <span>Ajoute des coordonnées GPS pour la météo réelle</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* ─── ZONES TAB ─── */}
      {tab === "zones" && (
        <>
          {!selectedSite ? (
            <p className="text-center text-xs text-muted-foreground py-10">Sélectionne d'abord un site dans l'onglet Sites.</p>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground mb-3">Zones de <strong className="text-foreground">{selectedSite.name}</strong></div>
              <button onClick={() => setShowAddZone(true)} className="btn-primary w-full mb-3 flex items-center justify-center gap-2 text-sm">
                <Plus size={15} /> Nouvelle zone
              </button>
              {zones.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-10">Aucune zone enregistrée pour ce site.</p>
              ) : (
                <ul className="space-y-2">
                  {zones.map((z) => (
                    <li key={z.id} className="glass-panel p-3" style={{ borderLeft: `3px solid ${RISK_META[z.risk_level].color}` }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-display text-sm">{z.name}</div>
                          {z.risk_factor && <div className="text-[11px] text-muted-foreground">{z.risk_factor}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${RISK_META[z.risk_level].color}22`, color: RISK_META[z.risk_level].color }}>
                            {RISK_META[z.risk_level].label}
                          </span>
                          <button onClick={() => deleteZone(z.id)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {z.recommendation && <p className="text-[11px] text-muted-foreground mt-1.5">{z.recommendation}</p>}
                      <div className="text-[10px] mt-1.5" style={{ color: z.trap_installed ? "var(--teal)" : "var(--muted-foreground)" }}>
                        {z.trap_installed ? "✓ Piège installé" : "Pas de piège installé"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {/* ─── ALERTES TAB ─── */}
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
                      <div className="text-[10px] text-muted-foreground">{a.relativeLabel} · {a.period} · {a.estimatedZone.surfaceLabel}</div>
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

      {/* ─── RAPPORTS TAB ─── */}
      {tab === "rapports" && (
        <>
          {!selectedSite ? (
            <p className="text-center text-xs text-muted-foreground py-10">Sélectionne d'abord un site dans l'onglet Sites.</p>
          ) : (
            <>
              <section className="glass-panel p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-display">Journal d'interventions</span>
                  <button onClick={() => setShowAddIntervention(true)} className="text-teal text-xs flex items-center gap-1">
                    <Plus size={13} /> Ajouter
                  </button>
                </div>
                {interventions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucune intervention enregistrée.</p>
                ) : (
                  <ul className="space-y-2">
                    {interventions.map((it) => (
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
          )}
        </>
      )}

      {/* ─── Modals ─── */}
      {showAddSite && (
        <AddSiteModal onClose={() => setShowAddSite(false)} onSubmit={addSite} />
      )}
      {showAddZone && selectedSiteId && (
        <AddZoneModal onClose={() => setShowAddZone(false)} onSubmit={addZone} />
      )}
      {showAddIntervention && selectedSiteId && (
        <AddInterventionModal onClose={() => setShowAddIntervention(false)} onSubmit={addIntervention} />
      )}
      {showExport && selectedSite && (
        <ExportReportModal
          site={selectedSite}
          zones={zones}
          interventions={interventions}
          detections={detections}
          scoreForSite={scoreForSite}
          exporting={exporting}
          setExporting={setExporting}
          onClose={() => setShowExport(false)}
        />
      )}

      <BottomNav />
    </main>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div className="glass-panel w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
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

function AddZoneModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: { name: string; risk_level: ProZone["risk_level"]; risk_factor: string; recommendation: string; trap_installed: boolean }) => void }) {
  const [form, setForm] = useState<{ name: string; risk_level: ProZone["risk_level"]; risk_factor: string; recommendation: string; trap_installed: boolean }>({
    name: "", risk_level: "modere", risk_factor: "", recommendation: "", trap_installed: false,
  });
  return (
    <ModalShell onClose={onClose}>
      <h3 className="font-display text-sm mb-3">Nouvelle zone</h3>
      <div className="space-y-2 text-xs">
        <input placeholder="Nom de la zone" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <select value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value as ProZone["risk_level"] })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <option value="critique">Critique</option>
          <option value="eleve">Élevé</option>
          <option value="modere">Modéré</option>
          <option value="faible">Faible</option>
        </select>
        <input placeholder="Facteur de risque (ex: eau stagnante)" value={form.risk_factor} onChange={(e) => setForm({ ...form, risk_factor: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <textarea placeholder="Recommandation" value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }} rows={2} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.trap_installed} onChange={(e) => setForm({ ...form, trap_installed: e.target.checked })} />
          Piège déjà installé
        </label>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="btn-ghost flex-1 text-xs">Annuler</button>
        <button onClick={() => onSubmit(form)} disabled={!form.name} className="btn-primary flex-1 text-xs">Ajouter</button>
      </div>
    </ModalShell>
  );
}

function AddInterventionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: { type: ProIntervention["type"]; title: string; description: string; operator: string }) => void }) {
  const [form, setForm] = useState<{ type: ProIntervention["type"]; title: string; description: string; operator: string }>({
    type: "treatment", title: "", description: "", operator: "",
  });
  return (
    <ModalShell onClose={onClose}>
      <h3 className="font-display text-sm mb-3">Nouvelle intervention</h3>
      <div className="space-y-2 text-xs">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProIntervention["type"] })} className="w-full bg-transparent border rounded-md px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
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
  site, zones, interventions, detections, scoreForSite, exporting, setExporting, onClose,
}: {
  site: ProSite;
  zones: ProZone[];
  interventions: ProIntervention[];
  detections: DetectionEvent[];
  scoreForSite: (s: ProSite) => { risk: number; health: number; weather: WeatherSnapshot | null };
  exporting: boolean;
  setExporting: (v: boolean) => void;
  onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  const { risk, health, weather } = scoreForSite(site);
  const recentDetections = detections.filter((d) => Date.now() - new Date(d.timestamp).getTime() < 30 * 24 * 3600 * 1000);

  useEffect(() => {
    setExporting(true);
    const t = setTimeout(() => {
      setExporting(false);
      setReady(true);
    }, 900);
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
            <h3 className="font-display text-sm flex items-center gap-2">
              <ShieldAlert size={15} className="text-teal" /> Rapport d'intervention
            </h3>
            <button onClick={onClose}><X size={15} className="text-muted-foreground" /></button>
          </div>
          <div id="print-report" className="bg-black/20 rounded-lg p-3 text-[11px] font-mono-x space-y-1.5">
            <div className="text-center border-b border-dashed border-white/10 pb-2 mb-2">
              <div className="font-bold uppercase">Rapport d'intervention — MosquitoRadar</div>
              <div className="text-[9px] text-muted-foreground">Document généré, à valider par un professionnel — ne constitue pas un certificat de conformité sanitaire</div>
            </div>
            <div><strong>Site :</strong> {site.name}</div>
            {site.client_name && <div><strong>Client :</strong> {site.client_name}</div>}
            <div><strong>Date :</strong> {new Date().toLocaleDateString("fr-FR")}</div>
            <div><strong>Score de risque (indicatif) :</strong> {risk}/100</div>
            <div><strong>Score de santé du site :</strong> {health}/100</div>
            {weather && <div><strong>Météo au moment du rapport :</strong> {weather.temperatureC.toFixed(0)}°C, {weather.humidityPercent.toFixed(0)}% humidité</div>}
            <div><strong>Détections (30 derniers jours) :</strong> {recentDetections.length}</div>
            <div><strong>Zones à risque suivies :</strong> {zones.length}</div>
            <div><strong>Interventions enregistrées :</strong> {interventions.length}</div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => window.print()} className="btn-ghost flex-1 text-xs flex items-center justify-center gap-1.5">
              <Printer size={13} /> Imprimer / PDF
            </button>
            <button onClick={onClose} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5">
              <Check size={13} /> Fermer
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
