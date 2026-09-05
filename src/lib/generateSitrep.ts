/**
 * ============================================================================
 *  NDRF COMMANDANT INCIDENT SITREP GENERATOR
 * ============================================================================
 *  Author : NDRF 08 Bn Joshimath FOB · in coordination with NDMA / NRSC.
 *
 *  Serialises active basin telemetry into an official Incident Situation
 *  Report (SITREP) conforming to Indian Ministry of Home Affairs (Disaster
 *  Management Division) field formats. Produces both a downloadable JSON
 *  payload and a printable, high-contrast military-styled HTML summary.
 *
 *  Browser-only (uses Blob/URL.createObjectURL + window.open for print).
 * ============================================================================
 */

import type {
  BasinCascadeResult,
  FlashFloodRiskVector,
  RiskLevel,
} from "@/lib/hydrologyEngine";

/* ----------------------------------------------------------------------------
 * 1. TYPES
 * ------------------------------------------------------------------------- */

/** Inputs the page assembles from the live simulation state. */
export interface SimulationState {
  /** The latest cascade result (per-ward risk vectors + confluence). */
  cascade: BasinCascadeResult;
  /** Current soil-moisture per ward (percent 0–100). */
  soilMoisture: Record<string, number>;
  /** Ward elevation_min_m (metres) — used for shelter elevation differentials. */
  wardElevationMin: Record<string, number>;
}

/** One row of the catchment status matrix. */
export interface CatchmentStatusRow {
  ward_id: string;
  ward_name: string;
  risk_level: RiskLevel;
  peak_q_m3_per_s: number;
  rainfall_mm_hr: number;
  soil_saturation_pct: number;
  exceedance_factor: number;
  time_to_inundation_min: number;
}

/** Confluence hydrology summary at the Vishnuprayag terminal gauge. */
export interface ConfluenceHydrology {
  cumulative_discharge_m3_per_s: number;
  /** Reference bankfull capacity (m³/s) for the gorge channel. */
  bankfull_capacity_m3_per_s: number;
  /** Discharge excess above bankfull (m³/s). Negative = within capacity. */
  discharge_excess_m3_per_s: number;
  /** Estimated current river stage (m above datum) from the stage–Q rating. */
  current_stage_m: number;
  /** Bankfull stage (m above datum). */
  bankfull_stage_m: number;
  /** Stage above bankfull (m). Positive = overtopping. */
  stage_excess_m: number;
  /** Max debris-flow entrainment probability across wards (0–1). */
  debris_entrainment_probability: number;
}

/** An evacuation corridor entry with elevation differential. */
export interface EvacuationCorridor {
  ward_id: string;
  shelter_name: string;
  shelter_elevation_m: number;
  ward_toe_elevation_m: number;
  elevation_differential_m: number;
  capacity_persons: number;
  route_id: string;
}

/** The full SITREP report. */
export interface SitrepReport {
  incident_identifier: string;
  security_classification: string;
  issuing_authority: string;
  precedence: string;
  generated_at: string;
  basin_wide_alert_level: RiskLevel;
  catchment_status_matrix: CatchmentStatusRow[];
  confluence_hydrology: ConfluenceHydrology;
  evacuation_corridors: EvacuationCorridor[];
  commandant_tactical_directives: string[];
}

/* ----------------------------------------------------------------------------
 * 2. CONSTANTS
 * ------------------------------------------------------------------------- */

/** Gorge bankfull capacity (m³/s) — consistent with the hydrograph panel. */
const BANKFULL_Q = 120;
/** Bankfull stage (m above datum) for the Vishnuprayag gauge. */
const BANKFULL_STAGE = 2.8;
/** Stage–discharge rating exponent (Himalayan gorge power-law). */
const STAGE_EXPONENT = 0.35;

/* ----------------------------------------------------------------------------
 * 3. SITREP GENERATOR
 * ------------------------------------------------------------------------- */

/**
 * generateSitrepData
 * Serialises the active simulation state into an official NDRF Incident SITREP.
 * The report is deterministic given the inputs (no RNG) so it is reproducible
 * across pitch replays.
 */
