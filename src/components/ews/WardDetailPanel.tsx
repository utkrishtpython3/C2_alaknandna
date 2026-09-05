"use client";

import { useEffect, useState } from "react";
import {
  Mountain,
  Gauge,
  Droplets,
  Layers,
  ArrowUp,
  MapPin,
  ShieldCheck,
} from "lucide-react";

interface EvacRow {
  shelter_id: string;
  name: string;
  elevation_m: number;
  capacity_persons: number;
  coordinates: [number, number];
  route_id: string;
  safe_elevation_differential_m: number;
}

interface WardDetail {
  ward_id: string;
  ward_name: string;
  drainage_area_sqkm: number;
  mean_slope_deg: number;
  time_of_concentration_min: number;
  soil_moisture_pct: number;
  rainfall_intensity_mm_hr: number;
  dynamic_threshold_mm_hr: number;
  dry_soil_threshold_mm_1hr: number;
  saturated_soil_threshold_mm_1hr: number;
  ksat_mm_hr: number;
  runoff_coefficient_C: number;
  peak_discharge_m3_per_s: number;
  exceedance_ratio: number;
  threshold_exceeded: boolean;
  evacuation_plan: EvacRow[];
}

interface WardDetailPanelProps {
  wardId: string | null;
  rainfall: number;
  moisture: number;
}

export function WardDetailPanel({ wardId, rainfall, moisture }: WardDetailPanelProps) {
  const [data, setData] = useState<WardDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wardId) return;
    let cancelled = false;
    // Debounce: telemetry sliders fire continuously; only refetch once the
    // user pauses. All setState calls happen inside async callbacks (never
    // synchronously in the effect body), per react-hooks/set-state-in-effect.
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      const qs = new URLSearchParams({
        wardId,
        soilMoisture: String(moisture),
        rainfall: String(rainfall),
      });
      fetch(`/api/hydrology/ward?${qs.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) {
            setData(d);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setData(null);
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wardId, rainfall, moisture]);

  if (!wardId) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
        <MapPin className="mb-2 h-6 w-6 text-slate-600" />
        <p className="text-sm text-slate-400">
          Select a catchment on the map or a ward card to inspect its dynamic
          FFG threshold, Green-Ampt parameters and NDRF evacuation plan.
        </p>
      </div>
    );
  }

  // Guard against rendering stale data from a previously-selected ward.
  const current = data && data.ward_id === wardId ? data : null;

  if (!current) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          <span className="text-xs text-slate-500">
            {loading ? "Resolving ward hydro-physics…" : "Syncing telemetry…"}
          </span>
        </div>
      </div>
    );
  }

  const d = current;
  const margin = d.dynamic_threshold_mm_hr - d.rainfall_intensity_mm_hr;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          Ward hydro-physics
        </p>
        <h3 className="text-sm font-bold text-slate-100">
          {d.ward_id.replace("UK-CHM-", "")}{" "}
          <span className="font-normal text-slate-400">— {d.ward_name}</span>
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon={<Mountain className="h-3 w-3" />} label="Slope" value={`${d.mean_slope_deg.toFixed(1)}°`} />
        <Stat icon={<Gauge className="h-3 w-3" />} label="Tc" value={`${d.time_of_concentration_min.toFixed(1)} min`} />
        <Stat icon={<Layers className="h-3 w-3" />} label="Area" value={`${d.drainage_area_sqkm.toFixed(2)} km²`} />
        <Stat icon={<Droplets className="h-3 w-3" />} label="Ksat" value={`${d.ksat_mm_hr.toFixed(1)} mm/hr`} />
        <Stat icon={<Droplets className="h-3 w-3" />} label="Runoff C" value={d.runoff_coefficient_C.toFixed(2)} />
        <Stat icon={<Gauge className="h-3 w-3" />} label="Peak Q" value={`${d.peak_discharge_m3_per_s.toFixed(1)} m³/s`} />
      </div>

      {/* Dynamic FFG threshold meter */}
      <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Dynamic 1-hr FFG threshold</span>
          <span className="font-mono text-amber-300">
            {d.dynamic_threshold_mm_hr.toFixed(1)} mm/hr
          </span>
        </div>
        <ThresholdBar
          dry={d.dry_soil_threshold_mm_1hr}
          sat={d.saturated_soil_threshold_mm_1hr}
          dyn={d.dynamic_threshold_mm_hr}
          rain={d.rainfall_intensity_mm_hr}
        />
        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-slate-500">
            Dry {d.dry_soil_threshold_mm_1hr} · Sat {d.saturated_soil_threshold_mm_1hr}
          </span>
          <span className={margin >= 0 ? "text-emerald-300" : "text-rose-300"}>
            {margin >= 0
              ? `Margin +${margin.toFixed(1)} mm/hr`
              : `DEFICIT ${margin.toFixed(1)} mm/hr`}
          </span>
        </div>
      </div>

      {/* Evacuation plan */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          NDRF evacuation plan (by safe elevation margin)
        </p>
        <ul className="flex flex-col gap-1.5">
          {d.evacuation_plan.map((e, i) => (
            <li
              key={e.shelter_id}
              className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-[10px] font-bold text-emerald-300">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-slate-200">
                  {e.name}
                </p>
                <p className="text-[9px] text-slate-500">
                  {e.route_id} · cap. {e.capacity_persons.toLocaleString()} ·{" "}
                  {e.coordinates[0].toFixed(3)}, {e.coordinates[1].toFixed(3)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="flex items-center gap-0.5 font-mono text-[11px] text-emerald-300">
                  <ArrowUp className="h-2.5 w-2.5" />
                  +{e.safe_elevation_differential_m.toFixed(0)}m
                </span>
                <span className="text-[9px] text-slate-500">@ {e.elevation_m}m</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[12px] font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}

function ThresholdBar({
  dry,
  sat,
  dyn,
  rain,
}: {
  dry: number;
  sat: number;
  dyn: number;
  rain: number;
}) {
  const MAX = Math.max(dry, rain, dyn) * 1.25 + 1;
  const pct = (v: number) => `${Math.min(100, (v / MAX) * 100)}%`;
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800">
      {/* saturation floor band */}
      <div
        className="absolute inset-y-0 left-0 bg-rose-500/25"
        style={{ width: pct(sat) }}
      />
      {/* dry ceiling marker */}
      <div
        className="absolute inset-y-0 w-px bg-slate-500"
        style={{ left: pct(dry) }}
        title={`dry ${dry}`}
      />
      {/* dynamic threshold marker */}
      <div
        className="absolute inset-y-0 w-0.5 bg-amber-400"
        style={{ left: pct(dyn) }}
        title={`dynamic ${dyn}`}
      />
      {/* rainfall indicator */}
      <div
        className={`absolute inset-y-0 w-1 ${
          rain > dyn ? "bg-rose-500" : "bg-cyan-400"
        }`}
        style={{ left: pct(rain) }}
        title={`rain ${rain}`}
      />
    </div>
  );
}
