"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  Cell,
} from "recharts";
import {
  CloudRain,
  Thermometer,
  Wind,
  Loader2,
  TriangleAlert,
  MapPin,
  Download,
  Zap,
} from "lucide-react";

interface MeteoForecastDay {
  date: string;
  index: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
  rain_sum_mm: number;
  wind_speed_10m_max_kmh: number;
  antecedent_7d_mm: number;
  soil_moisture_pct: number;
  effective_intensity_mm_hr: number;
  is_cloudburst: boolean;
  severity: "dry" | "wet" | "heavy" | "cloudburst";
}

interface DhauligangaMeteo {
  source: string;
  station: {
    name: string;
    latitude: number;
    longitude: number;
    elevation_m: number;
  };
  generated_at: string;
  timezone: string;
  window: { first_date: string; last_date: string; days: number };
  totals: {
    rain_sum_mm: number;
    cloudburst_days: number;
    max_daily_rain_mm: number;
    max_daily_rain_date: string;
    mean_temp_max_c: number;
    max_wind_kmh: number;
  };
  days: MeteoForecastDay[];
}

interface ChartDatum {
  date: string;
  label: string;
  rain: number;
  tmax: number;
  tmin: number;
  wind: number;
  intensity: number;
  moisture: number;
  is_cloudburst: boolean;
  severity: MeteoForecastDay["severity"];
}

interface MeteoForecastPanelProps {
  /** Called when the user clicks a forecast day to load it into the EWS. */
  onLoadDay: (day: {
    date: string;
    rainfall_mm_hr: number;
    soil_moisture_pct: number;
    is_cloudburst: boolean;
  }) => void;
  /** The currently-loaded day's date (highlighted on the chart), or null. */
  loadedDate: string | null;
}

const fmtLabel = (iso: string): string => {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
};

const RAIN_BAR_COLOR: Record<MeteoForecastDay["severity"], string> = {
  dry: "#475569",
  wet: "#0891b2",
  heavy: "#f59e0b",
  cloudburst: "#e11d48",
};

