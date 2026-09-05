"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BasinCascadeResult,
  CatchmentFeature,
  ScenarioId,
} from "@/lib/hydrologyEngine";
import { SCENARIO_PRESETS } from "@/lib/hydrologyEngine";
import { CatchmentMap, type WardRiskState } from "@/components/ews/CatchmentMap";
import {
  TelemetryControls,
  type WardTelemetry,
} from "@/components/ews/TelemetryControls";
import { Results } from "@/components/ews/Results";
import { WardDetailPanel } from "@/components/ews/WardDetailPanel";
import { CatchmentTelemetryCharts } from "@/components/ews/CatchmentTelemetryCharts";
import { TacticalAlertBanner } from "@/components/ews/TacticalAlertBanner";
import { DisasterDispatchModal } from "@/components/ews/DisasterDispatchModal";
import { TelemetryHealthBar } from "@/components/ews/TelemetryHealthBar";
import { MeteoForecastPanel } from "@/components/ews/MeteoForecastPanel";
import { CommsLayerPanel } from "@/components/ews/CommsLayerPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  generateSitrepData,
  downloadSitrepJSON,
  type SimulationState,
} from "@/lib/generateSitrep";
import { usePresentationControls } from "@/hooks/usePresentationControls";
import {
  Satellite,
  CloudLightning,
  ShieldAlert,
  Activity,
  Sun,
  CloudRain,
  CloudLightning as CloudburstIcon,
  Send,
  Github,
  Map as MapIcon,
  LineChart as LineChartIcon,
  RadioTower,
  Keyboard,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const SCENARIO_META: Record<
  ScenarioId,
  { icon: typeof Sun; short: string }
> = {
  dry: { icon: Sun, short: "Dry" },
  monsoon: { icon: CloudRain, short: "Monsoon" },
  cloudburst: { icon: CloudburstIcon, short: "Cloudburst" },
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
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [commsOpen, setCommsOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
  const [loadedMeteoDate, setLoadedMeteoDate] = useState<string | null>(null);

  // Bootstrap: load catchment catalogue
  useEffect(() => {
    fetch("/api/hydrology/cascade")
      .then((r) => r.json())
      .then((data) => {
        const wards: { ward_id: string; ward_name: string }[] = (
          data.wards ?? []
        ).map((w: { ward_id: string; ward_name: string }) => ({
          ward_id: w.ward_id,
          ward_name: w.ward_name,
        }));
        setFeatures((data.features ?? []) as CatchmentFeature[]);
        const preset = SCENARIO_PRESETS.monsoon;
        setTelemetry(
          wards.map((w) => ({
            ward_id: w.ward_id,
            ward_name: w.ward_name,
            rainfall: preset.rainfall[w.ward_id] ?? 18,
            moisture: preset.soilMoisture[w.ward_id] ?? 40,
          }))
        );
        setActiveScenario("monsoon");
      })
      .catch(() => setError("Failed to load catchment catalogue"));
  }, []);

  const runCascade = useCallback(async (telem: WardTelemetry[]) => {
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
  }, []);

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
    setActiveScenario(null);
    setLoadedMeteoDate(null);
    setTelemetry((prev) =>
      prev.map((t) => (t.ward_id === wardId ? { ...t, [field]: value } : t))
    );
  };

  const applyScenario = useCallback(
    (scenarioId: ScenarioId) => {
      const preset = SCENARIO_PRESETS[scenarioId];
      const next = telemetry.map((t) => ({
        ...t,
        rainfall: preset.rainfall[t.ward_id] ?? t.rainfall,
        moisture: preset.soilMoisture[t.ward_id] ?? t.moisture,
      }));
      setTelemetry(next);
      setActiveScenario(scenarioId);
      setLoadedMeteoDate(null);
      runCascade(next);
    },
    [telemetry, runCascade]
  );

  const handleReset = () => applyScenario("monsoon");

  /**
   * Load a real Dhauliganga forecast day into the EWS. Sets each ward's
   * rainfall to the day's effective hourly intensity (1h burst for cloudburst
   * days, 24h spread otherwise) and soil moisture to the day's antecedent
   * 7-day-moisture proxy, then runs the cascade. This is the real-data
   * integration point between the Open-Meteo forecast and the hydrology
   * engine.
   */
  const handleLoadMeteoDay = (day: {
    date: string;
    rainfall_mm_hr: number;
    soil_moisture_pct: number;
    is_cloudburst: boolean;
  }) => {
    const next = telemetry.map((t) => ({
      ...t,
      rainfall: Math.min(120, Math.round(day.rainfall_mm_hr)),
      // Use the forecast-derived moisture, slightly adjusted per ward
      // (UPPER ridge dries faster, LOWER gorge holds moisture longer).
      moisture: Math.min(
        100,
        Math.max(
          0,
          Math.round(
            day.soil_moisture_pct +
              (t.ward_id === "UK-CHM-UPPER"
                ? -3
                : t.ward_id === "UK-CHM-LOWER"
                  ? +3
                  : 0)
          )
        )
      ),
    }));
    setTelemetry(next);
    setActiveScenario(null);
    setLoadedMeteoDate(day.date);
    runCascade(next);
  };

  const riskStates: WardRiskState[] = (result?.per_ward_risk ?? []).map((w) => ({
    ward_id: w.ward_id,
    ward_name: w.ward_name,
    risk_level: w.risk_level,
    peak_discharge_m3_per_s: w.peak_discharge_m3_per_s,
  }));

  const selectedTelemetry = telemetry.find((t) => t.ward_id === selectedWard);
  const alertLevel = result?.basin_wide_alert_level ?? "LOW";
  const isSevere =
    alertLevel === "EXTREME" || alertLevel === "CATACLYSMIC";
  const surgeActive = alertLevel === "CATACLYSMIC";
  const surgeArrivalMin = result?.lower_basin_surge_arrival_min ?? 0;

  /**
   * Build the dispatch input the CommsLayerPanel forwards to /api/dispatch.
   * Uses the selected ward's telemetry + the cascade's confluence Q /
   * surge lead-time + the ward's evacuation shelters (fetched from the ward
   * detail endpoint at render time would be async; here we pull them from the
   * cascade result's evacuation_plan which the engine already attached).
   */
  const dispatchInput = useMemo(() => {
    if (!result || !selectedTelemetry) return null;
    const ward = result.per_ward_risk.find(
      (w) => w.ward_id === selectedWard
    );
    if (!ward) return null;
    const shelters = ward.evacuation_plan.map((s) => ({
      name: s.name,
      elevationM: s.elevation_m,
      capacity: s.capacity_persons,
      coordinates: s.coordinates,
    }));
    return {
      wardId: ward.ward_id as
        | "UK-CHM-UPPER"
        | "UK-CHM-MID"
        | "UK-CHM-LOWER",
      riskLevel: ward.risk_level,
      peakQ: ward.peak_discharge_m3_per_s,
      leadTimeMins: Math.round(ward.estimated_flood_arrival_min),
      rainfallIntensity: ward.rainfall_intensity_mm_hr,
      soilMoisturePct: selectedTelemetry.moisture,
      confluenceDischarge: result.cumulative_lower_basin_discharge_m3_per_s,
      evacuationShelters: shelters,
    };
  }, [result, selectedTelemetry, selectedWard]);

  // Ward elevation_min lookup (from the catchment features) — used for the
  // SITREP's evacuation corridor elevation differentials.
  const wardElevationMin = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of features) m[f.properties.ward_id] = f.properties.elevation_min_m;
    return m;
  }, [features]);

  // Download the NDRF Incident SITREP JSON (triggered by the "S" hotkey
  // or a UI button).
  const handleDownloadSitrep = useCallback(() => {
    if (!result) return;
    const state: SimulationState = {
      cascade: result,
      soilMoisture: Object.fromEntries(
        telemetry.map((t) => [t.ward_id, t.moisture])
      ),
      wardElevationMin,
    };
    const report = generateSitrepData(state);
    downloadSitrepJSON(report);
  }, [result, telemetry, wardElevationMin]);

  // Presentation keyboard hotkeys (1/2/3/M/D/S).
  const { guideVisible, toggleGuide, lastKey } = usePresentationControls({
    onScenario: applyScenario,
    onToggleSiren: () =>
      window.dispatchEvent(new CustomEvent("ews:toggle-siren")),
    onOpenDispatch: () => setDispatchOpen(true),
    onDownloadSitrep: handleDownloadSitrep,
    enabled: !dispatchOpen,
  });

  return (
    <div className="ews-app flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-rose-600 shadow-lg">
              <Activity className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight text-slate-50 sm:text-base">
                Upper Alaknanda–Dhauliganga C2 · Flash Flood EWS
              </h1>
              <p className="text-[10px] leading-tight text-slate-500">
                Command &amp; Control situational dashboard · Chamoli, Uttarakhand
              </p>
            </div>
          </div>

          {/* Scenario toggle bar */}
          <div className="order-3 w-full lg:order-2 lg:ml-6 lg:w-auto">
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
              {(Object.keys(SCENARIO_PRESETS) as ScenarioId[]).map((id) => {
                const meta = SCENARIO_META[id];
                const Icon = meta.icon;
                const active = activeScenario === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyScenario(id)}
                    title={SCENARIO_PRESETS[id].description}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? id === "cloudburst"
                          ? "bg-rose-600/30 text-rose-300 ring-1 ring-rose-500/50"
                          : id === "monsoon"
                            ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/40"
                            : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="order-2 ml-auto flex flex-wrap items-center gap-1.5 lg:order-3">
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCommsOpen((v) => !v)}
              disabled={!result}
              className={`h-7 gap-1 px-2.5 text-[11px] font-semibold ${
                commsOpen
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              <RadioTower className="h-3.5 w-3.5" />
              Comms Layer
            </Button>
            <Button
              size="sm"
              onClick={() => setDispatchOpen(true)}
              disabled={!result}
              className="h-7 gap-1 bg-amber-500 px-2.5 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Send className="h-3.5 w-3.5" />
              Dispatch CAP Alert
            </Button>
          </div>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        {error && (
          <div className="mb-3 rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            ⚠ {error}
          </div>
        )}

        {/* Tactical alert banner — full width */}
        <div className="mb-4">
          {result ? (
            <TacticalAlertBanner
              alertLevel={alertLevel}
              surgeArrivalMin={surgeArrivalMin}
              confluenceQ={result.cumulative_lower_basin_discharge_m3_per_s}
              timestamp={result.timestamp}
              directive={result.ndrf_deployment_directive}
            />
          ) : (
            <div className="h-32 rounded-lg bg-slate-900/60 shimmer" />
          )}
        </div>

        {/* 55 / 45 split: left = map + cascade; right = telemetry + charts.
            Single column on mobile; 55/45 grid on lg+ screens. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[55fr_45fr]">
          {/* Left 55% */}
          <div className="flex flex-col gap-4">
            <Tabs defaultValue="map" className="w-full">
              <div className="mb-2 flex items-center justify-between">
                <SectionTitle>Operations viewport</SectionTitle>
                <TabsList className="h-7 bg-slate-900 p-0.5">
                  <TabsTrigger
                    value="map"
                    className="h-6 gap-1 px-2.5 text-[11px] data-[state=active]:bg-slate-700 data-[state=active]:text-amber-300"
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                    Hazard map
                  </TabsTrigger>
                  <TabsTrigger
                    value="charts"
                    className="h-6 gap-1 px-2.5 text-[11px] data-[state=active]:bg-slate-700 data-[state=active]:text-amber-300"
                  >
                    <LineChartIcon className="h-3.5 w-3.5" />
                    Hydrograph
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="map">
                <CatchmentMap
                  features={features}
                  riskStates={riskStates}
                  selectedWard={selectedWard}
                  onSelectWard={setSelectedWard}
                  surgeActive={surgeActive}
                  alertLevel={result?.basin_wide_alert_level ?? "LOW"}
                />
              </TabsContent>
              <TabsContent value="charts">
                <CatchmentTelemetryCharts
                  wardId={selectedWard}
                  wardName={selectedTelemetry?.ward_name ?? ""}
                  rainfall={selectedTelemetry?.rainfall ?? 0}
                  moisture={selectedTelemetry?.moisture ?? 0}
                  surgeActive={surgeActive}
                  surgeArrivalMin={surgeArrivalMin}
                  alertLevel={alertLevel}
                />
              </TabsContent>
            </Tabs>

            <section>
              <SectionTitle>Cascade simulation results</SectionTitle>
              {running && !result ? (
                <ResultsSkeleton />
              ) : (
                <Results
                  result={result}
                  selectedWard={selectedWard}
                  onSelectWard={setSelectedWard}
                />
              )}
            </section>
          </div>

          {/* Right 45% */}
          <div className="flex flex-col gap-4">
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
                  onPreset={(p) => applyScenario(p as ScenarioId)}
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

        {/* Telemetry health bar — full width */}
        <div className="mt-4">
          <TelemetryHealthBar severe={isSevere} />
        </div>

        {/* Dhauliganga meteo forecast — full width, real-data integration */}
        <div className="mt-4">
          <SectionTitle>Dhauliganga meteo forecast — real data feed</SectionTitle>
          <MeteoForecastPanel
            onLoadDay={handleLoadMeteoDay}
            loadedDate={loadedMeteoDate}
          />
        </div>

        {/* Tactical comms + resilient failover layer — Phase 3 */}
        <div className="mt-4">
          <SectionTitle>
            Tactical comms &amp; resilient failover — Phase 3 LoRa / SATCOM stack
          </SectionTitle>
          <CommsLayerPanel dispatchInput={dispatchInput} open={commsOpen} />
        </div>
      </main>

      {/* ---------------- Footer (sticky bottom) ---------------- */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Github className="h-3 w-3" />
            Engine:{" "}
            <code className="text-slate-400">hydrologyEngine.ts</code>
          </span>
          <span>
            Data: <code className="text-slate-400">catchments.geojson</code> · RFC 7946 · EPSG:4326
          </span>
          <span className="hidden sm:inline">
            Models: Green-Ampt FFG · Rational+sigmoid Q · Kirpich cascade · Stage–Q rating
          </span>
          <span className="ml-auto">
            Schema v1.5.0-c2 · NRSC / IMD / NDRF operational
          </span>
        </div>
      </footer>

      {/* ---------------- Disaster dispatch modal ---------------- */}
      <DisasterDispatchModal
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        telemetry={telemetry.map((t) => ({
          wardId: t.ward_id,
          rainfall: t.rainfall,
          moisture: t.moisture,
        }))}
        cascade={result}
      />

      {/* ---------------- Pitch controls guide (collapsible) ---------------- */}
      <div className="no-print fixed bottom-3 right-3 z-40 select-none">
        {lastKey && (
          <div className="mb-1.5 flex items-center justify-end gap-1.5 animate-pulse">
            <span className="rounded-md border border-amber-500/50 bg-slate-900/90 px-2 py-1 font-mono text-[10px] font-bold text-amber-300 shadow-lg">
              ⌘ {lastKey}
            </span>
          </div>
        )}
        {guideVisible ? (
          <div className="w-64 rounded-lg border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-100">
                <Keyboard className="h-3.5 w-3.5 text-amber-400" />
                Pitch Controls
              </span>
              <button
                type="button"
                onClick={toggleGuide}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                aria-label="Collapse pitch controls guide"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-1 text-[10px] text-slate-300">
              <HotkeyRow k="1" label="Dry / Pre-Monsoon Baseline" />
              <HotkeyRow k="2" label="Active Monsoon Saturated" />
              <HotkeyRow k="3" label="Cataclysmic Cloudburst Cascade" />
              <HotkeyRow k="M" label="Toggle Audio Klaxon Siren" />
              <HotkeyRow k="D" label="Open CAP Dispatch Modal" />
              <HotkeyRow k="S" label="Download NDRF SITREP JSON" />
            </ul>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleGuide}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 shadow-lg backdrop-blur transition hover:border-amber-500/50 hover:text-amber-300"
          >
            <Keyboard className="h-3.5 w-3.5" />
            Hotkeys
            <ChevronUp className="h-3 w-3 opacity-60" />
          </button>
        )}
      </div>
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

function HotkeyRow({ k, label }: { k: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-600 bg-slate-800 px-1 font-mono text-[10px] font-bold text-amber-300">
        {k}
      </kbd>
      <span className="text-slate-300">{label}</span>
    </li>
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
