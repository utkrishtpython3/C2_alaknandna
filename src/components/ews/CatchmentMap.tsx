"use client";

import { useMemo } from "react";
import type { CatchmentFeature, RiskLevel } from "@/lib/hydrologyEngine";

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

interface InfraMarker {
  lng: number;
  lat: number;
  type: string;
  name: string;
}
interface ShelterMarker {
  lng: number;
  lat: number;
  name: string;
  elevation_m: number;
}

export function CatchmentMap({
  features,
  riskStates,
  selectedWard,
  onSelectWard,
}: CatchmentMapProps) {
  const { viewBox, project, infraMarkers, shelterMarkers, riverPath } =
    useMemo(() => {
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
        const y = H - (pad + (lat - minLat) * scale); // flip lat
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
          });
        for (const sh of f.properties.designated_ndrf_evacuation_points)
          shelterMarkers.push({
            lng: sh.coordinates[0],
            lat: sh.coordinates[1],
            name: sh.name,
            elevation_m: sh.elevation_m,
          });
      }

      // Stylized Alaknanda main-stem river path (decorative): traverses
      // from upper ridge outlet down through the gorge to the confluence.
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

      return {
        viewBox: `0 0 ${W} ${H}`,
        project,
        infraMarkers,
        shelterMarkers,
        riverPath,
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

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/80">
      <svg
        viewBox={viewBox}
        className="h-auto w-full"
        role="img"
        aria-label="Catchment hazard map, Upper Alaknanda–Dhauliganga corridor"
      >
        <defs>
          <pattern
            id="grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="#1e293b"
              strokeWidth="0.5"
            />
          </pattern>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* main river stem */}
        <path
          d={riverPath}
          fill="none"
          stroke="#0e7490"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.55"
          filter="url(#glow)"
        />
        <path
          d={riverPath}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />

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
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#e2e8f0"
                style={{ pointerEvents: "none" }}
              >
                {id.replace("UK-CHM-", "")}
              </text>
              {state && (
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#cbd5e1"
                  style={{ pointerEvents: "none" }}
                >
                  {state.peak_discharge_m3_per_s.toFixed(0)} m³/s
                </text>
              )}
            </g>
          );
        })}

        {/* evacuation shelters */}
        {shelterMarkers.map((s, i) => {
          const [x, y] = project([s.lng, s.lat]);
          return (
            <g key={`sh-${i}`}>
              <rect
                x={x - 4}
                y={y - 4}
                width="8"
                height="8"
                rx="1.5"
                fill="#10b981"
                stroke="#064e3b"
                strokeWidth="1"
              />
              <title>{`${s.name} • ${s.elevation_m}m`}</title>
            </g>
          );
        })}

        {/* critical infrastructure */}
        {infraMarkers.map((m, i) => {
          const [x, y] = project([m.lng, m.lat]);
          return (
            <g key={`inf-${i}`}>
              <circle
                cx={x}
                cy={y}
                r="5.5"
                fill="#0f172a"
                stroke="#f59e0b"
                strokeWidth="1.6"
              />
              <text
                x={x}
                y={y + 2}
                textAnchor="middle"
                fontSize="6.5"
                fontWeight="800"
                fill="#fde68a"
                style={{ pointerEvents: "none" }}
              >
                {infraGlyph(m.type)}
              </text>
              <title>{m.name}</title>
            </g>
          );
        })}

        {/* north arrow */}
        <g transform="translate(410, 36)">
          <polygon points="0,-12 6,8 0,3 -6,8" fill="#f8fafc" />
          <text x="0" y="24" textAnchor="middle" fontSize="9" fill="#94a3b8">
            N
          </text>
        </g>
      </svg>

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
      </div>
    </div>
  );
}
