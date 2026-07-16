import { useRef, useState } from "react";
import { Camera, Check, RotateCcw, Video, Ruler } from "lucide-react";
import type { CapturedPhoto } from "@/hooks/useRoomAnalysis";

const SLOTS = [
  { key: "north", label: "Mur Nord", glyph: "N" },
  { key: "south", label: "Mur Sud", glyph: "S" },
  { key: "east", label: "Mur Est", glyph: "E" },
  { key: "west", label: "Mur Ouest", glyph: "O" },
  { key: "ceiling", label: "Plafond", glyph: "↑" },
  { key: "floor", label: "Sol", glyph: "↓" },
] as const;

type Key = (typeof SLOTS)[number]["key"];

interface Props {
  onComplete: (payload: {
    photos: CapturedPhoto[];
    video: File | null;
    dimensions: { width: number; length: number; height: number };
  }) => void;
}

export function PhotoCaptureWizard({ onComplete }: Props) {
  const [photos, setPhotos] = useState<Record<Key, { url: string; file: File }>>(
    {} as Record<Key, { url: string; file: File }>,
  );
  const [video, setVideo] = useState<{ url: string; file: File } | null>(null);
  const [dims, setDims] = useState({ width: 4, length: 5, height: 2.5 });
  const [showManual, setShowManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Key | null>(null);

  const open = (k: Key) => {
    pendingRef.current = k;
    inputRef.current?.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const k = pendingRef.current;
    if (!file || !k) return;
    const url = URL.createObjectURL(file);
    setPhotos((p) => ({ ...p, [k]: { url, file } }));
    pendingRef.current = null;
    e.target.value = "";
  };

  const onVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideo({ url: URL.createObjectURL(file), file });
    e.target.value = "";
  };

  const removePhoto = (k: Key) => {
    setPhotos((p) => {
      const n = { ...p };
      if (n[k]) URL.revokeObjectURL(n[k].url);
      delete n[k];
      return n;
    });
  };

  const count = Object.keys(photos).length;
  const ready = (count >= 4 || !!video) && dims.width > 0 && dims.length > 0 && dims.height > 0;

  const finish = () => {
    if (!ready) return;
    const list: CapturedPhoto[] = (Object.entries(photos) as [Key, { file: File }][]).map(
      ([face, v]) => ({ face, file: v.file }),
    );
    onComplete({ photos: list, video: video?.file ?? null, dimensions: dims });
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={onVideoFile}
        className="hidden"
      />
      <div className="grid grid-cols-2 gap-3">
        {SLOTS.map((s) => {
          const has = !!photos[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => (has ? removePhoto(s.key) : open(s.key))}
              className="relative aspect-square rounded-2xl flex flex-col items-center justify-center text-center transition"
              style={{
                border: has ? "1px solid var(--teal)" : "1.5px dashed rgba(0,229,195,0.5)",
                background: has
                  ? "linear-gradient(135deg, rgba(0,229,195,0.18), rgba(124,58,237,0.18))"
                  : "rgba(255,255,255,0.02)",
                boxShadow: has ? "0 0 14px var(--teal-glow)" : "none",
              }}
            >
              {has ? (
                <>
                  <img
                    src={photos[s.key].url}
                    alt={s.label}
                    className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-60"
                  />
                  <div className="absolute top-2 right-2 bg-[var(--green)] rounded-full p-1">
                    <Check size={12} className="text-black" />
                  </div>
                  <div className="relative font-display font-bold text-2xl text-teal">{s.glyph}</div>
                  <div className="relative text-[10px] text-foreground mt-1">{s.label}</div>
                  <div className="relative flex items-center gap-1 mt-2 text-[9px] text-teal">
                    Photo prise ✓
                  </div>
                  <div className="relative flex items-center gap-1 mt-0.5 text-[8px] text-muted-foreground">
                    <RotateCcw size={8} /> retirer
                  </div>
                </>
              ) : (
                <>
                  <Camera size={22} className="text-teal mb-2" />
                  <div className="font-display font-bold text-xl text-foreground">{s.glyph}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{s.label}</div>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-4 px-4">
        Touchez une case pour ouvrir l'appareil photo. Touchez à nouveau pour retirer.
      </p>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          className="btn-ghost w-full flex items-center justify-center gap-2 text-xs"
        >
          <Video size={14} />
          {video ? "Vidéo panoramique ajoutée ✓ — remplacer" : "Ajouter une vidéo panoramique (scan 360°)"}
        </button>
        {video && (
          <p className="text-[9px] text-muted-foreground mt-1 text-center">
            8 frames seront extraites pour reconstruire les surfaces.
          </p>
        )}
      </div>

      <div className="mt-4 glass-panel p-3">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-teal"
        >
          <span className="flex items-center gap-2"><Ruler size={13} /> Dimensions de la pièce</span>
          <span className="font-mono-x text-muted-foreground">
            {dims.width}×{dims.length}×{dims.height} m
          </span>
        </button>
        {showManual && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {(["width", "length", "height"] as const).map((k) => (
              <label key={k} className="text-[10px] text-muted-foreground">
                {k === "width" ? "Largeur" : k === "length" ? "Longueur" : "Hauteur"} (m)
                <input
                  type="number"
                  step="0.1"
                  min={k === "height" ? 2 : 1.5}
                  max={k === "height" ? 4.5 : 12}
                  value={dims[k]}
                  onChange={(e) =>
                    setDims((d) => ({ ...d, [k]: Math.max(0.5, Number(e.target.value) || 0) }))
                  }
                  className="mt-1 w-full bg-transparent border border-[rgba(0,229,195,0.3)] rounded px-2 py-1 text-teal font-mono-x text-sm"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={finish}
          disabled={!ready}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ready
            ? `Analyser (${count} photo(s)${video ? " + vidéo" : ""})`
            : `Encore ${Math.max(0, 4 - count)} photo(s) — ou ajoutez une vidéo`}
        </button>
        <button
          onClick={() => onComplete({ photos: [], video: null, dimensions: dims })}
          className="text-xs text-muted-foreground hover:text-teal transition underline-offset-2 hover:underline"
        >
          Continuer avec dimensions seules (pas d'analyse photo)
        </button>
      </div>
    </div>
  );
}