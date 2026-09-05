import { NextResponse } from "next/server";
import { getHydrologyEngine } from "@/lib/hydrologyEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hydrology/cascade
 * Body: {
 *   rainfall: Record<wardId, mm_per_hr>,
 *   soilMoisture: Record<wardId, percent>
 * }
 * Returns the full BasinCascadeResult.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rainfall: Record<string, number> =
      body?.rainfall ?? {};
    const soilMoisture: Record<string, number> =
      body?.soilMoisture ?? {};

    const engine = getHydrologyEngine();
    const result = engine.simulateBasinCascade(rainfall, soilMoisture);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "cascade failed" },
      { status: 500 }
    );
  }
}

/** GET — returns the catchment catalogue + routing topology (with geometry). */
export async function GET() {
  const engine = getHydrologyEngine();
  const catalogue = engine.getCatalogue();
  const wards = catalogue.features.map((f) => {
    const p = f.properties;
    return {
      ward_id: p.ward_id,
      ward_name: p.ward_name,
      catchment_role: p.catchment_role,
      drainage_area_sqkm: p.drainage_area_sqkm,
      elevation_min_m: p.elevation_min_m,
      elevation_max_m: p.elevation_max_m,
      mean_slope_deg: p.mean_slope_deg,
      time_of_concentration_min: p.time_of_concentration_min,
      downstream_target_ward_id: p.downstream_target_ward_id,
      vulnerable_population: p.vulnerable_population,
      critical_infrastructure: p.critical_infrastructure,
      designated_ndrf_evacuation_points: p.designated_ndrf_evacuation_points,
      computed_area_sqkm: engine.computeAreaSqkm(p.ward_id),
      geometry: f.geometry,
    };
  });
  return NextResponse.json(
    {
      routing_order: engine.getRoutingOrder(),
      features: catalogue.features,
      wards,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