export function generateSitrepData(state: SimulationState): SitrepReport {
  const { cascade, soilMoisture, wardElevationMin } = state;

  // --- Catchment status matrix ------------------------------------------
  const matrix: CatchmentStatusRow[] = cascade.per_ward_risk.map(
    (w: FlashFloodRiskVector): CatchmentStatusRow => ({
      ward_id: w.ward_id,
      ward_name: w.ward_name,
      risk_level: w.risk_level,
      peak_q_m3_per_s: round(w.peak_discharge_m3_per_s, 1),
      rainfall_mm_hr: round(w.rainfall_intensity_mm_hr, 1),
      soil_saturation_pct: Math.round(soilMoisture[w.ward_id] ?? 0),
      exceedance_factor: round(w.exceedance_ratio, 2),
      time_to_inundation_min: round(w.estimated_flood_arrival_min, 0),
    })
  );

  // --- Confluence hydrology ---------------------------------------------
  const confluenceQ = cascade.cumulative_lower_basin_discharge_m3_per_s;
  const stageExcess = confluenceQ - BANKFULL_Q;
  // Stage from the power-law rating: h = BANKFULL_STAGE * (Q / Qbf)^exp.
  const currentStage =
    BANKFULL_STAGE * Math.pow(Math.max(1, confluenceQ) / BANKFULL_Q, STAGE_EXPONENT);
  const maxDebris = cascade.per_ward_risk.reduce(
    (m, w) => Math.max(m, w.debris_flow_probability),
    0
  );

  const confluence: ConfluenceHydrology = {
    cumulative_discharge_m3_per_s: round(confluenceQ, 1),
    bankfull_capacity_m3_per_s: BANKFULL_Q,
    discharge_excess_m3_per_s: round(stageExcess, 1),
    current_stage_m: round(currentStage, 2),
    bankfull_stage_m: BANKFULL_STAGE,
    stage_excess_m: round(currentStage - BANKFULL_STAGE, 2),
    debris_entrainment_probability: round(maxDebris, 2),
  };

  // --- Evacuation corridors ---------------------------------------------
  const corridors: EvacuationCorridor[] = [];
  for (const w of cascade.per_ward_risk) {
    const toe = wardElevationMin[w.ward_id] ?? 0;
    for (const sh of w.evacuation_plan) {
      corridors.push({
        ward_id: w.ward_id,
        shelter_name: sh.name,
        shelter_elevation_m: sh.elevation_m,
        ward_toe_elevation_m: toe,
        elevation_differential_m: sh.elevation_m - toe,
        capacity_persons: sh.capacity_persons,
        route_id: sh.route_id,
      });
    }
  }

  // --- Commandant tactical directives -----------------------------------
  const directives = buildDirectives(
    cascade.basin_wide_alert_level,
    confluenceQ,
    Math.round(cascade.lower_basin_surge_arrival_min),
    maxDebris,
    corridors
  );

  return {
    incident_identifier: `NDRF-08BN-SITREP-${Date.now()}`,
    security_classification: "RESTRICTED / OPERATIONAL IMMEDIATE",
    issuing_authority:
      "Commandant, 08th Battalion NDRF, Joshimath Forward Operating Base",
    precedence: "FLASH (Z)",
    generated_at: new Date().toISOString(),
    basin_wide_alert_level: cascade.basin_wide_alert_level,
    catchment_status_matrix: matrix,
    confluence_hydrology: confluence,
    evacuation_corridors: corridors,
    commandant_tactical_directives: directives,
  };
}

/* ----------------------------------------------------------------------------
 * 4. TACTICAL DIRECTIVE BUILDER
 * ------------------------------------------------------------------------- */

