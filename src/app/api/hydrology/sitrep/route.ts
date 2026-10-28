import { NextResponse } from "next/server";
import { getHydrologyEngine } from "@/lib/hydrologyEngine.server";
import type {
  BasinCascadeResult,
  BroadcastChannel,
  FlashFloodRiskVector,
  RiskLevel,
} from "@/lib/hydrologyEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hydrology/sitrep
 * Body: {
 *   rainfall: Record<wardId, mm_per_hr>,
 *   soilMoisture: Record<wardId, percent>,
 *   telemetryTimestamp?: ISO-8601  // optional observation time
 * }
 *
 * Returns a field-ready dispatch bundle:
 *   - `cap_xml`   : OASIS CAP 1.2 XML Alert document (string)
 *   - `cap`       : OASIS CAP 1.2 JSON-profile Alert document
 *   - `sitrep`    : NDRF tactical Situation Report overlay
 *   - `broadcast_channels`: NDRF multi-channel broadcast checklist
 *   - `cascade`   : the BasinCascadeResult that drove the directive
 *
 * The CAP `info.area.polygon` is emitted in CAP string form
 * ("lat,lng lat,lng ...") per OASIS CAP 1.2 §3.2.4, computed from the
 * union of the three micro-catchment rings.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rainfall: Record<string, number> = body?.rainfall ?? {};
    const soilMoisture: Record<string, number> = body?.soilMoisture ?? {};
    const telemetryTimestamp: string =
      body?.telemetryTimestamp ?? new Date().toISOString();

    const engine = getHydrologyEngine();
    const cascade = engine.simulateBasinCascade(rainfall, soilMoisture);

    const cap = buildCapAlert(cascade, telemetryTimestamp);
    const capXml = buildCapXml(cap);
    const sitrep = buildSitrep(cascade, telemetryTimestamp, rainfall, soilMoisture);
    const broadcastChannels = engine.buildBroadcastChannels(
      cascade.basin_wide_alert_level
    );

    return NextResponse.json(
      { cap, cap_xml: capXml, sitrep, broadcast_channels: broadcastChannels, cascade },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sitrep failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hydrology/sitrep
 * Returns the operational NDRF situation report for the active or baseline telemetry.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rainfall: Record<string, number> = {
      "UK-CHM-UPPER": Number(searchParams.get("rain_upper") ?? "32"),
      "UK-CHM-MID": Number(searchParams.get("rain_mid") ?? "24"),
      "UK-CHM-LOWER": Number(searchParams.get("rain_lower") ?? "18"),
    };
    const soilMoisture: Record<string, number> = {
      "UK-CHM-UPPER": Number(searchParams.get("moist_upper") ?? "68"),
      "UK-CHM-MID": Number(searchParams.get("moist_mid") ?? "72"),
      "UK-CHM-LOWER": Number(searchParams.get("moist_lower") ?? "78"),
    };
    const telemetryTimestamp = new Date().toISOString();

    const engine = getHydrologyEngine();
    const cascade = engine.simulateBasinCascade(rainfall, soilMoisture);

    const cap = buildCapAlert(cascade, telemetryTimestamp);
    const capXml = buildCapXml(cap);
    const sitrep = buildSitrep(cascade, telemetryTimestamp, rainfall, soilMoisture);
    const broadcastChannels = engine.buildBroadcastChannels(
      cascade.basin_wide_alert_level
    );

    return NextResponse.json(
      { cap, cap_xml: capXml, sitrep, broadcast_channels: broadcastChannels, cascade },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sitrep failed" },
      { status: 500 }
    );
  }
}


/* ------------------------------------------------------------------ *
 *  CAP 1.2 (OASIS) JSON-profile helpers
 * ------------------------------------------------------------------ */

/** NDRF operational sender id (8-Bn-Chamoli). */
const NDRF_SENDER_ID = "NDRF-08-BN-CHAMOLI";

function severityFor(level: RiskLevel): {
  severity: string;
  urgency: string;
  certainty: string;
  response: string;
} {
  switch (level) {
    case "CATACLYSMIC":
      return {
        severity: "Extreme",
        urgency: "Immediate",
        certainty: "Observed",
        response: "Evacuate",
      };
    case "EXTREME":
      return {
        severity: "Extreme",
        urgency: "Immediate",
        certainty: "Likely",
        response: "Evacuate",
      };
    case "HIGH":
      return {
        severity: "Severe",
        urgency: "Expected",
        certainty: "Likely",
        response: "Prepare",
      };
    case "MODERATE":
      return {
        severity: "Moderate",
        urgency: "Future",
        certainty: "Possible",
        response: "Monitor",
      };
    case "LOW":
    default:
      return {
        severity: "Minor",
        urgency: "Future",
        certainty: "Unlikely",
        response: "AllClear",
      };
  }
}

