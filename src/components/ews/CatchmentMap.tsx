"use client";

import { useMemo, useState } from "react";
import type { CatchmentFeature, RiskLevel } from "@/lib/hydrologyEngine";
import { X, TriangleAlert, Gauge, ShieldX, Wrench, Waves } from "lucide-react";

export interface WardRiskState {
  ward_id: string;
  ward_name: string;
  risk_level: RiskLevel;
  peak_discharge_m3_per_s: number;
}

interface CatchmentMapProps {
  features: CatchmentFeature[];
  riskStates: WardRiskState[];
  selectedWard: string | null;
  onSelectWard: (wardId: string) => void;
  /** When true (CATACLYSMIC/EXTREME), render animated evacuation flow arrows. */
  surgeActive: boolean;
  /** Basin-wide alert level — drives infra vulnerability node statuses. */
  alertLevel: RiskLevel;
}

const RISK_FILL: Record<RiskLevel, string> = {
  LOW: "#10b981",
  MODERATE: "#f59e0b",
  HIGH: "#f97316",
  EXTREME: "#ef4444",
  CATACLYSMIC: "#be123c",
};

const RISK_STROKE: Record<RiskLevel, string> = {
  LOW: "#34d399",
  MODERATE: "#fbbf24",
  HIGH: "#fb923c",
  EXTREME: "#f87171",
  CATACLYSMIC: "#fb7185",
};

/** Reference bankfull discharge (m³/s) for the stage–Q rating. */
const BANKFULL_Q = 120;
/** Reference bankfull stage (m above datum). */
const BANKFULL_STAGE = 2.8;
/** Stage–discharge rating exponent. */
const STAGE_EXP = 0.35;

interface InfraMarker {
  lng: number;
  lat: number;
  type: string;
  name: string;
  ward_id: string;
  critical_gauge_level_m: number;
}
interface ShelterMarker {
  lng: number;
  lat: number;
  name: string;
  elevation_m: number;
}

/** Evacuation flow corridor — a source (at-risk) → destination (safe high-ground). */
interface EvacCorridor {
  id: string;
  from: [number, number];
  to: [number, number];
  label: string;
  margin_m: number;
}

/** Vulnerability status assigned to each infra marker based on alert level. */
type InfraStatus =
  | "NOMINAL"
  | "ADVISORY"
  | "INTERDICTED"
  | "INUNDATION_IMMINENT"
  | "SHUTDOWN";

interface InfraVulnerability {
  status: InfraStatus;
  label: string;
  fill: string;
  stroke: string;
  textColor: string;
  flashing: boolean;
}

function computeStageM(q: number): number {
  return BANKFULL_STAGE * Math.pow(Math.max(1, q) / BANKFULL_Q, STAGE_EXP);
}

