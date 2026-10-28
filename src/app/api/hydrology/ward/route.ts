import { NextResponse } from "next/server";
import { getHydrologyEngine } from "@/lib/hydrologyEngine.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hydrology/ward?wardId=UK-CHM-UPPER&soilMoisture=45&rainfall=30
 * Returns the dynamic threshold, runoff coefficient, peak discharge and
 * evacuation plan for a single ward at the supplied telemetry state.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wardId = searchParams.get("wardId") || searchParams.get("id") || "UK-CHM-UPPER";
  const soilMoisture = Number(searchParams.get("soilMoisture") ?? "50");
  const rainfall = Number(searchParams.get("rainfall") ?? "25");

  try {
    const engine = getHydrologyEngine();
    const p = engine.getProperties(wardId);
    const threshold = engine.calculateDynamicThreshold(wardId, soilMoisture);
    const C = engine.runoffCoefficient(wardId, soilMoisture);
    const Q = engine.estimatePeakDischarge(wardId, rainfall, soilMoisture);
    const ratio = threshold > 0 ? rainfall / threshold : 0;
    const evacuation = engine.getEvacuationPlan(wardId);
    return NextResponse.json({
      ward_id: wardId,
      ward_name: p.ward_name,
      drainage_area_sqkm: p.drainage_area_sqkm,
      mean_slope_deg: p.mean_slope_deg,
      time_of_concentration_min: p.time_of_concentration_min,
      soil_moisture_pct: soilMoisture,
      rainfall_intensity_mm_hr: rainfall,
      dynamic_threshold_mm_hr: threshold,
      dry_soil_threshold_mm_1hr: p.dry_soil_threshold_mm_1hr,
      saturated_soil_threshold_mm_1hr: p.saturated_soil_threshold_mm_1hr,
      ksat_mm_hr: p.saturated_hydraulic_conductivity_ksat_mm_hr,
      runoff_coefficient_C: C,
      peak_discharge_m3_per_s: Q,
      exceedance_ratio: Number(ratio.toFixed(3)),
      threshold_exceeded: rainfall > threshold,
      evacuation_plan: evacuation,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ward lookup failed" },
      { status: 500 }
    );
  }
}
