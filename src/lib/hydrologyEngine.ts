/**
 * ============================================================================
 *  HYDROLOGY ENGINE  —  Upper Alaknanda–Dhauliganga Flash Flood Controller
 * ============================================================================
 *  Author : ISRO-NRSC (National Remote Sensing Centre)
 *           in coordination with IMD Hydrometeorological Directorate &
 *           NDRF Operations Directorate (Ministry of Home Affairs).
 *
 *  Purpose: Consume the operational `catchments.geojson` micro-catchment
 *  network and resolve hyper-local flash-flood / debris-flow risk vectors
 *  for the Joshimath–Vishnuprayag–Helang gorge corridor (Chamoli, UK).
 *
 *  Models implemented:
 *    1. Dynamic Green-Ampt / Flash-Flood-Guidance infiltration estimator.
 *    2. Rational-method peak discharge with a non-linear (sigmoid) runoff
 *       coefficient conditioned on antecedent soil moisture & hillslope.
 *    3. Kinematic-wave topological cascade routing (Kirpich Tc).
 *
 *  Runtime: Node.js / Next.js (server-side). No native deps. Strict TS.
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";

/* ----------------------------------------------------------------------------
 * 1. STRICT TYPE DEFINITIONS
 * ------------------------------------------------------------------------- */

export type InfrastructureType =
  | "BRIDGE"
  | "SUBSTATION"
  | "HIGHWAY_TUNNEL"
  | "HOSPITAL";

export type RiskLevel =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "EXTREME"
  | "CATACLYSMIC";

export type CatchmentRole =
  | "RUNOFF_GENERATION_DEBRIS_INITIATION"
  | "LANDSLIDE_DEBRIS_TRANSIT_SETTLEMENT_CORRIDOR"
  | "TERMINAL_HYDRAULIC_ACCUMULATION_BACKWATER_SURGE";

export interface CriticalInfrastructure {
  name: string;
  type: InfrastructureType;
  /** [longitude, latitude] — WGS84 */
  coordinates: [number, number];
  /** River / debris-stage gauge level (m) at which the asset is compromised. */
  critical_gauge_level_m: number;
}

export interface EvacuationPoint {
  shelter_id: string;
  name: string;
  elevation_m: number;
  capacity_persons: number;
  /** [longitude, latitude] — WGS84 */
  coordinates: [number, number];
  route_id: string;
}

export interface CatchmentProperties {
  // Administrative & cadastral
  ward_id: string;
  ward_name: string;
  basin_name: string;
  administrative_tehsil: string;
  risk_category: string;
  catchment_role: CatchmentRole;

  // Topographic & geomorphic
  drainage_area_sqkm: number;
  elevation_min_m: number;
  elevation_max_m: number;
  mean_slope_deg: number;
  main_channel_length_km: number;
  channel_slope_m_per_m: number;
  manning_roughness_n: number;
  time_of_concentration_min: number;

  // Geotechnical & soil hydro-physics
  geological_strata: string;
  soil_texture: string;
  saturated_hydraulic_conductivity_ksat_mm_hr: number;
  effective_porosity_fraction: number;
  suction_head_psi_mm: number;
  baseflow_recession_k: number;

  // Dynamic FFG baseline thresholds
  dry_soil_threshold_mm_1hr: number;
  saturated_soil_threshold_mm_1hr: number;

  // NDRF tactical response assets
  vulnerable_population: number;
  livestock_count: number;
  critical_infrastructure: CriticalInfrastructure[];
  designated_ndrf_evacuation_points: EvacuationPoint[];
  downstream_target_ward_id: string | null;
}

export interface CatchmentFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    /** GeoJSON polygon: array of linear rings, each ring = [lng,lat][] */
    coordinates: number[][][];
  };
  properties: CatchmentProperties;
}

export interface CatchmentCollection {
  type: "FeatureCollection";
  features: CatchmentFeature[];
  [key: string]: unknown;
}

export interface TelemetryInput {
  wardId: string;
  rainfallIntensity_mm_hr: number;
  antecedentSoilMoisturePct: number;
  /** ISO-8601 observation timestamp. */
  timestamp: string;
}

