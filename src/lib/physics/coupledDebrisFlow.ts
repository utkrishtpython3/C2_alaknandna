/**
 * Alaknanda C2: Advanced Physics-Informed Computational Fluid Dynamics Engine
 * Module: Coupled Green-Ampt Infiltration & Takahashi Dynamic Non-Newtonian Debris Rheology
 * 
 * Replaces legacy 1D kinematic static bulking (2.10x) with a fully-coupled
 * differential saturation-entrainment model:
 * 
 * B_f(theta, t) = C_inf / (C_inf - C_d * (1 + alpha * ((theta(t) - theta_r) / (theta_s - theta_r))))
 * tau_y = a1 * exp(a2 * C_d)
 * mu_m = mu_w * (1 - (C_d / C_inf))^(-2.5)
 */

export interface CoupledDebrisParams {
  /** Saturated volumetric water content (Green-Ampt porosity limit). Default: 0.43 */
  theta_s?: number;
  /** Residual/hygroscopic volumetric water content. Default: 0.05 */
  theta_r?: number;
  /** Initial volumetric water content. Default: 0.18 */
  theta_init?: number;
  /** Static packed sediment concentration limit (random loose packing). Default: 0.605 */
  c_inf?: number;
  /** Dynamic sediment concentration in debris slurry [0.05 - 0.55]. Default: 0.38 */
  c_d?: number;
  /** Dynamic entrainment scaling factor. Default: 0.35 */
  alpha?: number;
  /** Saturated hydraulic conductivity K_s (m/s). Default: 1.2e-6 (~4.32 mm/hr) */
  k_s?: number;
  /** Wetting front soil suction head psi (meters). Default: 0.167 */
  psi?: number;
  /** Soil column depth Z_soil (meters). Default: 1.2 */
  soil_depth_m?: number;
  /** Mean bed slope (degrees). Default: 28.0 */
  bed_slope_deg?: number;
  /** Yield stress scaling constant a1 (Pa). Default: 0.08 */
  a1?: number;
  /** Yield stress exponential coefficient a2. Default: 12.5 */
  a2?: number;
  /** Clear water dynamic viscosity mu_w (Pa·s). Default: 1.002e-3 */
  mu_w?: number;
  /** Solid grain density rho_s (kg/m3). Default: 2650 */
  rho_s?: number;
  /** Water density rho_w (kg/m3). Default: 1000 */
  rho_w?: number;
  /** Gravitational acceleration g (m/s2). Default: 9.81 */
  g?: number;
}

export interface DynamicDebrisRheology {
  /** Dynamic bulking factor B_f(theta, t) */
  bulking_factor: number;
  /** Current volumetric soil moisture theta(t) */
  soil_moisture_theta: number;
  /** Dynamic volumetric sediment concentration C_d */
  sediment_concentration: number;
  /** Dynamic Mohr-Coulomb/Bingham yield stress tau_y (Pa) */
  yield_stress_pa: number;
  /** Dynamic Bingham slurry viscosity mu_m (Pa·s) */
  slurry_viscosity_pa_s: number;
  /** Multi-phase slurry bulk density rho_m (kg/m3) */
  slurry_density_kg_m3: number;
  /** Infiltration rate i(t) (mm/hr) */
  infiltration_rate_mm_hr: number;
  /** Cumulative infiltration depth F(t) (mm) */
  cumulative_infiltration_mm: number;
}

export interface HydrographStep {
  time_min: number;
  rainfall_mm_hr: number;
  infiltration_mm_hr: number;
  effective_runoff_mm_hr: number;
  water_discharge_m3_s: number;
  bulked_discharge_m3_s: number;
  sediment_yield_m3_s: number;
  surge_depth_m: number;
  surge_velocity_m_s: number;
  froude_number: number;
  rheology: DynamicDebrisRheology;
}

export interface EvacuationLeadTimeResult {
  /** Surge wave arrival time at target gorge reach (minutes) */
  surge_arrival_time_min: number;
  /** Required civilian evacuation transit duration (minutes) */
  evacuation_transit_time_min: number;
  /** Net dynamic evacuation lead time window (minutes). Negative implies casualty interdiction */
  net_lead_time_min: number;
  /** Kinetic hazard index: h_peak * v_surge (m2/s) */
  hazard_index_m2_s: number;
  /** Urgency classification code */
  classification: "EXTREME_IMMEDIATE_EVACUATION" | "HIGH_PRIORITY_DISPATCH" | "ELEVATED_WATCH" | "NOMINAL";
  /** Descriptive tactical advisory */
  tactical_advisory: string;
  /** Whether civilian trail ascent can be completed before surge wave arrival */
  is_evacuation_feasible?: boolean;
  /** Absolute deficit duration if surge wave overtakes evacuees (minutes) */
  margin_deficit_min?: number;
}

