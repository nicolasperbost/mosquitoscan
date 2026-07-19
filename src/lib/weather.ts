// Real weather-based risk scoring — replaces the Gemini mockup's slider-
// driven fictional simulation (tempCelsius/humidityPercent as freely
// adjustable state, calculateDynamicRisk() as a made-up formula with no
// real inputs). Here, weather is fetched for real from Open-Meteo (no API
// key needed, generous free tier), and the risk formula, while still a
// heuristic rather than a validated epidemiological model, is at least
// applied to real inputs: real current weather + a real count of the
// site's active detections.
//
// IMPORTANT — be upfront about this in any UI copy: this is a rough
// indicator to help prioritize attention across sites, not a scientific
// infestation forecast. Aedes albopictus activity does correlate with
// warm, humid conditions in the literature, but this formula is not a
// calibrated model — don't let product copy imply more precision than it
// has.

export interface WeatherSnapshot {
  temperatureC: number;
  humidityPercent: number;
  fetchedAt: Date;
}

export async function fetchCurrentWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const temperatureC = data?.current?.temperature_2m;
    const humidityPercent = data?.current?.relative_humidity_2m;
    if (typeof temperatureC !== "number" || typeof humidityPercent !== "number") return null;
    return { temperatureC, humidityPercent, fetchedAt: new Date() };
  } catch (e) {
    console.warn("[weather] fetchCurrentWeather failed", e);
    return null;
  }
}

/**
 * Risk score (0-100) for a site, combining real weather with a real count
 * of recent active/high-confidence detections. Documented, simple, and
 * intentionally conservative in its claims — see file header.
 *
 * - Climate factor: Aedes albopictus activity is generally reported as
 *   highest in warm (25-32°C) and humid (>60%) conditions; this is a rough
 *   bell-shaped approximation, not a cited model.
 * - Detection factor: each recent (last 7 days) detection above 70%
 *   confidence adds weight, capped so a handful of detections doesn't
 *   saturate the score instantly.
 */
export function computeRiskScore(
  weather: WeatherSnapshot | null,
  recentHighConfidenceDetections: number,
): number {
  let climateFactor = 30; // neutral baseline if weather is unavailable
  if (weather) {
    const tempScore = Math.max(0, 1 - Math.abs(weather.temperatureC - 28) / 15); // peaks near 28°C
    const humidityScore = Math.max(0, Math.min(1, (weather.humidityPercent - 40) / 50)); // rises with humidity above 40%
    climateFactor = Math.round((tempScore * 0.6 + humidityScore * 0.4) * 60); // 0..60
  }
  const detectionFactor = Math.min(40, recentHighConfidenceDetections * 6); // 0..40
  return Math.min(100, climateFactor + detectionFactor);
}

/** Simple complementary "health score" for display — not a separate real
 *  metric, just risk inverted, kept as its own named concept because that's
 *  how the UI presents it (a positive framing next to the risk score). */
export function computeHealthScore(riskScore: number): number {
  return Math.max(0, 100 - riskScore);
}

export function riskLevelFromScore(score: number): "critique" | "eleve" | "modere" | "faible" {
  if (score >= 75) return "critique";
  if (score >= 50) return "eleve";
  if (score >= 25) return "modere";
  return "faible";
}