export interface FlashFloodRiskVector {
  ward_id: string;
  ward_name: string;
  risk_level: RiskLevel;
  /** Dynamic 1-hour critical rainfall threshold (mm/hr) for current soil state. */
  dynamic_threshold_mm_hr: number;
  rainfall_intensity_mm_hr: number;
  threshold_exceeded: boolean;
  /** rainfall_intensity / dynamic_threshold — drives escalation. */
  exceedance_ratio: number;
  /** Peak discharge (m³/s) at the ward outlet. */
  peak_discharge_m3_per_s: number;
  /** Local discharge generated within this ward only (m³/s). */
  local_discharge_m3_per_s: number;
  /** Discharge routed in from upstream wards (m³/s). */
  inflow_discharge_m3_per_s: number;
  /** Discharge transmitted downstream (m³/s). */
  outflow_discharge_m3_per_s: number;
  /** Lead time (min) before the cumulative peak manifests at this ward. */
  estimated_flood_arrival_min: number;
  /** Probability [0,1] of hyper-concentrated debris-flow entrainment. */
  debris_flow_probability: number;
  /** Runoff coefficient used by the Rational method. */
  runoff_coefficient_C: number;
  recommended_action: string;
  evacuation_plan: EvacuationPoint[];
  downstream_target_ward_id: string | null;
}

export interface BasinCascadeResult {
  timestamp: string;
  per_ward_risk: FlashFloodRiskVector[];
  /** Cumulative peak discharge at the terminal LOWER-basin confluence (m³/s). */
  cumulative_lower_basin_discharge_m3_per_s: number;
  /** Lead time (min) for the headwater-generated surge to reach LOWER gorge. */
  lower_basin_surge_arrival_min: number;
  /** Worst-case ordinal alert level across the basin. */
  basin_wide_alert_level: RiskLevel;
  /** Tactical deployment directive string for NDRF Operations. */
  ndrf_deployment_directive: string;
  /** Topological routing order used by the simulator. */
  routing_order: string[];
}

export interface EvacuationPlanEntry extends EvacuationPoint {
  /** Vertical safety margin above the catchment's vulnerable toe (m). */
  safe_elevation_differential_m: number;
}

/* ----------------------------------------------------------------------------
 * 2. INTERNAL UTILITIES
 * ------------------------------------------------------------------------- */

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const round = (v: number, digits = 3): number => {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
};

/** Green-Ampt explicit cumulative infiltration (mm) for a 1-hour window. */
function greenAmptOneHourInfiltration(
  ksat_mm_hr: number,
  psi_mm: number,
  dTheta: number
): number {
  if (dTheta <= 1e-6) return ksat_mm_hr; // saturated: gravity-only
  const t = 1; // hours
  const denom = psi_mm * dTheta;
  return ksat_mm_hr * t + denom * Math.log1p((ksat_mm_hr * t) / denom);
}

const RISK_ORDINAL: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  EXTREME: 3,
  CATACLYSMIC: 4,
};

function classifyRisk(exceedanceRatio: number, debrisP: number): RiskLevel {
  const r = exceedanceRatio;
  if (r >= 2.5 || debrisP >= 0.85) return "CATACLYSMIC";
  if (r >= 1.5 || debrisP >= 0.65) return "EXTREME";
  if (r >= 1.0) return "HIGH";
  if (r >= 0.6) return "MODERATE";
  return "LOW";
}

function actionFor(
  level: RiskLevel,
  wardName: string,
  arrivalMin: number
): string {
  switch (level) {
    case "CATACLYSMIC":
      return `IMMEDIATE EVACUATION of ${wardName}. NDRF column to force-march to high-ground shelters. Lead window ≈ ${Math.round(
        arrivalMin
      )} min. Pre-position swift-water rescue at confluence bridge.`;
    case "EXTREME":
      return `Issue FLASH FLOOD WARNING for ${wardName}. Begin precautionary evacuation of riverbed settlements & deactivate NH-7 traffic. Lead window ≈ ${Math.round(
        arrivalMin
      )} min.`;
    case "HIGH":
      return `Raise FLASH FLOOD WATCH for ${wardName}. Stage NDRF QRT, alert ITBP/Hospital, clear drainage culverts. Lead window ≈ ${Math.round(
        arrivalMin
      )} min.`;
    case "MODERATE":
      return `Maintain heightened surveillance on ${wardName}. Verify gauge telemetry & shelter readiness.`;
    case "LOW":
    default:
      return `Nominal monitoring for ${wardName}. Continue 15-min telemetry polling.`;
  }
}

