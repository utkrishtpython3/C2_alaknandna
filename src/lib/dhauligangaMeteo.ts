/**
 * ============================================================================
 *  DHAULIGANGA METEO FORECAST — TYPES & PARSER (server-side)
 * ============================================================================
 *  Ingests the Open-Meteo daily forecast file (`Dholi_ganga.json`) for the
 *  Dhauliganga headwaters (lat 30.615, lng 79.717, elev 3555m) and derives
 *  operational fields used by the FFEWS:
 *    - per-day cloudburst classification (rain_sum >= 10 mm/day)
 *    - 7-day antecedent precipitation index (API-7) → soil-moisture proxy
 *    - effective hourly rainfall intensity (mm/hr) for the EWS Rational cascade
 *
 *  Runtime: Node.js / Next.js server-side. Reads the JSON from disk.
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";

/** Raw Open-Meteo daily response shape (subset of fields we use). */
export interface OpenMeteoDailyResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  daily_units: {
    time: string;
    temperature_2m_max: string;
    temperature_2m_min: string;
    rain_sum: string;
    wind_speed_10m_max: string;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    rain_sum: number[];
    wind_speed_10m_max: number[];
  };
}

/** A single derived forecast day. */
export interface MeteoForecastDay {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Day index in the series (0-based). */
  index: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
  rain_sum_mm: number;
  wind_speed_10m_max_kmh: number;
  /** 7-day antecedent precipitation index (mm) — sum of the prior 7 days. */
  antecedent_7d_mm: number;
  /** Soil-moisture proxy (0–100%) derived from API-7 normalised to a
   *  60 mm saturation envelope. Floored at 15% (residual dry-season moisture). */
  soil_moisture_pct: number;
  /** Effective hourly rainfall intensity (mm/hr). For cloudburst days the
   *  daily total is assumed to fall in a 3-hour burst window; otherwise the
   *  total is spread uniformly over 24 h. */
  effective_intensity_mm_hr: number;
  /** True when rain_sum >= CLOUDBURST_THRESHOLD_MM. */
  is_cloudburst: boolean;
  /** Ordinal severity of the day: dry / wet / heavy / cloudburst. */
  severity: "dry" | "wet" | "heavy" | "cloudburst";
}

export interface DhauligangaMeteo {
  source: "Open-Meteo";
  station: {
    name: string;
    latitude: number;
    longitude: number;
    elevation_m: number;
  };
  generated_at: string;
  timezone: string;
  window: {
    first_date: string;
    last_date: string;
    days: number;
  };
  totals: {
    rain_sum_mm: number;
    cloudburst_days: number;
    max_daily_rain_mm: number;
    max_daily_rain_date: string;
    mean_temp_max_c: number;
    max_wind_kmh: number;
  };
  days: MeteoForecastDay[];
}

const CLOUDBURST_THRESHOLD_MM = 10;
const HEAVY_THRESHOLD_MM = 5;
const WET_THRESHOLD_MM = 1;
const SATURATION_ENVELOPE_MM = 60;
const MIN_MOISTURE_PCT = 15;

const METEO_FILE = path.join(
  process.cwd(),
  "src",
  "data",
  "Dholi_ganga.json"
);

let _raw: OpenMeteoDailyResponse | null = null;

/** Loads & caches the raw Open-Meteo response from disk. */
export function loadDhauligangaMeteoRaw(): OpenMeteoDailyResponse {
  if (_raw) return _raw;
  const text = fs.readFileSync(METEO_FILE, "utf8");
  _raw = JSON.parse(text) as OpenMeteoDailyResponse;
  return _raw;
}

/**
 * Parses the raw Open-Meteo response into operational `MeteoForecastDay`s
 * with antecedent-moisture and effective-intensity derivations.
 */
export function parseDhauligangaMeteo(): DhauligangaMeteo {
  const raw = loadDhauligangaMeteoRaw();
  const times = raw.daily.time;
  const rain = raw.daily.rain_sum;
  const tMax = raw.daily.temperature_2m_max;
  const tMin = raw.daily.temperature_2m_min;
  const wind = raw.daily.wind_speed_10m_max;

  const days: MeteoForecastDay[] = times.map((date, i) => {
    // 7-day antecedent precipitation index (sum of prior 7 days' rain).
    let antecedent = 0;
    for (let j = Math.max(0, i - 7); j < i; j++) antecedent += rain[j];

    // Soil-moisture proxy: normalise API-7 to the saturation envelope.
    const moisturePct = Math.max(
      MIN_MOISTURE_PCT,
      Math.min(100, (antecedent / SATURATION_ENVELOPE_MM) * 100)
    );

    const dayRain = rain[i];
    // Effective intensity: cloudburst days concentrate the daily total in a
    // 1-hour convective burst window (orographic cloudburst cells typically
    // dump the day's moisture in 30–90 min); other days spread it uniformly
    // over 24 h. The 1-hour burst produces realistic mm/hr intensities that
    // interact meaningfully with the EWS dynamic FFG thresholds, especially
    // on high-antecedent-moisture days where the threshold collapses.
    const burstHours = dayRain >= CLOUDBURST_THRESHOLD_MM ? 1 : 24;
    const effectiveIntensity = dayRain / burstHours;

    const isCloudburst = dayRain >= CLOUDBURST_THRESHOLD_MM;
    const severity: MeteoForecastDay["severity"] = isCloudburst
      ? "cloudburst"
      : dayRain >= HEAVY_THRESHOLD_MM
        ? "heavy"
        : dayRain >= WET_THRESHOLD_MM
          ? "wet"
          : "dry";

    return {
      date,
      index: i,
      temperature_2m_max: tMax[i],
      temperature_2m_min: tMin[i],
      rain_sum_mm: dayRain,
      wind_speed_10m_max_kmh: wind[i],
      antecedent_7d_mm: Math.round(antecedent * 10) / 10,
      soil_moisture_pct: Math.round(moisturePct),
      effective_intensity_mm_hr: Math.round(effectiveIntensity * 100) / 100,
      is_cloudburst: isCloudburst,
      severity,
    };
  });

  const totalRain = rain.reduce((a, b) => a + b, 0);
  const cbDays = days.filter((d) => d.is_cloudburst).length;
  const maxRain = Math.max(...rain);
  const maxRainDate = times[rain.indexOf(maxRain)];
  const meanTmax =
    tMax.reduce((a, b) => a + b, 0) / tMax.length;
  const maxWind = Math.max(...wind);

  return {
    source: "Open-Meteo",
    station: {
      name: "Dhauliganga Headwaters (Auli Ridge AWS)",
      latitude: raw.latitude,
      longitude: raw.longitude,
      elevation_m: raw.elevation,
    },
    generated_at: new Date().toISOString(),
    timezone: raw.timezone,
    window: {
      first_date: times[0],
      last_date: times[times.length - 1],
      days: times.length,
    },
    totals: {
      rain_sum_mm: Math.round(totalRain * 10) / 10,
      cloudburst_days: cbDays,
      max_daily_rain_mm: maxRain,
      max_daily_rain_date: maxRainDate,
      mean_temp_max_c: Math.round(meanTmax * 10) / 10,
      max_wind_kmh: maxWind,
    },
    days,
  };
}
