"use client";

import React, { useState, useEffect } from "react";
import type { BasinCascadeResult, RiskLevel } from "@/lib/hydrologyEngine";
import {
  Clock,
  Timer,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Waves,
  Zap,
  MountainSnow,
  Navigation,
  Activity,
  Flame,
  CheckCircle2,
  AlertOctagon,
  MapPin,
  Eye,
  Droplets,
  TrendingUp,
} from "lucide-react";
import { useRealtimeClock } from "@/hooks/useRealtimeClock";
import { MONITORED_VILLAGES_3D } from "@/data/terrain3dGeo";

interface LeadTimeMatrixProps {
  result: BasinCascadeResult | null;
  selectedWard: string | null;
  onSelectWard: (id: string) => void;
  activeScenario?: string | null;
  selectedLocationId?: string | null;
  onSelectLocation?: (locId: string) => void;
  onOpenRheologyLab?: () => void;
  onOpenValleyCrossSection?: (locationId?: string) => void;
}

interface WardLeadTimeRecord {
  wardId: string;
  wardName: string;
  leadTimeMin: number;
  evacTransitMin: number;
  marginMin: number;
  marginStatus: "SAFE" | "CRITICAL" | "SURGE_IMMINENT";
  waveVelocityMs: number;
  peakQ: number;
  riskLevel: RiskLevel;
  primaryShelter: string;
  shelterElevationGainM: number;
}

