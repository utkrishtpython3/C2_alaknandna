"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BasinCascadeResult,
  CatchmentFeature,
} from "@/lib/hydrologyEngine";
import { CatchmentMap, type WardRiskState } from "@/components/ews/CatchmentMap";
import {
  TelemetryControls,
  type WardTelemetry,
} from "@/components/ews/TelemetryControls";
import { Results } from "@/components/ews/Results";
import { WardDetailPanel } from "@/components/ews/WardDetailPanel";
import { SitrepModal } from "@/components/ews/SitrepModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAlertSiren } from "@/hooks/useAlertSiren";
import {
  Satellite,
  CloudLightning,
  ShieldAlert,
  Activity,
  Github,
  Volume2,
  VolumeX,
  Send,
} from "lucide-react";

const DEFAULT_RAIN = 18;
const DEFAULT_MOISTURE = {
  "UK-CHM-UPPER": 38,
  "UK-CHM-MID": 45,
  "UK-CHM-LOWER": 52,
};

const PRESETS: Record<
  string,
  Record<string, { rainfall: number; moisture: number }>
> = {
  dry: {
    "UK-CHM-UPPER": { rainfall: 6, moisture: 14 },
    "UK-CHM-MID": { rainfall: 6, moisture: 16 },
    "UK-CHM-LOWER": { rainfall: 6, moisture: 18 },
  },
  monsoon: {
    "UK-CHM-UPPER": { rainfall: 32, moisture: 68 },
    "UK-CHM-MID": { rainfall: 34, moisture: 72 },
    "UK-CHM-LOWER": { rainfall: 30, moisture: 78 },
  },
  cloudburst: {
    "UK-CHM-UPPER": { rainfall: 96, moisture: 90 },
    "UK-CHM-MID": { rainfall: 88, moisture: 92 },
    "UK-CHM-LOWER": { rainfall: 78, moisture: 94 },
  },
};

