"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Loader2, Play, RotateCcw, CloudRain, Droplets, CheckCircle2, Zap } from "lucide-react";

export interface WardTelemetry {
  ward_id: string;
  ward_name: string;
  rainfall: number; // mm/hr
  moisture: number; // %
}

interface TelemetryControlsProps {
  wards: WardTelemetry[];
  onChange: (wardId: string, field: "rainfall" | "moisture", value: number) => void;
  onRun: () => void;
  onReset: () => void;
  onPreset: (preset: string) => void;
  running: boolean;
  lastRunTime?: string | null;
  successFlash?: boolean;
}

const RAIN_MAX = 120;
const MOISTURE_MAX = 100;

export function TelemetryControls({
  wards,
  onChange,
  onRun,
  onReset,
  onPreset,
  running,
  lastRunTime = null,
  successFlash = false,
}: TelemetryControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={onRun}
          disabled={running}
          className={`font-bold transition-all duration-300 shadow-md ${
            running
              ? "bg-amber-600 text-slate-950 opacity-90 cursor-not-allowed"
              : successFlash
                ? "bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 shadow-emerald-500/30"
                : "bg-amber-500 text-slate-950 hover:bg-amber-400 hover:shadow-amber-500/25 active:scale-95"
          }`}
          title="Simulate kinematic wave routing and flood cascade for the basin"
        >
          {running ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-slate-950" />
              <span>Simulating...</span>
            </>
          ) : successFlash ? (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4 text-slate-950" />
              <span>Cascade Updated!</span>
            </>
          ) : (
            <>
              <Zap className="mr-1.5 h-4 w-4 fill-slate-950" />
              <span>Run Cascade</span>
            </>
          )}
        </Button>
        {lastRunTime && (
          <span className="hidden sm:inline-flex items-center text-[10.5px] font-mono text-slate-400">
            Last: <span className="text-amber-300 font-bold ml-1">{lastRunTime}</span>
          </span>
        )}
        <Button size="sm" variant="outline" onClick={onReset} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Reset
        </Button>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {["dry", "monsoon", "cloudburst"].map((p) => (
            <Button
              key={p}
              size="sm"
              variant="outline"
              className="h-7 border-slate-700 bg-slate-800 px-2 text-[11px] capitalize text-slate-200 hover:bg-slate-700"
              onClick={() => onPreset(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {wards.map((w) => (
          <div
            key={w.ward_id}
            className="rounded-md border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-200">
                {w.ward_id.replace("UK-CHM-", "")}
              </span>
              <span className="text-[10px] text-slate-500">{w.ward_name}</span>
            </div>

            <div className="mb-2.5">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-400">
                  <CloudRain className="h-3 w-3" /> Rainfall
                </span>
                <span className="font-mono text-amber-300">
                  {w.rainfall.toFixed(0)} mm/hr
                </span>
              </div>
              <Slider
                value={[w.rainfall]}
                min={0}
                max={RAIN_MAX}
                step={1}
                onValueChange={(v) => onChange(w.ward_id, "rainfall", v[0])}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-400">
                  <Droplets className="h-3 w-3" /> Soil moisture
                </span>
                <span className="font-mono text-cyan-300">
                  {w.moisture.toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[w.moisture]}
                min={0}
                max={MOISTURE_MAX}
                step={1}
                onValueChange={(v) => onChange(w.ward_id, "moisture", v[0])}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