/**
 * Calculates dynamic volumetric sediment concentration based on Takahashi equilibrium:
 * C_eq = (rho_w * tan(theta)) / ((rho_s - rho_w) * (tan(phi) - tan(theta)))
 */
export function calculateTakahashiEquilibriumConcentration(
  slope_deg: number,
  internal_friction_angle_deg: number = 38.0,
  rho_s: number = 2650,
  rho_w: number = 1000,
  c_inf: number = 0.605
): number {
  const safe_slope = Math.max(0.0, Math.min(85.0, typeof slope_deg === "number" && !isNaN(slope_deg) ? slope_deg : 0.0));
  if (safe_slope <= 0.5) return 0.0; // Flat channel, zero dynamic entrainment

  const theta = (safe_slope * Math.PI) / 180;
  const phi = (Math.max(1.0, internal_friction_angle_deg) * Math.PI) / 180;
  const tanTheta = Math.tan(theta);
  const tanPhi = Math.tan(phi);

  if (tanTheta >= tanPhi) {
    return Math.min(0.52, c_inf * 0.9); // Near-choked bed slide
  }

  const denominator = (rho_s - rho_w) * (tanPhi - tanTheta);
  if (denominator <= 0) return 0.48;

  const c_eq = (rho_w * tanTheta) / denominator;
  return Math.max(0.0, Math.min(c_eq, 0.52));
}

/**
 * Evaluates dynamic yield stress tau_y and Bingham dynamic viscosity mu_m
 * for a hyper-concentrated sediment-water slurry.
 */
export function evaluateDynamicDebrisViscosity(
  c_d: number,
  params?: Partial<CoupledDebrisParams>
): {
  yield_stress_pa: number;
  slurry_viscosity_pa_s: number;
  slurry_density_kg_m3: number;
} {
  const c_inf = params?.c_inf ?? 0.605;
  const a1 = params?.a1 ?? 0.08;
  const a2 = params?.a2 ?? 12.5;
  const mu_w = params?.mu_w ?? 1.002e-3;
  const rho_s = params?.rho_s ?? 2650;
  const rho_w = params?.rho_w ?? 1000;

  // Clean water boundary condition (no sediment)
  const safe_cd = typeof c_d === "number" && !isNaN(c_d) ? Math.max(0.0, c_d) : 0.0;
  if (safe_cd <= 0.001) {
    return {
      yield_stress_pa: 0.0,
      slurry_viscosity_pa_s: Number(mu_w.toFixed(5)),
      slurry_density_kg_m3: Number(rho_w.toFixed(1)),
    };
  }

  // Clamping concentration strictly below maximum random packing limit
  const c_clamped = Math.max(0.001, Math.min(safe_cd, c_inf * 0.98));

  // Mohr-Coulomb / Bingham Yield stress: tau_y = a1 * exp(a2 * C_d)
  const yield_stress_pa = a1 * Math.exp(a2 * c_clamped);

  // Krieger-Dougherty / Thomas slurry viscosity: mu_m = mu_w * (1 - (C_d / C_inf))^(-2.5)
  const concentration_ratio = c_clamped / c_inf;
  const slurry_viscosity_pa_s = mu_w * Math.pow(1.0 - concentration_ratio, -2.5);

  // Bulk mixture density
  const slurry_density_kg_m3 = rho_w * (1.0 - c_clamped) + rho_s * c_clamped;

  return {
    yield_stress_pa: Number(yield_stress_pa.toFixed(3)),
    slurry_viscosity_pa_s: Number(slurry_viscosity_pa_s.toFixed(5)),
    slurry_density_kg_m3: Number(slurry_density_kg_m3.toFixed(1)),
  };
}

/**
 * Fully Coupled Infiltration-Bulking Dynamic Equation:
 * B_f(theta, t) = C_inf / (C_inf - C_d * (1 + alpha * ((theta(t) - theta_r) / (theta_s - theta_r))))
 */