export function MeteoForecastPanel({
  onLoadDay,
  loadedDate,
}: MeteoForecastPanelProps) {
  const [data, setData] = useState<DhauligangaMeteo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const reqId = ++reqIdRef.current;
    fetch("/api/meteo/dhauliganga")
      .then((r) => {
        if (!r.ok) throw new Error("meteo fetch failed");
        return r.json();
      })
      .then((d: DhauligangaMeteo) => {
        if (cancelled || reqIdRef.current !== reqId) return;
        setData(d);
        setErr(null);
      })
      .catch((e) => {
        if (cancelled || reqIdRef.current !== reqId) return;
        setErr(e instanceof Error ? e.message : "meteo failed");
        setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData: ChartDatum[] = useMemo(() => {
    if (!data) return [];
    return data.days.map((d) => ({
      date: d.date,
      label: fmtLabel(d.date),
      rain: d.rain_sum_mm,
      tmax: d.temperature_2m_max,
      tmin: d.temperature_2m_min,
      wind: d.wind_speed_10m_max_kmh,
      intensity: d.effective_intensity_mm_hr,
      moisture: d.soil_moisture_pct,
      is_cloudburst: d.is_cloudburst,
      severity: d.severity,
    }));
  }, [data]);

  const loading = !data && !err;

  const handleBarClick = (datum: ChartDatum) => {
    onLoadDay({
      date: datum.date,
      rainfall_mm_hr: datum.intensity,
      soil_moisture_pct: datum.moisture,
      is_cloudburst: datum.is_cloudburst,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-bold text-slate-100">
            Dhauliganga Meteo Forecast
          </span>
          <span className="text-[10px] text-slate-500">
            {data?.station.name ?? "—"}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px]">
          {data && (
            <>
              <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-300">
                {data.totals.rain_sum_mm}mm total
              </span>
              <span className="rounded border border-rose-700/50 bg-rose-500/10 px-1.5 py-0.5 font-mono text-rose-300">
                {data.totals.cloudburst_days} CB days
              </span>
              <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-amber-300">
                max {data.totals.max_daily_rain_mm}mm · {data.totals.max_daily_rain_date}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Station metadata */}
      {data && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-slate-500">
          <span>
            lat <span className="font-mono text-slate-400">{data.station.latitude.toFixed(4)}</span>
          </span>
          <span>
            lng <span className="font-mono text-slate-400">{data.station.longitude.toFixed(4)}</span>
          </span>
          <span>
            elev <span className="font-mono text-slate-400">{data.station.elevation_m.toFixed(0)}m</span>
          </span>
          <span>
            window{" "}
            <span className="font-mono text-slate-400">
              {data.window.first_date} → {data.window.last_date} ({data.window.days}d)
            </span>
          </span>
          <span>source <span className="font-mono text-slate-400">{data.source}</span></span>
        </div>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading 93-day Dhauliganga forecast…
        </div>
      )}
      {err && (
        <div className="rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
          ⚠ {err}
        </div>
      )}

      {data && chartData.length > 0 && (
        <>
          {/* Legend / instructions */}
          <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-500">
            <span className="flex items-center gap-1">
              <CloudRain className="h-3 w-3 text-cyan-400" />
              Click any rainfall bar to load that day into the EWS cascade
            </span>
            <span className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: RAIN_BAR_COLOR.dry }} />
                dry
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: RAIN_BAR_COLOR.wet }} />
                wet
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: RAIN_BAR_COLOR.heavy }} />
                heavy
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: RAIN_BAR_COLOR.cloudburst }} />
                cloudburst
              </span>
            </span>
          </div>

          {/* The chart */}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                onClick={(e: { activeLabel?: string }) => {
                  if (e && e.activeLabel) {
                    const d = chartData.find((x) => x.label === e.activeLabel);
                    if (d) handleBarClick(d);
                  }
                }}
              >
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  tick={{ fontSize: 8 }}
                  interval={Math.floor(chartData.length / 12)}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#06b6d4"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  width={34}
                  label={{
                    value: "mm",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#06b6d4",
                    fontSize: 9,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f97316"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  width={28}
                  label={{
                    value: "°C",
                    angle: 90,
                    position: "insideRight",
                    fill: "#f97316",
                    fontSize: 9,
                  }}
                />
                {/* Rainfall bars (coloured by severity) */}
                <Bar
                  yAxisId="left"
                  dataKey="rain"
                  radius={[2, 2, 0, 0]}
                  isAnimationActive
                  animationDuration={500}
                  onClick={(d: ChartDatum) => handleBarClick(d)}
                >
                  {chartData.map((d) => (
                    <Cell
                      key={d.date}
                      fill={RAIN_BAR_COLOR[d.severity]}
                      fillOpacity={loadedDate === d.date ? 1 : 0.85}
                      stroke={loadedDate === d.date ? "#fbbf24" : "none"}
                      strokeWidth={loadedDate === d.date ? 2 : 0}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Bar>
                {/* Temperature max line (right axis) */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="tmax"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  dot={false}
                  strokeOpacity={0.8}
                />
                {/* Cloudburst markers */}
                {chartData
                  .filter((d) => d.is_cloudburst)
                  .map((d) => (
                    <ReferenceDot
                      key={`cb-${d.date}`}
                      yAxisId="left"
                      x={d.label}
                      y={d.rain}
                      r={5}
                      fill="#e11d48"
                      stroke="#fff"
                      strokeWidth={1}
                      isFront
                    />
                  ))}
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#cbd5e1", fontSize: 10 }}
                  formatter={(v: number, name: string) => {
                    if (name === "rain")
                      return [`${typeof v === "number" ? v.toFixed(1) : v} mm`, "Rain"];
                    if (name === "tmax")
                      return [`${typeof v === "number" ? v.toFixed(1) : v} °C`, "Tmax"];
                    return [String(v), name];
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Loaded-day summary */}
          {loadedDate &&
            (() => {
              const d = data.days.find((x) => x.date === loadedDate);
              if (!d) return null;
              return (
                <div className="rounded-md border border-amber-600/50 bg-amber-500/5 p-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span className="font-bold text-slate-200">
                      Loaded into EWS: {d.date}
                    </span>
                    {d.is_cloudburst && (
                      <span className="rounded bg-rose-600/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-300">
                        CLOUDBURST
                      </span>
                    )}
                    <span className="ml-auto font-mono text-slate-400">
                      rain {d.rain_sum_mm}mm · effI {d.effective_intensity_mm_hr} mm/hr · moist {d.soil_moisture_pct}% · API7 {d.antecedent_7d_mm}mm
                    </span>
                  </div>
                </div>
              );
            })()}

          {/* Per-day mini-strip (cloudburst days highlighted) */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <TriangleAlert className="h-3 w-3 text-rose-400" />
              Detected cloudburst days (rain ≥ 10mm · 1h burst)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.days
                .filter((d) => d.is_cloudburst)
                .map((d) => (
                  <button
                    key={d.date}
                    onClick={() =>
                      handleBarClick({
                        date: d.date,
                        rain: d.rain_sum_mm,
                        tmax: d.temperature_2m_max,
                        tmin: d.temperature_2m_min,
                        wind: d.wind_speed_10m_max_kmh,
                        intensity: d.effective_intensity_mm_hr,
                        moisture: d.soil_moisture_pct,
                        is_cloudburst: d.is_cloudburst,
                        severity: d.severity,
                        label: fmtLabel(d.date),
                      })
                    }
                    className={`flex flex-col items-start rounded-md border px-2 py-1 text-left transition ${
                      loadedDate === d.date
                        ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40"
                        : "border-rose-700/40 bg-rose-500/5 hover:bg-rose-500/10"
                    }`}
                  >
                    <span className="font-mono text-[10px] font-bold text-slate-200">
                      {d.date}
                    </span>
                    <span className="font-mono text-[9px] text-rose-300">
                      {d.rain_sum_mm}mm · {d.effective_intensity_mm_hr}mm/hr
                    </span>
                    <span className="font-mono text-[9px] text-cyan-400">
                      moist {d.soil_moisture_pct}%
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Climate summary strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ClimateStat
              icon={<CloudRain className="h-3 w-3" />}
              label="Seasonal rain"
              value={`${data.totals.rain_sum_mm} mm`}
              tone="cyan"
            />
            <ClimateStat
              icon={<Thermometer className="h-3 w-3" />}
              label="Mean Tmax"
              value={`${data.totals.mean_temp_max_c}°C`}
              tone="amber"
            />
            <ClimateStat
              icon={<Wind className="h-3 w-3" />}
              label="Max wind"
              value={`${data.totals.max_wind_kmh} km/h`}
              tone="slate"
            />
            <ClimateStat
              icon={<TriangleAlert className="h-3 w-3" />}
              label="Cloudburst days"
              value={`${data.totals.cloudburst_days}`}
              tone="rose"
            />
          </div>
        </>
      )}
    </div>
  );
}

function ClimateStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "amber" | "slate" | "rose";
}) {
  const tones: Record<string, string> = {
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    slate: "text-slate-300",
    rose: "text-rose-300",
  };
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
        <span className={tones[tone]}>{icon}</span>
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-[12px] font-semibold ${tones[tone]}`}>
        {value}
      </div>
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
