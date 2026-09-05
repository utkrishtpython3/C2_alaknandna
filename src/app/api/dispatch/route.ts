import { NextResponse } from "next/server";
import { getHydrologyEngine } from "@/lib/hydrologyEngine.server";
import type {
  BasinCascadeResult,
  BroadcastChannel,
  FlashFloodRiskVector,
  RiskLevel,
} from "@/lib/hydrologyEngine";
import {
  compressCAPAlertToPayload,
  buildTelemetryFrameFromCascade,
  encodeTelemetryFrame,
  bytesToHex,
  bytesToBase64,
  WARD_NUMERIC_MAP,
  RISK_ORDINAL_MAP,
  type CompactAlertBurst,
  type WardNumericId,
} from "@/lib/loraProtocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 *  POST /api/dispatch  —  NDMA-COMPLIANT CAP-SA v1.2 DISPATCH ENDPOINT
 * ============================================================================
 *  Receives a `DispatchPayload` from the C2 dashboard, runs the cascade,
 *  and returns the full Phase-3 dispatch bundle:
 *
 *    • `cap_xml`            — OASIS CAP 1.2 XML alert (NDMA-SA profile)
 *    • `cap`                — OASIS CAP 1.2 JSON-profile alert
 *    • `lora_telemetry`     — 32-byte CompactTelemetryFrame per ward (hex+base64)
 *    • `lora_alert_burst`   — 48-byte compressed CAP alert burst (hex+base64+SNR)
 *    • `broadcast_channels` — NDRF multi-channel broadcast matrix
 *    • `failover_topology`  — multi-tier resilient uplink snapshot
 *    • `cascade`            — the driving BasinCascadeResult
 *
 *  This is the operational "transmit" button: when fibre is down and BTS
 *  towers are flooded, the alert still reaches offline villages via the
 *  LoRa mesh + SATCOM failover chain encoded in this response.
 * ============================================================================
 */

interface DispatchShelter {
  name: string;
  elevationM: number;
  capacity: number;
  coordinates: [number, number];
}

interface DispatchPayload {
  wardId: "UK-CHM-UPPER" | "UK-CHM-MID" | "UK-CHM-LOWER";
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "EXTREME" | "CATACLYSMIC";
  peakQ: number;
  leadTimeMins: number;
  rainfallIntensity: number;
  soilMoisturePct: number;
  confluenceDischarge: number;
  evacuationShelters: DispatchShelter[];
}

