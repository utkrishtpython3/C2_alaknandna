"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SCENARIO_PRESETS,
  type BasinCascadeResult,
  type CatchmentFeature,
  type ScenarioId,
} from "@/lib/hydrologyEngine";
import { CatchmentMap, type WardRiskState } from "@/components/ews/CatchmentMap";
import { TacticalTerrain3D, type TacticalSimulationState } from "@/components/TacticalTerrain3D";
import { LeadTimeMatrix } from "@/components/ews/LeadTimeMatrix";
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
import { SitrepModal } from "@/components/ews/SitrepModal";
import { MultiSourceFusionCockpit } from "@/components/ews/MultiSourceFusionCockpit";
import { NebiusHpcModal } from "@/components/dashboard/NebiusHpcModal";
import { DebrisRheologyLabModal } from "@/components/ews/DebrisRheologyLabModal";
import { TacticalVoiceBroadcastModal } from "@/components/ews/TacticalVoiceBroadcastModal";
import { JudgePitchTourModal } from "@/components/ews/JudgePitchTourModal";
import { ValleyCrossSectionModal } from "@/components/ews/ValleyCrossSectionModal";
import { NdrfCommandPostModal } from "@/components/ews/NdrfCommandPostModal";
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
  Mountain,
  Keyboard,
  ChevronUp,
  ChevronDown,
  Clock,
  Maximize2,
  Zap,
  Loader2,
  CheckCircle2,
  FileText,
  Layers,
  Waves,
  Server,
  Cpu,
  Flame,
  Droplets,
  Volume2,
  TrendingUp,
} from "lucide-react";
import { useRealtimeClock } from "@/hooks/useRealtimeClock";

const SCENARIO_META: Record<
  ScenarioId,
  { icon: typeof Sun; short: string }