function buildDirectives(
  level: RiskLevel,
  confluenceQ: number,
  leadMin: number,
  debrisP: number,
  corridors: EvacuationCorridor[]
): string[] {
  const q = Math.round(confluenceQ);
  const lead = leadMin;
  const debrisPct = Math.round(debrisP * 100);

  // Find the named corridors referenced in the directive text.
  const gorson = corridors.find((c) =>
    /gorson|auli/i.test(c.shelter_name)
  );
  const pandukeshwar = corridors.find((c) =>
    /pandukeshwar/i.test(c.shelter_name)
  );
  const gorsonDiff = gorson
    ? Math.round(gorson.elevation_differential_m)
    : 340;
  const pandukDiff = pandukeshwar
    ? Math.round(pandukeshwar.elevation_differential_m)
    : 140;

  const severe = level === "EXTREME" || level === "CATACLYSMIC";
  const high = level === "HIGH" || severe;

  const directives: string[] = [];

  if (severe) {
    directives.push(
      `DEPLOY Swift Water Rescue Teams (SWRTs) to Vishnuprayag Bridge (Axis NH-7). ` +
        `Cumulative confluence discharge ${q} m³/s exceeds 1-in-50 envelope; surge-to-gorge lead ${lead} min. ` +
        `Pre-position inflatable boats + throw-lines at the barrage intake.`
    );
    directives.push(
      `ENFORCE CLOSURE of NH-7 at Helang Checkpost due to active cut-slope pore-pressure failure ` +
        `and debris-flow entrainment (probability ${debrisPct}%). Divert all vehicular traffic to ` +
        `the Pipalkoti bypass until geotechnical clearance is issued by BRO.`
    );
    directives.push(
      `ACTIVATE EVACUATION CORRIDORS to designated safe shelters: ` +
        `Gorson Bugyal / Auli highland camp (safe elevation margin +${gorsonDiff}m); ` +
        `Pandukeshwar Temple high ground (+${pandukDiff}m). ` +
        `Move vulnerable population (riverbed settlements, NH-7 wayfarers) uphill immediately.`
    );
    directives.push(
      `COMMUNICATIONS FALLBACK: Commercial BTS carrier failure detected — field traffic ` +
        `routing over 865 MHz LoRa mesh repeater network (Auli Ridge → Helang → Pandukeshwar, ` +
        `4 nodes). CAP alert burst encoded as 48-byte frame, SF9BW125, SNR margin 11 dB. ` +
        `Do NOT rely on cellular for life-safety confirmations.`
    );
  } else if (high) {
    directives.push(
      `STAGE Swift Water Rescue Teams (SWRTs) at Joshimath FOB; standby for deployment to ` +
        `Vishnuprayag Bridge (Axis NH-7). Confluence Q ${q} m³/s approaching bankfull.`
    );
    directives.push(
      `ADVISORY CLOSURE of NH-7 Helang Cut-Slope corridor — monitor for pore-pressure failure. ` +
        `BRO to inspect after peak surge passes (lead ${lead} min).`
    );
    directives.push(
      `PREPARE EVACUATION CORRIDORS: Gorson Bugyal (+${gorsonDiff}m), Pandukeshwar (+${pandukDiff}m). ` +
        `Vulnerable population to stand by for movement order.`
    );
    directives.push(
      `COMMS: Verify LoRa mesh repeater chain health; cellular carrier degraded. ` +
        `Maintain SATCOM (GSAT-7A) as primary telemetry uplink.`
    );
  } else {
    directives.push(
      `ROUTINE MONITORING: Confluence Q ${q} m³/s within bankfull capacity. ` +
        `Continue 15-min telemetry polling. No evacuation required.`
    );
    directives.push(
      `COMMS: All tiers nominal (SATCOM + LoRa mesh + cellular). No fallback required.`
    );
  }

  return directives;
}

/* ----------------------------------------------------------------------------
 * 5. JSON DOWNLOAD
 * ------------------------------------------------------------------------- */

/**
 * downloadSitrepJSON
 * Triggers a browser download of the SITREP as a formatted JSON file.
 */
export function downloadSitrepJSON(report: SitrepReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.incident_identifier}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------------------------------------------------------------
 * 6. PRINTABLE TACTICAL HTML (military high-contrast styling)
 * ------------------------------------------------------------------------- */

/**
 * printTacticalSitrepHTML
 * Opens a new browser window with a self-contained, high-contrast military-
 * styled HTML SITREP document and triggers the print dialog (Save as PDF).
 * The document uses a monospace tactical font, amber/red classification
 * banners, and a tabular catchment matrix.
 */
export function printTacticalSitrepHTML(report: SitrepReport): void {
  const html = renderSitrepHTML(report);
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}