function infraVulnerability(
  type: string,
  wardId: string,
  alertLevel: RiskLevel
): InfraVulnerability {
  const severe = alertLevel === "EXTREME" || alertLevel === "CATACLYSMIC";
  const high = alertLevel === "HIGH" || severe;

  // Vishnuprayag Confluence Bridge (LOWER BRIDGE) — inundation risk.
  if (type === "BRIDGE" && wardId === "UK-CHM-LOWER") {
    if (severe)
      return {
        status: "INUNDATION_IMMINENT",
        label: "INUNDATION IMMINENT",
        fill: "#7f1d1d",
        stroke: "#f43f5e",
        textColor: "#fda4af",
        flashing: true,
      };
    if (high)
      return {
        status: "ADVISORY",
        label: "ADVISORY — monitor stage",
        fill: "#0f172a",
        stroke: "#f59e0b",
        textColor: "#fde68a",
        flashing: false,
      };
  }
  // Other bridges.
  if (type === "BRIDGE") {
    if (severe)
      return {
        status: "ADVISORY",
        label: "ADVISORY — bridge scour risk",
        fill: "#0f172a",
        stroke: "#f59e0b",
        textColor: "#fde68a",
        flashing: false,
      };
  }
  // NH-7 highway / tunnel / culvert — cut-slope interdiction.
  if (type === "HIGHWAY_TUNNEL") {
    if (severe)
      return {
        status: "INTERDICTED",
        label: "INTERDICTED — landslide surge",
        fill: "#7c2d12",
        stroke: "#f97316",
        textColor: "#fed7aa",
        flashing: false,
      };
    if (high)
      return {
        status: "ADVISORY",
        label: "ADVISORY — pore-pressure rising",
        fill: "#0f172a",
        stroke: "#f59e0b",
        textColor: "#fde68a",
        flashing: false,
      };
  }
  // Substations / barrage — shutdown advisory.
  if (type === "SUBSTATION") {
    if (severe)
      return {
        status: "SHUTDOWN",
        label: "ADVISORY SHUTDOWN",
        fill: "#451a03",
        stroke: "#f59e0b",
        textColor: "#fde68a",
        flashing: false,
      };
  }
  // Hospitals — protect.
  if (type === "HOSPITAL" && severe) {
    return {
      status: "ADVISORY",
      label: "PROTECT — evacuate ground floor",
      fill: "#0f172a",
      stroke: "#f59e0b",
      textColor: "#fde68a",
      flashing: false,
    };
  }
  return {
    status: "NOMINAL",
    label: "NOMINAL",
    fill: "#0f172a",
    stroke: "#f59e0b",
    textColor: "#fde68a",
    flashing: false,
  };
}

const STATUS_ICON: Record<InfraStatus, typeof Gauge> = {
  NOMINAL: Gauge,
  ADVISORY: TriangleAlert,
  INTERDICTED: ShieldX,
  INUNDATION_IMMINENT: Waves,
  SHUTDOWN: Wrench,
};