export function LeadTimeMatrix({
  result,
  selectedWard,
  onSelectWard,
  activeScenario = "monsoon",
  selectedLocationId = null,
  onSelectLocation,
  onOpenRheologyLab,
  onOpenValleyCrossSection,
}: LeadTimeMatrixProps) {
  // Simulated dynamic countdown seconds
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedTimelinePoint, setSelectedTimelinePoint] = useState<number | null>(null);
  const realtimeClock = useRealtimeClock();

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => (prev + 1) % 1800); // 30 min cycle
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!result) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-500">
        <Clock className="mx-auto mb-2 h-6 w-6 text-slate-600 animate-pulse" />
        Calculating hydrodynamic wave propagation &amp; evacuation lead-time matrices...
      </div>
    );
  }

  const isSevere =
    result.basin_wide_alert_level === "CATACLYSMIC" ||
    result.basin_wide_alert_level === "EXTREME";

  const totalSurgeMin = Math.round(result.lower_basin_surge_arrival_min || 18);
  const surgeSecRemaining = Math.max(
    0,
    totalSurgeMin * 60 - (isSevere ? elapsedSec : Math.floor(elapsedSec * 0.3))
  );
  const displayMin = Math.floor(surgeSecRemaining / 60);
  const displaySec = surgeSecRemaining % 60;

  // Process per-ward lead-time data
  const wardRecords: WardLeadTimeRecord[] = result.per_ward_risk.map((w) => {
    const leadTimeMin = Math.round(w.estimated_flood_arrival_min);
    // Typical uphill escape transit times based on trail steepness & terrain distance
    const evacTransitMin =
      w.ward_id === "UK-CHM-UPPER" ? 18 : w.ward_id === "UK-CHM-MID" ? 12 : 9;
    const marginMin = leadTimeMin - evacTransitMin;
    const marginStatus =
      marginMin < 0 ? "SURGE_IMMINENT" : marginMin < 8 ? "CRITICAL" : "SAFE";

    const primaryShelter =
      w.evacuation_plan[0]?.name ?? "High-Altitude Assembly Zone";
    const shelterElevationGainM =
      w.ward_id === "UK-CHM-UPPER" ? 340 : w.ward_id === "UK-CHM-MID" ? 220 : 140;

    return {
      wardId: w.ward_id,
      wardName: w.ward_name,
      leadTimeMin,
      evacTransitMin,
      marginMin,
      marginStatus,
      waveVelocityMs: parseFloat((Math.min(8.5, 2.2 + Math.sqrt(Math.max(1, w.peak_discharge_m3_per_s)) * 0.35)).toFixed(1)),
      peakQ: w.peak_discharge_m3_per_s,
      riskLevel: w.risk_level,
      primaryShelter,
      shelterElevationGainM,
    };
  });

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl backdrop-blur">
      {/* Header with Live T-Minus Surge Clock */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-lg ${
              isSevere
                ? "border-rose-500 bg-rose-950/60 text-rose-400 animate-pulse"
                : "border-amber-500/50 bg-amber-950/50 text-amber-400"
            }`}
          >
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-wide text-slate-100 uppercase">
                Evacuation Lead-Time &amp; Kinematic Wave Matrix
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isSevere
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                }`}
              >
                {isSevere ? "RAPID ENTRAYNMENT" : "KINEMATIC PROPAGATION"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Kirpich time-of-concentration routing to Vishnuprayag gorge confluence
            </p>
          </div>
        </div>

        {/* Real-time Clock + Live T-Minus Clock */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Synchronized Real-Time Wall Clock */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-3 py-1.5 shadow-inner">
            <Clock className="h-4 w-4 text-cyan-400 animate-pulse" />
            <div>
              <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-400">
                Synchronized C2 Time
              </span>
              <div className="flex items-baseline gap-1 font-mono text-xs">
                <span className="font-bold text-slate-100">{realtimeClock.istTime}</span>
                <span className="text-[9px] font-semibold text-cyan-400">IST</span>
                <span className="text-slate-600">·</span>
                <span className="text-[10px] text-slate-400">{realtimeClock.utcTime} UTC</span>
              </div>
            </div>
          </div>

          {/* Live T-Minus Surge Clock */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/90 px-3.5 py-1.5 shadow-inner">
            <div className="text-right">
              <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-400">
                Confluence Wave Arrival
              </span>
              <span className="font-mono text-base font-black text-amber-400">
                T - {String(displayMin).padStart(2, "0")}:{String(displaySec).padStart(2, "0")} MIN
              </span>
            </div>
            <div
              className={`flex h-3 w-3 items-center justify-center rounded-full ${
                isSevere ? "bg-rose-500 animate-ping" : "bg-emerald-400 animate-pulse"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Kinematic Wave Propagation Stepper */}
      <div className="mt-4 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-200">
              <Waves className="h-3.5 w-3.5 text-cyan-400" />
              Downstream Flash-Flood Cascade Routing Chain
            </span>
            <span className="hidden sm:inline font-mono text-[10px] text-slate-400">
              &bull; 12.8 km reach &bull; Slope 38.4&deg;
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenRheologyLab && (
              <button
                type="button"
                onClick={onOpenRheologyLab}
                className="flex items-center gap-1 rounded-md border border-purple-500/50 bg-purple-950/40 px-2 py-0.5 text-[10px] font-mono text-purple-300 hover:bg-purple-900/60 shadow-[0_0_8px_rgba(168,85,247,0.25)] transition cursor-pointer"
                title="Open Non-Newtonian Rheology Lab (Takahashi 2.10x Bulking & Bingham Yield Stress)"
              >
                <Droplets className="h-3 w-3 text-purple-400" />
                <span>Rheology Lab (2.10&times;)</span>
              </button>
            )}

            {onOpenValleyCrossSection && (
              <button
                type="button"
                onClick={() => onOpenValleyCrossSection(selectedLocationId ?? "loc-vishnuprayag")}
                className="flex items-center gap-1 rounded-md border border-cyan-500/50 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-mono text-cyan-300 hover:bg-cyan-900/60 shadow-[0_0_8px_rgba(6,182,212,0.25)] transition cursor-pointer"
                title="Inspect 2D Geotechnical Transect Profile (Riverbed vs Safe Uphill Shelter Elevation)"
              >
                <TrendingUp className="h-3 w-3 text-cyan-400" />
                <span>2D Transect Profile</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          {/* Step 1: Orographic Burst Inception */}
          <button
            type="button"
            onClick={() => {
              onSelectWard("UK-CHM-UPPER");
              onSelectLocation?.("loc-auli");
              const el = document.getElementById("operations-viewport");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`relative flex flex-col text-left rounded-md border p-2.5 transition cursor-pointer ${
              selectedLocationId === "loc-auli"
                ? "border-amber-400 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-1 ring-amber-400"
                : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/80"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono w-full">
              <span className="text-cyan-400 font-bold">1. CLOUD BURST</span>
              <span className="rounded bg-cyan-950 px-1 py-0.2 text-cyan-300">T + 00m</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Auli Upper Crest</span>
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> 3D Pin
              </span>
            </p>
            <span className="text-[10px] text-slate-400">3120m ASL · Debris generation</span>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] w-full">
              <span className="text-slate-500">Infiltration Expired</span>
              <span className="text-emerald-400 font-bold">100% Saturation</span>
            </div>
          </button>

          {/* Step 2: Mid-Slope Debris Wave */}
          <button
            type="button"
            onClick={() => {
              onSelectWard("UK-CHM-MID");
              onSelectLocation?.("loc-joshimath");
              const el = document.getElementById("operations-viewport");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`relative flex flex-col text-left rounded-md border p-2.5 transition cursor-pointer ${
              selectedLocationId === "loc-joshimath"
                ? "border-amber-400 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-1 ring-amber-400"
                : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/80"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono w-full">
              <span className="text-amber-400 font-bold">2. DEBRIS SURGE</span>
              <span className="rounded bg-amber-950 px-1 py-0.2 text-amber-300">T + 08m</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Joshimath Flank</span>
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> 3D Pin
              </span>
            </p>
            <span className="text-[10px] text-slate-400">1890m ASL · Surcharge 4.2m/s</span>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] w-full">
              <span className="text-slate-500">Toe Slope Erosion</span>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold">HIGH MOMENTUM</span>
                {onOpenValleyCrossSection && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenValleyCrossSection("loc-joshimath");
                    }}
                    className="inline-flex items-center gap-0.5 rounded bg-cyan-950/80 px-1 py-0.5 text-[9px] text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900 transition"
                    title="Open 2D Topographic Transect Profile for Joshimath"
                  >
                    <TrendingUp className="h-2.5 w-2.5" /> 2D
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* Step 3: Gorge Canyon Choke */}
          <button
            type="button"
            onClick={() => {
              onSelectWard("UK-CHM-MID");
              onSelectLocation?.("loc-helang");
              const el = document.getElementById("operations-viewport");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`relative flex flex-col text-left rounded-md border p-2.5 transition cursor-pointer ${
              selectedLocationId === "loc-helang"
                ? "border-amber-400 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-1 ring-amber-400"
                : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/80"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono w-full">
              <span className="text-rose-400 font-bold">3. ROAD CUT-OFF</span>
              <span className="rounded bg-rose-950 px-1 py-0.2 text-rose-300">T + 14m</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Helang Gorge Spur</span>
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> 3D Pin
              </span>
            </p>
            <span className="text-[10px] text-slate-400">1540m ASL · NH-7 interdiction</span>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] w-full">
              <span className="text-slate-500">Highway Transit</span>
              <div className="flex items-center gap-1.5">
                <span className="text-rose-400 font-bold">ZERO ACCESS</span>
                {onOpenValleyCrossSection && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenValleyCrossSection("loc-helang");
                    }}
                    className="inline-flex items-center gap-0.5 rounded bg-cyan-950/80 px-1 py-0.5 text-[9px] text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900 transition"
                    title="Open 2D Topographic Transect Profile for Helang"
                  >
                    <TrendingUp className="h-2.5 w-2.5" /> 2D
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* Step 4: Terminal Confluence Inundation */}
          <button
            type="button"
            onClick={() => {
              onSelectWard("UK-CHM-LOWER");
              onSelectLocation?.("loc-vishnuprayag");
              const el = document.getElementById("operations-viewport");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`relative flex flex-col text-left rounded-md border p-2.5 transition cursor-pointer ${
              selectedLocationId === "loc-vishnuprayag"
                ? "border-rose-400 bg-rose-950/60 shadow-[0_0_12px_rgba(244,63,94,0.4)] ring-1 ring-rose-400"
                : "border-rose-700/60 bg-rose-950/20 hover:border-rose-600 hover:bg-rose-900/30"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono w-full">
              <span className="text-rose-300 font-bold">4. CONFLUENCE CREST</span>
              <span className="rounded bg-rose-900 px-1 py-0.2 text-rose-200">
                T + {totalSurgeMin}m
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-rose-200 flex items-center justify-between">
              <span>Vishnuprayag</span>
              <span className="text-[10px] text-amber-300 font-mono flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> 3D Pin
              </span>
            </p>
            <span className="text-[10px] text-slate-400">1410m ASL · Bridge submergence</span>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] w-full">
              <span className="text-slate-400">Flood Wave Height</span>
              <div className="flex items-center gap-1.5">
                <span className="text-rose-300 font-bold">+8.5m Stage Rise</span>
                {onOpenValleyCrossSection && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenValleyCrossSection("loc-vishnuprayag");
                    }}
                    className="inline-flex items-center gap-0.5 rounded bg-cyan-950/80 px-1 py-0.5 text-[9px] text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900 transition"
                    title="Open 2D Topographic Transect Profile for Vishnuprayag"
                  >
                    <TrendingUp className="h-2.5 w-2.5" /> 2D
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Per-Ward Evacuation Window vs Transit Time Margin Table */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ward-Level Evacuation Execution Margins &amp; Monitored Locations
          </h4>
          <span className="text-[10px] text-cyan-400 font-mono">
            &larr; Click any village badge or row to pinpoint on 3D map
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Catchment / Ward</th>
                <th className="px-3 py-2 font-semibold">Observed Villages &amp; Map Pins</th>
                <th className="px-3 py-2 font-semibold">Wave Lead Time</th>
                <th className="px-3 py-2 font-semibold">Evac Transit Time</th>
                <th className="px-3 py-2 font-semibold">Safe Margin Delta</th>
                <th className="px-3 py-2 font-semibold">Primary Safe Shelter</th>
                <th className="px-3 py-2 font-semibold">Action Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {wardRecords.map((r) => {
                const wardVillages = MONITORED_VILLAGES_3D.filter((v) => v.wardId === r.wardId);
                const hasSelectedLocation = wardVillages.some((v) => v.id === selectedLocationId);
                const isSelected = selectedWard === r.wardId || hasSelectedLocation;

                const handleRowClick = () => {
                  onSelectWard(r.wardId);
                  if (wardVillages.length > 0 && !hasSelectedLocation) {
                    onSelectLocation?.(wardVillages[0].id);
                  }
                  const el = document.getElementById("operations-viewport");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                };

                return (
                  <tr
                    key={r.wardId}
                    id={`lead-time-ward-${r.wardId}`}
                    onClick={handleRowClick}
                    className={`cursor-pointer transition-all duration-300 ${
                      isSelected
                        ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/50 shadow-inner"
                        : "hover:bg-slate-900/60"
                    }`}
                  >
                    <td className="px-3 py-2.5 font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">{r.wardId.replace("UK-CHM-", "")}</span>
                        <span className="text-slate-200 font-sans">{r.wardName.split(" ")[0]}</span>
                      </div>
                    </td>

                    {/* Observed Villages with Interactive Pin Badges */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {wardVillages.map((v) => {
                          const isLocActive = selectedLocationId === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectWard(r.wardId);
                                onSelectLocation?.(v.id);
                                const el = document.getElementById("operations-viewport");
                                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-sans font-medium transition ${
                                isLocActive
                                  ? "bg-amber-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.6)] ring-1 ring-amber-200"
                                  : "border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:border-cyan-500/80 hover:bg-cyan-950/60 hover:text-cyan-300"
                              }`}
                              title={`Click to pinpoint ${v.name} (${v.hindiName}) on 3D Tactical Map`}
                            >
                              <MapPin
                                className={`h-2.5 w-2.5 flex-shrink-0 ${
                                  isLocActive ? "text-slate-950 fill-slate-950" : "text-amber-400"
                                }`}
                              />
                              <span className="font-semibold">{v.name.replace(" Village", "").replace(" (Alaknanda Spur)", "").replace(" Confluence", "").replace(" Gorge Basin", "")}</span>
                              <span className="font-mono text-[9px] opacity-75">
                                {v.coordinates[2]}m
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 font-bold text-amber-300">
                      {r.leadTimeMin} min
                    </td>

                    <td className="px-3 py-2.5 text-slate-300">
                      {r.evacTransitMin} min
                    </td>

                    <td className="px-3 py-2.5 font-bold">
                      {r.marginMin >= 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          +{r.marginMin} min window
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 animate-pulse font-extrabold">
                          <AlertOctagon className="h-3 w-3" />
                          {r.marginMin} min DEFICIT
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 font-sans">
                      <div className="flex flex-col">
                        <span className="text-slate-200">{r.primaryShelter}</span>
                        <span className="font-mono text-[10px] text-cyan-400">
                          +{r.shelterElevationGainM}m Vertical Delta
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      {r.marginStatus === "SAFE" && (
                        <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-800/50">
                          CLEARANCE ONGOING
                        </span>
                      )}
                      {r.marginStatus === "CRITICAL" && (
                        <span className="rounded bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-800/50 animate-pulse">
                          EXPEDITE RETREAT
                        </span>
                      )}
                      {r.marginStatus === "SURGE_IMMINENT" && (
                        <span className="rounded bg-rose-900 px-2 py-0.5 text-[10px] font-black text-rose-100 border border-rose-700 shadow-[0_0_10px_#e11d48]">
                          VERTICAL EVAC ONLY
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
export default LeadTimeMatrix;