> = {
  dry: { icon: Sun, short: "Dry" },
  monsoon: { icon: CloudRain, short: "Monsoon" },
  cloudburst: { icon: CloudburstIcon, short: "Cloudburst" },
  glof: { icon: Waves, short: "2021 GLOF" },
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
  const [sitrepOpen, setSitrepOpen] = useState(false);
  const [multiSourceOpen, setMultiSourceOpen] = useState(false);
  const [nebiusHpcOpen, setNebiusHpcOpen] = useState(false);
  const [rheologyLabOpen, setRheologyLabOpen] = useState(false);
  const [voiceBroadcastOpen, setVoiceBroadcastOpen] = useState(false);
  const [judgeTourOpen, setJudgeTourOpen] = useState(false);
  const [valleyCrossSectionOpen, setValleyCrossSectionOpen] = useState(false);
  const [valleyCrossSectionLocId, setValleyCrossSectionLocId] = useState<string>("loc-vishnuprayag");
  const [ndrfCommandPostOpen, setNdrfCommandPostOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
  const [loadedMeteoDate, setLoadedMeteoDate] = useState<string | null>(null);
  const realtimeClock = useRealtimeClock();
  const [cascadeSuccessFlash, setCascadeSuccessFlash] = useState(false);
  const [lastCascadeTime, setLastCascadeTime] = useState<string | null>(null);

  // Map viewport height state (controlled by dynamic slider, applied to both 3D and 2D)
  const [mapHeight, setMapHeight] = useState<number>(640);
  const [activeViewportTab, setActiveViewportTab] = useState<string>("terrain3d");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>("loc-joshimath");

  const handleMapHeightChange = useCallback((val: number) => {
    setMapHeight(val);
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }, []);

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

  // Keep a stable ref to the current telemetry array so callbacks don't thrash
  const telemetryRef = useRef<WardTelemetry[]>(telemetry);
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  const runningRef = useRef(false);
  const autoRunDoneRef = useRef(false);

  const runCascade = useCallback(async (telem: WardTelemetry[]) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);
    try {
      const rainfall: Record<string, number> = {};
      const soilMoisture: Record<string, number> = {};
      for (const t of telem) {
        rainfall[t.ward_id] = t.rainfall;
        soilMoisture[t.ward_id] = t.moisture;
      }
      // Guarantee minimum 350ms visual execution duration so user feels the simulation computing
      const [res] = await Promise.all([
        fetch("/api/hydrology/cascade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rainfall, soilMoisture }),
        }),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
      if (!res.ok) throw new Error("Cascade request failed");
      const data: BasinCascadeResult = await res.json();
      setResult(data);
      const nowStr = new Date().toLocaleTimeString("en-IN", { hour12: false });
      setLastCascadeTime(nowStr);
      setCascadeSuccessFlash(true);
      setTimeout(() => setCascadeSuccessFlash(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cascade failed");
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  // Auto-run once catalogue is loaded
  useEffect(() => {
    if (telemetry.length > 0 && !autoRunDoneRef.current) {
      autoRunDoneRef.current = true;
      runCascade(telemetry);
    }
  }, [telemetry, runCascade]);

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
      const current = telemetryRef.current;
      const next = current.map((t) => ({
        ...t,
        rainfall: preset.rainfall[t.ward_id] ?? t.rainfall,
        moisture: preset.soilMoisture[t.ward_id] ?? t.moisture,
      }));
      setTelemetry(next);
      setActiveScenario(scenarioId);
      setLoadedMeteoDate(null);
      runCascade(next);
    },
    [runCascade]
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

  const [liveMeteoData, setLiveMeteoData] = useState<{
    summary?: {
      mean_temperature_c: number;
      mean_humidity_pct: number;
      mean_soil_saturation_pct: number;
      mean_surface_pressure_hpa: number;
    };
  } | null>(null);
  const [liveMeteoLoading, setLiveMeteoLoading] = useState(false);

  const fetchAndApplyLiveMeteo = useCallback(async () => {
    setLiveMeteoLoading(true);
    try {
      const res = await fetch("/api/meteo/live");
      if (!res.ok) throw new Error("Live meteo query failed");
      const data = await res.json();
      setLiveMeteoData(data);

      if (data.wards) {
        const next = telemetry.map((t) => {
          const wData = data.wards[t.ward_id];
          if (!wData) return t;
          return {
            ...t,
            rainfall: wData.rainfall_mm_hr,
            moisture: wData.soil_moisture_pct,
          };
        });
        setTelemetry(next);
        setActiveScenario(null);
        setLoadedMeteoDate(`LIVE ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`);
        runCascade(next);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLiveMeteoLoading(false);
    }
  }, [telemetry, runCascade]);

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
  const surgeActive = alertLevel === "CATACLYSMIC" || alertLevel === "EXTREME";
  const surgeArrivalMin = result?.lower_basin_surge_arrival_min ?? 0;

  // Dynamically map cascade computation results directly into 3D tactical terrain simulation
  const mappedSimulationState = useMemo<TacticalSimulationState>(() => {
    if (result) {
      if (
        result.basin_wide_alert_level === "CATACLYSMIC" ||
        result.basin_wide_alert_level === "EXTREME"
      ) {
        return "CLOUDBURST_CATACLYSMIC";
      }
      if (result.basin_wide_alert_level === "LOW") {
        return "DRY_BASELINE";
      }
      return "MONSOON_SATURATED";
    }
    if (activeScenario === "glof" || activeScenario === "cloudburst") return "CLOUDBURST_CATACLYSMIC";
    if (activeScenario === "dry") return "DRY_BASELINE";
    return "MONSOON_SATURATED";
  }, [result, activeScenario]);

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

  // Presentation keyboard hotkeys (1/2/3/4/M/D/S/R/F/T/L/V/P/X).
  const { guideVisible, toggleGuide, lastKey } = usePresentationControls({
    onScenario: applyScenario,
    onToggleSiren: () =>
      window.dispatchEvent(new CustomEvent("ews:toggle-siren")),
    onOpenDispatch: () => setDispatchOpen(true),
    onDownloadSitrep: handleDownloadSitrep,
    onOpenSitrep: () => setSitrepOpen(true),
    onOpenMultiSource: () => setMultiSourceOpen(true),
    onOpenJudgeTour: () => setJudgeTourOpen(true),
    onOpenRheologyLab: () => setRheologyLabOpen(true),
    onOpenVoiceBroadcast: () => setVoiceBroadcastOpen(true),
    onOpenNebiusHpc: () => setNebiusHpcOpen(true),
    onOpenValleyCrossSection: () => setValleyCrossSectionOpen(true),
    onStartDroneTour: () => {
      setActiveViewportTab("terrain3d");
      window.dispatchEvent(new CustomEvent("ews:start-drone-tour"));
    },
    onOpenNdrfCommandPost: () => setNdrfCommandPostOpen(true),
    enabled: !dispatchOpen && !sitrepOpen && !multiSourceOpen && !rheologyLabOpen && !voiceBroadcastOpen && !judgeTourOpen && !ndrfCommandPostOpen,
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
                        ? id === "glof"
                          ? "bg-purple-600/30 text-purple-300 ring-1 ring-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                          : id === "cloudburst"
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
              {/* Real-time Open-Meteo Live Data Sync Button */}
              <button
                type="button"
                onClick={fetchAndApplyLiveMeteo}
                disabled={liveMeteoLoading}
                title="Query live real-time Open-Meteo weather and soil moisture for Joshimath-Auli corridor"
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  loadedMeteoDate?.startsWith("LIVE")
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 ${
                      loadedMeteoDate?.startsWith("LIVE")
                        ? "animate-ping opacity-75"
                        : "opacity-40"
                    }`}
                  />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>{liveMeteoLoading ? "Syncing..." : "Live Open-Meteo (Realtime)"}</span>
              </button>
            </div>
            {liveMeteoData?.summary && (
              <span className="ml-2 hidden xl:inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-mono text-emerald-300">
                <span>● REALTIME:</span>
                <span>{liveMeteoData.summary.mean_temperature_c}°C</span>
                <span>•</span>
                <span>{liveMeteoData.summary.mean_humidity_pct}% RH</span>
                <span>•</span>
                <span>{liveMeteoData.summary.mean_soil_saturation_pct}% SOIL SAT</span>
              </span>
            )}
          </div>

          <div className="order-2 ml-auto flex flex-wrap items-center gap-1.5 lg:order-3">
            {/* Live Real-Time Defense Clock with Seconds */}
            <div className="flex items-center gap-1.5 rounded-md border border-cyan-800/60 bg-slate-900/90 px-2.5 py-1 text-[11px] font-mono shadow-inner">
              <Clock className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span className="font-bold tracking-wider text-cyan-200">{realtimeClock.istTime}</span>
              <span className="text-[9px] font-bold text-cyan-400">IST</span>
              <span className="text-slate-600">|</span>
              <span className="text-[10px] text-slate-400">{realtimeClock.utcTime}</span>
              <span className="text-[9px] text-slate-500">UTC</span>
            </div>

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
              onClick={() => setNdrfCommandPostOpen(true)}
              className="gap-1 border-rose-500/50 bg-rose-950/40 text-[10px] font-mono text-rose-300 cursor-pointer hover:bg-rose-900/60 transition shadow-[0_0_8px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/30"
              title="Open NDRF Incident Command Post, MHA Form ICS-204 & NDMA Sachet Gateway (Hotkey: I)"
            >
              <ShieldAlert className="h-3 w-3 text-rose-400" /> NDRF ICP
            </Badge>

            {/* 60s Executive Tactical Mission Briefing */}
            <Button
              size="sm"
              onClick={() => setJudgeTourOpen(true)}
              className="h-7 gap-1.5 border border-slate-700 bg-slate-800 px-3 text-[11px] font-bold text-amber-300 hover:bg-slate-700 hover:text-amber-200 shadow-sm cursor-pointer"
              title="Launch 60-Second Tactical Mission Briefing (Hotkey: T)"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>⚡ 60s Briefing</span>
            </Button>

            {/* Nebius H100 & TensorRT HPC Telemetry Modal Trigger */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNebiusHpcOpen(true)}
              className="h-7 gap-1.5 border-emerald-500/60 bg-emerald-950/50 px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/60 shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30 cursor-pointer"
              title="Open Nebius AI Cloud & NVIDIA TensorRT HPC Telemetry HUD (Hotkey: P)"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <span>Nebius H100 (3.8ms)</span>
            </Button>

            {/* Non-Newtonian Rheology & Debris Bulking Lab */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRheologyLabOpen(true)}
              className="h-7 gap-1.5 border-purple-500/60 bg-purple-950/40 px-2.5 text-[11px] font-semibold text-purple-200 hover:bg-purple-900/60 shadow-[0_0_10px_rgba(168,85,247,0.25)] cursor-pointer"
              title="Open Coupled Non-Newtonian Rheology & Debris Bulking Lab (Hotkey: L)"
            >
              <Droplets className="h-3.5 w-3.5 text-purple-400" />
              <span>Rheology Lab (2.10&times;)</span>
            </Button>

            {/* Tactical Multilingual Megaphone Voice Siren */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVoiceBroadcastOpen(true)}
              className="h-7 gap-1.5 border-rose-500/60 bg-rose-950/40 px-2.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-900/60 shadow-[0_0_10px_rgba(244,63,94,0.25)] cursor-pointer"
              title="Open Multilingual Tactical Megaphone Siren (Garhwali / Hindi / English) (Hotkey: V)"
            >
              <Volume2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Voice Siren (गढ़वाली)</span>
            </Button>

            {/* NDRF Incident Command Post & Sachet Dissemination */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNdrfCommandPostOpen(true)}
              className="h-7 gap-1.5 border-rose-500/60 bg-rose-950/50 px-2.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-900/60 shadow-[0_0_12px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/40 cursor-pointer"
              title="Open NDRF Incident Command Post, MHA Form ICS-204 & NDMA Sachet Gateway (Hotkey: I)"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>NDRF Command Post</span>
            </Button>

            {/* Multi-Source Ingestion Cockpit */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMultiSourceOpen(true)}
              className="h-7 gap-1.5 border-cyan-700/60 bg-cyan-950/40 px-2.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-900/60 shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer"
              title="Open Multi-Source Data Ingestion & Sensor Fusion Cockpit (Hotkey: F)"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 animate-ping opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              Multi-Source (5/5)
            </Button>

            {/* NDRF Incident SITREP */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSitrepOpen(true)}
              disabled={!result}
              className="h-7 gap-1 border-slate-700 bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 hover:text-amber-300 cursor-pointer"
              title="Open Official NDRF Incident Command Situation Report (Hotkey: R)"
            >
              <FileText className="h-3.5 w-3.5 text-amber-400" />
              NDRF SITREP
            </Button>

            {/* 2D Geotechnical Valley Profile Modal */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setValleyCrossSectionLocId("loc-vishnuprayag");
                setValleyCrossSectionOpen(true);
              }}
              className="h-7 gap-1 border-cyan-700/60 bg-cyan-950/40 px-2.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-900/60 shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer"
              title="Open 2D Topographic Slicing & Valley Cross-Section Profile (Hotkey: X)"
            >
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
              <span>Valley Profile (2D)</span>
            </Button>

            {/* Offline PWA Ready Badge */}
            <span
              className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[10px] font-mono font-bold text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
              title="Progressive Web App (PWA) Offline Service Worker Active: Operates with zero internet during telecom blackout"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Offline C2 Ready
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCommsOpen((v) => !v)}
              disabled={!result}
              className={`h-7 gap-1 px-2.5 text-[11px] font-semibold cursor-pointer ${
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
              className="h-7 gap-1 bg-amber-500 px-2.5 text-[11px] font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer"
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
          <div id="operations-viewport" className="flex flex-col gap-4 scroll-mt-6">
            <Tabs
              value={activeViewportTab}
              onValueChange={(val) => {
                setActiveViewportTab(val);
                if (val === "terrain3d") {
                  setTimeout(() => {
                    window.dispatchEvent(new Event("resize"));
                  }, 60);
                }
              }}
              className="w-full"
            >
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <SectionTitle>Operations viewport</SectionTitle>

                  {/* Dynamic Map Size Slider (controls both 3D & 2D maps) */}
                  <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs shadow-inner">
                    <Maximize2 className="h-3 w-3 text-cyan-400" />
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Map Size:
                    </span>
                    <input
                      type="range"
                      min={400}
                      max={960}
                      step={20}
                      value={mapHeight}
                      onChange={(e) => handleMapHeightChange(Number(e.target.value))}
                      className="h-1.5 w-20 sm:w-28 cursor-pointer accent-cyan-400 rounded bg-slate-700 hover:accent-cyan-300 transition"
                      title="Slide to dynamically adjust 3D & 2D map height"
                    />
                    <span className="font-mono text-[11px] font-bold text-cyan-300 w-12 text-right">
                      {mapHeight}px
                    </span>

                    {/* Quick preset buttons */}
                    <div className="hidden sm:flex items-center gap-1 border-l border-slate-800 pl-2">
                      <button
                        type="button"
                        onClick={() => handleMapHeightChange(480)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono transition ${
                          mapHeight === 480
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Compact
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMapHeightChange(640)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono transition ${
                          mapHeight === 640
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMapHeightChange(840)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono transition ${
                          mapHeight === 840
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Expanded
                      </button>
                    </div>
                  </div>
                </div>

                <TabsList className="h-7 bg-slate-900 p-0.5 ring-1 ring-slate-700">
                  <TabsTrigger
                    value="terrain3d"
                    className="h-6 gap-1 px-2.5 text-[11px] font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 data-[state=inactive]:text-slate-400"
                  >
                    <Mountain className="h-3.5 w-3.5" />
                    3D Tactical Twin
                  </TabsTrigger>
                  <TabsTrigger
                    value="map"
                    className="h-6 gap-1 px-2.5 text-[11px] font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 data-[state=inactive]:text-slate-400"
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                    Hazard map (2D)
                  </TabsTrigger>
                  <TabsTrigger
                    value="charts"
                    className="h-6 gap-1 px-2.5 text-[11px] font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 data-[state=inactive]:text-slate-400"
                  >
                    <LineChartIcon className="h-3.5 w-3.5" />
                    Hydrograph
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="terrain3d" className="mt-0">
                <TacticalTerrain3D
                  height={`${mapHeight}px`}
                  simulationState={mappedSimulationState}
                  onScenarioChange={(state) => {
                    const mapped =
                      state === "DRY_BASELINE"
                        ? "dry"
                        : state === "glof"
                          ? "glof"
                          : state === "CLOUDBURST_CATACLYSMIC"
                            ? "cloudburst"
                            : "monsoon";
                    applyScenario(mapped);
                  }}
                  selectedWard={selectedWard}
                  onSelectWard={setSelectedWard}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={setSelectedLocationId}
                  leadTimeMin={result?.lower_basin_surge_arrival_min}
                  onSelectStation={(stnId) => {
                    if (stnId.includes("station-d")) setSelectedWard("UK-CHM-LOWER");
                    else if (stnId.includes("station-c")) setSelectedWard("UK-CHM-MID");
                    else setSelectedWard("UK-CHM-UPPER");
                  }}
                  onLiveMeteoSync={fetchAndApplyLiveMeteo}
                />
              </TabsContent>
              <TabsContent value="map" className="mt-0">
                <CatchmentMap
                  height={`${mapHeight}px`}
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

            {/* Evacuation Lead-Time & Kinematic Wave Propagation Matrix */}
            <LeadTimeMatrix
              result={result}
              selectedWard={selectedWard}
              onSelectWard={setSelectedWard}
              activeScenario={activeScenario}
              selectedLocationId={selectedLocationId}
              onSelectLocation={(locId) => {
                setSelectedLocationId(locId);
                setActiveViewportTab("terrain3d");
              }}
              onOpenRheologyLab={() => setRheologyLabOpen(true)}
              onOpenValleyCrossSection={(locId) => {
                if (locId) setValleyCrossSectionLocId(locId);
                setValleyCrossSectionOpen(true);
              }}
            />

            <section id="cascade-results" className="scroll-mt-6">
              <div className="mb-2 flex items-center justify-between">
                <SectionTitle>Cascade simulation results</SectionTitle>
                <div className="flex items-center gap-2">
                  {running && (
                    <span className="flex items-center gap-1.5 text-xs font-mono text-amber-400 animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Computing Hydrodynamic Cascade...
                    </span>
                  )}
                  {cascadeSuccessFlash && !running && (
                    <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 font-bold animate-in fade-in duration-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Cascade Synchronized {lastCascadeTime && `(${lastCascadeTime})`}
                    </span>
                  )}
                </div>
              </div>
              {running && !result ? (
                <ResultsSkeleton />
              ) : (
                <div className={`transition-all duration-300 ${running ? "opacity-40 pointer-events-none scale-[0.99]" : "opacity-100"}`}>
                  <Results
                    result={result}
                    selectedWard={selectedWard}
                    onSelectWard={setSelectedWard}
                  />
                </div>
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
                  lastRunTime={lastCascadeTime}
                  successFlash={cascadeSuccessFlash}
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

      {/* ---------------- NDRF SITREP Modal ---------------- */}
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

      {/* ---------------- Multi-Source Sensor Fusion Cockpit ---------------- */}
      <MultiSourceFusionCockpit
        open={multiSourceOpen}
        onOpenChange={setMultiSourceOpen}
        rainfallTelemetry={Object.fromEntries(
          telemetry.map((t) => [t.ward_id, t.rainfall])
        )}
        soilMoistureTelemetry={Object.fromEntries(
          telemetry.map((t) => [t.ward_id, t.moisture])
        )}
      />

      {/* ---------------- Nebius HPC & TensorRT HUD Modal ---------------- */}
      <NebiusHpcModal
        isOpen={nebiusHpcOpen}
        onClose={() => setNebiusHpcOpen(false)}
        activeScenario={activeScenario}
      />

      {/* ---------------- Non-Newtonian Debris Rheology Lab Modal ---------------- */}
      <DebrisRheologyLabModal
        isOpen={rheologyLabOpen}
        onClose={() => setRheologyLabOpen(false)}
        onApplyBulkingToCascade={(bf, cd) => {
          if (telemetry.length > 0) {
            runCascade(telemetry);
          }
        }}
        initialSedimentConc={0.38}
      />

      {/* ---------------- Tactical Voice Broadcast & Megaphone Siren Modal ---------------- */}
      <TacticalVoiceBroadcastModal
        isOpen={voiceBroadcastOpen}
        onClose={() => setVoiceBroadcastOpen(false)}
        leadTimeMin={Math.round(result?.lower_basin_surge_arrival_min ?? 26)}
        confluenceQ={result?.cumulative_lower_basin_discharge_m3_per_s ?? 146.0}
        alertLevel={alertLevel}
      />

      {/* ---------------- 60-Second Tactical Mission Briefing Modal ---------------- */}
      <JudgePitchTourModal
        isOpen={judgeTourOpen}
        onClose={() => setJudgeTourOpen(false)}
        onApplyScenario={applyScenario}
        onOpenNebiusHpc={() => setNebiusHpcOpen(true)}
        onOpenRheologyLab={() => setRheologyLabOpen(true)}
        onOpenVoiceBroadcast={() => setVoiceBroadcastOpen(true)}
        onStartDroneTour={() => {
          setActiveViewportTab("terrain3d");
          window.dispatchEvent(new CustomEvent("ews:start-drone-tour"));
        }}
        onOpenSitrep={() => setSitrepOpen(true)}
      />

      {/* ---------------- Geotechnical Valley Cross-Section Modal ---------------- */}
      <ValleyCrossSectionModal
        isOpen={valleyCrossSectionOpen}
        onClose={() => setValleyCrossSectionOpen(false)}
        defaultLocationId={valleyCrossSectionLocId}
        activeScenario={mappedSimulationState}
      />

      {/* ---------------- NDRF Incident Command Post & Sachet Dissemination Modal ---------------- */}
      <NdrfCommandPostModal
        isOpen={ndrfCommandPostOpen}
        onClose={() => setNdrfCommandPostOpen(false)}
        cascade={result}
        leadTimeMin={Math.round(result?.lower_basin_surge_arrival_min ?? 26)}
        confluenceQ={result?.cumulative_lower_basin_discharge_m3_per_s ?? 146}
        alertLevel={alertLevel}
      />

      {/* ---------------- Tactical hotkeys guide (collapsible) ---------------- */}
      <div className="no-print fixed bottom-3 right-3 z-40 select-none">
        {lastKey && (
          <div className="mb-1.5 flex items-center justify-end gap-1.5 animate-pulse">
            <span className="rounded-md border border-amber-500/50 bg-slate-900/90 px-2 py-1 font-mono text-[10px] font-bold text-amber-300 shadow-lg">
              ⌘ {lastKey}
            </span>
          </div>
        )}
        {guideVisible ? (
          <div className="w-72 rounded-lg border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-100">
                <Keyboard className="h-3.5 w-3.5 text-amber-400" />
                Tactical Hotkey Matrix
              </span>
              <button
                type="button"
                onClick={toggleGuide}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                aria-label="Collapse tactical hotkey matrix"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-1 text-[10px] text-slate-300">
              <HotkeyRow k="T" label="60s Tactical Mission Briefing" />
              <HotkeyRow k="Z" label="Toggle Zen Mode (Clean 3D Map View)" />
              <HotkeyRow k="I" label="NDRF Command Post (ICS-204 & Sachet)" />
              <HotkeyRow k="1" label="Dry / Pre-Monsoon Baseline" />
              <HotkeyRow k="2" label="Active Monsoon Saturated" />
              <HotkeyRow k="3" label="Cataclysmic Cloudburst Cascade" />
              <HotkeyRow k="4" label="2021 Chamoli GLOF & Debris Flow" />
              <HotkeyRow k="L" label="Non-Newtonian Rheology Lab (2.10x)" />
              <HotkeyRow k="V" label="Garhwali & Hindi Voice Megaphone" />
              <HotkeyRow k="P" label="Nebius H100 HPC & TensorRT HUD" />
              <HotkeyRow k="X" label="Valley 2D Transect Profile" />
              <HotkeyRow k="U" label="UAV Drone Recon Sentry HUD" />
              <HotkeyRow k="F" label="Multi-Source Sensor Fusion Cockpit" />
              <HotkeyRow k="R" label="Open NDRF Situation Report (SITREP)" />
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
            Tactical Hotkeys
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
