"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import type { CatchmentFeature, RiskLevel } from "@/lib/hydrologyEngine";
import {
  X,
  TriangleAlert,
  Gauge,
  ShieldX,
  Wrench,
  Waves,
  MapPin,
  Eye,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Radio,
  Mountain,
  Activity,
  Crosshair,
  Footprints,
  Info,
} from "lucide-react";
import {
  MONITORED_VILLAGES_3D,
  STATIONS_3D,
  type MonitoredVillage3D,
} from "@/data/terrain3dGeo";

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
  /** Optional container height */
  height?: string;
}

const RISK_FILL: Record<RiskLevel, string> = {
  LOW: "#059669",
  MODERATE: "#d97706",
  HIGH: "#ea580c",
  EXTREME: "#dc2626",
  CATACLYSMIC: "#9f1239",
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

interface EvacCorridor {
  id: string;
  from: [number, number];
  to: [number, number];
  label: string;
  margin_m: number;
}

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
  height = "640px",
}: CatchmentMapProps) {
  const [selectedInfra, setSelectedInfra] = useState<InfraMarker | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<MonitoredVillage3D | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [hoveredWard, setHoveredWard] = useState<string | null>(null);

  // Layer switches
  const [showRiverFlow, setShowRiverFlow] = useState(true);
  const [showRadarSweep, setShowRadarSweep] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [showRfMesh, setShowRfMesh] = useState(true);
  const [showEvacVectors, setShowEvacVectors] = useState(true);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const svgContainerRef = useRef<HTMLDivElement | null>(null);

  // Cursor HUD coordinate state
  const [cursorCoords, setCursorCoords] = useState<{
    lat: number;
    lng: number;
    elev: number;
    x: number;
    y: number;
    active: boolean;
  }>({
    lat: 30.548,
    lng: 79.563,
    elev: 1890,
    x: 270,
    y: 320,
    active: false,
  });

  const {
    viewBox,
    project,
    unproject,
    infraMarkers,
    shelterMarkers,
    alaknandaStemPath,
    dhauligangaStemPath,
    mergedLowerStemPath,
    evacCorridors,
    contourLines,
    svgW,
    svgH,
    radarCenter,
    confluencePoint,
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
    const midLng = (minLng + maxLng) / 2;
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180);

    const W = 520;
    const H = 580;
    const padX = 30;
    const padY = 24;
    const spanX = (maxLng - minLng) * cosLat;
    const spanY = maxLat - minLat;
    const scaleX = (W - 2 * padX) / spanX;
    const scaleY = (H - 2 * padY) / spanY;
    const scale = Math.min(scaleX, scaleY);

    const centerX = W / 2;
    const centerY = H / 2;

    // Mathematically centered projection
    const project = ([lng, lat]: [number, number]): [number, number] => {
      const x = centerX + (lng - midLng) * cosLat * scale;
      const y = centerY - (lat - midLat) * scale;
      return [x, y];
    };

    const unproject = ([x, y]: [number, number]): [number, number] => {
      const lng = (x - centerX) / (cosLat * scale) + midLng;
      const lat = (centerY - y) / scale + midLat;
      return [lng, lat];
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

    // Authentic Dual-River Hydraulic Network
    // 1. Alaknanda North Stem (from Pandukeshwar/Badrinath down to Vishnuprayag)
    const alaknandaPts: [number, number][] = (
      [
        [79.562, 30.578],
        [79.563, 30.569],
        [79.564, 30.558],
        [79.563, 30.548],
        [79.562, 30.536],
        [79.5621, 30.5245], // Confluence anchor
      ] as [number, number][]
    ).map(project);
    const alaknandaStemPath =
      "M " + alaknandaPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ");

    // 2. Dhauliganga East Tributary (from Tapovan gorge down to Vishnuprayag)
    const dhauligangaPts: [number, number][] = (
      [
        [79.582, 30.552],
        [79.577, 30.544],
        [79.572, 30.536],
        [79.567, 30.530],
        [79.5621, 30.5245], // Confluence anchor
      ] as [number, number][]
    ).map(project);
    const dhauligangaStemPath =
      "M " + dhauligangaPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ");

    // 3. Merged Lower Alaknanda Gorge Torrent (down past Helang)
    const lowerPts: [number, number][] = (
      [
        [79.5621, 30.5245],
        [79.558, 30.521],
        [79.554, 30.518],
        [79.549, 30.515],
        [79.544, 30.512],
      ] as [number, number][]
    ).map(project);
    const mergedLowerStemPath =
      "M " + lowerPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ");

    const confluencePoint = project([79.5621, 30.5245]);
    const radarCenter = project([79.562, 30.556]); // Joshimath C2 Radar Dome

    // Topographic Contours (realistic isolines)
    const contourDefs = [
      {
        elevation: 3400,
        label: "3,400m Auli Ridge",
        points: [
          [79.552, 30.575],
          [79.562, 30.576],
          [79.574, 30.574],
          [79.578, 30.568],
        ] as [number, number][],
      },
      {
        elevation: 2800,
        label: "2,800m Upper Forest",
        points: [
          [79.551, 30.565],
          [79.561, 30.564],
          [79.572, 30.562],
          [79.577, 30.558],
        ] as [number, number][],
      },
      {
        elevation: 2200,
        label: "2,200m Mid Terrace",
        points: [
          [79.552, 30.554],
          [79.560, 30.553],
          [79.568, 30.551],
          [79.576, 30.548],
        ] as [number, number][],
      },
      {
        elevation: 1800,
        label: "1,800m Joshimath Bench",
        points: [
          [79.553, 30.545],
          [79.561, 30.544],
          [79.569, 30.542],
          [79.575, 30.540],
        ] as [number, number][],
      },
      {
        elevation: 1450,
        label: "1,450m Canyon Rim",
        points: [
          [79.554, 30.536],
          [79.562, 30.534],
          [79.568, 30.532],
          [79.574, 30.528],
        ] as [number, number][],
      },
    ];

    const contourLines = contourDefs.map((c) => ({
      elevation: c.elevation,
      label: c.label,
      path:
        "M " +
        c.points
          .map(project)
          .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
          .join(" L "),
      labelPos: project(c.points[1]),
    }));

    // Evacuation flow corridors
    const evacCorridors: EvacCorridor[] = [
      {
        id: "evac-joshimath-gorson",
        from: [79.565, 30.548],
        to: [79.576, 30.573],
        label: "Joshimath → Gorson Bugyal (+340m)",
        margin_m: 340,
      },
      {
        id: "evac-vishnuprayag-pandukeshwar",
        from: [79.561, 30.522],
        to: [79.548, 30.530],
        label: "Vishnuprayag → Pandukeshwar (+140m)",
        margin_m: 140,
      },
      {
        id: "evac-helang-urgam",
        from: [79.548, 30.531],
        to: [79.538, 30.545],
        label: "Helang Gorge → Urgam Ridge (+280m)",
        margin_m: 280,
      },
    ];

    return {
      viewBox: `0 0 ${W} ${H}`,
      project,
      unproject,
      infraMarkers,
      shelterMarkers,
      alaknandaStemPath,
      dhauligangaStemPath,
      mergedLowerStemPath,
      evacCorridors,
      contourLines,
      svgW: W,
      svgH: H,
      radarCenter,
      confluencePoint,
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const normX = (clientX / rect.width) * svgW;
      const normY = (clientY / rect.height) * svgH;
      const [lng, lat] = unproject([normX, normY]);
      const approxElev = Math.round(1350 + (1 - normY / svgH) * 2050);

      setCursorCoords({
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
        elev: approxElev,
        x: normX,
        y: normY,
        active: true,
      });

      if (isPanning) {
        setPan((prev) => ({
          x: prev.x + (e.clientX - panStartRef.current.x),
          y: prev.y + (e.clientY - panStartRef.current.y),
        }));
        panStartRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [isPanning, svgW, svgH, unproject]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && zoom > 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Preset Focus points
  const handleFocusWard = (wardId: string) => {
    onSelectWard(wardId);
    if (wardId === "UK-CHM-UPPER") {
      setZoom(1.35);
      setPan({ x: 0, y: 90 });
    } else if (wardId === "UK-CHM-MID") {
      setZoom(1.35);
      setPan({ x: 0, y: 5 });
    } else if (wardId === "UK-CHM-LOWER") {
      setZoom(1.35);
      setPan({ x: 0, y: -85 });
    }
  };

  if (!features || features.length === 0) {
    return (
      <div className="h-[420px] w-full rounded-lg border border-slate-700/60 bg-slate-950/80 shimmer" />
    );
  }

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
    <div
      ref={svgContainerRef}
      className="relative w-full flex flex-col justify-between overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-950 font-sans shadow-2xl transition-all duration-300 select-none group/map"
      style={{ height }}
    >
      {/* =========================================================================
       *  TOP TACTICAL HUD HEADER BAR
       * ========================================================================= */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-cyan-800/50 text-[10px] font-mono text-cyan-300">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                surgeActive ? "bg-rose-500 animate-ping" : "bg-emerald-400"
              }`}
            />
            <span className="font-bold tracking-wider">
              {surgeActive ? "ALERT // FLASH SURGE" : "SITMAP // LIVE WGS-84"}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <Crosshair className="h-3 w-3 text-cyan-400" />
            <span>
              {cursorCoords.lat.toFixed(4)}°N, {cursorCoords.lng.toFixed(4)}°E
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400">~{cursorCoords.elev}m ASL</span>
          </div>
        </div>

        {/* Quick Ward Focus Pill Buttons */}
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition"
          >
            All Corridor
          </button>
          <button
            type="button"
            onClick={() => handleFocusWard("UK-CHM-UPPER")}
            className={`px-2 py-0.5 rounded border transition ${
              selectedWard === "UK-CHM-UPPER"
                ? "border-amber-400 bg-amber-500/20 text-amber-300 font-bold"
                : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-amber-400/50"
            }`}
          >
            Upper Auli
          </button>
          <button
            type="button"
            onClick={() => handleFocusWard("UK-CHM-MID")}
            className={`px-2 py-0.5 rounded border transition ${
              selectedWard === "UK-CHM-MID"
                ? "border-amber-400 bg-amber-500/20 text-amber-300 font-bold"
                : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-amber-400/50"
            }`}
          >
            Joshimath Mid
          </button>
          <button
            type="button"
            onClick={() => handleFocusWard("UK-CHM-LOWER")}
            className={`px-2 py-0.5 rounded border transition ${
              selectedWard === "UK-CHM-LOWER"
                ? "border-amber-400 bg-amber-500/20 text-amber-300 font-bold"
                : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-amber-400/50"
            }`}
          >
            Vishnuprayag
          </button>
        </div>
      </div>

      {/* =========================================================================
       *  MAIN INTERACTIVE SVG MAP VIEWPORT
       * ========================================================================= */}
      <div
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setCursorCoords((c) => ({ ...c, active: false }));
        }}
      >
        <div
          className="relative h-full w-full max-h-full flex items-center justify-center transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <svg
            viewBox={viewBox}
            className="h-full w-full max-h-full object-contain"
            role="img"
            aria-label="Catchment tactical situational map, Upper Alaknanda–Dhauliganga corridor"
            onMouseMove={handleMouseMove}
          >
            <defs>
              {/* Tactical Sci-Fi Grids */}
              <pattern
                id="tactical-grid-dense"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="0.5"
                />
                <circle cx="20" cy="0" r="0.6" fill="#1e293b" />
              </pattern>

              <pattern
                id="tactical-grid-major"
                width="80"
                height="80"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 80 0 L 0 0 0 80"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="0.8"
                  strokeDasharray="2 4"
                />
                <path d="M 77 80 L 83 80 M 80 77 L 80 83" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.35" />
              </pattern>

              {/* Glowing Filters */}
              <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="surge-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="marker-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.85" />
              </filter>

              {/* Dynamic Gradients */}
              <linearGradient id="river-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>

              <linearGradient id="river-surge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e11d48" />
                <stop offset="60%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>

              {/* Radar Wedge Gradient */}
              <radialGradient id="radar-sweep-wedge" cx="0" cy="0" r="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
              </radialGradient>

              {/* Evac arrow head */}
              <marker
                id="evac-arrowhead"
                markerWidth="9"
                markerHeight="9"
                refX="7"
                refY="4.5"
                orient="auto"
              >
                <path d="M0,0 L9,4.5 L0,9 L2.5,4.5 Z" fill="#34d399" />
              </marker>
            </defs>

            {/* Base Tactical Grids */}
            <rect width="100%" height="100%" fill="#020617" />
            <rect width="100%" height="100%" fill="url(#tactical-grid-dense)" />
            <rect width="100%" height="100%" fill="url(#tactical-grid-major)" />

            {/* MGRS Lat/Long Grid Ticks along borders */}
            <g opacity="0.4" stroke="#475569" strokeWidth="0.8">
              <line x1="40" y1="10" x2="40" y2="20" />
              <line x1="270" y1="10" x2="270" y2="20" />
              <line x1="500" y1="10" x2="500" y2="20" />
              <line x1="10" y1="40" x2="20" y2="40" />
              <line x1="10" y1="320" x2="20" y2="320" />
              <line x1="10" y1="600" x2="20" y2="600" />
            </g>

            {/* Tactical HUD Corner Brackets */}
            <g stroke="#0284c7" strokeWidth="1.5" fill="none" opacity="0.6">
              <path d="M 14 30 L 14 14 L 30 14" />
              <path d="M 526 30 L 526 14 L 510 14" />
              <path d="M 14 610 L 14 626 L 30 626" />
              <path d="M 526 610 L 526 626 L 510 626" />
            </g>

            {/* =============================================================
             *  TOPOGRAPHIC CONTOURS LAYER
             * ============================================================= */}
            {showContours && (
              <g className="transition-opacity duration-300">
                {contourLines.map((c, i) => (
                  <g key={`contour-${i}`}>
                    <path
                      d={c.path}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="2.5"
                      opacity="0.5"
                    />
                    <path
                      d={c.path}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="0.9"
                      strokeDasharray={i % 2 === 0 ? "none" : "3 3"}
                      opacity="0.85"
                    />
                    <text
                      x={c.labelPos[0] + 12}
                      y={c.labelPos[1] - 4}
                      fill="#64748b"
                      fontSize="7"
                      fontFamily="monospace"
                      opacity="0.8"
                    >
                      {c.elevation}m
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* =============================================================
             *  DOPPLER RADAR SWEEP SCANNER LAYER
             * ============================================================= */}
            {showRadarSweep && (
              <g
                transform={`translate(${radarCenter[0]}, ${radarCenter[1]})`}
                className="pointer-events-none"
              >
                {/* Concentric Radar Range Rings */}
                <circle
                  r="60"
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                  opacity="0.3"
                />
                <circle
                  r="120"
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                  opacity="0.25"
                />
                <circle
                  r="180"
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                  opacity="0.18"
                />
                <text x="62" y="-4" fill="#0891b2" fontSize="6.5" fontFamily="monospace" opacity="0.6">
                  3km
                </text>
                <text x="122" y="-4" fill="#0891b2" fontSize="6.5" fontFamily="monospace" opacity="0.6">
                  6km
                </text>
                <text x="182" y="-4" fill="#0891b2" fontSize="6.5" fontFamily="monospace" opacity="0.6">
                  9km
                </text>

                {/* Rotating Sweep Beam */}
                <g className="map-radar-beam">
                  <line
                    x1="0"
                    y1="0"
                    x2="200"
                    y2="0"
                    stroke="#22d3ee"
                    strokeWidth="1.8"
                    opacity="0.75"
                  />
                  <path
                    d="M 0 0 L 200 0 A 200 200 0 0 0 173 -100 Z"
                    fill="url(#radar-sweep-wedge)"
                    opacity="0.2"
                  />
                </g>
              </g>
            )}

            {/* =============================================================
             *  CATCHMENT POLYGONS LAYER
             * ============================================================= */}
            {features.map((f) => {
              const ring = f.geometry.coordinates[0] as [number, number][];
              const pts = ring.map(project).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
              const id = f.properties.ward_id;
              const state = riskMap.get(id);
              const level = state?.risk_level ?? "LOW";
              const selected = selectedWard === id;
              const isCat = level === "CATACLYSMIC" || level === "EXTREME";

              // Clean badge offset per ward so nothing overlaps with pins
              const badgeOffset: Record<string, { dx: number; dy: number }> = {
                "UK-CHM-UPPER": { dx: 0, dy: 10 },
                "UK-CHM-MID": { dx: 24, dy: -20 },
                "UK-CHM-LOWER": { dx: 0, dy: 14 },
              };
              const offset = badgeOffset[id] ?? { dx: 0, dy: 0 };

              const centroid = ring
                .slice(0, -1)
                .reduce(
                  (acc, c) => [acc[0] + c[0], acc[1] + c[1]] as [number, number],
                  [0, 0] as [number, number]
                );
              const ccount = ring.length - 1;
              const [cx, cy] = project([centroid[0] / ccount, centroid[1] / ccount]);

              return (
                <g
                  key={id}
                  className="cursor-pointer transition-all duration-300"
                  onClick={() => onSelectWard(id)}
                  onMouseEnter={() => setHoveredWard(id)}
                  onMouseLeave={() => setHoveredWard(null)}
                >
                  {/* Catchment Fill with Hazard Pulse */}
                  <polygon
                    points={pts}
                    fill={RISK_FILL[level]}
                    fillOpacity={selected ? 0.45 : isCat ? 0.35 : 0.22}
                    stroke={RISK_STROKE[level]}
                    strokeWidth={selected ? 3.2 : isCat ? 2.4 : 1.6}
                    strokeLinejoin="round"
                    className={isCat ? "map-ward-hazard-pulse" : ""}
                    filter={isCat ? "url(#glow-cyan)" : undefined}
                  />

                  {/* Ward Boundary Dash Track */}
                  {selected && (
                    <polygon
                      points={pts}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                      opacity="0.8"
                    />
                  )}

                  {/* Central Ward Badge */}
                  <g
                    transform={`translate(${cx + offset.dx}, ${cy + offset.dy})`}
                    style={{ pointerEvents: "none" }}
                  >
                    <rect
                      x="-44"
                      y="-12"
                      width="88"
                      height="24"
                      rx="4"
                      fill="#020617"
                      fillOpacity="0.9"
                      stroke={RISK_STROKE[level]}
                      strokeWidth="1.2"
                    />
                    <text
                      x="0"
                      y="-1"
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="800"
                      fill="#f8fafc"
                    >
                      {id.replace("UK-CHM-", "")}
                    </text>
                    {state && (
                      <text
                        x="0"
                        y="9"
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="700"
                        fontFamily="monospace"
                        fill={RISK_STROKE[level]}
                      >
                        Q: {state.peak_discharge_m3_per_s.toFixed(0)} m³/s
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* =============================================================
             *  HYDRODYNAMIC DUAL-RIVER FLOW CHANNELS
             * ============================================================= */}
            {showRiverFlow && (
              <g className="pointer-events-none">
                {/* 1. Alaknanda North Stem */}
                <path
                  d={alaknandaStemPath}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth={surgeActive ? "8" : "4.5"}
                  strokeLinecap="round"
                  opacity={surgeActive ? 0.4 : 0.25}
                  filter={surgeActive ? "url(#surge-glow)" : "url(#glow-cyan)"}
                />
                <path
                  d={alaknandaStemPath}
                  fill="none"
                  stroke={surgeActive ? "url(#river-surge-gradient)" : "url(#river-gradient)"}
                  strokeWidth={surgeActive ? "3.5" : "2.2"}
                  strokeLinecap="round"
                />
                <path
                  d={alaknandaStemPath}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={surgeActive ? "2.5" : "1.5"}
                  strokeLinecap="round"
                  className={surgeActive ? "map-river-flow-surge" : "map-river-flow"}
                  opacity="0.9"
                />

                {/* 2. Dhauliganga East Tributary Stem */}
                <path
                  d={dhauligangaStemPath}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth={surgeActive ? "8" : "4"}
                  strokeLinecap="round"
                  opacity={surgeActive ? 0.4 : 0.25}
                  filter={surgeActive ? "url(#surge-glow)" : "url(#glow-cyan)"}
                />
                <path
                  d={dhauligangaStemPath}
                  fill="none"
                  stroke={surgeActive ? "url(#river-surge-gradient)" : "url(#river-gradient)"}
                  strokeWidth={surgeActive ? "3.2" : "2"}
                  strokeLinecap="round"
                />
                <path
                  d={dhauligangaStemPath}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={surgeActive ? "2.5" : "1.5"}
                  strokeLinecap="round"
                  className={surgeActive ? "map-river-flow-surge" : "map-river-flow"}
                  opacity="0.9"
                />

                {/* 3. Merged Lower Gorge Torrent */}
                <path
                  d={mergedLowerStemPath}
                  fill="none"
                  stroke={surgeActive ? "#e11d48" : "#0284c7"}
                  strokeWidth={surgeActive ? "11" : "5.5"}
                  strokeLinecap="round"
                  opacity={surgeActive ? 0.5 : 0.3}
                  filter={surgeActive ? "url(#surge-glow)" : "url(#glow-cyan)"}
                />
                <path
                  d={mergedLowerStemPath}
                  fill="none"
                  stroke={surgeActive ? "url(#river-surge-gradient)" : "url(#river-gradient)"}
                  strokeWidth={surgeActive ? "4.5" : "2.8"}
                  strokeLinecap="round"
                />
                <path
                  d={mergedLowerStemPath}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={surgeActive ? "3" : "1.8"}
                  strokeLinecap="round"
                  className={surgeActive ? "map-river-flow-surge" : "map-river-flow"}
                  opacity="0.95"
                />

                {/* Confluence Surge Eddy Vortex */}
                <g transform={`translate(${confluencePoint[0]}, ${confluencePoint[1]})`}>
                  <circle
                    r={surgeActive ? "14" : "8"}
                    fill="none"
                    stroke={surgeActive ? "#f43f5e" : "#38bdf8"}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    className="map-radar-beam"
                    opacity="0.8"
                  />
                  <circle
                    r={surgeActive ? "5" : "3"}
                    fill={surgeActive ? "#f43f5e" : "#0284c7"}
                  />
                  <text
                    x="16"
                    y="3"
                    fill={surgeActive ? "#fda4af" : "#38bdf8"}
                    fontSize="7"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    VISHNUPRAYAG CONFLUENCE
                  </text>
                </g>
              </g>
            )}

            {/* =============================================================
             *  RF LORA MESH TELEMETRY LINKS & EXPANDING WAVEFORMS
             * ============================================================= */}
            {showRfMesh && (
              <g className="transition-opacity duration-300">
                {(() => {
                  const pts = STATIONS_3D.map((s) => project([s.coordinates[0], s.coordinates[1]]));
                  const pathD = `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]} L ${pts[2][0]},${pts[2][1]} L ${pts[3][0]},${pts[3][1]}`;
                  return (
                    <g>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1.2"
                        className="map-rf-link"
                        opacity="0.75"
                      />
                    </g>
                  );
                })()}

                {STATIONS_3D.map((st) => {
                  const [sx, sy] = project([st.coordinates[0], st.coordinates[1]]);
                  return (
                    <g
                      key={`st-node-${st.id}`}
                      className="cursor-pointer"
                      onClick={() => setSelectedStation(st.id)}
                    >
                      <circle
                        cx={sx}
                        cy={sy}
                        r="8"
                        fill="none"
                        stroke="#06b6d4"
                        className="map-beacon-wave-1 pointer-events-none"
                      />
                      <circle
                        cx={sx}
                        cy={sy}
                        r="8"
                        fill="none"
                        stroke="#06b6d4"
                        className="map-beacon-wave-2 pointer-events-none"
                      />
                      <circle
                        cx={sx}
                        cy={sy}
                        r="4.5"
                        fill="#020617"
                        stroke="#22d3ee"
                        strokeWidth="1.5"
                      />
                      <circle cx={sx} cy={sy} r="1.8" fill="#38bdf8" />
                      <text
                        x={sx}
                        y={sy - 7}
                        textAnchor="middle"
                        fontSize="6.5"
                        fontWeight="700"
                        fontFamily="monospace"
                        fill="#67e8f9"
                        stroke="#020617"
                        strokeWidth="2"
                        style={{ paintOrder: "stroke" }}
                      >
                        {st.callsign.split("-")[1] ?? st.callsign}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* =============================================================
             *  ANIMATED TACTICAL EVACUATION FLOW ARROWS
             * ============================================================= */}
            {showEvacVectors &&
              surgeActive &&
              evacCorridors.map((corridor) => {
                const [fx, fy] = project(corridor.from);
                const [tx, ty] = project(corridor.to);
                const midX = (fx + tx) / 2 + 14;
                const midY = (fy + ty) / 2 - 10;
                const d = `M ${fx.toFixed(1)},${fy.toFixed(1)} Q ${midX.toFixed(1)},${midY.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;
                return (
                  <g key={corridor.id} style={{ pointerEvents: "none" }}>
                    <path
                      d={d}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="8"
                      strokeLinecap="round"
                      opacity="0.18"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      markerEnd="url(#evac-arrowhead)"
                      className="evac-arrow"
                      opacity="0.95"
                    />
                    <circle cx={fx} cy={fy} r="3.5" fill="#f43f5e" stroke="#fff" strokeWidth="0.8" />
                    <circle cx={tx} cy={ty} r="4" fill="#10b981" stroke="#fff" strokeWidth="0.8" />
                    <text
                      x={midX}
                      y={midY - 4}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="800"
                      fill="#6ee7b7"
                      stroke="#0f172a"
                      strokeWidth="2.5"
                      style={{ paintOrder: "stroke" }}
                    >
                      ▲ +{corridor.margin_m}m Safe
                    </text>
                  </g>
                );
              })}

            {/* Evacuation Safe Shelters */}
            {shelterMarkers.map((s, i) => {
              const [x, y] = project([s.lng, s.lat]);
              return (
                <g key={`sh-${i}`} className="cursor-pointer">
                  <rect
                    x={x - 4}
                    y={y - 4}
                    width="8"
                    height="8"
                    rx="1.5"
                    fill="#10b981"
                    stroke="#020617"
                    strokeWidth="1.2"
                  />
                  <text
                    x={x}
                    y={y + 11}
                    textAnchor="middle"
                    fontSize="6"
                    fontWeight="700"
                    fill="#a7f3d0"
                    stroke="#020617"
                    strokeWidth="2"
                    style={{ paintOrder: "stroke" }}
                  >
                    {s.name.split(" ")[0]}
                  </text>
                  <title>{`${s.name} • ${s.elevation_m}m ASL`}</title>
                </g>
              );
            })}

            {/* =============================================================
             *  CRITICAL INFRASTRUCTURE NODES
             * ============================================================= */}
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
                    filter="url(#marker-shadow)"
                  />
                  <text
                    x={x}
                    y={y + 2}
                    textAnchor="middle"
                    fontSize="6.5"
                    fontWeight="800"
                    fill={vuln.textColor}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                    style={{ pointerEvents: "none", paintOrder: "stroke" }}
                  >
                    {infraGlyph(m.type)}
                  </text>
                  {vuln.status !== "NOMINAL" && vuln.status !== "ADVISORY" && (
                    <text
                      x={x}
                      y={y - 9}
                      textAnchor="middle"
                      fontSize="6"
                      fontWeight="800"
                      fill={vuln.stroke}
                      stroke="#0f172a"
                      strokeWidth="2"
                      style={{ pointerEvents: "none", paintOrder: "stroke" }}
                    >
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

            {/* =============================================================
             *  SETTLEMENT PINS & RESCUE TARGETS
             * ============================================================= */}
            {MONITORED_VILLAGES_3D.map((v) => {
              const [x, y] = project([v.coordinates[0], v.coordinates[1]]);
              const isSelected = selectedVillage?.id === v.id || selectedWard === v.wardId;
              return (
                <g
                  key={`village-pin-${v.id}`}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVillage(v);
                    onSelectWard(v.wardId);
                  }}
                >
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r="16"
                      fill="#06b6d4"
                      fillOpacity="0.25"
                      className="animate-ping"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y - 8}
                    r="6.5"
                    fill={isSelected ? "#f59e0b" : "#020617"}
                    stroke={isSelected ? "#fef08a" : "#38bdf8"}
                    strokeWidth="2"
                  />
                  <path
                    d={`M ${x - 4.5} ${y - 6} L ${x + 4.5} ${y - 6} L ${x} ${y} Z`}
                    fill={isSelected ? "#f59e0b" : "#38bdf8"}
                  />
                  <text
                    x={x}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize="6.5"
                    fontWeight="900"
                    fill={isSelected ? "#020617" : "#38bdf8"}
                  >
                    📍
                  </text>
                  <text
                    x={x}
                    y={y + 11}
                    textAnchor="middle"
                    fontSize="7.5"
                    fontWeight="800"
                    fill="#f8fafc"
                    stroke="#020617"
                    strokeWidth="2.5"
                    style={{ paintOrder: "stroke" }}
                  >
                    {v.name.split(" ")[0]}
                  </text>
                  <title>{`${v.name} (${v.hindiName}) — Lead Time: ${v.leadTimeMin}m`}</title>
                </g>
              );
            })}

            {/* Interactive Crosshair Tracking lines */}
            {cursorCoords.active && (
              <g className="pointer-events-none opacity-40">
                <line
                  x1={cursorCoords.x}
                  y1={0}
                  x2={cursorCoords.x}
                  y2={svgH}
                  stroke="#38bdf8"
                  strokeWidth="0.6"
                  strokeDasharray="2 3"
                />
                <line
                  x1={0}
                  y1={cursorCoords.y}
                  x2={svgW}
                  y2={cursorCoords.y}
                  stroke="#38bdf8"
                  strokeWidth="0.6"
                  strokeDasharray="2 3"
                />
                <circle cx={cursorCoords.x} cy={cursorCoords.y} r="6" stroke="#38bdf8" strokeWidth="1" fill="none" />
              </g>
            )}

            {/* North Compass Indicator */}
            <g transform="translate(488, 38)" opacity="0.85">
              <circle cx="0" cy="0" r="14" fill="#020617" stroke="#334155" strokeWidth="1" />
              <polygon points="0,-10 4,4 0,1 -4,4" fill="#ef4444" />
              <polygon points="0,10 4,4 0,1 -4,4" fill="#94a3b8" />
              <text x="0" y="-12" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#f8fafc">
                N
              </text>
            </g>
          </svg>
        </div>

        {/* =========================================================================
         *  FLOATING BOTTOM-LEFT LAYER TOGGLES TOOLBAR
         * ========================================================================= */}
        <div className="absolute bottom-11 left-3 z-30 flex items-center gap-1 rounded-lg border border-slate-800/90 bg-slate-950/85 p-1 backdrop-blur shadow-xl">
          <button
            type="button"
            onClick={() => setShowRiverFlow((v) => !v)}
            title="Toggle Hydrodynamic River Flow Currents"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition ${
              showRiverFlow
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Waves className="h-3 w-3" />
            <span className="hidden sm:inline">Flow</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRadarSweep((v) => !v)}
            title="Toggle Doppler Radar Scanner"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition ${
              showRadarSweep
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="h-3 w-3" />
            <span className="hidden sm:inline">Radar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowContours((v) => !v)}
            title="Toggle Topographic Elevation Contours"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition ${
              showContours
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mountain className="h-3 w-3" />
            <span className="hidden sm:inline">Contours</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRfMesh((v) => !v)}
            title="Toggle LoRa RF Mesh Telemetry Arcs"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition ${
              showRfMesh
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="h-3 w-3" />
            <span className="hidden sm:inline">RF Mesh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEvacVectors((v) => !v)}
            title="Toggle Evacuation Pathways"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition ${
              showEvacVectors
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Footprints className="h-3 w-3" />
            <span className="hidden sm:inline">Evac</span>
          </button>
        </div>

        {/* =========================================================================
         *  FLOATING BOTTOM-RIGHT ZOOM & RESET CONTROLS
         * ========================================================================= */}
        <div className="absolute bottom-11 right-3 z-30 flex items-center gap-1 rounded-lg border border-slate-800/90 bg-slate-950/85 p-1 backdrop-blur shadow-xl">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset Pan & Zoom"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <span className="px-1 text-[10px] font-mono text-cyan-400 font-bold border-l border-slate-800">
            {zoom}x
          </span>
        </div>

        {/* Hover Ward Quick Card */}
        {hoveredWard && !selectedInfra && !selectedVillage && (
          <div className="absolute top-3 right-3 z-30 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-1.5 backdrop-blur shadow-lg text-[10px] font-mono pointer-events-none">
            <span className="text-slate-400">Target: </span>
            <span className="font-bold text-amber-300">{hoveredWard}</span>
            <span className="text-slate-600"> · </span>
            <span className="text-cyan-400 font-bold">
              {riskMap.get(hoveredWard)?.risk_level ?? "LOW"}
            </span>
          </div>
        )}

        {/* =========================================================================
         *  INFRASTRUCTURE INSPECTION POPOVER
         * ========================================================================= */}
        {selectedInfra && selectedInfraProjected && selectedVuln && (
          <div
            className="absolute z-40 w-56 -translate-x-1/2 -translate-y-full"
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
                      width: `${Math.min(
                        100,
                        (selectedStageM /
                          Math.max(selectedInfra.critical_gauge_level_m, selectedStageM, 1)) *
                          100
                      )}%`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-amber-400"
                    style={{
                      left: `${Math.min(
                        100,
                        (selectedInfra.critical_gauge_level_m /
                          Math.max(selectedInfra.critical_gauge_level_m, selectedStageM, 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[9px] leading-tight text-slate-500">
                  {selectedStageM >= selectedInfra.critical_gauge_level_m
                    ? "⚠ Current stage EXCEEDS critical gauge — asset compromised."
                    : `Margin: ${(selectedInfra.critical_gauge_level_m - selectedStageM).toFixed(
                        2
                      )}m below critical.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
         *  STUDIED VILLAGE INFORMATION MODAL DRAWER
         * ========================================================================= */}
        {selectedVillage && (
          <div className="absolute top-4 left-4 z-40 w-80 sm:w-96 rounded-xl border border-cyan-500/70 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-cyan-500/40 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{selectedVillage.name}</h4>
                  <p className="text-[10px] font-mono text-amber-300">
                    {selectedVillage.hindiName} · {selectedVillage.wardId} · {selectedVillage.coordinates[2]}m ASL
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVillage(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Quick-switch bar */}
            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
              {MONITORED_VILLAGES_3D.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setSelectedVillage(loc);
                    onSelectWard(loc.wardId);
                  }}
                  className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono transition ${
                    selectedVillage.id === loc.id
                      ? "bg-amber-400 text-slate-950 font-bold shadow-[0_0_8px_#f59e0b]"
                      : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📍 {loc.name.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* Info Table */}
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80">
              <table className="w-full text-left font-mono text-[10px]">
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  <tr>
                    <td className="px-2.5 py-1 text-slate-400">Coordinates</td>
                    <td className="px-2.5 py-1 text-right font-bold text-slate-100">
                      {selectedVillage.coordinates[0]}°E, {selectedVillage.coordinates[1]}°N
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1 text-slate-400">Elevation ASL</td>
                    <td className="px-2.5 py-1 text-right font-bold text-cyan-400">
                      {selectedVillage.coordinates[2]}m
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1 text-slate-400">Surge Lead Time</td>
                    <td className="px-2.5 py-1 text-right font-black text-amber-400">
                      {selectedVillage.leadTimeMin} min
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1 text-slate-400">Civilians at Risk</td>
                    <td className="px-2.5 py-1 text-right font-bold text-rose-400">
                      {selectedVillage.population.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1 text-slate-400">Toe Slope</td>
                    <td className="px-2.5 py-1 text-right font-bold text-slate-200">
                      {selectedVillage.toeSlopeDeg}°
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1 text-slate-400">Safe Shelter</td>
                    <td className="px-2.5 py-1 text-right font-bold text-emerald-400 truncate max-w-[140px]">
                      {selectedVillage.evacuationShelter}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-2 rounded bg-amber-950/40 p-2 border border-amber-800/40 text-[9.5px] text-amber-200">
              <div className="font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Directive
              </div>
              <div className="mt-0.5">{selectedVillage.riskDescription}</div>
            </div>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(`lead-time-ward-${selectedVillage.wardId}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-cyan-400");
                  setTimeout(() => el.classList.remove("ring-2", "ring-cyan-400"), 3000);
                }
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-cyan-500/60 bg-cyan-950/60 py-1 text-center text-[10px] font-bold text-cyan-300 hover:bg-cyan-900/80 transition"
            >
              <Eye className="h-3 w-3" />
              Inspect in Lead Time Data Table &darr;
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
       *  BOTTOM TACTICAL LEGEND STRIP
       * ========================================================================= */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-800 bg-slate-950/95 px-3 py-2 text-[10px] text-slate-400 backdrop-blur z-20">
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
        <span className="hidden sm:flex items-center gap-1.5 ml-auto">
          <span className="inline-block h-2 w-5 bg-cyan-400 rounded-sm" style={{ background: "linear-gradient(90deg, #0284c7, #38bdf8)" }} />
          Hydro River Flow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Evac shelter
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-amber-500 bg-slate-900" />
          Critical asset
        </span>
        {surgeActive && (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span
              className="inline-block h-0.5 w-5 bg-emerald-400"
              style={{
                background: "repeating-linear-gradient(90deg,#34d399 0 4px,transparent 4px 7px)",
              }}
            />
            Evac vector
          </span>
        )}
      </div>
    </div>
  );
}
