import { NextResponse } from "next/server";
import { getHydrologyEngine } from "@/lib/hydrologyEngine.server";
import type { WardTelemetrySeries } from "@/lib/hydrologyEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hydrology/telemetry
 * Body: {
 *   wardId: string,
 *   rainfall: number,        // current rainfall intensity mm/hr
 *   moisture: number,         // current soil moisture %
 *   now?: string             // optional ISO "now" override
 * }
 * Returns the 8-hour WardTelemetrySeries (6 h observed + 2 h projected).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const wardId: string = body?.wardId || body?.id || "UK-CHM-UPPER";
    const rainfall: number = Number(body?.rainfall ?? 35);
    const moisture: number = Number(body?.moisture ?? 60);
    const now = body?.now ? new Date(body.now as string) : new Date();
    if (Number.isNaN(now.getTime())) {
      return NextResponse.json({ error: "invalid `now`" }, { status: 400 });
    }
    const engine = getHydrologyEngine();
    const series: WardTelemetrySeries = engine.generateTelemetrySeries(
      wardId,
      rainfall,
      moisture,
      now
    );
    return NextResponse.json(series, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "telemetry failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hydrology/telemetry?wardId=...&rainfall=...&moisture=...
 * Convenience GET form for quick probing.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wardId = searchParams.get("wardId") || searchParams.get("id") || "UK-CHM-UPPER";
  const rainfall = Number(searchParams.get("rainfall") ?? "35");
  const moisture = Number(searchParams.get("moisture") ?? "60");
  try {
    const engine = getHydrologyEngine();
    const series = engine.generateTelemetrySeries(wardId, rainfall, moisture);
    return NextResponse.json(series, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "telemetry failed" },
      { status: 500 }
    );
  }
}
