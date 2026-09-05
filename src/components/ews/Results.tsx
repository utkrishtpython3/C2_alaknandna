"use client";

import type {
  BasinCascadeResult,
  FlashFloodRiskVector,
  RiskLevel,
} from "@/lib/hydrologyEngine";
import {
  AlertTriangle,
  Waves,
  Timer,
  MountainSnow,
  Building2,
  Footprints,
  Radio,
} from "lucide-react";

const RISK_BADGE: Record<RiskLevel, { bg: string; text: string; ring: string; label: string }> = {
  LOW: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-500/40", label: "LOW" },
  MODERATE: { bg: "bg-amber-500/15", text: "text-amber-300", ring: "ring-amber-500/40", label: "MODERATE" },
  HIGH: { bg: "bg-orange-500/15", text: "text-orange-300", ring: "ring-orange-500/50", label: "HIGH" },
  EXTREME: { bg: "bg-red-500/15", text: "text-red-300", ring: "ring-red-500/50", label: "EXTREME" },
  CATACLYSMIC: { bg: "bg-rose-600/20", text: "text-rose-300", ring: "ring-rose-500/60", label: "CATACLYSMIC" },
};

interface ResultsProps {
  result: BasinCascadeResult | null;
  selectedWard: string | null;
  onSelectWard: (id: string) => void;
}

export function Results({ result, selectedWard, onSelectWard }: ResultsProps) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
        Awaiting telemetry. Adjust rainfall &amp; soil-moisture sliders, then run the cascade simulation.
      </div>
    );
  }

  const alert = RISK_BADGE[result.basin_wide_alert_level];

  return (
    <div className="flex flex-col gap-4">
      {/* Basin-wide alert banner */}
      <div className={`rounded-lg border p-4 ring-1 ${alert.ring} border-slate-700 bg-slate-900/70`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 rounded-md px-2.5 py-1 ${alert.bg} ${alert.text}`}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-bold tracking-wide">{alert.label}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              Basin-wide alert — Upper Alaknanda–Dhauliganga
            </p>
            <p className="font-mono text-sm text-slate-100">
              {result.timestamp.replace("T", " · ").replace(/\..+Z$/, " UTC")}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            icon={<Waves className="h-3.5 w-3.5" />}
            label="Confluence Q"
            value={`${result.cumulative_lower_basin_discharge_m3_per_s.toFixed(1)} m³/s`}
            tone="cyan"
          />
          <Metric
            icon={<Timer className="h-3.5 w-3.5" />}
            label="Surge lead time"
            value={`${Math.round(result.lower_basin_surge_arrival_min)} min`}
            tone="amber"
          />
          <Metric
            icon={<MountainSnow className="h-3.5 w-3.5" />}
            label="Routing"
            value={result.routing_order.map((r) => r.replace("UK-CHM-", "")).join(" → ")}
            tone="slate"
          />
          <Metric
            icon={<Radio className="h-3.5 w-3.5" />}
            label="Directive"
            value={result.basin_wide_alert_level}
            tone="rose"
          />
        </div>
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p className="font-mono text-[12px] leading-relaxed text-amber-200">
            ▸ {result.ndrf_deployment_directive}
          </p>
        </div>
      </div>

      {/* Per-ward risk cards */}
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
        {result.per_ward_risk.map((w) => (
          <WardCard
            key={w.ward_id}
            ward={w}
            selected={selectedWard === w.ward_id}
            onSelect={() => onSelectWard(w.ward_id)}
          />
        ))}
      </div>
    </div>
  );
}

function Metric({
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
    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500`}>
        <span className={tones[tone]}>{icon}</span>
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function WardCard({
  ward,
  selected,
  onSelect,
}: {
  ward: FlashFloodRiskVector;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = RISK_BADGE[ward.risk_level];
  return (
    <button
      onClick={onSelect}
      className={`flex h-full flex-col gap-3 rounded-lg border bg-slate-900/70 p-4 text-left transition hover:border-slate-600 ${
        selected ? "border-amber-500 ring-1 ring-amber-500/40" : "border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-100">
            {ward.ward_id.replace("UK-CHM-", "")}
          </p>
          <p className="truncate text-[11px] text-slate-500">{ward.ward_name}</p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Field label="Threshold" value={`${ward.dynamic_threshold_mm_hr.toFixed(1)} mm/hr`} />
        <Field label="Rainfall" value={`${ward.rainfall_intensity_mm_hr.toFixed(0)} mm/hr`} />
        <Field label="Peak Q" value={`${ward.peak_discharge_m3_per_s.toFixed(1)} m³/s`} tone="cyan" />
        <Field label="Runoff C" value={ward.runoff_coefficient_C.toFixed(2)} />
        <Field label="Arrival" value={`${Math.round(ward.estimated_flood_arrival_min)} min`} tone="amber" />
        <Field
          label="Exceed"
          value={`${ward.exceedance_ratio.toFixed(2)}×`}
          tone={ward.threshold_exceeded ? "rose" : "slate"}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>Debris-flow probability</span>
          <span className="font-mono text-rose-300">
            {(ward.debris_flow_probability * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 transition-all"
            style={{ width: `${Math.min(100, ward.debris_flow_probability * 100)}%` }}
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-950/50 p-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Footprints className="h-3 w-3 text-emerald-400" />
          Evacuation ({ward.evacuation_plan.length})
        </p>
        <ul className="mt-1.5 space-y-1">
          {ward.evacuation_plan.slice(0, 3).map((e) => (
            <li key={e.shelter_id} className="flex items-start justify-between gap-2 text-[10px]">
              <span className="break-words leading-tight text-slate-300">{e.name}</span>
              <span className="shrink-0 font-mono text-emerald-300">{e.elevation_m}m</span>
            </li>
          ))}
        </ul>
      </div>

      {ward.threshold_exceeded && (
        <p className="mt-auto flex items-start gap-1.5 text-[10px] leading-snug text-rose-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{ward.recommended_action}</span>
        </p>
      )}
    </button>
  );
}

function Field({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "cyan" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-200",
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`font-mono text-[12px] font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export { RISK_BADGE };
