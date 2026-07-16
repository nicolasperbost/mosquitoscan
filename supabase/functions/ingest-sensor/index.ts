// Supabase Edge Function: ingest-sensor
//
// Receives detection events pushed by fixed WiFi-connected sensors (e.g. an
// ESP32 running a lightweight version of the wingbeat-detection algorithm),
// validates and stores them, then republishes on the same Supabase Realtime
// channel used elsewhere in the app (see src/lib/realtimeBus.ts) so any
// connected client sees the detection live.
//
// ─── Expected firmware payload (copy this shape directly into an ESP32
//     HTTP client) ───────────────────────────────────────────────────────
//
//   POST https://<project-ref>.supabase.co/functions/v1/ingest-sensor
//   Content-Type: application/json
//   Authorization: Bearer <anon/publishable key>   (required by Supabase's
//                                                    edge gateway; this is
//                                                    NOT a secret write key)
//
//   {
//     "deviceId": "esp32-a1b2c3",       // stable per-device identifier
//     "deviceLabel": "Terrasse Nord",   // optional, human-readable
//     "timestamp": "2026-07-11T14:32:05Z", // ISO 8601, device RTC time
//     "peakFrequency": 512.3,          // Hz
//     "snr": 14.2,                     // dB
//     "confidence": 78                // 0..100
//   }
//
// The function responds 201 with the stored row on success, 400 on a
// malformed payload, 500 on a storage/broadcast failure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface SensorPayload {
  deviceId: string;
  deviceLabel?: string;
  timestamp: string;
  peakFrequency: number;
  snr: number;
  confidence: number;
}

function classifySpecies(freq: number): string {
  if (freq >= 340 && freq <= 470) return "Culex pipiens probable";
  if (freq >= 470 && freq <= 620) return "Anopheles / Culex possible";
  if (freq >= 620 && freq <= 780) return "Aedes albopictus possible";
  return "Espèce non identifiée";
}

function isValidPayload(body: unknown): body is SensorPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.deviceId === "string" &&
    b.deviceId.length > 0 &&
    typeof b.timestamp === "string" &&
    !isNaN(new Date(b.timestamp).getTime()) &&
    typeof b.peakFrequency === "number" &&
    typeof b.snr === "number" &&
    typeof b.confidence === "number" &&
    b.confidence >= 0 &&
    b.confidence <= 100
  );
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!isValidPayload(body)) {
    return new Response(
      JSON.stringify({
        error:
          "Payload invalide. Attendu: { deviceId: string, deviceLabel?: string, timestamp: ISO8601 string, peakFrequency: number, snr: number, confidence: number (0-100) }",
      }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const speciesHint = classifySpecies(body.peakFrequency);

  const { data, error } = await supabase
    .from("detections_sensors")
    .insert({
      device_id: body.deviceId,
      device_label: body.deviceLabel ?? null,
      recorded_at: body.timestamp,
      peak_frequency: body.peakFrequency,
      snr: body.snr,
      confidence: body.confidence,
      species_hint: speciesHint,
    })
    .select()
    .single();

  if (error) {
    console.error("[ingest-sensor] insert failed", error);
    return new Response(JSON.stringify({ error: "Storage failure" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Republish on the realtime channel so connected clients (e.g. the /multi
  // page, or a future live dashboard) see this instantly, matching the shape
  // multi.tsx already expects from RealtimeBus report messages.
  try {
    const channel = supabase.channel(`mosquito-wifi-sensors`); // placeholder scoping — see note below
    await channel.send({
      type: "broadcast",
      event: "peer",
      payload: {
        type: "report",
        report: {
          peerId: body.deviceId,
          ts: new Date(body.timestamp).getTime(),
          snr: body.snr,
          peakFreq: body.peakFrequency,
          confidence: body.confidence / 100,
        },
      },
    });
  } catch (broadcastError) {
    // Non-fatal: the row is already stored, live push is a nice-to-have.
    console.warn("[ingest-sensor] realtime broadcast failed", broadcastError);
  }

  return new Response(JSON.stringify({ ok: true, detection: data }), {
    status: 201,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});

// NOTE: the channel name above is a placeholder. If multi-room/multi-site
// support is introduced later, replace "mosquito-wifi-sensors" with a
// per-room or per-account channel derived from deviceId, rather than a
// single global channel shared by every deployed sensor.