/**
 * Build a CAP polygon string ("lat,lng lat,lng ...") from the union of all
 * catchment rings. CAP polygon ordering is [lat,lng], space-separated, with
 * a minimum of 4 vertices and a closed ring.
 */
function capPolygonFromCatchments(): string {
  const engine = getHydrologyEngine();
  const cat = engine.getCatalogue();
  const pts: string[] = [];
  for (const f of cat.features) {
    const ring = f.geometry.coordinates[0];
    // CAP wants lat,lng — note the swap from GeoJSON's lng,lat.
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng, lat] = ring[i];
      pts.push(`${lat.toFixed(4)},${lng.toFixed(4)}`);
    }
  }
  // Close the combined ring if needed.
  if (pts.length > 0) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first !== last) pts.push(first);
  }
  return pts.join(" ");
}

function buildCapAlert(cascade: BasinCascadeResult, telemetryTimestamp: string) {
  const engine = getHydrologyEngine();
  const cat = engine.getCatalogue();
  const { severity, urgency, certainty, response } = severityFor(
    cascade.basin_wide_alert_level
  );

  const sent = cascade.timestamp;
  const onset = new Date(sent).getTime();
  // Expires 6 hours after issue for Immediate/Expected, 12 h otherwise.
  const expireHrs =
    urgency === "Immediate" ? 6 : urgency === "Expected" ? 6 : 12;
  const expires = new Date(onset + expireHrs * 3600_000).toISOString();

  const wardLines = cascade.per_ward_risk
    .map(
      (w) =>
        `  • ${w.ward_id} (${w.ward_name}): ${w.risk_level} — ` +
        `rainfall ${w.rainfall_intensity_mm_hr} mm/hr vs threshold ${w.dynamic_threshold_mm_hr} mm/hr ` +
        `(exceedance ${w.exceedance_ratio.toFixed(2)}×), peak Q ${w.peak_discharge_m3_per_s} m³/s, ` +
        `debris-flow probability ${(w.debris_flow_probability * 100).toFixed(0)}%, arrival ${w.estimated_flood_arrival_min} min.`
    )
    .join("\n");

  const description =
    `Hyper-local flash-flood & debris-flow early warning issued by ISRO-NRSC ` +
    `for the Upper Alaknanda–Dhauliganga basin (Joshimath–Vishnuprayag–Helang ` +
    `gorge, Chamoli, Uttarakhand). Cumulative confluence discharge ` +
    `${cascade.cumulative_lower_basin_discharge_m3_per_s} m³/s; surge-to-gorge ` +
    `lead time ${Math.round(cascade.lower_basin_surge_arrival_min)} min. ` +
    `Telemetry observed at ${telemetryTimestamp}.\n\nPer-ward assessment:\n${wardLines}`;

  const areaDesc = cascade.per_ward_risk
    .map((w) => `${w.ward_id} — ${w.ward_name}`)
    .join("; ");

  // Aggregate vulnerable population & livestock across wards.
  const vulnerable = cascade.per_ward_risk.reduce((s, w) => {
    const p = engine.getProperties(w.ward_id);
    return s + p.vulnerable_population;
  }, 0);
  const livestock = cascade.per_ward_risk.reduce((s, w) => {
    const p = engine.getProperties(w.ward_id);
    return s + p.livestock_count;
  }, 0);

  // Stable identifier derived from alert level + minute-bucketed sent time.
  const ident = `NRSC-FFEWS-${sent.slice(0, 16).replace(/[-:T]/g, "")}-${cascade.basin_wide_alert_level}`;

  return {
    alert: {
      identifier: ident,
      sender: `${NDRF_SENDER_ID}@ndrf.gov.in`,
      sent,
      status: "Actual",
      msgType: "Alert",
      scope: "Public",
      code: ["NRSC-FFEWS-v1.5", "OASIS-CAP-1.2"],
      references: [],
      incidents: ["Upper-Alaknanda-Dhauliganga-2021-Chamoli-Corridor"],
      info: [
        {
          language: "en-IN",
          category: ["Met", "Geo"],
          event: "Flash Flood and Debris Flow",
          urgency,
          severity,
          certainty,
          responseTypes: [response],
          audience: "NDRF Ops Directorate, IMD Hydromet, Uttarakhand SDMA, Chamoli DDMA",
          effective: sent,
          onset: sent,
          expires,
          senderName: "NDRF 08 Bn Chamoli (Ops) · ISRO-NRSC · IMD Hydromet",
          headline: `${severity.toUpperCase()} — Flash Flood & Debris Flow warning, Upper Alaknanda basin, Chamoli (alert: ${cascade.basin_wide_alert_level})`,
          description,
          instruction: cascade.ndrf_deployment_directive,
          web: "https://nrsc.gov.in/Alaknanda_FFEWS",
          contact: "NDRF Ops Centre +91-11-2610-7940; NRSC Duty Officer +91-40-2388-4423",
          parameter: [
            {
              valueName: "cumulativeConfluenceQ_m3s",
              value: String(cascade.cumulative_lower_basin_discharge_m3_per_s),
            },
            {
              valueName: "surgeLeadTime_min",
              value: String(Math.round(cascade.lower_basin_surge_arrival_min)),
            },
            {
              valueName: "vulnerablePopulation",
              value: String(vulnerable),
            },
            {
              valueName: "livestockCount",
              value: String(livestock),
            },
            {
              valueName: "routingOrder",
              value: cascade.routing_order.join(" -> "),
            },
          ],
          area: {
            areaDesc,
            polygon: capPolygonFromCatchments(),
            geocode: [
              {
                valueName: "ISO3166-2",
                value: "IN-UT-053", // Chamoli
              },
              {
                valueName: "basin",
                value: "Upper Alaknanda",
              },
            ],
          },
        },
      ],
    },
    cap_version: "1.2",
    cap_profile: "OASIS-JSON",
  };
}