export default function Home() {
  const [features, setFeatures] = useState<CatchmentFeature[]>([]);
  const [telemetry, setTelemetry] = useState<WardTelemetry[]>([]);
  const [result, setResult] = useState<BasinCascadeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedWard, setSelectedWard] = useState<string | null>(
    "UK-CHM-UPPER"
  );
  const [error, setError] = useState<string | null>(null);
  const [sitrepOpen, setSitrepOpen] = useState(false);
  const siren = useAlertSiren();

  // Arm the Web Audio context on the first user interaction (autoplay policy).
  useEffect(() => {
    const onGesture = () => siren.arm();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [siren]);

  // Drive the siren from the basin alert level. EXTREME/CATACLYSMIC trigger
  // the wail; anything below silences it. Respects the mute toggle.
  useEffect(() => {
    const level = result?.basin_wide_alert_level;
    const active = level === "EXTREME" || level === "CATACLYSMIC";
    if (active && !siren.muted) {
      siren.start();
    } else {
      siren.stop();
    }
  }, [result?.basin_wide_alert_level, siren.muted, siren]);

  // Bootstrap: load catchment catalogue
  useEffect(() => {
    fetch("/api/hydrology/cascade")
      .then((r) => r.json())
      .then((data) => {
        const wards: { ward_id: string; ward_name: string }[] = (
          data.wards ?? []
        ).map(
          (w: { ward_id: string; ward_name: string }) => ({
            ward_id: w.ward_id,
            ward_name: w.ward_name,
          })
        );
        setFeatures((data.features ?? []) as CatchmentFeature[]);
        setTelemetry(
          wards.map((w) => ({
            ward_id: w.ward_id,
            ward_name: w.ward_name,
            rainfall: DEFAULT_RAIN,
            moisture: DEFAULT_MOISTURE[w.ward_id as keyof typeof DEFAULT_MOISTURE] ?? 40,
          }))
        );
      })
      .catch(() => setError("Failed to load catchment catalogue"));
  }, []);

  const runCascade = useCallback(
    async (telem: WardTelemetry[]) => {
      setRunning(true);
      setError(null);
      try {
        const rainfall: Record<string, number> = {};
        const soilMoisture: Record<string, number> = {};
        for (const t of telem) {
          rainfall[t.ward_id] = t.rainfall;
          soilMoisture[t.ward_id] = t.moisture;
        }
        const res = await fetch("/api/hydrology/cascade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rainfall, soilMoisture }),
        });
        if (!res.ok) throw new Error("Cascade request failed");
        const data: BasinCascadeResult = await res.json();
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cascade failed");
      } finally {
        setRunning(false);
      }
    },
    []
  );

  // Auto-run once catalogue is loaded
  useEffect(() => {
    if (telemetry.length > 0 && !result) {
      runCascade(telemetry);
    }
  }, [telemetry, result, runCascade]);

  const handleChange = (
    wardId: string,
    field: "rainfall" | "moisture",
    value: number
  ) => {
    setTelemetry((prev) =>
      prev.map((t) => (t.ward_id === wardId ? { ...t, [field]: value } : t))
    );
  };

  const handlePreset = (preset: string) => {
    const p = PRESETS[preset];
    if (!p) return;
    const next = telemetry.map((t) => ({
      ...t,
      rainfall: p[t.ward_id]?.rainfall ?? t.rainfall,
      moisture: p[t.ward_id]?.moisture ?? t.moisture,
    }));
    setTelemetry(next);
    runCascade(next);
  };

  const handleReset = () => {
    const reset = telemetry.map((t) => ({
      ...t,
      rainfall: DEFAULT_RAIN,
      moisture:
        DEFAULT_MOISTURE[t.ward_id as keyof typeof DEFAULT_MOISTURE] ?? 40,
    }));
    setTelemetry(reset);
    runCascade(reset);
  };

  const riskStates: WardRiskState[] = (result?.per_ward_risk ?? []).map((w) => ({
    ward_id: w.ward_id,
    ward_name: w.ward_name,
    risk_level: w.risk_level,
    peak_discharge_m3_per_s: w.peak_discharge_m3_per_s,
  }));

  const selectedTelemetry = telemetry.find((t) => t.ward_id === selectedWard);
  const alertLevel = result?.basin_wide_alert_level ?? "LOW";

  return (
    <div className="ews-app flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-rose-600 shadow-lg">
              <Activity className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight text-slate-50 sm:text-base">
                Upper Alaknanda–Dhauliganga Flash Flood EWS
              </h1>
              <p className="text-[10px] leading-tight text-slate-500">
                Hyper-local micro-catchment hazard controller · Chamoli, Uttarakhand
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="gap-1 border-slate-700 bg-slate-900 text-[10px] font-normal text-slate-300"
            >
              <Satellite className="h-3 w-3 text-amber-400" /> NRSC
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 border-slate-700 bg-slate-900 text-[10px] font-normal text-slate-300"
            >
              <CloudLightning className="h-3 w-3 text-cyan-400" /> IMD
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 border-slate-700 bg-slate-900 text-[10px] font-normal text-slate-300"
            >
              <ShieldAlert className="h-3 w-3 text-rose-400" /> NDRF
            </Badge>

            {/* Siren mute toggle — visible only once audio is armed or active */}
            <button
              type="button"
              onClick={siren.toggleMute}
              aria-label={siren.muted ? "Unmute alert siren" : "Mute alert siren"}
              title={siren.muted ? "Alert siren muted" : "Alert siren armed"}
              className={`flex h-6 w-6 items-center justify-center rounded-md border text-[10px] transition ${
                siren.muted
                  ? "border-slate-700 bg-slate-800 text-slate-500 hover:bg-slate-700"
                  : siren.active
                    ? "border-rose-500 bg-rose-500/20 text-rose-300 alert-strobe-pulse"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {siren.muted ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </button>

            <AlertBadge level={alertLevel} active={siren.active} />

            <Button
              size="sm"
              onClick={() => setSitrepOpen(true)}
              disabled={!result}
              className="h-7 gap-1 bg-amber-500 px-2.5 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Send className="h-3.5 w-3.5" />
              Dispatch NDRF SITREP
            </Button>
          </div>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4">
        {error && (
          <div className="mb-3 rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            ⚠ {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Left: map + results */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            <section>
              <SectionTitle>Catchment hazard map</SectionTitle>
              <CatchmentMap
                features={features}
                riskStates={riskStates}
                selectedWard={selectedWard}
                onSelectWard={setSelectedWard}
              />
            </section>

            <section>
              <SectionTitle>Cascade simulation results</SectionTitle>
              {running && !result ? <ResultsSkeleton /> : (
                <Results
                  result={result}
                  selectedWard={selectedWard}
                  onSelectWard={setSelectedWard}
                />
              )}
            </section>
          </div>

          {/* Right: controls + ward detail */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <SectionTitle>Live telemetry input</SectionTitle>
              {telemetry.length === 0 ? (
                <div className="h-40 rounded-md bg-slate-900/60 shimmer" />
              ) : (
                <TelemetryControls
                  wards={telemetry}
                  onChange={handleChange}
                  onRun={() => runCascade(telemetry)}
                  onReset={handleReset}
                  onPreset={handlePreset}
                  running={running}
                />
              )}
            </section>

            <section>
              <SectionTitle>Ward hydro-physics &amp; evacuation</SectionTitle>
              <WardDetailPanel
                wardId={selectedWard}
                rainfall={selectedTelemetry?.rainfall ?? 0}
                moisture={selectedTelemetry?.moisture ?? 0}
              />
            </section>
          </div>
        </div>
      </main>

      {/* ---------------- Footer (sticky bottom) ---------------- */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Github className="h-3 w-3" />
            Engine:{" "}
            <code className="text-slate-400">hydrologyEngine.ts</code>
          </span>
          <span>
            Data: <code className="text-slate-400">catchments.geojson</code> · RFC 7946 · EPSG:4326
          </span>
          <span className="hidden sm:inline">
            Models: Dynamic Green-Ampt FFG · Rational+sigmoid Q · Kirpich kinematic cascade
          </span>
          <span className="ml-auto">
            Schema v1.4.0-ops · For operational use by NRSC / IMD / NDRF
          </span>
        </div>
      </footer>

      {/* ---------------- SITREP dispatch modal ---------------- */}
      <SitrepModal
        open={sitrepOpen}
        onOpenChange={setSitrepOpen}
        telemetry={telemetry.map((t) => ({
          wardId: t.ward_id,
          rainfall: t.rainfall,
          moisture: t.moisture,
        }))}
        cascade={result}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h2>
  );
}

function AlertBadge({ level, active }: { level: string; active?: boolean }) {
  const styles: Record<string, string> = {
    LOW: "border-emerald-600/50 bg-emerald-500/15 text-emerald-300",
    MODERATE: "border-amber-600/50 bg-amber-500/15 text-amber-300",
    HIGH: "border-orange-600/50 bg-orange-500/15 text-orange-300",
    EXTREME: "border-red-600/50 bg-red-500/15 text-red-300",
    CATACLYSMIC: "border-rose-600/60 bg-rose-600/20 text-rose-300",
  };
  // Strobe only when the siren is actively firing AND the level is severe —
  // i.e. a genuine evacuation trigger, not just a static risk classification.
  const strobe =
    active && (level === "CATACLYSMIC"
      ? "strobe-red"
      : level === "EXTREME"
        ? "strobe-amber"
        : "");
  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles[level] ?? styles.LOW} ${strobe}`}
    >
      <ShieldAlert className="h-3 w-3" />
      {level}
    </span>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-28 rounded-lg bg-slate-900/60 shimmer" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="h-64 rounded-lg bg-slate-900/60 shimmer" />
        <div className="h-64 rounded-lg bg-slate-900/60 shimmer" />
        <div className="h-64 rounded-lg bg-slate-900/60 shimmer" />
      </div>
    </div>
  );
}