/** NDRF operational sender id (8-Bn-Chamoli) — NDMA CAP-SA profile. */
const NDMA_SENDER_ID = "NDRF-08-BN-CHAMOLI";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<DispatchPayload>;
    const payload = normalisePayload(body);

    const engine = getHydrologyEngine();
    const cascade = engine.simulateBasinCascade(
      // Run the cascade with the dispatch payload's telemetry so the CAP
      // description reflects the same risk vector the officer is dispatching.
      { [payload.wardId]: payload.rainfallIntensity },
      { [payload.wardId]: payload.soilMoisturePct }
    );
    // Merge the caller's authoritative peakQ / leadTime / confluenceQ into the
    // cascade so the dispatch reflects exactly what the dashboard showed.
    const authoritativeCascade: BasinCascadeResult = {
      ...cascade,
      cumulative_lower_basin_discharge_m3_per_s: payload.confluenceDischarge,
      lower_basin_surge_arrival_min: payload.leadTimeMins,
      basin_wide_alert_level: payload.riskLevel,
      ndrf_deployment_directive: directiveFor(
        payload.riskLevel,
        payload.confluenceDischarge,
        payload.leadTimeMins
      ),
    };

    const cap = buildCapAlert(authoritativeCascade, payload);
    const capXml = buildCapXml(cap);
    const loraTelemetry = buildLoRaTelemetryFrames(authoritativeCascade, payload);
    const loraAlertBurst = buildLoRaAlertBurst(payload);
    const broadcastChannels = engine.buildBroadcastChannels(payload.riskLevel);
    const failoverTopology = buildFailoverTopology(payload.riskLevel);

    return NextResponse.json(
      {
        cap,
        cap_xml: capXml,
        lora_telemetry: loraTelemetry,
        lora_alert_burst: loraAlertBurst,
        broadcast_channels: broadcastChannels,
        failover_topology: failoverTopology,
        cascade: authoritativeCascade,
        dispatch_meta: {
          received_at: new Date().toISOString(),
          sender: `${NDMA_SENDER_ID}@ndma.gov.in`,
          profile: "NDMA-CAP-SA-1.2",
          frame_sizes: {
            telemetry_bytes: 32,
            alert_burst_bytes: 48,
          },
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "dispatch failed" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ *
 *  PAYLOAD NORMALISATION
 * ------------------------------------------------------------------ */

function normalisePayload(body: Partial<DispatchPayload>): DispatchPayload {
  const wardId = body.wardId;
  if (
    wardId !== "UK-CHM-UPPER" &&
    wardId !== "UK-CHM-MID" &&
    wardId !== "UK-CHM-LOWER"
  ) {
    throw new Error("dispatch: invalid or missing wardId");
  }
  const riskLevel = body.riskLevel;
  const VALID_RISKS: DispatchPayload["riskLevel"][] = [
    "LOW",
    "MODERATE",
    "HIGH",
    "EXTREME",
    "CATACLYSMIC",
  ];
  if (!riskLevel || !VALID_RISKS.includes(riskLevel)) {
    throw new Error("dispatch: invalid or missing riskLevel");
  }
  return {
    wardId,
    riskLevel,
    peakQ: numOr(body.peakQ, 0),
    leadTimeMins: numOr(body.leadTimeMins, 0),
    rainfallIntensity: numOr(body.rainfallIntensity, 0),
    soilMoisturePct: clamp(numOr(body.soilMoisturePct, 0), 0, 100),
    confluenceDischarge: numOr(body.confluenceDischarge, 0),
    evacuationShelters: Array.isArray(body.evacuationShelters)
      ? body.evacuationShelters.map((s) => ({
          name: String(s?.name ?? ""),
          elevationM: numOr(s?.elevationM, 0),
          capacity: numOr(s?.capacity, 0),
          coordinates: [
            numOr(s?.coordinates?.[0], 0),
            numOr(s?.coordinates?.[1], 0),
          ] as [number, number],
        }))
      : [],
  };
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : NaN;
const numOr = (v: unknown, fallback: number): number => {
  const n = num(v);
  return Number.isNaN(n) ? fallback : n;
};
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ *
 *  CAP-SA v1.2 ALERT BUILDER  (NDMA profile)
 * ------------------------------------------------------------------ */

function severityFor(level: DispatchPayload["riskLevel"]) {
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

function directiveFor(
  level: DispatchPayload["riskLevel"],
  qLower: number,
  leadMin: number
): string {
  const q = Math.round(qLower);
  const lead = Math.round(leadMin);
  switch (level) {
    case "CATACLYSMIC":
      return `NDMA DISPATCH — RED: Activate full NDRF battalion (≈4 coys) to Joshimath & Vishnuprayag. Cumulative confluence discharge ≈ ${q} m³/s exceeds 1-in-50 envelope. Force evacuation of all wards. Surge-to-gorge lead ≈ ${lead} min. Coordinate IAF ALH winch ops. LoRa mesh + SATCOM failover active.`;
    case "EXTREME":
      return `NDMA DISPATCH — ORANGE: Stage 2-coy QRT at Helang; pre-deploy inflatable boats to Vishnuprayag. Confluence Q ≈ ${q} m³/s. Lead ≈ ${lead} min. Cellular failover expected — verify LoRa relay.`;
    case "HIGH":
      return `NDMA DISPATCH — YELLOW: 1-coy QRT on 15-min standby. Confluence Q ≈ ${q} m³/s. Lead ≈ ${lead} min. Verify shelter inventories + LoRa mesh health.`;
    case "MODERATE":
      return `NDMA DISPATCH — STANDBY: Recon teams to confirm gauge telemetry. Confluence Q ≈ ${q} m³/s.`;
    case "LOW":
    default:
      return `NDMA DISPATCH — GREEN: Routine monitoring. Confluence Q ≈ ${q} m³/s.`;
  }
}

function capPolygonFromCatchments(): string {
  const engine = getHydrologyEngine();
  const cat = engine.getCatalogue();
  const pts: string[] = [];
  for (const f of cat.features) {
    const ring = f.geometry.coordinates[0];
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng, lat] = ring[i] as [number, number];
      pts.push(`${lat.toFixed(4)},${lng.toFixed(4)}`);
    }
  }
  if (pts.length > 0 && pts[0] !== pts[pts.length - 1]) pts.push(pts[0]);
  return pts.join(" ");
}

function buildCapAlert(cascade: BasinCascadeResult, payload: DispatchPayload) {
  const { severity, urgency, certainty, response } = severityFor(
    payload.riskLevel
  );
  const sent = new Date().toISOString();
  const expireHrs = urgency === "Immediate" ? 6 : 12;
  const expires = new Date(
    Date.parse(sent) + expireHrs * 3600_000
  ).toISOString();

  const shelterLines = payload.evacuationShelters
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.name} — elev ${s.elevationM}m, cap. ${s.capacity}, ` +
        `[${s.coordinates[0].toFixed(4)}, ${s.coordinates[1].toFixed(4)}]`
    )
    .join("\n");

  const description =
    `NDMA CAP-SA v1.2 flash-flood & debris-flow dispatch for ward ${payload.wardId}. ` +
    `Peak discharge ${payload.peakQ} m³/s; surge lead time ${payload.leadTimeMins} min; ` +
    `rainfall intensity ${payload.rainfallIntensity} mm/hr; soil moisture ${payload.soilMoisturePct}%; ` +
    `cumulative confluence discharge ${payload.confluenceDischarge} m³/s.\n\n` +
    `Designated evacuation shelters:\n${shelterLines}`;

  const ident = `NDMA-CAPSA-${sent.slice(0, 16).replace(/[-:T]/g, "")}-${payload.riskLevel}`;

  return {
    alert: {
      identifier: ident,
      sender: `${NDMA_SENDER_ID}@ndma.gov.in`,
      sent,
      status: "Actual",
      msgType: "Alert",
      scope: "Public",
      code: ["NDMA-CAP-SA-1.2", "OASIS-CAP-1.2", "NRSC-FFEWS-v1.6"],
      references: [],
      incidents: ["Upper-Alaknanda-Dhauliganga-Chamoli-Corridor"],
      info: [
        {
          language: "en-IN",
          category: ["Met", "Geo", "Safety"],
          event: "Flash Flood and Debris Flow",
          urgency,
          severity,
          certainty,
          responseTypes: [response],
          audience:
            "NDRF Ops Directorate, IMD Hydromet, Uttarakhand SDMA, Chamoli DDMA, IAF Bareilly SAR",
          effective: sent,
          onset: sent,
          expires,
          senderName: "NDMA 08 Bn Chamoli (NDRF) · ISRO-NRSC · IMD Hydromet",
          headline: `${severity.toUpperCase()} — Flash Flood & Debris Flow dispatch, ${payload.wardId} (alert: ${payload.riskLevel})`,
          description,
          instruction: cascade.ndrf_deployment_directive,
          web: "https://ndma.gov.in/Alaknanda_FFEWS",
          contact:
            "NDMA Ops Centre +91-11-2670-1700; NDRF 08 Bn Chamoli +91-13872-252-100",
          parameter: [
            {
              valueName: "wardId",
              value: payload.wardId,
            },
            {
              valueName: "peakQ_m3s",
              value: String(payload.peakQ),
            },
            {
              valueName: "leadTime_min",
              value: String(payload.leadTimeMins),
            },
            {
              valueName: "rainfallIntensity_mm_hr",
              value: String(payload.rainfallIntensity),
            },
            {
              valueName: "soilMoisture_pct",
              value: String(payload.soilMoisturePct),
            },
            {
              valueName: "confluenceQ_m3s",
              value: String(payload.confluenceDischarge),
            },
            {
              valueName: "evacuationShelterCount",
              value: String(payload.evacuationShelters.length),
            },
            {
              valueName: "loraAlertBurstBytes",
              value: "48",
            },
          ],
          area: {
            areaDesc: `${payload.wardId} — Upper Alaknanda–Dhauliganga basin, Chamoli`,
            polygon: capPolygonFromCatchments(),
            geocode: [
              { valueName: "ISO3166-2", value: "IN-UT-053" },
              { valueName: "basin", value: "Upper Alaknanda" },
            ],
          },
        },
      ],
    },
    cap_version: "1.2",
    cap_profile: "NDMA-SA",
  };
}

/* ------------------------------------------------------------------ *
 *  CAP 1.2 XML SERIALISER (NDMA-SA profile)
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
 *  LORA TELEMETRY + ALERT BURST PACKING
 * ------------------------------------------------------------------ */

interface LoRaTelemetryFrame {
  ward_id: string;
  ward_numeric_id: WardNumericId;
  hex: string;
  base64: string;
  byte_size: number;
  decoded: {
    timestamp: number;
    rainfall_rate_mm_hr: number;
    soil_saturation_pct: number;
    river_stage_m: number;
    risk_ordinal: number;
    risk_label: string;
    relay_hop_count: number;
  };
}

function buildLoRaTelemetryFrames(
  cascade: BasinCascadeResult,
  payload: DispatchPayload
): LoRaTelemetryFrame[] {
  const engine = getHydrologyEngine();
  return cascade.per_ward_risk.map((w: FlashFloodRiskVector): LoRaTelemetryFrame => {
    const props = engine.getProperties(w.ward_id);
    // Derive a river stage from the ward's peak Q via a simple power rating
    // (consistent with the hydrograph panel's stage–discharge curve).
    const stageM = Math.pow(Math.max(1, w.peak_discharge_m3_per_s), 0.35) * 0.32;
    const surgeRate = clamp(
      Math.round(
        (w.peak_discharge_m3_per_s - w.inflow_discharge_m3_per_s) * 0.5
      ),
      -32768,
      32767
    );
    const frame = buildTelemetryFrameFromCascade({
      wardId: w.ward_id,
      timestamp: Math.floor(Date.parse(cascade.timestamp) / 1000),
      rainfallRate_mm_hr: w.rainfall_intensity_mm_hr,
      soilSaturation_pct: clamp(
        Math.round(
          w.ward_id === payload.wardId
            ? payload.soilMoisturePct
            : w.rainfall_intensity_mm_hr > 0
              ? 60 + w.rainfall_intensity_mm_hr * 0.2
              : 40
        ),
        0,
        100
      ),
      riverStage_m: stageM,
      riverSurgeRate_mm_min: surgeRate,
      riskLevel: w.risk_level,
      batteryMv: 3700 - (WARD_NUMERIC_MAP[w.ward_id as keyof typeof WARD_NUMERIC_MAP] - 1) * 80,
      temperatureC: Math.round((props.elevation_min_m + props.elevation_max_m) / 2 / 200 - 5),
      relayHopCount: (WARD_NUMERIC_MAP[w.ward_id as keyof typeof WARD_NUMERIC_MAP] - 1) as 0 | 1 | 2,
    });
    const buf = encodeTelemetryFrame(frame);
    return {
      ward_id: w.ward_id,
      ward_numeric_id: WARD_NUMERIC_MAP[
        w.ward_id as keyof typeof WARD_NUMERIC_MAP
      ] as WardNumericId,
      hex: bytesToHex(buf),
      base64: bytesToBase64(buf),
      byte_size: buf.length,
      decoded: {
        timestamp: frame.timestamp,
        rainfall_rate_mm_hr: frame.rainfallRate_mm_hr,
        soil_saturation_pct: frame.soilSaturation_pct,
        river_stage_m: frame.riverStage_m,
        risk_ordinal: frame.riskLevel,
        risk_label: ["LOW", "MODERATE", "HIGH", "CATACLYSMIC"][frame.riskLevel],
        relay_hop_count: frame.relayHopCount,
      },
    };
  });
}

function buildLoRaAlertBurst(payload: DispatchPayload) {
  const wardNumeric = WARD_NUMERIC_MAP[payload.wardId as keyof typeof WARD_NUMERIC_MAP] as WardNumericId;
  const riskOrdinal =
    RISK_ORDINAL_MAP[payload.riskLevel as keyof typeof RISK_ORDINAL_MAP] ?? 0;
  const burst: CompactAlertBurst = {
    timestamp: Math.floor(Date.now() / 1000),
    wardNumericId: wardNumeric,
    riskLevel: riskOrdinal,
    leadTimeMin: payload.leadTimeMins,
    peakQ_m3_per_s: payload.peakQ,
    rainfallIntensity_mm_hr: payload.rainfallIntensity,
    soilMoisturePct: payload.soilMoisturePct,
    confluenceQ_m3_per_s: payload.confluenceDischarge,
    evacuate:
      payload.riskLevel === "EXTREME" || payload.riskLevel === "CATACLYSMIC",
    shelters: payload.evacuationShelters.slice(0, 4).map((s) => ({
      lat: s.coordinates[1],
      lng: s.coordinates[0],
      elevationM: s.elevationM,
    })),
  };
  return compressCAPAlertToPayload(burst);
}

/* ------------------------------------------------------------------ *
 *  MULTI-TIER RESILIENT FAILOVER TOPOLOGY SNAPSHOT
 * ------------------------------------------------------------------ */

interface FailoverTier {
  id: string;
  label: string;
  tier: number; // 1 = primary, 2 = secondary, 3 = tertiary, 4 = last-resort
  status: "ACTIVE" | "CONNECTED" | "DEGRADED" | "FAILED";
  protocol: string;
  bitrate_kbps: number;
  latency_ms: number;
  reach: string;
  notes: string;
}

interface FailoverTopology {
  severe: boolean;
  active_path: string;
  survivability_pct: number;
  tiers: FailoverTier[];
  offline_village_reach: {
    reachable: boolean;
    via: string;
    latency_ms: number;
    note: string;
  };
}

function buildFailoverTopology(level: DispatchPayload["riskLevel"]): FailoverTopology {
  const severe = level === "EXTREME" || level === "CATACLYSMIC";
  const tiers: FailoverTier[] = [
    {
      id: "satcom",
      label: "SATCOM (GSAT-7A) Ku-band",
      tier: 1,
      status: "ACTIVE",
      protocol: "DVB-S2 / SCPC",
      bitrate_kbps: 512,
      latency_ms: 480,
      reach: "ISRO hub Lucknow → NRSC Hyderabad",
      notes: "Primary telemetry uplink. Survives fibre cuts + BTS flooding.",
    },
    {
      id: "lora-mesh",
      label: "LoRa Mesh (866 MHz SX1262)",
      tier: 2,
      status: "CONNECTED",
      protocol: "LoRaWAN SF9BW125",
      bitrate_kbps: 5,
      latency_ms: 1200,
      reach: "Auli Ridge → Helang → Pandukeshwar (4 nodes)",
      notes: "Offline-fallback. Carries 32-byte telemetry + 48-byte alert burst.",
    },
    {
      id: "vhf",
      label: "VHF Repeater (146.5 MHz)",
      tier: 3,
      status: severe ? "CONNECTED" : "STANDBY",
      protocol: "Analog FM / P25",
      bitrate_kbps: 12,
      latency_ms: 80,
      reach: "Joshimath → Vishnuprayag → Tapovan",
      notes: "Voice + AFSK data fallback for siren + shelter comms.",
    },
    {
      id: "cellular",
      label: "Cellular 4G/5G (Airtel/Jio)",
      tier: 4,
      status: severe ? "FAILED" : "DEGRADED",
      protocol: "LTE / NR",
      bitrate_kbps: severe ? 0 : 8200,
      latency_ms: severe ? 0 : 45,
      reach: "Joshimath BTS (7 cells)",
      notes: severe
        ? "BTS inundated — cellular blackout. CAP relay via SATCOM + LoRa."
        : "Simulated failover — degraded. Do not rely on for life-safety alerts.",
    },
  ];
  const tierWeights: Record<FailoverTier["status"], number> = {
    ACTIVE: 1,
    CONNECTED: 1,
    STANDBY: 0.5,
    DEGRADED: 0.5,
    FAILED: 0,
  };
  const score = Math.round(
    (tiers.reduce((s, t) => s + tierWeights[t.status], 0) / tiers.length) * 100
  );
  const activePath = severe
    ? "SATCOM (GSAT-7A) → LoRa Mesh → VHF (4G/5G BLACKOUT)"
    : "SATCOM + LoRa Mesh + VHF standby + 4G/5G failover";
  return {
    severe,
    active_path: activePath,
    survivability_pct: score,
    tiers,
    offline_village_reach: {
      reachable: true,
      via: "LoRa Mesh → Auli Ridge repeater → Pandukeshwar node",
      latency_ms: 1200,
      note: severe
        ? "Offline villages reachable via LoRa burst (48-byte CAP). Cellular blackout does NOT isolate them."
        : "LoRa mesh carries routine telemetry to offline outposts.",
    },
  };
}

// Re-export for client typing convenience.
export type { BroadcastChannel };