/* ------------------------------------------------------------------ *
 *  CAP 1.2 XML serialiser (OASIS CAP 1.2 schema)
 * ------------------------------------------------------------------ */

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function buildCapXml(cap: ReturnType<typeof buildCapAlert>): string {
  const a = cap.alert;
  const info = a.info[0];
  const params = info.parameter
    .map(
      (p) =>
        `        <parameter><valueName>${xmlEscape(p.valueName)}</valueName><value>${xmlEscape(p.value)}</value></parameter>`
    )
    .join("\n");
  const geocodes = info.area.geocode
    .map(
      (g) =>
        `          <geocode><valueName>${xmlEscape(g.valueName)}</valueName><value>${xmlEscape(g.value)}</value></geocode>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${xmlEscape(a.identifier)}</identifier>
  <sender>${xmlEscape(a.sender)}</sender>
  <sent>${xmlEscape(a.sent)}</sent>
  <status>${xmlEscape(a.status)}</status>
  <msgType>${xmlEscape(a.msgType)}</msgType>
  <scope>${xmlEscape(a.scope)}</scope>
  ${a.code.map((c) => `<code>${xmlEscape(c)}</code>`).join("\n  ")}
  <incidents>${a.incidents.map((i) => xmlEscape(i)).join(", ")}</incidents>
  <info>
    <language>${xmlEscape(info.language)}</language>
    ${info.category.map((c) => `<category>${xmlEscape(c)}</category>`).join("\n    ")}
    <event>${xmlEscape(info.event)}</event>
    <urgency>${xmlEscape(info.urgency)}</urgency>
    <severity>${xmlEscape(info.severity)}</severity>
    <certainty>${xmlEscape(info.certainty)}</certainty>
    ${info.responseTypes.map((r) => `<responseType>${xmlEscape(r)}</responseType>`).join("\n    ")}
    <audience>${xmlEscape(info.audience)}</audience>
    <effective>${xmlEscape(info.effective)}</effective>
    <onset>${xmlEscape(info.onset)}</onset>
    <expires>${xmlEscape(info.expires)}</expires>
    <senderName>${xmlEscape(info.senderName)}</senderName>
    <headline>${xmlEscape(info.headline)}</headline>
    <description>${xmlEscape(info.description)}</description>
    <instruction>${xmlEscape(info.instruction)}</instruction>
    <web>${xmlEscape(info.web)}</web>
    <contact>${xmlEscape(info.contact)}</contact>
${params}
    <area>
      <areaDesc>${xmlEscape(info.area.areaDesc)}</areaDesc>
      <polygon>${xmlEscape(info.area.polygon)}</polygon>
${geocodes}
    </area>
  </info>
</alert>
`;
}

/* ------------------------------------------------------------------ *
 *  NDRF SITREP overlay
 * ------------------------------------------------------------------ */

function buildSitrep(
  cascade: BasinCascadeResult,
  telemetryTimestamp: string,
  rainfall: Record<string, number>,
  soilMoisture: Record<string, number>
) {
  const engine = getHydrologyEngine();
  const wards = cascade.per_ward_risk.map((w) => {
    const p = engine.getProperties(w.ward_id);
    const plan = engine.getEvacuationPlan(w.ward_id);
    return {
      ward_id: w.ward_id,
      ward_name: w.ward_name,
      tehsil: p.administrative_tehsil,
      risk_level: w.risk_level,
      rainfall_intensity_mm_hr: w.rainfall_intensity_mm_hr,
      dynamic_threshold_mm_hr: w.dynamic_threshold_mm_hr,
      exceedance_ratio: w.exceedance_ratio,
      threshold_exceeded: w.threshold_exceeded,
      peak_discharge_m3_per_s: w.peak_discharge_m3_per_s,
      local_discharge_m3_per_s: w.local_discharge_m3_per_s,
      inflow_discharge_m3_per_s: w.inflow_discharge_m3_per_s,
      outflow_discharge_m3_per_s: w.outflow_discharge_m3_per_s,
      estimated_flood_arrival_min: w.estimated_flood_arrival_min,
      debris_flow_probability: w.debris_flow_probability,
      runoff_coefficient_C: w.runoff_coefficient_C,
      recommended_action: w.recommended_action,
      vulnerable_population: p.vulnerable_population,
      livestock_count: p.livestock_count,
      critical_infrastructure: p.critical_infrastructure,
      evacuation_plan: plan,
      rainfall_observed: rainfall[w.ward_id] ?? 0,
      soil_moisture_pct: soilMoisture[w.ward_id] ?? 0,
    };
  });

  const vulnerable = wards.reduce(
    (s, w) => s + w.vulnerable_population,
    0
  );
  const livestock = wards.reduce((s, w) => s + w.livestock_count, 0);
  const totalShelterCapacity = wards.reduce(
    (s, w) =>
      s +
      w.evacuation_plan.reduce((a, e) => a + e.capacity_persons, 0),
    0
  );
  const shelterCoveragePct =
    vulnerable > 0
      ? Number(((totalShelterCapacity / vulnerable) * 100).toFixed(1))
      : 0;

  return {
    sitrep_id: `NDRF-SITREP-${cascade.timestamp
      .slice(0, 16)
      .replace(/[-:T]/g, "")}`,
    issued_at: cascade.timestamp,
    telemetry_observed_at: telemetryTimestamp,
    issuing_authority: "ISRO-NRSC (National Remote Sensing Centre)",
    coordinated_with: [
      "IMD Hydrometeorological Directorate",
      "NDRF Operations Directorate (MHA)",
      "Uttarakhand SDMA",
      "Chamoli DDMA",
    ],
    basin: "Upper Alaknanda–Dhauliganga",
    corridor: "Joshimath–Vishnuprayag–Helang gorge",
    basin_wide_alert_level: cascade.basin_wide_alert_level,
    routing_order: cascade.routing_order,
    cumulative_lower_basin_discharge_m3_per_s:
      cascade.cumulative_lower_basin_discharge_m3_per_s,
    lower_basin_surge_arrival_min: Math.round(
      cascade.lower_basin_surge_arrival_min
    ),
    ndrf_deployment_directive: cascade.ndrf_deployment_directive,
    tactical_summary: {
      vulnerable_population_total: vulnerable,
      livestock_total: livestock,
      shelter_capacity_total: totalShelterCapacity,
      shelter_coverage_pct: shelterCoveragePct,
    },
    per_ward: wards,
  };
}

export type SitrepResponse = Awaited<ReturnType<typeof POST>> extends NextResponse
  ? never
  : {
      cap: ReturnType<typeof buildCapAlert>;
      cap_xml: string;
      sitrep: ReturnType<typeof buildSitrep>;
      broadcast_channels: BroadcastChannel[];
      cascade: BasinCascadeResult;
    };

// Re-exported for client typing convenience.
export type { FlashFloodRiskVector };