/* ----------------------------------------------------------------------------
 * 3. HYDROLOGY ENGINE — SYSTEM CONTROLLER
 * ------------------------------------------------------------------------- */

export class HydrologyEngine {
  private readonly catchments: Map<string, CatchmentFeature>;
  private readonly order: string[];

  constructor(data: CatchmentCollection) {
    this.catchments = new Map(
      data.features.map((f) => [f.properties.ward_id, f])
    );
    this.order = this.topologicalSort();
  }

  /* -- Geospatial / lookup helpers ------------------------------------- */

  /** Returns the catchment feature for a ward id (throws if unknown). */
  getCatchment(wardId: string): CatchmentFeature {
    const f = this.catchments.get(wardId);
    if (!f) {
      throw new Error(`HydrologyEngine: unknown ward_id "${wardId}"`);
    }
    return f;
  }

  getProperties(wardId: string): CatchmentProperties {
    return this.getCatchment(wardId).properties;
  }

  listWards(): string[] {
    return Array.from(this.catchments.keys());
  }

  /** Returns the full catchment feature collection (geometry + properties). */
  getCatalogue(): CatchmentCollection {
    return {
      type: "FeatureCollection",
      features: Array.from(this.catchments.values()),
    } as CatchmentCollection;
  }

  /** Topological order from headwater → terminal basin. */
  getRoutingOrder(): string[] {
    return [...this.order];
  }

  /**
   * Resolve the topological cascade order by walking
   * `downstream_target_ward_id` from every headwater to the terminal sink.
   */
  private topologicalSort(): string[] {
    const downstream = new Map<string, string | null>();
    const ids: string[] = [];
    for (const f of this.catchments.values()) {
      const p = f.properties;
      downstream.set(p.ward_id, p.downstream_target_ward_id);
      ids.push(p.ward_id);
    }
    const headwaters = ids.filter(
      (id) => !ids.some((other) => downstream.get(other) === id)
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    const queue = [...headwaters];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (seen.has(id)) continue;
      ordered.push(id);
      seen.add(id);
      const next = downstream.get(id);
      if (next) queue.push(next);
    }
    // append any stragglers (defensive — should not happen for a clean chain)
    for (const id of ids) if (!seen.has(id)) ordered.push(id);
    return ordered;
  }

  /* -- (A) Dynamic Green-Ampt / FFG infiltration estimator -------------- */

  /**
   * calculateDynamicThreshold
   * Computes the operational 1-hour critical rainfall threshold (mm/hr)
   * conditioned on antecedent soil moisture.
   *
   * Model:
   *  - moisture weighting w = m^1.4 (convex: threshold collapses rapidly
   *    as the soil approaches saturation, reflecting loss of capillary
   *    suction head ψ and shrinking moisture deficit Δθ).
   *  - baseline interpolation T_lin = dry·(1−w) + saturated·w
   *  - Green-Ampt 1-hour infiltration capacity ceiling:
   *        F₁ = Ksat·t + ψ·Δθ·ln(1 + Ksat·t/(ψ·Δθ))      [t = 1 hr]
   *    The dynamic threshold is physically capped by this ceiling and
   *    floored by the saturated threshold.
   */
  calculateDynamicThreshold(
    wardId: string,
    antecedentSoilMoisturePct: number
  ): number {
    const p = this.getProperties(wardId);
    const m = clamp(antecedentSoilMoisturePct, 0, 100) / 100;

    const w = Math.pow(m, 1.4);
    const tLin =
      p.dry_soil_threshold_mm_1hr * (1 - w) +
      p.saturated_soil_threshold_mm_1hr * w;

    const dTheta = p.effective_porosity_fraction * (1 - m); // deficit
    const fCap = greenAmptOneHourInfiltration(
      p.saturated_hydraulic_conductivity_ksat_mm_hr,
      p.suction_head_psi_mm,
      dTheta
    );

    const threshold = clamp(
      tLin,
      p.saturated_soil_threshold_mm_1hr,
      Math.max(p.dry_soil_threshold_mm_1hr, fCap)
    );
    return round(threshold, 2);
  }

