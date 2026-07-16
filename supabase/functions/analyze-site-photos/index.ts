// Supabase Edge Function: analyze-site-photos
//
// Receives 1..N base64-encoded images from the /expertise page and asks a
// vision-capable model (via Lovable AI Gateway — Gemini 2.5 Flash by
// default; no external API key required) to identify potential mosquito
// breeding sites: stagnant water, saucers, gutters, tyres, tarps, watering
// cans, etc. Returns strict JSON for each image.
//
// Every successful (or failed) request is logged to public.analysis_calls
// with the number of images processed, so we can track paid-API usage.
//
// This function stays intentionally isolated from other app code — swap the
// model or provider by editing GATEWAY_URL / MODEL constants below without
// touching the client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

interface ImagePayload {
  /** data:image/jpeg;base64,... or plain base64 */
  dataUrl: string;
  filename?: string;
}
interface RequestBody {
  images: ImagePayload[];
  context?: string; // free-text: "jardin", "camping bord de piscine", etc.
}

interface Zone {
  label: string;
  riskLevel: "low" | "medium" | "high";
  description: string;
  boundingBoxApprox?: { x: number; y: number; w: number; h: number };
}
interface ImageResult {
  filename?: string;
  zones: Zone[];
  overallRisk: "low" | "medium" | "high";
  summary: string;
  error?: string;
}

const SYSTEM_PROMPT = `Tu es un expert en lutte anti-vectorielle spécialisé dans la détection visuelle de gîtes larvaires de moustiques.
On te fournit une photo d'une propriété (jardin, extérieur d'hôtel, camping, etc.).
Ta mission : repérer les zones à risque de gîte larvaire (eau stagnante, coupelles de pots, gouttières, pneus usagés, bâches plissées, arrosoirs, seaux, bidons, vases, piscines non entretenues, flaques persistantes, etc.) ET les zones à surveiller (végétation dense, zones humides sans eau visible, points bas du terrain).
Tu retournes UNIQUEMENT un JSON strict conforme à ce schéma, sans texte avant ou après :
{
  "zones": [
    { "label": "string court FR", "riskLevel": "low"|"medium"|"high", "description": "1-2 phrases FR expliquant le risque", "boundingBoxApprox": { "x": 0..1, "y": 0..1, "w": 0..1, "h": 0..1 } }
  ],
  "overallRisk": "low"|"medium"|"high",
  "summary": "1 phrase FR résumant l'état"
}
Si aucune zone à risque n'est visible, retourne un tableau zones vide, overallRisk "low", et un summary neutre.
Ne diagnostique pas d'espèce ni de maladie. Ne propose pas de traitement chimique. Reste factuel.`;

async function analyzeOne(image: ImagePayload, extraContext: string, apiKey: string): Promise<ImageResult> {
  const dataUrl = image.dataUrl.startsWith("data:") ? image.dataUrl : `data:image/jpeg;base64,${image.dataUrl}`;
  const userText = extraContext
    ? `Contexte fourni par l'utilisateur : ${extraContext}. Analyse cette photo.`
    : "Analyse cette photo.";
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { filename: image.filename, zones: [], overallRisk: "low", summary: "", error: `AI gateway ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "";
  let parsed: { zones?: Zone[]; overallRisk?: ImageResult["overallRisk"]; summary?: string } = {};
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return { filename: image.filename, zones: [], overallRisk: "low", summary: "", error: "Réponse non JSON" };
  }
  return {
    filename: image.filename,
    zones: Array.isArray(parsed.zones) ? parsed.zones : [],
    overallRisk: parsed.overallRisk ?? "low",
    summary: parsed.summary ?? "",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!body?.images?.length) {
    return new Response(JSON.stringify({ error: "no images" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!apiKey) {
    await supabase.from("analysis_calls").insert({ image_count: body.images.length, status: "error", error: "missing LOVABLE_API_KEY" });
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: ImageResult[] = [];
  for (const img of body.images.slice(0, 8)) {
    try {
      results.push(await analyzeOne(img, body.context ?? "", apiKey));
    } catch (e) {
      results.push({ filename: img.filename, zones: [], overallRisk: "low", summary: "", error: e instanceof Error ? e.message : String(e) });
    }
  }
  const anyError = results.some((r) => r.error);
  await supabase.from("analysis_calls").insert({
    image_count: body.images.length,
    status: anyError ? "partial" : "success",
    error: anyError ? results.filter((r) => r.error).map((r) => r.error).join(" | ").slice(0, 500) : null,
  });

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});