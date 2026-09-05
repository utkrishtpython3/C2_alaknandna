import { NextResponse } from "next/server";
import { parseDhauligangaMeteo } from "@/lib/dhauligangaMeteo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/meteo/dhauliganga
 * Returns the parsed Dhauliganga 93-day monsoon forecast with derived fields
 * (cloudburst classification, 7-day antecedent moisture, effective hourly
 * intensity). The client uses this to render the forecast strip and to drive
 * the EWS cascade by clicking a forecast day.
 */
export async function GET() {
  try {
    const meteo = parseDhauligangaMeteo();
    return NextResponse.json(meteo, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "meteo failed" },
      { status: 500 }
    );
  }
}