  /* -- (B) Rational-method peak discharge with sigmoid runoff C --------- */

  /**
   * estimatePeakDischarge
   * Returns peak discharge Q (m³/s) using the Rational formula
   *
   *     Q = 0.278 · C · I · A
   *
   * where I is in mm/hr, A in km² and the factor 0.278 converts
   * (mm/hr · km²) → m³/s. The runoff coefficient C is a non-linear
   * sigmoid function of antecedent soil moisture and hillslope angle:
   *
   *     z     = 6·(m − 0.5) + 1.5·(slopeNorm − 0.5)
   *     C     = Cmin + (Cmax − Cmin) · σ(z)
   *
   * (Cmin = 0.25 for dry/low-slope alpine terrain; Cmax = 0.92 for
   *  saturated, debris-charged steep torrents.)
   */
  estimatePeakDischarge(
    wardId: string,
    rainfallIntensity_mm_hr: number,
    soilMoisturePct: number
  ): number {
    const p = this.getProperties(wardId);
    const I = Math.max(0, rainfallIntensity_mm_hr);
    const A = p.drainage_area_sqkm;
    const m = clamp(soilMoisturePct, 0, 100) / 100;
    const slopeNorm = clamp((p.mean_slope_deg - 30) / 20, 0, 1); // 30°→50° = 0→1

    const z = 6 * (m - 0.5) + 1.5 * (slopeNorm - 0.5);
    const sigmoid = 1 / (1 + Math.exp(-z));
    const Cmin = 0.25;
    const Cmax = 0.92;
    const C = Cmin + (Cmax - Cmin) * sigmoid;

    const Q = 0.278 * C * I * A;
    return round(Q, 3);
  }

  /** Runoff coefficient exposure (used by the dashboard). */
  runoffCoefficient(
    wardId: string,
    soilMoisturePct: number
  ): number {
    const p = this.getProperties(wardId);
    const m = clamp(soilMoisturePct, 0, 100) / 100;
    const slopeNorm = clamp((p.mean_slope_deg - 30) / 20, 0, 1);
    const z = 6 * (m - 0.5) + 1.5 * (slopeNorm - 0.5);
    const sigmoid = 1 / (1 + Math.exp(-z));
    return round(0.25 + (0.92 - 0.25) * sigmoid, 3);
  }

  /**
   * Debris-flow entrainment probability — heuristic coupling of burst
   * exceedance, steepness (MCT-affected colluvium) and saturation.
   */
  private debrisFlowProbability(
    exceedanceRatio: number,
    slopeDeg: number,
    moistureFrac: number
  ): number {
    if (exceedanceRatio < 1) {
      // background (pre-threshold) residual risk on steep saturated slopes
      return round(
        clamp(
          0.05 +
            ((slopeDeg - 32) / 30) * 0.1 +
            moistureFrac * 0.12,
          0,
          0.4
        ),
        3
      );
    }
    return round(
      clamp(
        0.35 +
          (exceedanceRatio - 1) * 0.35 +
          ((slopeDeg - 32) / 30) * 0.2 +
          (moistureFrac - 0.5) * 0.3,
        0,
        0.98
      ),
      3
    );
  }

  /* -- (C) Topological cascade simulator -------------------------------- */

