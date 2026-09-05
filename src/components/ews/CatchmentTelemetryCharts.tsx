"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type {
  TelemetrySeriesPoint,
  WardTelemetrySeries,
} from "@/lib/hydrologyEngine";
import {
  CloudRain,
  Waves,
  Gauge as GaugeIcon,
  Loader2,
  TriangleAlert,
  Timer,
} from "lucide-react";

interface CatchmentTelemetryChartsProps {
  wardId: string | null;
  wardName: string;
  rainfall: number;
  moisture: number;
  /** When true (cloudburst), the chart animates the surge countdown marker. */
  surgeActive: boolean;
  /** Surge lead time in minutes (drives the countdown marker x-position). */
  surgeArrivalMin: number;
  /** Basins-wide alert level for color theming the countdown marker. */
  alertLevel: string;
}

interface ChartDatum extends TelemetrySeriesPoint {
  /** "HH:MM" tick label for the x-axis. */
  label: string;
  /** Offset in minutes as a number (for ReferenceLine x). */
  x: number;
}

const fmtTick = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
};

const fmtOffset = (min: number): string => {
  const sign = min < 0 ? "-" : "+";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${sign}${h}h${m.toString().padStart(2, "0")}m`;
};

export function CatchmentTelemetryCharts({
  wardId,
  wardName,
  rainfall,
  moisture,
  surgeActive,
  surgeArrivalMin,
  alertLevel,
}: CatchmentTelemetryChartsProps) {
  const [data, setData] = useState<WardTelemetrySeries | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  // Animated countdown (seconds) for the surge-arrival marker.
  // The countdown is stored as remaining seconds; it's seeded from the
  // surge lead-time the first time the interval ticks after activation.
  // All setStates happen inside the interval callback (never synchronously
  // in the effect body) to satisfy react-hooks/set-state-in-effect.
  const [countdown, setCountdown] = useState(0);
  const seededRef = useRef(false);
  useEffect(() => {
    // Reset the seed flag whenever the activation state flips so a fresh
    // activation re-seeds from the latest lead-time.
    seededRef.current = false;
  }, [surgeActive, surgeArrivalMin]);
  useEffect(() => {
    const id = setInterval(() => {
      if (!surgeActive) {
        setCountdown(0);
        return;
      }
      if (!seededRef.current) {
        seededRef.current = true;
        setCountdown(Math.max(0, Math.round(surgeArrivalMin * 60)));
        return;
      }
      setCountdown((c) => (c <= 0 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [surgeActive, surgeArrivalMin]);

  // Fetch the telemetry series (debounced + reqId-guarded to satisfy the
  // react-hooks/set-state-in-effect lint rule).
  useEffect(() => {
    if (!wardId) return;
    let cancelled = false;
    const reqId = ++reqIdRef.current;
    const timer = setTimeout(() => {
      if (cancelled || reqIdRef.current !== reqId) return;
      fetch("/api/hydrology/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wardId, rainfall, moisture }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("telemetry fetch failed");
          return r.json();
        })
        .then((d: WardTelemetrySeries) => {
          if (cancelled || reqIdRef.current !== reqId) return;
          setData(d);
          setErr(null);
        })
        .catch((e) => {
          if (cancelled || reqIdRef.current !== reqId) return;
          setErr(e instanceof Error ? e.message : "telemetry failed");
          setData(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wardId, rainfall, moisture]);

  const chartData: ChartDatum[] = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({
      ...p,
      label: fmtTick(p.t),
      x: p.offsetMin,
    }));
  }, [data]);

  const loading = !data && !err;
  const bankfull = data?.bankfull_stage_m ?? 0;
  const peakQ = data?.peak_projected_discharge_m3_per_s ?? 0;
  const peakStage = useMemo(() => {
    if (!data) return 0;
    const peakPt = data.series.find((p) => p.offsetMin === data.peak_arrival_min);
    return peakPt?.gauge_height_m ?? 0;
  }, [data]);
  const overtops = bankfull > 0 && peakStage > bankfull;

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;
  const countdownStr = `${countdownMin.toString().padStart(2, "0")}:${countdownSec
    .toString()
    .padStart(2, "0")}`;

  const surgeMarkerColor =
    alertLevel === "CATACLYSMIC"
      ? "#fb7185"
      : alertLevel === "EXTREME"
        ? "#f87171"
        : "#fbbf24";

  if (!wardId) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 text-sm text-slate-500">
        Select a catchment to load its 8-hour telemetry series.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <GaugeIcon className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-bold text-slate-100">
            {wardId.replace("UK-CHM-", "")}
          </span>
          <span className="text-[10px] text-slate-500">{wardName}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-300">
            Bankfull {bankfull.toFixed(2)}m
          </span>
          <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-amber-300">
            Peak Q {peakQ.toFixed(0)} m³/s
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 font-mono ${
              overtops
                ? "border-rose-600 bg-rose-500/15 text-rose-300"
                : "border-emerald-600 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {overtops ? "OVERTOPS" : "Within banks"}
          </span>
        </div>
      </div>

      {/* Surge countdown banner (only when cloudburst) */}
      {surgeActive && (
        <div
          className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
          style={{
            borderColor: surgeMarkerColor,
            background: `${surgeMarkerColor}22`,
            color: surgeMarkerColor,
          }}
        >
          <Timer className="h-3.5 w-3.5" />
          <span className="font-bold uppercase tracking-wider">
            Surge arrival at Vishnuprayag
          </span>
          <span className="ml-auto font-mono text-base font-bold tabular-nums">
            {countdownStr}
          </span>
          <span className="text-[9px] opacity-70">({fmtOffset(surgeArrivalMin)})</span>
        </div>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Resolving 8-hour telemetry series…
        </div>
      )}
      {err && (
        <div className="rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
          ⚠ {err}
        </div>
      )}

      {data && chartData.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Chart A: Rainfall intensity vs FFG threshold */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <CloudRain className="h-3 w-3 text-amber-400" />
              Rainfall intensity vs FFG threshold
              <span className="ml-auto font-mono text-slate-500">mm/hr · 6h past + 2h forecast</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fontSize: 9 }}
                    interval={Math.floor(chartData.length / 8)}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    width={36}
                  />
                  {/* Forecast window shading */}
                  <ReferenceArea
                    x1={chartData.find((d) => d.offsetMin === 0)?.label}
                    x2={chartData[chartData.length - 1]?.label}
                    fill="#0ea5e9"
                    fillOpacity={0.06}
                    stroke="#0ea5e9"
                    strokeOpacity={0.2}
                    strokeDasharray="2 2"
                  />
                  {/* Dynamic FFG threshold line */}
                  <ReferenceLine
                    y={data.series[0]?.ffg_threshold_mm_hr ?? 0}
                    stroke="#22d3ee"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    label={{
                      value: "FFG",
                      position: "insideTopLeft",
                      fill: "#22d3ee",
                      fontSize: 9,
                    }}
                  />
                  {/* Rainfall area */}
                  <Area
                    type="monotone"
                    dataKey="rainfall_mm_hr"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#rainGrad)"
                    isAnimationActive
                    animationDuration={600}
                  />
                  {/* FFG threshold as a line too (dynamic per step) */}
                  <Line
                    type="monotone"
                    dataKey="ffg_threshold_mm_hr"
                    stroke="#22d3ee"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#cbd5e1", fontSize: 10 }}
                    formatter={(v: number, name: string) => [
                      `${typeof v === "number" ? v.toFixed(1) : v} mm/hr`,
                      name === "rainfall_mm_hr" ? "Rainfall" : "FFG threshold",
                    ]}
                  />
                  {/* Surge arrival marker (vertical, only when cloudburst) */}
                  {surgeActive && data.peak_arrival_min > 0 && (
                    <ReferenceLine
                      x={
                        chartData.find(
                          (d) => d.offsetMin === data.peak_arrival_min
                        )?.label
                      }
                      stroke={surgeMarkerColor}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{
                        value: `T+${Math.round(data.peak_arrival_min)}m`,
                        position: "top",
                        fill: surgeMarkerColor,
                        fontSize: 9,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart B: Discharge Q vs Gauge height (dual-axis) with bankfull ref */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Waves className="h-3 w-3 text-cyan-400" />
              River discharge Q vs gauge height
              <span className="ml-auto flex items-center gap-2 font-mono text-slate-500">
                <span className="text-cyan-300">━ Q m³/s</span>
                <span className="text-emerald-300">━ Stage m</span>
                <span className="text-rose-300">┄ Bankfull</span>
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fontSize: 9 }}
                    interval={Math.floor(chartData.length / 8)}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#06b6d4"
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    width={36}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    width={32}
                  />
                  <ReferenceArea
                    x1={chartData.find((d) => d.offsetMin === 0)?.label}
                    x2={chartData[chartData.length - 1]?.label}
                    yAxisId="left"
                    fill="#0ea5e9"
                    fillOpacity={0.06}
                    stroke="#0ea5e9"
                    strokeOpacity={0.2}
                    strokeDasharray="2 2"
                  />
                  {/* Critical bankfull stage reference */}
                  <ReferenceLine
                    yAxisId="right"
                    y={bankfull}
                    stroke="#f43f5e"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{
                      value: `BANKFULL ${bankfull.toFixed(2)}m`,
                      position: "insideTopRight",
                      fill: "#f43f5e",
                      fontSize: 9,
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="discharge_m3_per_s"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#qGrad)"
                    isAnimationActive
                    animationDuration={600}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="gauge_height_m"
                    stroke="#10b981"
                    strokeWidth={1.8}
                    dot={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#cbd5e1", fontSize: 10 }}
                    formatter={(v: number, name: string) => {
                      if (name === "discharge_m3_per_s")
                        return [`${typeof v === "number" ? v.toFixed(1) : v} m³/s`, "Discharge Q"];
                      return [`${typeof v === "number" ? v.toFixed(2) : v} m`, "Gauge height"];
                    }}
                  />
                  {surgeActive && data.peak_arrival_min > 0 && (
                    <ReferenceLine
                      yAxisId="left"
                      x={
                        chartData.find(
                          (d) => d.offsetMin === data.peak_arrival_min
                        )?.label
                      }
                      stroke={surgeMarkerColor}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Footer: overtop warning */}
          {overtops && (
            <div className="flex items-center gap-1.5 rounded-md border border-rose-600/50 bg-rose-950/40 px-2.5 py-1.5 text-[10px] text-rose-300">
              <TriangleAlert className="h-3 w-3 shrink-0" />
              <span>
                Projected peak stage{" "}
                <span className="font-mono font-bold">{peakStage.toFixed(2)}m</span>{" "}
                exceeds bankfull{" "}
                <span className="font-mono font-bold">{bankfull.toFixed(2)}m</span> at{" "}
                <span className="font-mono">T+{Math.round(data.peak_arrival_min)}min</span> —
                inundation imminent at the outlet gauge.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 10,
  color: "#e2e8f0",
};
