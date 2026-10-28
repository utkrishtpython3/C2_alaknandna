"use client";

import React, { useState } from "react";
import {
  VALLEY_CROSS_SECTIONS,
} from "@/data/terrain3dGeo";
import {
  X,
  Mountain,
  ShieldCheck,
  AlertTriangle,
  Timer,
  Navigation,
  TrendingUp,
} from "lucide-react";

interface ValleyCrossSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLocationId?: string;
  activeScenario?: "DRY_BASELINE" | "MONSOON_SATURATED" | "CLOUDBURST_CATACLYSMIC" | "glof" | "dry" | "monsoon" | "cloudburst" | string;
}

export function ValleyCrossSectionModal({
  isOpen,
  onClose,
  defaultLocationId = "loc-vishnuprayag",
  activeScenario = "CLOUDBURST_CATACLYSMIC",
}: ValleyCrossSectionModalProps) {
  const [selectedId, setSelectedId] = useState<string>(
    VALLEY_CROSS_SECTIONS[defaultLocationId] ? defaultLocationId : "loc-vishnuprayag"
  );
  const [prevDefault, setPrevDefault] = useState(defaultLocationId);
  if (prevDefault !== defaultLocationId) {
    setPrevDefault(defaultLocationId);
    if (VALLEY_CROSS_SECTIONS[defaultLocationId]) {
      setSelectedId(defaultLocationId);
    }
  }

  if (!isOpen) return null;

  const profile = VALLEY_CROSS_SECTIONS[selectedId] || VALLEY_CROSS_SECTIONS["loc-vishnuprayag"];

  const isGlof = activeScenario === "glof";
  const isCloudburst = activeScenario === "CLOUDBURST_CATACLYSMIC" || isGlof;

  const currentWaterAlt = isGlof
    ? profile.glofDebrisSurgeAltM
    : isCloudburst
      ? profile.cloudburstSurgeAltM
      : profile.baseStageWaterAltM;

  const currentStageRise = (currentWaterAlt - profile.riverbedAltM).toFixed(1);

  const isBridgeSubmerged = profile.bridgeDeckAltM ? currentWaterAlt >= profile.bridgeDeckAltM : false;
  const bridgeClearance = profile.bridgeDeckAltM ? (profile.bridgeDeckAltM - currentWaterAlt).toFixed(1) : null;

  const safetyMarginMin = profile.waveLeadTimeMin - profile.pedestrianWalkTimeMin;

  // SVG Geometry calculations
  const svgWidth = 680;
  const svgHeight = 260;
  const padX = 50;
  const padBottom = 40;
  const padTop = 30;

  const minAlt = profile.riverbedAltM - 10;
  const maxAlt = profile.shelterAltM + 30;
  const altRange = maxAlt - minAlt;

  const altToY = (alt: number) => {
    return svgHeight - padBottom - ((alt - minAlt) / altRange) * (svgHeight - padBottom - padTop);
  };

  const xRiver = padX + 50;
  const xBridge = padX + 110;
  const xSettlement = padX + 260;
  const xShelter = svgWidth - padX - 40;

  const yRiverbed = altToY(profile.riverbedAltM);
  const yWater = altToY(currentWaterAlt);
  const yBridge = profile.bridgeDeckAltM ? altToY(profile.bridgeDeckAltM) : null;
  const ySettlement = altToY(profile.settlementToeAltM);
  const yShelter = altToY(profile.shelterAltM);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-cyan-500/50 bg-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.9)] ring-1 ring-cyan-500/30 overflow-hidden font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/40 text-cyan-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  Topographic Cross-Section &amp; Hydraulic Surcharge Profile
                </h3>
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-[9.5px] font-mono font-bold text-cyan-300 border border-cyan-800/80">
                  GEOTECHNICAL 2D TRANSECT
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Riverbed Inundation Stage vs. Uphill Pedestrian Evacuation Margin (&Delta;t)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
            title="Close Cross-Section"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Location Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-2 sm:px-6 overflow-x-auto">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex-shrink-0">
            Select Valley Transect:
          </span>
          {Object.values(VALLEY_CROSS_SECTIONS).map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setSelectedId(loc.id)}
              className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                selectedId === loc.id
                  ? "border-cyan-500 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              📍 {loc.name}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Key Metric Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Riverbed Elevation</span>
              <span className="text-base font-black font-mono text-cyan-400 mt-0.5">
                {profile.riverbedAltM} m ASL
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Hydraulic Gorge Datum</span>
            </div>

            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Flood Water Level</span>
              <span className={`text-base font-black font-mono mt-0.5 ${
                isGlof ? "text-amber-400" : isCloudburst ? "text-rose-400 animate-pulse" : "text-emerald-400"
              }`}>
                {currentWaterAlt} m ASL
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                +{currentStageRise}m Above Bed {isGlof ? "(Takahashi Bulked)" : ""}
              </span>
            </div>

            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Safe Haven Shelter</span>
              <span className="text-base font-black font-mono text-emerald-400 mt-0.5">
                {profile.shelterAltM} m ASL
              </span>
              <span className="text-[10px] text-emerald-300 mt-0.5">
                +{(profile.shelterAltM - profile.settlementToeAltM)}m Ascent Differential
              </span>
            </div>

            <div className={`flex flex-col rounded-xl border p-3 ${
              safetyMarginMin < 0
                ? "border-rose-500/80 bg-rose-950/40 text-rose-200"
                : safetyMarginMin <= 10
                  ? "border-amber-500/80 bg-amber-950/40 text-amber-200"
                  : "border-emerald-500/80 bg-emerald-950/40 text-emerald-200"
            }`}>
              <span className="text-[10px] font-mono uppercase">Evacuation Margin (&Delta;t)</span>
              <span className="text-base font-black font-mono mt-0.5">
                {safetyMarginMin >= 0 ? `+${safetyMarginMin} min MARGIN` : `${safetyMarginMin} min DEFICIT`}
              </span>
              <span className="text-[10px] opacity-90 mt-0.5">
                Surge: {profile.waveLeadTimeMin}m | Walk: {profile.pedestrianWalkTimeMin}m
              </span>
            </div>
          </div>

          {/* Interactive Cross-Section SVG Diagram */}
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-inner">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-2 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <Mountain className="h-4 w-4 text-cyan-400" />
                <span>VALLEY SLOPE: <strong className="text-slate-100">{profile.valleySlopeDeg}&deg;</strong></span>
                <span>•</span>
                <span>HORIZONTAL DIST: <strong className="text-slate-100">{profile.distanceToShelterM}m</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Safe Haven
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Inundation Zone
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[620px] h-64 select-none font-mono text-[9px]"
              >
                <defs>
                  {/* Water Gradient */}
                  <linearGradient id="floodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isGlof ? "#b45309" : isCloudburst ? "#dc2626" : "#0284c7"} stopOpacity="0.85" />
                    <stop offset="100%" stopColor={isGlof ? "#78350f" : isCloudburst ? "#7f1d1d" : "#0369a1"} stopOpacity="0.95" />
                  </linearGradient>

                  {/* Terrain Gradient */}
                  <linearGradient id="terrainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                {/* Elevation Horizontal Grid Lines */}
                {[profile.riverbedAltM, profile.settlementToeAltM, profile.shelterAltM].map((alt, idx) => {
                  const y = altToY(alt);
                  return (
                    <g key={idx}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={svgWidth - padX}
                        y2={y}
                        stroke="#334155"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text x={padX - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="8.5">
                        {alt}m
                      </text>
                    </g>
                  );
                })}

                {/* Mountain Terrain Polygon */}
                <polygon
                  points={`
                    ${padX},${yRiverbed}
                    ${xRiver},${yRiverbed}
                    ${xSettlement},${ySettlement}
                    ${xShelter},${yShelter}
                    ${xShelter + 40},${yShelter}
                    ${xShelter + 40},${svgHeight - padBottom}
                    ${padX},${svgHeight - padBottom}
                  `}
                  fill="url(#terrainGrad)"
                  stroke="#475569"
                  strokeWidth="2"
                />

                {/* River Water Body Polygon */}
                <polygon
                  points={`
                    ${padX},${yWater}
                    ${xRiver + 60},${yWater}
                    ${xRiver + 30},${yRiverbed}
                    ${padX},${yRiverbed}
                  `}
                  fill="url(#floodGrad)"
                  stroke={isGlof ? "#f59e0b" : isCloudburst ? "#f87171" : "#38bdf8"}
                  strokeWidth="2"
                />

                {/* Animated Water Surface Waves */}
                <line
                  x1={padX}
                  y1={yWater}
                  x2={xRiver + 60}
                  y2={yWater}
                  stroke={isGlof ? "#fde68a" : isCloudburst ? "#fca5a5" : "#7dd3fc"}
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  className="animate-pulse"
                />

                {/* Flood Stage Label */}
                <text
                  x={padX + 10}
                  y={yWater - 6}
                  fill={isGlof ? "#fde68a" : isCloudburst ? "#f87171" : "#38bdf8"}
                  fontWeight="bold"
                  fontSize="9.5"
                >
                  {isGlof ? "GLOF DEBRIS SURGE" : isCloudburst ? "CLOUDBURST SURGE" : "BASE STAGE"}: +{currentStageRise}m
                </text>

                {/* Bridge Deck Marker (If present) */}
                {profile.bridgeDeckAltM && yBridge && (
                  <g>
                    <line
                      x1={xRiver - 20}
                      y1={yBridge}
                      x2={xBridge + 20}
                      y2={yBridge}
                      stroke={isBridgeSubmerged ? "#f43f5e" : "#f59e0b"}
                      strokeWidth="3.5"
                    />
                    {/* Bridge Piers */}
                    <line x1={xRiver} y1={yBridge} x2={xRiver} y2={yRiverbed} stroke="#64748b" strokeWidth="2" />
                    <line x1={xBridge} y1={yBridge} x2={xBridge} y2={yRiverbed} stroke="#64748b" strokeWidth="2" />

                    <circle cx={(xRiver + xBridge) / 2} cy={yBridge} r="4" fill={isBridgeSubmerged ? "#e11d48" : "#f59e0b"} />
                    <text
                      x={(xRiver + xBridge) / 2}
                      y={yBridge - 8}
                      textAnchor="middle"
                      fill={isBridgeSubmerged ? "#fda4af" : "#fde68a"}
                      fontWeight="bold"
                      fontSize="9"
                    >
                      BRIDGE DECK: {profile.bridgeDeckAltM}m {isBridgeSubmerged ? "[SUBMERGED]" : `[${bridgeClearance}m CLEAR]`}
                    </text>
                  </g>
                )}

                {/* Settlement Marker */}
                <g>
                  <circle cx={xSettlement} cy={ySettlement} r="6" fill="#f59e0b" stroke="#020617" strokeWidth="2" />
                  <line x1={xSettlement} y1={ySettlement} x2={xSettlement} y2={ySettlement - 30} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" />
                  <rect
                    x={xSettlement - 55}
                    y={ySettlement - 52}
                    width="110"
                    height="20"
                    rx="4"
                    fill="#0f172a"
                    stroke="#f59e0b"
                    strokeWidth="1"
                  />
                  <text x={xSettlement} y={ySettlement - 39} textAnchor="middle" fill="#fde68a" fontWeight="bold" fontSize="9">
                    📍 {profile.locationName.split(" ")[0]} ({profile.settlementToeAltM}m)
                  </text>
                </g>

                {/* Safe Shelter Marker */}
                <g>
                  <circle cx={xShelter} cy={yShelter} r="7" fill="#10b981" stroke="#020617" strokeWidth="2" />
                  <line x1={xShelter} y1={yShelter} x2={xShelter} y2={yShelter - 35} stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
                  <rect
                    x={xShelter - 65}
                    y={yShelter - 58}
                    width="130"
                    height="22"
                    rx="4"
                    fill="#0f172a"
                    stroke="#10b981"
                    strokeWidth="1"
                  />
                  <text x={xShelter} y={yShelter - 44} textAnchor="middle" fill="#6ee7b7" fontWeight="bold" fontSize="9">
                    🛡️ SAFE SHELTER ({profile.shelterAltM}m)
                  </text>
                </g>

                {/* Uphill Escape Pathway Vector Arrow */}
                <g>
                  <line
                    x1={xSettlement + 10}
                    y1={ySettlement - 10}
                    x2={xShelter - 10}
                    y2={yShelter + 10}
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={(xSettlement + xShelter) / 2}
                    y={(ySettlement + yShelter) / 2 - 12}
                    textAnchor="middle"
                    fill="#34d399"
                    fontWeight="bold"
                    fontSize="9.5"
                  >
                    UPHILL TRAIL: {profile.distanceToShelterM}m · {profile.pedestrianWalkTimeMin} min walk (&Delta;H +{profile.shelterAltM - profile.settlementToeAltM}m)
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Operational Directive Details */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>NDRF Geotechnical Assessment &amp; Surcharge Analysis</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {profile.summaryText}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-mono text-slate-400 border-t border-slate-800">
              <span className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5 text-cyan-400" />
                Peak Surge Arrival: <strong className="text-amber-400">{profile.waveLeadTimeMin} min</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5 text-emerald-400" />
                Uphill Transit Time: <strong className="text-emerald-400">{profile.pedestrianWalkTimeMin} min</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                Designated Safe Haven: <strong className="text-slate-200">{profile.shelterName}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 px-4 py-3 sm:px-6">
          <div className="text-[11px] font-mono text-slate-400">
            ISRO-NRSC CartoDEM 3D Transect Calibrated for Alaknanda Basin
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 transition shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer"
          >
            Close Transect
          </button>
        </div>
      </div>
    </div>
  );
}

export default ValleyCrossSectionModal;