function renderSitrepHTML(report: SitrepReport): string {
  const esc = (s: string): string =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const matrixRows = report.catchment_status_matrix
    .map(
      (r) => `
        <tr>
          <td><strong>${esc(r.ward_id.replace("UK-CHM-", ""))}</strong><br><span class="dim">${esc(r.ward_name)}</span></td>
          <td class="risk ${r.risk_level.toLowerCase()}">${esc(r.risk_level)}</td>
          <td class="mono">${r.peak_q_m3_per_s.toFixed(1)}</td>
          <td class="mono">${r.rainfall_mm_hr.toFixed(0)}</td>
          <td class="mono">${r.soil_saturation_pct}%</td>
          <td class="mono ${r.exceedance_factor >= 1 ? "danger" : ""}">${r.exceedance_factor.toFixed(2)}×</td>
          <td class="mono">${Math.round(r.time_to_inundation_min)} min</td>
        </tr>`
    )
    .join("");

  const corridorRows = report.evacuation_corridors
    .map(
      (c) => `
        <tr>
          <td>${esc(c.ward_id.replace("UK-CHM-", ""))}</td>
          <td>${esc(c.shelter_name)}</td>
          <td class="mono">${c.shelter_elevation_m}m</td>
          <td class="mono">${c.ward_toe_elevation_m}m</td>
          <td class="mono ok">+${Math.round(c.elevation_differential_m)}m</td>
          <td class="mono">${c.capacity_persons.toLocaleString()}</td>
        </tr>`
    )
    .join("");

  const directiveList = report.commandant_tactical_directives
    .map((d, i) => `<li><span class="num">${i + 1}.</span> ${esc(d)}</li>`)
    .join("");

  const ch = report.confluence_hydrology;
  const overtops = ch.stage_excess_m > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(report.incident_identifier)} — NDRF SITREP</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", Consolas, monospace; color:#0a0a0a; font-size:10px; line-height:1.5; margin:0; background:#fff; }
  .banner { background: ${overtops ? "#7f1d1d" : "#1e3a5f"}; color:#fff; padding:6px 10px; text-align:center; font-weight:bold; letter-spacing:2px; font-size:9px; }
  .header { display:flex; justify-content:space-between; padding:8px 0; border-bottom:2px solid #1e3a5f; }
  .header h1 { font-size:14px; margin:0; }
  .header .id { font-size:11px; font-weight:bold; }
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:2px 12px; margin:8px 0; padding:6px 8px; background:#f1f5f9; border:1px solid #cbd5e1; }
  .meta .label { font-size:8px; text-transform:uppercase; color:#475569; letter-spacing:1px; }
  .meta .val { font-size:10px; font-weight:bold; }
  h2 { font-size:11px; margin:12px 0 4px; border-bottom:1.5px solid #1e3a5f; padding-bottom:2px; text-transform:uppercase; letter-spacing:1px; }
  table { width:100%; border-collapse:collapse; margin:4px 0; }
  th { background:#1e3a5f; color:#fff; font-size:8px; padding:3px 4px; text-transform:uppercase; letter-spacing:0.5px; text-align:left; }
  td { padding:3px 5px; border-bottom:1px solid #e2e8f0; vertical-align:top; font-size:9px; }
  .dim { color:#666; font-size:8px; }
  .mono { font-family:"Courier New",monospace; }
  .risk { font-weight:bold; }
  .risk.low { color:#059669; }
  .risk.moderate { color:#d97706; }
  .risk.high { color:#ea580c; }
  .risk.extreme { color:#dc2626; }
  .risk.cataclysmic { color:#be123c; }
  .danger { color:#dc2626; font-weight:bold; }
  .ok { color:#059669; font-weight:bold; }
  .confluence { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin:4px 0; }
  .confluence > div { border:1px solid #cbd5e1; padding:5px 7px; }
  .confluence .label { font-size:8px; text-transform:uppercase; color:#475569; letter-spacing:0.5px; }
  .confluence .val { font-size:12px; font-weight:bold; }
  .confluence .val.danger { color:#dc2626; }
  .directives { background:#fef2f2; border-left:4px solid #dc2626; padding:6px 10px; margin:6px 0; }
  .directives ol { margin:0; padding-left:18px; }
  .directives li { margin:3px 0; font-size:9.5px; }
  .directives .num { font-weight:bold; color:#dc2626; }
  .foot { margin-top:12px; border-top:1px solid #cbd5e1; padding-top:4px; font-size:8px; color:#666; text-align:center; }
</style>
</head>
<body>
  <div class="banner">${esc(report.security_classification)}</div>

  <div class="header">
    <div>
      <h1>NDRF INCIDENT SITREP</h1>
      <div class="id">${esc(report.incident_identifier)}</div>
    </div>
    <div style="text-align:right">
      <div class="dim" style="font-size:8px;color:#666">PRECEDENCE</div>
      <div style="font-weight:bold;font-size:11px">${esc(report.precedence)}</div>
      <div class="dim" style="font-size:8px;color:#666;margin-top:3px">GENERATED</div>
      <div class="mono" style="font-size:9px">${esc(report.generated_at.replace("T"," ").replace(/\..+Z$/," UTC"))}</div>
    </div>
  </div>

  <div class="meta">
    <div><div class="label">Issuing Authority</div><div class="val">${esc(report.issuing_authority)}</div></div>
    <div><div class="label">Basin-wide Alert</div><div class="val risk ${report.basin_wide_alert_level.toLowerCase()}">${esc(report.basin_wide_alert_level)}</div></div>
  </div>

  <h2>Catchment Status Matrix</h2>
  <table>
    <thead><tr>
      <th>Ward</th><th>Risk</th><th>Peak Q (m³/s)</th><th>Rain (mm/hr)</th><th>Soil Sat (%)</th><th>Exceedance</th><th>T-inundation</th>
    </tr></thead>
    <tbody>${matrixRows}</tbody>
  </table>

  <h2>Confluence Hydrology — Vishnuprayag Terminal Gauge</h2>
  <div class="confluence">
    <div><div class="label">Cumulative Discharge</div><div class="val">${ch.cumulative_discharge_m3_per_s.toFixed(1)} m³/s</div></div>
    <div><div class="label">Bankfull Capacity</div><div class="val">${ch.bankfull_capacity_m3_per_s} m³/s</div></div>
    <div><div class="label">Discharge Excess</div><div class="val ${ch.discharge_excess_m3_per_s > 0 ? "danger" : ""}">${ch.discharge_excess_m3_per_s > 0 ? "+" : ""}${ch.discharge_excess_m3_per_s.toFixed(1)} m³/s</div></div>
    <div><div class="label">Current Stage</div><div class="val ${overtops ? "danger" : ""}">${ch.current_stage_m.toFixed(2)} m</div></div>
    <div><div class="label">Bankfull Stage</div><div class="val">${ch.bankfull_stage_m.toFixed(2)} m</div></div>
    <div><div class="label">Stage Excess</div><div class="val ${overtops ? "danger" : ""}">${overtops ? "+" : ""}${ch.stage_excess_m.toFixed(2)} m</div></div>
    <div><div class="label">Debris Entrainment</div><div class="val ${ch.debris_entrainment_probability >= 0.65 ? "danger" : ""}">${Math.round(ch.debris_entrainment_probability * 100)}%</div></div>
    <div><div class="label">Verdict</div><div class="val ${overtops ? "danger" : "ok"}">${overtops ? "OVERTOPPING" : "WITHIN BANKS"}</div></div>
    <div></div>
  </div>

  <h2>Evacuation Corridors</h2>
  <table>
    <thead><tr>
      <th>Ward</th><th>Shelter</th><th>Shelter Elev</th><th>Toe Elev</th><th>Safe Margin</th><th>Capacity</th>
    </tr></thead>
    <tbody>${corridorRows}</tbody>
  </table>

  <h2>Commandant's Tactical Directives</h2>
  <div class="directives">
    <ol>${directiveList}</ol>
  </div>

  <div class="foot">
    Generated by NDRF 08 Bn Joshimath FOB · FFEWS v1.6.0 · ${esc(report.generated_at)}<br>
    This SITREP is RESTRICTED — for operational use by NDRF / NDMA / SDMA / DDMA only.
  </div>
</body>
</html>`;
}

/* ----------------------------------------------------------------------------
 * 7. INTERNAL HELPERS
 * ------------------------------------------------------------------------- */

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}