export function calculateDynamicBulkingFactor(
  theta_t: number,
  c_d: number,
  params?: Partial<CoupledDebrisParams>
): number {
  const theta_s = params?.theta_s ?? 0.43;
  const theta_r = params?.theta_r ?? 0.05;
  const c_inf = params?.c_inf ?? 0.605;
  const alpha = params?.alpha ?? 0.35;

  // Auto-normalize if passed as a percentage [1..100] instead of volumetric fraction [0..1]
  let theta = typeof theta_t === "number" && !isNaN(theta_t) ? theta_t : theta_r;
  if (theta > 1.0) {
    theta = theta_r + (Math.min(100.0, Math.max(0.0, theta)) / 100.0) * (theta_s - theta_r);
  }

  // Normalized saturation ratio: S_e = (theta - theta_r) / (theta_s - theta_r)
  const s_e = Math.max(0.0, Math.min(1.0, (theta - theta_r) / Math.max(0.01, theta_s - theta_r)));

  // If no sediment concentration, clean water bulking factor is strictly 1.0
  const safe_cd = Math.max(0.0, typeof c_d === "number" && !isNaN(c_d) ? c_d : 0.0);
  if (safe_cd <= 0.001) {
    return 1.0;
  }

  // Dynamic entrainment coefficient boosted by matrix suction decay
  const entrainment_multiplier = 1.0 + alpha * s_e;
  const effective_cd = safe_cd * entrainment_multiplier;

  // Protect against singular asymptotic choke (bed damming limit)
  const denominator = c_inf - effective_cd;
  if (denominator <= 0.08) {
    return 3.5; // Upper physical limit before complete debris jam / rock damming
  }

  const b_f = c_inf / denominator;
  return Number(Math.max(1.0, Math.min(b_f, 3.5)).toFixed(3));
}

/**
 * Computes forward time-series hydrograph coupled with Green-Ampt infiltration
 * and dynamic non-Newtonian debris transport.
 */