  /**
   * simulateBasinCascade
   * Routes excess surface discharge from the headwater (UK-CHM-UPPER)
   * through UK-CHM-MID into the terminal UK-CHM-LOWER gorge, computing
   * cumulative river surge and downstream flood-arrival lead time.
   *
   * Routing assumptions (kinematic-wave cascade):
   *  - Each ward's local discharge is added to routed inflow from upstream.
   *  - A transmission factor τ = 0.70 + 0.25·m (0.70–0.95) partitions
   *    surface outflow (transmitted downstream) vs. infiltration / storage.
   *  - The terminal basin's totalQ is reported as the cumulative surge.
   *  - Flood-arrival lead time at a ward = Σ Tc of that ward + all upstream
   *    wards (conservative kinematic-wave transit bound used by NDRF).
   */
  simulateBasinCascade(
    rainfallTelemetryMap: Record<string, number>,
    soilMoistureMap: Record<string, number>
  ): BasinCascadeResult {
    const outflow: Record<string, number> = {};
    const inflow: Record<string, number> = {};
    const perWard: FlashFloodRiskVector[] = [];

    let upstreamLag = 0; // minutes accumulated along the cascade

    for (const wardId of this.order) {
      const p = this.getProperties(wardId);
      const I = rainfallTelemetryMap[wardId] ?? 0;
      const sm = soilMoistureMap[wardId] ?? 0;
      const m = clamp(sm, 0, 100) / 100;

      const localQ = this.estimatePeakDischarge(wardId, I, sm);
      const upIn = inflow[wardId] ?? 0;
      const totalQ = localQ + upIn;

      const tau = 0.7 + 0.25 * m; // transmission factor
      const downstreamQ = totalQ * tau;
      outflow[wardId] = downstreamQ;

      const ds = p.downstream_target_ward_id;
      if (ds) inflow[ds] = (inflow[ds] ?? 0) + downstreamQ;

      const threshold = this.calculateDynamicThreshold(wardId, sm);
      const ratio = threshold > 0 ? I / threshold : I > 0 ? 99 : 0;
      const debrisP = this.debrisFlowProbability(ratio, p.mean_slope_deg, m);
      const level = classifyRisk(ratio, debrisP);
      const arrival = upstreamLag + p.time_of_concentration_min;

      perWard.push({
        ward_id: wardId,
        ward_name: p.ward_name,
        risk_level: level,
        dynamic_threshold_mm_hr: threshold,
        rainfall_intensity_mm_hr: round(I, 2),
        threshold_exceeded: I > threshold,
        exceedance_ratio: round(ratio, 3),
        peak_discharge_m3_per_s: round(totalQ, 3),
        local_discharge_m3_per_s: round(localQ, 3),
        inflow_discharge_m3_per_s: round(upIn, 3),
        outflow_discharge_m3_per_s: round(downstreamQ, 3),
        estimated_flood_arrival_min: round(arrival, 1),
        debris_flow_probability: debrisP,
        runoff_coefficient_C: this.runoffCoefficient(wardId, sm),
        recommended_action: actionFor(level, p.ward_name, arrival),
        evacuation_plan: this.getEvacuationPlan(wardId).map(
          (e) =>
            ({
              shelter_id: e.shelter_id,
              name: e.name,
              elevation_m: e.elevation_m,
              capacity_persons: e.capacity_persons,
              coordinates: e.coordinates,
              route_id: e.route_id,
            }) satisfies EvacuationPoint
        ),
        downstream_target_ward_id: p.downstream_target_ward_id,
      });

      // advance the cascade lag by this ward's Tc (kinematic transit)
      upstreamLag += p.time_of_concentration_min;
    }

    const lower = perWard.find((w) => w.downstream_target_ward_id === null);
    const cumulativeLower = lower?.peak_discharge_m3_per_s ?? 0;

    // surge-arrival lead time = Σ Tc of all wards upstream of & incl. LOWER
    const lowerArrival = lower?.estimated_flood_arrival_min ?? 0;

    const basinLevel = perWard.reduce<RiskLevel>(
      (acc, w) =>
        RISK_ORDINAL[w.risk_level] > RISK_ORDINAL[acc] ? w.risk_level : acc,
      "LOW"
    );

    const directive = this.ndrfDirective(basinLevel, cumulativeLower, lowerArrival);

    return {
      timestamp: new Date().toISOString(),
      per_ward_risk: perWard,
      cumulative_lower_basin_discharge_m3_per_s: cumulativeLower,
      lower_basin_surge_arrival_min: lowerArrival,
      basin_wide_alert_level: basinLevel,
      ndrf_deployment_directive: directive,
      routing_order: [...this.order],
    };
  }