export function CatchmentMap({
  features,
  riskStates,
  selectedWard,
  onSelectWard,
  surgeActive,
  alertLevel,
}: CatchmentMapProps) {
  const [selectedInfra, setSelectedInfra] = useState<InfraMarker | null>(null);

  const {
    viewBox,
    project,
    infraMarkers,
    shelterMarkers,
    riverPath,
    evacCorridors,
    svgW,
    svgH,
  } = useMemo(() => {
    const allCoords: [number, number][] = [];
    for (const f of features) {
      for (const pt of f.geometry.coordinates[0]) allCoords.push(pt as [number, number]);
    }
    for (const f of features) {
      for (const inf of f.properties.critical_infrastructure)
        allCoords.push(inf.coordinates as [number, number]);
      for (const sh of f.properties.designated_ndrf_evacuation_points)
        allCoords.push(sh.coordinates as [number, number]);
    }

    const lons = allCoords.map((c) => c[0]);
    const lats = allCoords.map((c) => c[1]);
    const minLng = Math.min(...lons);
    const maxLng = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const meanLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((meanLat * Math.PI) / 180);

    const W = 460;
    const H = 540;
    const pad = 36;
    const spanX = (maxLng - minLng) * cosLat;
    const spanY = maxLat - minLat;
    const scaleX = (W - 2 * pad) / spanX;
    const scaleY = (H - 2 * pad) / spanY;
    const scale = Math.min(scaleX, scaleY);

    const project = ([lng, lat]: [number, number]): [number, number] => {
      const x = pad + (lng - minLng) * cosLat * scale;
      const y = H - (pad + (lat - minLat) * scale);
      return [x, y];
    };

    const infraMarkers: InfraMarker[] = [];
    const shelterMarkers: ShelterMarker[] = [];
    for (const f of features) {
      for (const inf of f.properties.critical_infrastructure)
        infraMarkers.push({
          lng: inf.coordinates[0],
          lat: inf.coordinates[1],
          type: inf.type,
          name: inf.name,
          ward_id: f.properties.ward_id,
          critical_gauge_level_m: inf.critical_gauge_level_m,
        });
      for (const sh of f.properties.designated_ndrf_evacuation_points)
        shelterMarkers.push({
          lng: sh.coordinates[0],
          lat: sh.coordinates[1],
          name: sh.name,
          elevation_m: sh.elevation_m,
        });
    }

    // Stylized Alaknanda main-stem river path.
    const riverPts: [number, number][] = [
      [79.576, 30.559],
      [79.572, 30.549],
      [79.566, 30.540],
      [79.562, 30.530],
      [79.561, 30.522],
      [79.559, 30.518],
    ].map(project);
    const riverPath =
      "M " +
      riverPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ");

    // Evacuation flow corridors: source (at-risk) → destination (safe).
    // Joshimath lower settlement → Gorson Bugyal / Auli highland.
    // Vishnuprayag riverbed → Pandukeshwar Temple high ground.
    const evacCorridors: EvacCorridor[] = [
      {
        id: "evac-joshimath-gorson",
        from: [79.565, 30.548],
        to: [79.576, 30.573],
        label: "Joshimath → Gorson Bugyal",
        margin_m: 340,
      },
      {
        id: "evac-vishnuprayag-pandukeshwar",
        from: [79.561, 30.522],
        to: [79.548, 30.530],
        label: "Vishnuprayag → Pandukeshwar",
        margin_m: 140,
      },
    ];

    return {
      viewBox: `0 0 ${W} ${H}`,
      project,
      infraMarkers,
      shelterMarkers,
      riverPath,
      evacCorridors,
      svgW: W,
      svgH: H,
    };
  }, [features]);

  const riskMap = useMemo(() => {
    const m = new Map<string, WardRiskState>();
    for (const r of riskStates) m.set(r.ward_id, r);
    return m;
  }, [riskStates]);

  const infraGlyph = (type: string) => {
    switch (type) {
      case "BRIDGE":
        return "B";
      case "SUBSTATION":
        return "S";
      case "HOSPITAL":
        return "H";
      case "HIGHWAY_TUNNEL":
        return "T";
      default:
        return "•";
    }
  };

  if (!features || features.length === 0) {
    return (
      <div className="h-[420px] w-full rounded-lg border border-slate-700/60 bg-slate-950/80 shimmer" />
    );
  }

  // Compute the popover position from the selected infra marker's projected coords.
  const selectedInfraProjected = selectedInfra
    ? project([selectedInfra.lng, selectedInfra.lat])
    : null;
  const selectedWardState = selectedInfra
    ? riskMap.get(selectedInfra.ward_id)
    : null;
  const selectedStageM = selectedWardState
    ? computeStageM(selectedWardState.peak_discharge_m3_per_s)
    : 0;
  const selectedVuln = selectedInfra
    ? infraVulnerability(selectedInfra.type, selectedInfra.ward_id, alertLevel)
    : null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/80">
      <svg
        viewBox={viewBox}
        className="h-auto w-full"
        role="img"
        aria-label="Catchment hazard map, Upper Alaknanda–Dhauliganga corridor"
      >
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="evac-arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="#34d399" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* main river stem */}
        <path d={riverPath} fill="none" stroke="#0e7490" strokeWidth="6" strokeLinecap="round" opacity="0.55" filter="url(#glow)" />
        <path d={riverPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" opacity="0.7" />

        {/* catchment polygons */}
        {features.map((f) => {
          const ring = f.geometry.coordinates[0] as [number, number][];
          const pts = ring.map(project).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
          const id = f.properties.ward_id;
          const state = riskMap.get(id);
          const level = state?.risk_level ?? "LOW";
          const selected = selectedWard === id;
          const centroid = ring
            .slice(0, -1)
            .reduce(
              (acc, c) => [acc[0] + c[0], acc[1] + c[1]] as [number, number],
              [0, 0] as [number, number]
            );
          const ccount = ring.length - 1;
          const [cx, cy] = project([centroid[0] / ccount, centroid[1] / ccount]);
          return (
            <g key={id} className="cursor-pointer" onClick={() => onSelectWard(id)}>
              <polygon
                points={pts}
                fill={RISK_FILL[level]}
                fillOpacity={selected ? 0.55 : 0.32}
                stroke={RISK_STROKE[level]}
                strokeWidth={selected ? 3 : 1.6}
                strokeLinejoin="round"
              />
              <text x={cx} y={cy} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e2e8f0" style={{ pointerEvents: "none" }}>
                {id.replace("UK-CHM-", "")}
              </text>
              {state && (
                <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#cbd5e1" style={{ pointerEvents: "none" }}>
                  {state.peak_discharge_m3_per_s.toFixed(0)} m³/s
                </text>
              )}
            </g>
          );
        })}

        {/* === PHASE 4: animated evacuation flow arrows === */}
        {surgeActive &&
          evacCorridors.map((corridor) => {
            const [fx, fy] = project(corridor.from);
            const [tx, ty] = project(corridor.to);
            const midX = (fx + tx) / 2 + 14;
            const midY = (fy + ty) / 2 - 10;
            const d = `M ${fx.toFixed(1)},${fy.toFixed(1)} Q ${midX.toFixed(1)},${midY.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;
            return (
              <g key={corridor.id} style={{ pointerEvents: "none" }}>
                <path d={d} fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="round" opacity="0.12" />
                <path
                  d={d}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd="url(#evac-arrowhead)"
                  className="evac-arrow"
                  opacity="0.95"
                />
                <circle cx={fx} cy={fy} r="3" fill="#f43f5e" stroke="#fff" strokeWidth="0.8" />
                <circle cx={tx} cy={ty} r="3.5" fill="#10b981" stroke="#fff" strokeWidth="0.8" />
                <text
                  x={midX}
                  y={midY - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill="#6ee7b7"
                  style={{ pointerEvents: "none", paintOrder: "stroke" }}
                  stroke="#0f172a"
                  strokeWidth="2"
                  strokeOpacity="0.8"
                >
                  +{corridor.margin_m}m
                </text>
              </g>
            );
          })}

        {/* evacuation shelters */}
        {shelterMarkers.map((s, i) => {
          const [x, y] = project([s.lng, s.lat]);
          return (
            <g key={`sh-${i}`}>
              <rect x={x - 4} y={y - 4} width="8" height="8" rx="1.5" fill="#10b981" stroke="#064e3b" strokeWidth="1" />
              <title>{`${s.name} • ${s.elevation_m}m`}</title>
            </g>
          );
        })}

        {/* === PHASE 4: critical infrastructure vulnerability nodes === */}
        {infraMarkers.map((m, i) => {
          const [x, y] = project([m.lng, m.lat]);
          const vuln = infraVulnerability(m.type, m.ward_id, alertLevel);
          return (
            <g
              key={`inf-${i}`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedInfra(m);
              }}
            >
              <circle
                cx={x}
                cy={y}
                r="5.5"
                fill={vuln.fill}
                stroke={vuln.stroke}
                strokeWidth="1.8"
                className={vuln.flashing ? "infra-flash-red" : ""}
              />
              <text x={x} y={y + 2} textAnchor="middle" fontSize="6.5" fontWeight="800" fill={vuln.textColor} style={{ pointerEvents: "none", paintOrder: "stroke" }} stroke="#0f172a" strokeWidth="1.5" strokeOpacity="0.7">
                {infraGlyph(m.type)}
              </text>
              {vuln.status !== "NOMINAL" && vuln.status !== "ADVISORY" && (
                <text x={x} y={y - 9} textAnchor="middle" fontSize="6" fontWeight="700" fill={vuln.stroke} style={{ pointerEvents: "none", paintOrder: "stroke" }} stroke="#0f172a" strokeWidth="2" strokeOpacity="0.85">
                  {vuln.status === "INUNDATION_IMMINENT"
                    ? "INUND"
                    : vuln.status === "INTERDICTED"
                      ? "CUT"
                      : vuln.status === "SHUTDOWN"
                        ? "SDN"
                        : ""}
                </text>
              )}
              <title>{`${m.name} — ${vuln.label}`}</title>
            </g>
          );
        })}

        {/* north arrow */}
        <g transform="translate(410, 36)">
          <polygon points="0,-12 6,8 0,3 -6,8" fill="#f8fafc" />
          <text x="0" y="24" textAnchor="middle" fontSize="9" fill="#94a3b8">N</text>
        </g>
      </svg>

      {/* === PHASE 4: infrastructure inspection popover === */}
      {selectedInfra && selectedInfraProjected && selectedVuln && (
        <div
          className="absolute z-20 w-56 -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(selectedInfraProjected[0] / svgW) * 100}%`,
            top: `${(selectedInfraProjected[1] / svgH) * 100}%`,
            marginTop: "-12px",
          }}
        >
          <div className="rounded-lg border border-slate-600 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-100">
                  {selectedInfra.name}
                </p>
                <p className="text-[9px] text-slate-500">
                  {selectedInfra.ward_id.replace("UK-CHM-", "")} · {selectedInfra.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInfra(null)}
                className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                aria-label="Close inspection popover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Status badge */}
            <div
              className="mb-2 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold"
              style={{
                borderColor: selectedVuln.stroke,
                background: `${selectedVuln.stroke}22`,
                color: selectedVuln.stroke,
              }}
            >
              {(() => {
                const Icon = STATUS_ICON[selectedVuln.status];
                return <Icon className="h-3 w-3" />;
              })()}
              {selectedVuln.label}
            </div>

            {/* Gauge vs stage comparison */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1 text-slate-400">
                  <Gauge className="h-3 w-3 text-amber-400" />
                  Critical gauge
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {selectedInfra.critical_gauge_level_m.toFixed(2)}m
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1 text-slate-400">
                  <Waves className="h-3 w-3 text-cyan-400" />
                  Current stage
                </span>
                <span
                  className={`font-mono font-bold ${
                    selectedStageM >= selectedInfra.critical_gauge_level_m
                      ? "text-rose-300"
                      : "text-cyan-300"
                  }`}
                >
                  {selectedStageM.toFixed(2)}m
                </span>
              </div>
              {/* Stage bar */}
              <div className="relative h-2 mt-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-cyan-500/40"
                  style={{
                    width: `${Math.min(100, (selectedStageM / Math.max(selectedInfra.critical_gauge_level_m, selectedStageM, 1)) * 100)}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-amber-400"
                  style={{
                    left: `${Math.min(100, (selectedInfra.critical_gauge_level_m / Math.max(selectedInfra.critical_gauge_level_m, selectedStageM, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[9px] leading-tight text-slate-500">
                {selectedStageM >= selectedInfra.critical_gauge_level_m
                  ? "⚠ Current stage EXCEEDS critical gauge — asset compromised."
                  : `Margin: ${(selectedInfra.critical_gauge_level_m - selectedStageM).toFixed(2)}m below critical.`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-800 px-3 py-2 text-[10px] text-slate-400">
        {(["LOW", "MODERATE", "HIGH", "EXTREME", "CATACLYSMIC"] as RiskLevel[]).map(
          (l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: RISK_FILL[l] }}
              />
              {l}
            </span>
          )
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Evac shelter
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-amber-500 bg-slate-900" />
          Critical asset
        </span>
        {surgeActive && (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="inline-block h-0.5 w-5 bg-emerald-400" style={{ background: "repeating-linear-gradient(90deg,#34d399 0 4px,transparent 4px 7px)" }} />
            Evac vector
          </span>
        )}
      </div>
    </div>
  );
}