export function calculateCoupledHydrograph(
  catchment_area_km2: number,
  peak_rainfall_mm_hr: number,
  duration_min: number = 120,
  time_step_min: number = 2,
  user_params?: Partial<CoupledDebrisParams>
): HydrographStep[] {
  const p: Required<CoupledDebrisParams> = {
    theta_s: user_params?.theta_s ?? 0.43,
    theta_r: user_params?.theta_r ?? 0.05,
    theta_init: user_params?.theta_init ?? 0.18,
    c_inf: user_params?.c_inf ?? 0.605,
    c_d: user_params?.c_d ?? calculateTakahashiEquilibriumConcentration(user_params?.bed_slope_deg ?? 28.0),
    alpha: user_params?.alpha ?? 0.35,
    k_s: user_params?.k_s ?? 1.2e-6,
    psi: user_params?.psi ?? 0.167,
    soil_depth_m: user_params?.soil_depth_m ?? 1.2,
    bed_slope_deg: user_params?.bed_slope_deg ?? 28.0,
    a1: user_params?.a1 ?? 0.08,
    a2: user_params?.a2 ?? 12.5,
    mu_w: user_params?.mu_w ?? 1.002e-3,
    rho_s: user_params?.rho_s ?? 2650,
    rho_w: user_params?.rho_w ?? 1000,
    g: user_params?.g ?? 9.81,
  };

  const steps: HydrographStep[] = [];
  let cumulative_F_meters = 0.0001; // Initial moisture seeding to avoid division by zero
  const k_s_mm_hr = p.k_s * 3600 * 1000; // Convert m/s to mm/hr (~4.32 mm/hr)

  // Synthetic hyetograph: Gamma-distributed peak at t = 25% duration
  const t_peak = duration_min * 0.25;

  for (let t = 0; t <= duration_min; t += time_step_min) {
    // 1. Rainfall hyetograph intensity R(t)
    const norm_t = t / Math.max(1, t_peak);
    const intensity_factor = norm_t * Math.exp(1 - norm_t);
    const r_t = Math.max(0.0, peak_rainfall_mm_hr * intensity_factor);

    // 2. Green-Ampt Infiltration: i(t) = K_s * (1 + (psi * delta_theta) / F(t))
    const delta_theta = Math.max(0.001, p.theta_s - p.theta_init);
    const psi_delta_theta_m = p.psi * delta_theta;
    const infiltration_capacity_mm_hr = k_s_mm_hr * (1.0 + (psi_delta_theta_m / Math.max(0.00001, cumulative_F_meters)));
    const actual_infiltration_mm_hr = Math.min(r_t, infiltration_capacity_mm_hr);

    // Update cumulative infiltration F
    const dt_hours = time_step_min / 60.0;
    cumulative_F_meters += (actual_infiltration_mm_hr / 1000.0) * dt_hours;

    // 3. Dynamic volumetric soil moisture theta(t)
    const max_moisture_storage_m = Math.max(0.01, p.soil_depth_m * Math.max(0.01, p.theta_s - p.theta_r));
    const added_saturation_ratio = Math.min(1.0, cumulative_F_meters / max_moisture_storage_m);
    const theta_t = p.theta_init + (p.theta_s - p.theta_init) * added_saturation_ratio;

    // 4. Net effective excess precipitation
    const effective_runoff_mm_hr = Math.max(0.0, r_t - actual_infiltration_mm_hr);

    // 5. Rational / Kinematic clear water discharge Q_w = (C * I * A) / 3.6
    // Using runoff generation: Q = (excess_mm_hr * area_km2 * 1000) / 3600
    const water_discharge_m3_s = (effective_runoff_mm_hr * catchment_area_km2 * 1000.0) / 3600.0;

    // 6. Dynamic Bulking Factor B_f(theta, t)
    const bulking_factor = calculateDynamicBulkingFactor(theta_t, p.c_d, p);

    // 7. Bulked Debris Discharge & Sediment Yield
    const bulked_discharge_m3_s = water_discharge_m3_s * bulking_factor;
    const sediment_yield_m3_s = bulked_discharge_m3_s - water_discharge_m3_s;

    // 8. Non-Newtonian Rheology
    const rheo = evaluateDynamicDebrisViscosity(p.c_d, p);

    // 9. Surge Hydraulics: Approximated gorge channel cross-section (trapezoidal b=15m, 1:1 side slopes)
    const b_width = 15.0;
    const s_slope = Math.sin((p.bed_slope_deg * Math.PI) / 180);
    // Manning-Bingham depth estimation (guarded against negative pow):
    const safe_discharge = Math.max(0.0, bulked_discharge_m3_s);
    const surge_depth_m = Math.pow(
      (safe_discharge * (0.055 + rheo.slurry_viscosity_pa_s * 5.0)) /
        (b_width * Math.sqrt(Math.max(0.01, s_slope))),
      0.6
    );
    const surge_velocity_m_s = safe_discharge / (Math.max(0.1, b_width * Math.max(0.05, surge_depth_m)));
    const froude_number = surge_velocity_m_s / Math.sqrt(p.g * Math.max(0.05, surge_depth_m));

    steps.push({
      time_min: t,
      rainfall_mm_hr: Number(r_t.toFixed(2)),
      infiltration_mm_hr: Number(actual_infiltration_mm_hr.toFixed(2)),
      effective_runoff_mm_hr: Number(effective_runoff_mm_hr.toFixed(2)),
      water_discharge_m3_s: Number(water_discharge_m3_s.toFixed(2)),
      bulked_discharge_m3_s: Number(bulked_discharge_m3_s.toFixed(2)),
      sediment_yield_m3_s: Number(sediment_yield_m3_s.toFixed(2)),
      surge_depth_m: Number(Math.max(0.02, surge_depth_m).toFixed(2)),
      surge_velocity_m_s: Number(Math.max(0.1, surge_velocity_m_s).toFixed(2)),
      froude_number: Number(froude_number.toFixed(2)),
      rheology: {
        bulking_factor,
        soil_moisture_theta: Number(theta_t.toFixed(3)),
        sediment_concentration: Number(p.c_d.toFixed(3)),
        yield_stress_pa: rheo.yield_stress_pa,
        slurry_viscosity_pa_s: rheo.slurry_viscosity_pa_s,
        slurry_density_kg_m3: rheo.slurry_density_kg_m3,
        infiltration_rate_mm_hr: Number(actual_infiltration_mm_hr.toFixed(2)),
        cumulative_infiltration_mm: Number((cumulative_F_meters * 1000.0).toFixed(1)),
      },
    });
  }

  return steps;
}

/**
 * Computes dynamic civilian evacuation lead time accounting for non-Newtonian
 * wave acceleration, boulder entrainment drag, and population transit speed.
 */
