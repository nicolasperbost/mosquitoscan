import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Upload, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/expertise")({
  head: () => ({
    meta: [
      { title: "Expertise visuelle — MosquitoRadar" },
      { name: "description", content: "Repérage IA des zones à risque de gîte larvaire sur photos d'une propriété." },
    ],
  }),
  component: ExpertisePage,
});

type Risk = "low" | "medium" | "high";
interface Zone {
  label: string;
  riskLevel: Risk;
  description: string;
  boundingBoxApprox?: { x: number; y: number; w: number; h: number };
}
interface ImageResult {
  filename?: string;
  zones: Zone[];
  overallRisk: Risk;
  summary: string;
  error?: string;
}
interface Item {
  id: string;
  file: File;
  previewUrl: string;
  result?: ImageResult;
}

const RISK_COLOR: Record<Risk, string> = {
  low: "var(--teal)",
  medium: "var(--amber, #f59e0b)",
  high: "var(--red, #ef4444)",
};
const RISK_LABEL: Record<Risk, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Downscale to max 1280px before sending to keep payload small
async function downscaleImage(file: File, max = 1280): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return rej(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      res(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = rej;
    img.src = dataUrl;
  });
}

function ExpertisePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [ctx, setCtx] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Item[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      next.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
      });
    }
    setItems((prev) => [...prev, ...next].slice(0, 8));
  };

  const addVideoFrames = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = rej;
    });
    const frames = 4;
    const canvas = document.createElement("canvas");
    const w = 1280;
    const h = Math.round((1280 * video.videoHeight) / Math.max(1, video.videoWidth));
    canvas.width = w;
    canvas.height = h;
    const ctx2d = canvas.getContext("2d")!;
    const dur = video.duration || 1;
    const newItems: Item[] = [];
    for (let i = 0; i < frames; i++) {
      const t = (i / (frames - 1)) * dur * 0.95;
      await new Promise<void>((res) => {
        video.onseeked = () => res();
        video.currentTime = t;
      });
      ctx2d.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      if (blob) {
        const f = new File([blob], `video_frame_${i + 1}.jpg`, { type: "image/jpeg" });
        newItems.push({
          id: `${Date.now()}_v${i}`,
          file: f,
          previewUrl: URL.createObjectURL(f),
        });
      }
    }
    URL.revokeObjectURL(url);
    setItems((prev) => [...prev, ...newItems].slice(0, 8));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const analyze = async () => {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const images = await Promise.all(
        items.map(async (it) => ({
          filename: it.file.name,
          dataUrl: await downscaleImage(it.file),
        })),
      );
      const { data, error } = await supabase.functions.invoke("analyze-site-photos", {
        body: { images, context: ctx },
      });
      if (error) throw error;
      const results: ImageResult[] = data?.results ?? [];
      setItems((prev) =>
        prev.map((it, i) => ({ ...it, result: results[i] })),
      );
      const hasError = results.some((r) => r.error);
      if (hasError) toast.error("Analyse partielle — certaines images ont échoué");
      else toast.success(`✓ ${results.length} image(s) analysée(s)`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur d'analyse");
    } finally {
      setLoading(false);
    }
  };

  // Actionable list across all images
  const actionable = items.flatMap((it) =>
    (it.result?.zones ?? []).map((z) => ({ zone: z, filename: it.file.name })),
  );
  const toTreat = actionable.filter((a) => a.zone.riskLevel === "high" || a.zone.riskLevel === "medium");
  const toWatch = actionable.filter((a) => a.zone.riskLevel === "low");

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-4">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Expertise visuelle</h1>
        <span />
      </header>

      <div
        className="glass-panel p-3 flex items-start gap-2 mb-4"
        style={{ borderColor: "rgba(245,158,11,0.4)" }}
      >
        <AlertTriangle size={16} className="text-amber-x mt-0.5 shrink-0" style={{ color: "var(--amber, #f59e0b)" }} />
        <p className="text-[11px] leading-relaxed">
          <span className="font-semibold">Aide au repérage visuel</span> — ne remplace pas une
          inspection professionnelle et ne constitue pas un diagnostic sanitaire.
        </p>
      </div>

      <div className="glass-panel p-4 mb-4">
        <p className="text-xs text-muted-foreground mb-3">
          Importez des photos (jardin, coins d'hôtel, camping…) ou une courte vidéo pour un
          repérage automatique des zones à risque de gîte larvaire.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => addVideoFrames(e.target.files)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-primary text-xs !py-2 flex items-center justify-center gap-1"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} /> Photos
          </button>
          <button
            className="btn-primary text-xs !py-2 flex items-center justify-center gap-1"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--foreground)" }}
            onClick={() => videoRef.current?.click()}
          >
            <Upload size={14} /> Vidéo (4 vues)
          </button>
        </div>
        <textarea
          value={ctx}
          onChange={(e) => setCtx(e.target.value)}
          placeholder="Contexte (optionnel) : ex. « jardin bord de piscine, hôtel Provence »"
          rows={2}
          className="w-full mt-3 bg-transparent border rounded-md px-2 py-1.5 text-xs"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        />
        <button
          onClick={analyze}
          disabled={loading || items.length === 0}
          className="btn-primary text-sm !py-2.5 w-full mt-3 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {loading ? "Analyse en cours…" : `Analyser ${items.length} image(s)`}
        </button>
      </div>

      {items.length > 0 && (
        <ul className="space-y-3 mb-4">
          {items.map((it) => (
            <li key={it.id} className="glass-panel overflow-hidden">
              <div className="relative">
                <img src={it.previewUrl} alt={it.file.name} className="w-full h-40 object-cover" />
                <button
                  onClick={() => removeItem(it.id)}
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 text-white hover:bg-black/80"
                  aria-label="Retirer"
                >
                  <Trash2 size={12} />
                </button>
                {it.result?.zones.map((z, i) =>
                  z.boundingBoxApprox ? (
                    <div
                      key={i}
                      className="absolute border-2 rounded"
                      style={{
                        left: `${z.boundingBoxApprox.x * 100}%`,
                        top: `${z.boundingBoxApprox.y * 100}%`,
                        width: `${z.boundingBoxApprox.w * 100}%`,
                        height: `${z.boundingBoxApprox.h * 100}%`,
                        borderColor: RISK_COLOR[z.riskLevel],
                        boxShadow: `0 0 8px ${RISK_COLOR[z.riskLevel]}`,
                      }}
                    />
                  ) : null,
                )}
              </div>
              <div className="p-3">
                <div className="text-[11px] text-muted-foreground truncate">{it.file.name}</div>
                {it.result ? (
                  it.result.error ? (
                    <p className="text-xs text-red-400 mt-1">Erreur : {it.result.error}</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            background: RISK_COLOR[it.result.overallRisk] + "20",
                            color: RISK_COLOR[it.result.overallRisk],
                          }}
                        >
                          {RISK_LABEL[it.result.overallRisk]}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{it.result.summary}</span>
                      </div>
                      {it.result.zones.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {it.result.zones.map((z, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{
                                background: RISK_COLOR[z.riskLevel] + "18",
                                color: RISK_COLOR[z.riskLevel],
                              }}
                              title={z.description}
                            >
                              {z.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">En attente d'analyse.</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {actionable.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="glass-panel p-3">
            <h3 className="text-xs font-display font-semibold mb-2" style={{ color: RISK_COLOR.high }}>
              À traiter ({toTreat.length})
            </h3>
            {toTreat.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Aucune zone prioritaire.</p>
            ) : (
              <ul className="space-y-1.5">
                {toTreat.map((a, i) => (
                  <li key={i} className="text-[11px] flex gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: RISK_COLOR[a.zone.riskLevel] }}
                    />
                    <span>
                      <span className="font-semibold">{a.zone.label}</span> —{" "}
                      <span className="text-muted-foreground">{a.zone.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="glass-panel p-3">
            <h3 className="text-xs font-display font-semibold mb-2 text-teal">
              À surveiller ({toWatch.length})
            </h3>
            {toWatch.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Aucune zone à surveiller.</p>
            ) : (
              <ul className="space-y-1.5">
                {toWatch.map((a, i) => (
                  <li key={i} className="text-[11px] flex gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: RISK_COLOR.low }}
                    />
                    <span>
                      <span className="font-semibold">{a.zone.label}</span> —{" "}
                      <span className="text-muted-foreground">{a.zone.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center mb-6">
        Rappel : aide au repérage visuel, ne remplace pas une inspection professionnelle.
      </p>

      <BottomNav />
    </main>
  );
}