  private ndrfDirective(
    level: RiskLevel,
    qLower: number,
    leadMin: number
  ): string {
    const q = Math.round(qLower);
    const lead = Math.round(leadMin);
    switch (level) {
      case "CATACLYSMIC":
        return `NDRF DIRECTIVE — RED: Activate full battalion (≈4 coys) to Joshimath & Vishnuprayag. Cumulative confluence discharge ≈ ${q} m³/s exceeds 1-in-50 envelope. Force evacuation of all wards. Surge-to-gorge lead ≈ ${lead} min. Coordinate IAF ALH winch ops.`;
      case "EXTREME":
        return `NDRF DIRECTIVE — ORANGE: Stage 2-coy QRT at Helang; pre-deploy inflatable boats to Vishnuprayag. Confluence Q ≈ ${q} m³/s. Lead ≈ ${lead} min.`;
      case "HIGH":
        return `NDRF DIRECTIVE — YELLOW: 1-coy QRT on 15-min standby. Confluence Q ≈ ${q} m³/s. Lead ≈ ${lead} min. Verify shelter inventories.`;
      case "MODERATE":
        return `NDRF DIRECTIVE — STANDBY: Recon teams to confirm gauge telemetry. Confluence Q ≈ ${q} m³/s.`;
      case "LOW":
      default:
        return `NDRF DIRECTIVE — GREEN: Routine monitoring. Confluence Q ≈ ${q} m³/s.`;
    }
  }

  /* -- (D) Geospatial helpers ------------------------------------------- */

  /**
   * getEvacuationPlan
   * Returns the designated NDRF evacuation points for a ward, sorted by
   * safe elevation differential (shelter_elevation − catchment_elevation_min),
   * descending — i.e. the highest, safest assembly zones first.
   */
  getEvacuationPlan(wardId: string): EvacuationPlanEntry[] {
    const p = this.getProperties(wardId);
    const base = p.elevation_min_m;
    return [...p.designated_ndrf_evacuation_points]
      .map((e) => ({
        ...e,
        safe_elevation_differential_m: round(e.elevation_m - base, 1),
      }))
      .sort(
        (a, b) =>
          b.safe_elevation_differential_m - a.safe_elevation_differential_m
      );
  }

  /**
   * Spherical-area (Shoelace on a sphere) — operational sanity check for
   * the declared `drainage_area_sqkm`. Returns area in km².
   */
  computeAreaSqkm(wardId: string): number {
    const ring = this.getCatchment(wardId).geometry.coordinates[0];
    const R = 6371.0088; // Earth radius (km)
    let area = 0;
    const n = ring.length - 1; // closed ring
    for (let i = 0; i < n; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const lat1r = (lat1 * Math.PI) / 180;
      const lat2r = (lat2 * Math.PI) / 180;
      area += dLng * (2 + Math.sin(lat1r) + Math.sin(lat2r));
    }
    return round((Math.abs(area) * R * R) / 2, 3);
  }

  /**
   * Haversine distance (km) between two [lng,lat] points — used for
   * shelter-reach & infrastructure proximity checks.
   */
  static haversineKm(
    a: [number, number],
    b: [number, number]
  ): number {
    const R = 6371.0088;
    const dLat = ((b[1] - a[1]) * Math.PI) / 180;
    const dLng = ((b[0] - a[0]) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a[1] * Math.PI) / 180) *
        Math.cos((b[1] * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return round(2 * R * Math.asin(Math.sqrt(s)), 3);
  }
}

/* ----------------------------------------------------------------------------
 * 4. SINGLETON FACTORY (directly importable into Next.js / Node)
 * ------------------------------------------------------------------------- */

const CATCHMENTS_FILE = path.join(
  process.cwd(),
  "src",
  "data",
  "catchments.geojson"
);

let _data: CatchmentCollection | null = null;

/**
 * Loads & caches the operational catchment GeoJSON from disk. Server-only.
 */
export function loadCatchments(): CatchmentCollection {
  if (_data) return _data;
  const raw = fs.readFileSync(CATCHMENTS_FILE, "utf8");
  _data = JSON.parse(raw) as CatchmentCollection;
  return _data;
}

let _instance: HydrologyEngine | null = null;

export function getHydrologyEngine(): HydrologyEngine {
  if (!_instance) _instance = new HydrologyEngine(loadCatchments());
  return _instance;
}

export default HydrologyEngine;