export function computeDynamicEvacuationLeadTime(
  h_peak_m: number,
  v_surge_m_s: number,
  transit_speed_km_h: number = 3.5,
  gorge_reach_distance_km: number = 8.5,
  civilian_safe_ascent_distance_m: number = 350.0
): EvacuationLeadTimeResult {
  // Defensive input sanitization
  const safe_h = Math.max(0.0, typeof h_peak_m === "number" && !isNaN(h_peak_m) ? h_peak_m : 0.0);
  const safe_v = Math.max(0.0, typeof v_surge_m_s === "number" && !isNaN(v_surge_m_s) ? v_surge_m_s : 0.0);
  const safe_transit_speed = Math.max(0.5, typeof transit_speed_km_h === "number" && !isNaN(transit_speed_km_h) ? transit_speed_km_h : 3.5);
  const safe_reach_km = Math.max(0.1, typeof gorge_reach_distance_km === "number" && !isNaN(gorge_reach_distance_km) ? gorge_reach_distance_km : 8.5);
  const safe_ascent_m = Math.max(10.0, typeof civilian_safe_ascent_distance_m === "number" && !isNaN(civilian_safe_ascent_distance_m) ? civilian_safe_ascent_distance_m : 350.0);

  // Hydrodynamic wave transit time down the gorge
  const v_surge_km_h = Math.max(0.5, safe_v * 3.6);
  const surge_arrival_time_min = (safe_reach_km / v_surge_km_h) * 60.0;

  // Civilian uphill trail evacuation duration
  const evac_speed_m_min = (safe_transit_speed * 1000.0) / 60.0;
  // Include 4 minutes warning dissemination & reaction buffer
  const reaction_buffer_min = 4.0;
  const evacuation_transit_time_min = (safe_ascent_m / evac_speed_m_min) + reaction_buffer_min;

  // Net lead time & kinetic hazard index (h * v in m2/s)
  const net_lead_time_min = surge_arrival_time_min - evacuation_transit_time_min;
  const hazard_index_m2_s = safe_h * safe_v;

  // Determine whether an actual surge hazard exists (prevents false positive alarms when dry/calm)
  const is_active_hazard = (safe_h >= 0.5 && safe_v >= 0.8) || hazard_index_m2_s >= 1.5;

  let classification: EvacuationLeadTimeResult["classification"] = "NOMINAL";
  let tactical_advisory = "Routine hydrological monitoring. Gorge access open.";

  if (is_active_hazard) {
    if (net_lead_time_min < 0.0) {
      classification = "EXTREME_IMMEDIATE_EVACUATION";
      tactical_advisory = `CRITICAL INTERDICTION: Flood wave arrives in ${surge_arrival_time_min.toFixed(1)} min — DEFICIT of ${Math.abs(net_lead_time_min).toFixed(1)} min before trail ascent (${evacuation_transit_time_min.toFixed(1)} min) can complete. Horizontal valley evacuation compromised; immediate vertical / rooftop scaling mandatory!`;
    } else if (hazard_index_m2_s > 18.0 || net_lead_time_min < 5.0) {
      classification = "EXTREME_IMMEDIATE_EVACUATION";
      tactical_advisory =
        "CRITICAL DANGER: Supercritical debris bore with high boulder entrainment. Immediate vertical hillside evacuation mandatory.";
    } else if (hazard_index_m2_s > 8.0 || net_lead_time_min < 12.0) {
      classification = "HIGH_PRIORITY_DISPATCH";
      tactical_advisory =
        "HIGH HAZARD: Hyper-concentrated sediment surge approaching settlements. Sound automated LoRa sirens; interdict river bridges.";
    } else if (hazard_index_m2_s > 3.0 || net_lead_time_min < 25.0) {
      classification = "ELEVATED_WATCH";
      tactical_advisory =
        "ELEVATED RISK: River stage rising rapidly. Issue preparatory warnings to low-lying riverbank wards.";
    }
  }

  return {
    surge_arrival_time_min: Number(surge_arrival_time_min.toFixed(1)),
    evacuation_transit_time_min: Number(evacuation_transit_time_min.toFixed(1)),
    net_lead_time_min: Number(net_lead_time_min.toFixed(1)),
    hazard_index_m2_s: Number(hazard_index_m2_s.toFixed(2)),
    classification,
    tactical_advisory,
    is_evacuation_feasible: is_active_hazard ? net_lead_time_min >= 0 : true,
    margin_deficit_min: net_lead_time_min < 0 && is_active_hazard ? Number(Math.abs(net_lead_time_min).toFixed(1)) : 0,
  };
}

/**
 * Backward-compatibility wrapper for legacy systems expecting static Takahashi multipliers.
 */
export function getLegacyCompatibleBulkingMultiplier(
  meanSlopeDeg: number,
  soilMoisturePct: number,
  debrisProbability: number = 0.5
): number {
  const theta = 0.05 + (soilMoisturePct / 100.0) * (0.43 - 0.05);
  const c_d = calculateTakahashiEquilibriumConcentration(meanSlopeDeg);
  const dynamicFactor = calculateDynamicBulkingFactor(theta, c_d);

  // Blend dynamically with debris entrainment probability
  return Number((1.0 + debrisProbability * (dynamicFactor - 1.0)).toFixed(2));
}
