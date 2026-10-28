"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  STATIONS_3D,
  RF_MESH_ARCS_3D,
  SATELLITE_BURST_BEACON,
  NH7_HIGHWAY_LINESTRING,
  MOUNTAIN_PACK_TRAILS,
  ROAD_INTERDICTION_NODE,
  EVACUATION_PATHWAYS_3D,
  EVACUATION_SHELTERS_3D,
  CRITICAL_INFRA_3D,
  RIVER_CENTERLINE_3D,
  RIVER_BASE_STAGE_POLYGON,
  RIVER_CATACLYSMIC_INUNDATION_POLYGON,
  CAMERA_WAYPOINTS,
  MONITORED_VILLAGES_3D,
  VALLEY_CROSS_SECTIONS,
  EXTRUDED_STRUCTURES_3D_GEOJSON,
  TOPOGRAPHIC_CONTOURS_GEOJSON,
  type CameraWaypointPreset,
} from "@/data/terrain3dGeo";
import {
  Compass,
  Radio,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Waves,
  Mountain,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Crosshair,
  Layers,
  X,
  Activity,
  Zap,
  Navigation,
  Timer,
  ChevronDown,
  ChevronUp,
  CloudRain,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  Droplets,
  Video,
  Orbit,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import { useRealtimeClock } from "@/hooks/useRealtimeClock";
import { ValleyCrossSectionModal } from "@/components/ews/ValleyCrossSectionModal";
import { VerifiedDataFeedModal } from "@/components/ews/VerifiedDataFeedModal";
import { InundationShaderLayer } from "@/components/map/InundationShaderLayer";

export type TacticalSimulationState =
  | "DRY_BASELINE"
  | "MONSOON_SATURATED"
  | "CLOUDBURST_CATACLYSMIC"
  | "dry"
  | "monsoon"
  | "cloudburst"
  | "glof";

interface TacticalTerrain3DProps {
  /** External simulation state hook sync */
  simulationState?: TacticalSimulationState;
  /** Callback when user changes simulation state via the HUD timeline */
  onScenarioChange?: (state: "DRY_BASELINE" | "MONSOON_SATURATED" | "CLOUDBURST_CATACLYSMIC" | "glof") => void;
  /** Optional container height */
  height?: string;
  /** Active selected ward sync if any */
  selectedWard?: string | null;
  /** Callback when user selects a ward */
  onSelectWard?: (wardId: string) => void;
  /** Active selected village/location id */
  selectedLocationId?: string | null;
  /** Callback when user selects a village/location */
  onSelectLocation?: (locId: string) => void;
  /** Callback when user selects a station or feature */
  onSelectStation?: (stationId: string) => void;
  /** Optional cascade lead time override */
  leadTimeMin?: number;
  /** Optional callback to trigger parent live Open-Meteo sync */
  onLiveMeteoSync?: () => void;
}

// Generate smooth parabolic Bézier 3D arc coordinates
function generateParabolicArc(
  start: [number, number, number],
  end: [number, number, number],
  peakAltM: number,
  steps: number = 60
): [number, number, number][] {
  const points: [number, number, number][] = [];
  const baseAlt = (start[2] + end[2]) / 2;
  const arcHeight = Math.max(250, peakAltM - baseAlt);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng = start[0] + (end[0] - start[0]) * t;
    const lat = start[1] + (end[1] - start[1]) * t;
    const altitude = (start[2] * (1 - t) + end[2] * t) + 4 * arcHeight * t * (1 - t);
    points.push([lng, lat, altitude]);
  }
  return points;
}

// Interpolate coordinates along the river centerline based on surge wavefront elapsed time (0 - 45 min)
function getSurgeWavefrontCoord(tMin: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(45, tMin));
  const ratio = clamped / 45;
  const totalSegments = RIVER_CENTERLINE_3D.length - 1;
  const idxFloat = ratio * totalSegments;
  const idx0 = Math.floor(idxFloat);
  const idx1 = Math.min(totalSegments, idx0 + 1);
  const frac = idxFloat - idx0;
  const p0 = RIVER_CENTERLINE_3D[idx0];
  const p1 = RIVER_CENTERLINE_3D[idx1];
  return [
    p0[0] + (p1[0] - p0[0]) * frac,
    p0[1] + (p1[1] - p0[1]) * frac,
    p0[2] + (p1[2] - p0[2]) * frac,
  ];
}

export function TacticalTerrain3D({
  simulationState = "MONSOON_SATURATED",
  onScenarioChange,
  height = "640px",
  selectedWard,
  onSelectWard,
  selectedLocationId,
  onSelectLocation,
  onSelectStation,
  leadTimeMin,
  onLiveMeteoSync,
}: TacticalTerrain3DProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const waveMarkerRef = useRef<maplibregl.Marker | null>(null);
  const spotMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenOscRef = useRef<OscillatorNode | null>(null);
  const sirenGainRef = useRef<GainNode | null>(null);
  const weatherCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rainDropsRef = useRef<{ x: number; y: number; speed: number; length: number }[]>([]);

  // Normalize simulation state
  const normalizedState = useMemo<"DRY_BASELINE" | "MONSOON_SATURATED" | "CLOUDBURST_CATACLYSMIC" | "glof">(() => {
    if (simulationState === "dry" || simulationState === "DRY_BASELINE") return "DRY_BASELINE";
    if (simulationState === "glof") return "glof";
    if (simulationState === "cloudburst" || simulationState === "CLOUDBURST_CATACLYSMIC")
      return "CLOUDBURST_CATACLYSMIC";
    return "MONSOON_SATURATED";
  }, [simulationState]);

  const [activeState, setActiveState] = useState<"DRY_BASELINE" | "MONSOON_SATURATED" | "CLOUDBURST_CATACLYSMIC" | "glof">(
    normalizedState
  );

  const realtimeClock = useRealtimeClock();

  // Keep internal state synced with parent prop
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveState(normalizedState);
    }, 0);
    return () => clearTimeout(timer);
  }, [normalizedState]);

  const isGlof = activeState === "glof";
  const isCataclysmic = activeState === "CLOUDBURST_CATACLYSMIC" || isGlof;
  const isMonsoon = activeState === "MONSOON_SATURATED";

  // HUD telemetry state
  const [cursorPos, setCursorPos] = useState<{ lng: number; lat: number; alt: number }>({
    lng: 79.565,
    lat: 30.555,
    alt: 1418,
  });
  const [cameraTelemetry, setCameraTelemetry] = useState<{
    pitch: number;
    bearing: number;
    zoom: number;
  }>({
    pitch: 62,
    bearing: -28,
    zoom: 13.4,
  });

  // Layer switches
  const [layers, setLayers] = useState({
    demRelief: true,
    rfMeshWaves: true,
    evacCorridors: true,
    inundationPlane: true,
    criticalAssets: true,
    extruded3d: true,
    contourLines: true,
  });

  // Basemap selector state: Google Hybrid HD, Google Sat HD, ESRI Sat, OpenTopo
  const [basemapMode, setBasemapMode] = useState<"google-hybrid" | "google-sat" | "esri-sat" | "opentopo">("google-hybrid");

  // Lead-time widget collapse state
  const [leadTimeOpen, setLeadTimeOpen] = useState(true);
  const [leadTimeCountdownSec, setLeadTimeCountdownSec] = useState(0);

  // Active waypoint preset
  const [activeWaypoint, setActiveWaypoint] = useState<string>("default-tactical");
  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Audio siren mute state
  const [sirenMuted, setSirenMuted] = useState(true);

  // Zen / Cinema clean map mode
  const [zenMode, setZenMode] = useState(false);

  // Active flyout menu ("layers" | "waypoints" | "basemap" | "focus" | "scenario" | null)
  const [activeFlyout, setActiveFlyout] = useState<"layers" | "waypoints" | "basemap" | "focus" | "scenario" | null>(null);

  // Bottom 4D Flood Surge controller visibility & minimize state
  const [showWaveController, setShowWaveController] = useState(true);
  const [waveControllerMinimized, setWaveControllerMinimized] = useState(false);
  const [showLeadTimeDock, setShowLeadTimeDock] = useState(true);

  // Selected inspection card
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "STATION" | "SHELTER" | "INFRA" | "INTERDICTION" | "VILLAGE";
    data: any;
  } | null>(null);
  const activePopupRef = useRef<maplibregl.Popup | null>(null);

  // Global keyboard shortcuts: Esc to dismiss flyouts / exit zen; 'Z' to toggle Zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeFlyout) setActiveFlyout(null);
        else if (selectedEntity) setSelectedEntity(null);
        else if (zenMode) setZenMode(false);
      }
      if ((e.key === "z" || e.key === "Z") && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setZenMode((prev) => !prev);
      }
    };
    const handleZenEvent = () => setZenMode((prev) => !prev);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("ews:toggle-zen-mode", handleZenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("ews:toggle-zen-mode", handleZenEvent);
    };
  }, [activeFlyout, selectedEntity, zenMode]);

  // Cross-section modal state
  const [crossSectionOpen, setCrossSectionOpen] = useState(false);
  const [crossSectionLocId, setCrossSectionLocId] = useState("loc-vishnuprayag");

  // Verified Multi-API modal state
  const [verifiedModalOpen, setVerifiedModalOpen] = useState(false);
  const [verifiedApiData, setVerifiedApiData] = useState<any>(null);

  // Spot measurement pin state
  const [spotInspection, setSpotInspection] = useState<{
    lng: number;
    lat: number;
    alt: number;
    slopeEst: number;
  } | null>(null);

  // --------------------------------------------------------------------------
  // INTERACTIVE 4D FLOOD SURGE PROPAGATION SIMULATOR
  // --------------------------------------------------------------------------
  const [waveSimActive, setWaveSimActive] = useState(false);
  const [waveProgressMin, setWaveProgressMin] = useState(0);

  // Ticker for flood wave simulation
  useEffect(() => {
    if (!waveSimActive) return;
    const interval = setInterval(() => {
      setWaveProgressMin((prev) => {
        if (prev >= 45) {
          setWaveSimActive(false);
          return 45;
        }
        return parseFloat((prev + 0.4).toFixed(1));
      });
    }, 120);
    return () => clearInterval(interval);
  }, [waveSimActive]);

  // 2D WebGL Inundation Shader Layer ref & synchronization
  const inundationLayerRef = useRef<InundationShaderLayer | null>(null);

  useEffect(() => {
    if (inundationLayerRef.current) {
      inundationLayerRef.current.setTime(waveProgressMin);
      inundationLayerRef.current.setSedimentConcentration(isGlof ? 0.48 : isCataclysmic ? 0.38 : 0.22);
      inundationLayerRef.current.setSurgeIntensity(isGlof ? 1.8 : isCataclysmic ? 1.4 : 0.8);
    }
  }, [waveProgressMin, isGlof, isCataclysmic]);

  const [activeEngineMode, setActiveEngineMode] = useState<string>("NEBIUS_H100_TRITON_INT8");

  useEffect(() => {
    const handleTelemetry = (e: any) => {
      if (e.detail?.engineMode) {
        setActiveEngineMode(e.detail.engineMode);
        if (inundationLayerRef.current) {
          inundationLayerRef.current.setEngineMode(e.detail.engineMode);
        }
      }
    };
    window.addEventListener("ews:engine-telemetry" as any, handleTelemetry);
    return () => window.removeEventListener("ews:engine-telemetry" as any, handleTelemetry);
  }, []);

  // --------------------------------------------------------------------------
  // AUTOMATED DRONE RECON VALLEY TOUR
  // --------------------------------------------------------------------------
  const [droneTourActive, setDroneTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [reconSensorMode, setReconSensorMode] = useState<"OPTICAL" | "THERMAL" | "NVG">("OPTICAL");

  const TOUR_WAYPOINTS = useMemo(() => [
    "tapovan-barrage",
    "dhauliganga-canyon",
    "vishnuprayag-gorge",
    "joshimath-midslope",
    "helang-chokepoint",
    "auli-ridge",
    "macro-overview",
  ], []);

  useEffect(() => {
    const handleDroneTourEvent = () => {
      setDroneTourActive(true);
      setTourStep(0);
    };
    window.addEventListener("ews:start-drone-tour" as any, handleDroneTourEvent);
    return () => window.removeEventListener("ews:start-drone-tour" as any, handleDroneTourEvent);
  }, []);

  useEffect(() => {
    if (!droneTourActive || !mapRef.current) return;
    const wpId = TOUR_WAYPOINTS[tourStep];
    const wp = CAMERA_WAYPOINTS.find((w) => w.id === wpId);
    if (wp && mapRef.current) {
      setActiveWaypoint(wp.id);
      mapRef.current.flyTo({
        center: wp.center,
        zoom: wp.zoom,
        pitch: wp.pitch,
        bearing: wp.bearing,
        speed: 0.65,
        curve: 1.45,
        essential: true,
      });
    }

    const timer = setTimeout(() => {
      setTourStep((prev) => (prev + 1) % TOUR_WAYPOINTS.length);
    }, 7500);

    return () => clearTimeout(timer);
  }, [droneTourActive, tourStep, TOUR_WAYPOINTS]);

  // --------------------------------------------------------------------------
  // AUTO-ORBIT 360° CONTINUOUS ROTATION
  // --------------------------------------------------------------------------
  const [autoOrbit, setAutoOrbit] = useState(false);

  // --------------------------------------------------------------------------
  // ATMOSPHERIC WEATHER VISUAL FX CANVAS OVERLAY
  // --------------------------------------------------------------------------
  const [weatherFxActive, setWeatherFxActive] = useState(true);

  useEffect(() => {
    const drops: { x: number; y: number; speed: number; length: number }[] = [];
    for (let i = 0; i < 90; i++) {
      drops.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        speed: 8 + Math.random() * 12,
        length: 12 + Math.random() * 18,
      });
    }
    rainDropsRef.current = drops;
  }, []);

  // Multi-API live feed state
  const [liveMeteoActive, setLiveMeteoActive] = useState(false);
  const [liveMeteoSummary, setLiveMeteoSummary] = useState<{
    mean_temperature_c?: number;
    mean_humidity_pct?: number;
    mean_soil_saturation_pct?: number;
    mean_surface_pressure_hpa?: number;
    max_rainfall_mm_hr?: number;
    river_discharge_m3_s?: number;
  } | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const playTacticalClick = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }, []);

  const syncLiveMultiApi = useCallback(async () => {
    setLiveLoading(true);
    playTacticalClick();
    try {
      if (onLiveMeteoSync) {
        onLiveMeteoSync();
      }
      const res = await fetch("/api/meteo/live");
      if (!res.ok) throw new Error("Live multi-API failed");
      const data = await res.json();
      setVerifiedApiData(data);
      setLiveMeteoSummary(data.summary);
      setLiveMeteoActive(true);

      if (data.summary) {
        if (data.summary.max_rainfall_mm_hr > 50) {
          setActiveState("CLOUDBURST_CATACLYSMIC");
        } else if (
          data.summary.mean_soil_saturation_pct > 65 ||
          data.summary.max_rainfall_mm_hr > 5
        ) {
          setActiveState("MONSOON_SATURATED");
        } else {
          setActiveState("DRY_BASELINE");
        }
      }
    } catch (err) {
      console.error("Live Multi-API sync error:", err);
    } finally {
      setLiveLoading(false);
    }
  }, [onLiveMeteoSync, playTacticalClick]);

  // Initial auto-fetch for verified multi-API data on mount
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await fetch("/api/meteo/live");
        if (res.ok) {
          const data = await res.json();
          setVerifiedApiData(data);
          setLiveMeteoSummary(data.summary);
          setLiveMeteoActive(true);
        }
      } catch {}
    };
    fetchInitial();
  }, []);

  // Effective lead time calculated or provided
  const effectiveLeadMin = useMemo(() => {
    if (typeof leadTimeMin === "number") return Math.round(leadTimeMin);
    if (isGlof) return 14;
    if (activeState === "CLOUDBURST_CATACLYSMIC") return 18;
    if (activeState === "MONSOON_SATURATED") return 26;
    return 38;
  }, [leadTimeMin, activeState, isGlof]);

  // Lead time dynamic countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setLeadTimeCountdownSec((prev) => (prev + 1) % 1800);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalSecLeft = Math.max(0, effectiveLeadMin * 60 - leadTimeCountdownSec);
  const displayMin = Math.floor(totalSecLeft / 60);
  const displaySec = totalSecLeft % 60;

  // Change Basemap Handler with Ultra-HD 2x Retina & OpenTopo
  const changeBasemap = useCallback((mode: "google-hybrid" | "google-sat" | "esri-sat" | "opentopo") => {
    playTacticalClick();
    setBasemapMode(mode);
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const baseLayers = ["google-hybrid-base", "google-sat-base", "esri-sat-base", "opentopo-base-layer"];
    baseLayers.forEach((id) => {
      if (map.getLayer(id)) {
        const match =
          (mode === "google-hybrid" && id === "google-hybrid-base") ||
          (mode === "google-sat" && id === "google-sat-base") ||
          (mode === "esri-sat" && id === "esri-sat-base") ||
          (mode === "opentopo" && id === "opentopo-base-layer");
        map.setLayoutProperty(id, "visibility", match ? "visible" : "none");
      }
    });
  }, [playTacticalClick]);

  // Emergency Siren
  const playSiren = useCallback(() => {
    if (sirenMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      if (sirenOscRef.current) {
        sirenOscRef.current.stop();
        sirenOscRef.current.disconnect();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 1.2);
      osc.frequency.linearRampToValueAtTime(440, now + 2.4);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 3.0);

      sirenOscRef.current = osc;
      sirenGainRef.current = gain;
    } catch {}
  }, [sirenMuted]);

  // Handle Scenario trigger
  const handleScenarioTrigger = useCallback(
    (nextState: "DRY_BASELINE" | "MONSOON_SATURATED" | "CLOUDBURST_CATACLYSMIC" | "glof") => {
      playTacticalClick();
      setLiveMeteoActive(false);
      setActiveState(nextState);
      if (onScenarioChange) {
        onScenarioChange(nextState);
      }
      if (nextState === "CLOUDBURST_CATACLYSMIC" || nextState === "glof") {
        playSiren();
        const targetWp = CAMERA_WAYPOINTS.find((w) => w.id === (nextState === "glof" ? "tapovan-barrage" : "vishnuprayag-gorge"));
        if (targetWp && mapRef.current) {
          mapRef.current.flyTo({
            center: targetWp.center,
            zoom: targetWp.zoom,
            pitch: targetWp.pitch,
            bearing: targetWp.bearing,
            speed: 0.9,
            curve: 1.4,
            essential: true,
          });
          setActiveWaypoint(targetWp.id);
        }
      }
    },
    [onScenarioChange, playSiren, playTacticalClick]
  );

  // Fly to waypoint
  const flyToWaypoint = useCallback((wp: CameraWaypointPreset) => {
    playTacticalClick();
    if (!mapRef.current) return;
    setActiveWaypoint(wp.id);
    mapRef.current.flyTo({
      center: wp.center,
      zoom: wp.zoom,
      pitch: wp.pitch,
      bearing: wp.bearing,
      speed: 0.85,
      curve: 1.42,
      essential: true,
    });
  }, [playTacticalClick]);

  // Popup Preview for Settlements
  const showVillagePopup = useCallback(
    (mapInstance: maplibregl.Map, v: any) => {
      if (activePopupRef.current) {
        activePopupRef.current.remove();
      }
      const isSubmerged = waveProgressMin >= v.leadTimeMin && waveProgressMin > 0;
      const popupContent = `
        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: rgba(2, 6, 23, 0.96); border: 1px solid #06b6d4; border-radius: 8px; padding: 10px; color: #f1f5f9; min-width: 240px; box-shadow: 0 12px 30px rgba(0,0,0,0.85); line-height: 1.3;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 5px; margin-bottom: 6px;">
            <span style="font-weight: 800; color: #f59e0b; font-size: 11.5px;">📍 ${v.name}</span>
            <span style="font-size: 9px; font-weight: 700; background: ${isSubmerged ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.25)'}; color: ${isSubmerged ? '#fca5a5' : '#22d3ee'}; padding: 1px 5px; border-radius: 4px; border: 1px solid ${isSubmerged ? '#ef4444' : 'rgba(6,182,212,0.4)'};">
              ${isSubmerged ? 'BREACHED' : v.wardId}
            </span>
          </div>
          <div style="font-size: 10px; color: #fde68a; margin-bottom: 6px; font-weight: 600;">${v.hindiName} · ${v.coordinates[2]}m ASL</div>
          <table style="width: 100%; font-size: 9.5px; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid rgba(51,65,85,0.5);"><td style="color: #94a3b8; padding: 3px 0;">Surge Lead Time:</td><td style="text-align: right; font-weight: 800; color: #f59e0b;">${v.leadTimeMin === 0 ? "Epicenter (0m)" : v.leadTimeMin + " min"}</td></tr>
            <tr style="border-bottom: 1px solid rgba(51,65,85,0.5);"><td style="color: #94a3b8; padding: 3px 0;">Civilians at Risk:</td><td style="text-align: right; font-weight: 800; color: #fb7185;">${v.population.toLocaleString()}</td></tr>
            <tr style="border-bottom: 1px solid rgba(51,65,85,0.5);"><td style="color: #94a3b8; padding: 3px 0;">Toe Slope:</td><td style="text-align: right; color: #f8fafc; font-weight: 700;">${v.toeSlopeDeg}°</td></tr>
            <tr><td style="color: #94a3b8; padding: 3px 0;">Safe Haven:</td><td style="text-align: right; color: #6ee7b7; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700;">${v.evacuationShelter}</td></tr>
          </table>
        </div>
      `;
      const popup = new maplibregl.Popup({
        offset: [0, -38],
        closeButton: true,
        closeOnClick: false,
      })
        .setLngLat([v.coordinates[0], v.coordinates[1]])
        .setHTML(popupContent)
        .addTo(mapInstance);
      activePopupRef.current = popup;
    },
    [waveProgressMin]
  );

  // Sync Markers
  const syncMarkers = useCallback(
    (map: maplibregl.Map, isCat: boolean) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (!layers.criticalAssets) return;

      // 1. Station Markers
      STATIONS_3D.forEach((stn) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer select-none group";

        const badgeColor =
          isCat && stn.id === "station-a"
            ? "border-amber-500 bg-amber-950/90 text-amber-300 animate-pulse"
            : stn.id === "station-d" && isCat
              ? "border-rose-500 bg-rose-950/90 text-rose-300 animate-pulse"
              : "border-emerald-500/80 bg-slate-950/90 text-emerald-300";

        const dotColor =
          isCat && stn.id === "station-a"
            ? "bg-amber-400 shadow-[0_0_10px_#f59e0b]"
            : stn.id === "station-d" && isCat
              ? "bg-rose-500 shadow-[0_0_10px_#ef4444]"
              : "bg-emerald-400 shadow-[0_0_8px_#10b981]";

        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold shadow-2xl backdrop-blur-md ${badgeColor}">
              <span>${stn.callsign.split("-")[0]}: ${stn.name.split(" ")[0]}</span>
              <span class="text-[8px] opacity-75">${stn.coordinates[2]}m</span>
            </div>
            <div class="h-3.5 w-0.5 bg-slate-400/80"></div>
            <div class="h-2 w-2 rounded-full ${dotColor}"></div>
          </div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          playTacticalClick();
          setSelectedEntity({ type: "STATION", data: stn });
          if (onSelectStation) onSelectStation(stn.id);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([stn.coordinates[0], stn.coordinates[1]])
          .addTo(map);

        markersRef.current.push(marker);
      });

      // 2. Safe Shelters
      EVACUATION_SHELTERS_3D.forEach((sh) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer select-none";
        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="flex items-center gap-1 rounded border border-cyan-500/80 bg-slate-950/90 px-1.5 py-0.5 text-[8.5px] font-bold text-cyan-300 shadow-xl backdrop-blur">
              <span>SHELTER: ${sh.name.split(" ")[0]}</span>
              <span class="text-[8px] text-cyan-400 font-mono">+${sh.elevationM}m</span>
            </div>
            <div class="h-2.5 w-0.5 bg-cyan-400/80"></div>
            <div class="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]"></div>
          </div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          playTacticalClick();
          setSelectedEntity({ type: "SHELTER", data: sh });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([sh.coordinates[0], sh.coordinates[1]])
          .addTo(map);

        markersRef.current.push(marker);
      });

      // 3. Road Interdiction Barrier
      if (isCat) {
        const el = document.createElement("div");
        el.className = "cursor-pointer select-none animate-bounce";
        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="flex items-center gap-1 rounded border border-rose-500 bg-rose-950/95 px-2 py-1 text-[9px] font-black text-rose-100 shadow-[0_0_15px_#e11d48]">
              <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
              <span>NH-7 INTERDICTED · DEBRIS SLIDE</span>
            </div>
            <div class="h-3 w-0.5 bg-rose-500"></div>
            <div class="h-2.5 w-2.5 rounded-full bg-rose-600 shadow-[0_0_10px_#ef4444]"></div>
          </div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          playTacticalClick();
          setSelectedEntity({ type: "INTERDICTION", data: ROAD_INTERDICTION_NODE });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([ROAD_INTERDICTION_NODE.coordinates[0], ROAD_INTERDICTION_NODE.coordinates[1]])
          .addTo(map);

        markersRef.current.push(marker);
      }

      // 4. Monitored Villages & Settlements
      MONITORED_VILLAGES_3D.forEach((v) => {
        const isSelected = selectedLocationId === v.id || selectedWard === v.wardId;
        const el = document.createElement("div");
        el.className = "cursor-pointer select-none group transition-transform duration-200 hover:scale-110";

        const badgeClass = isSelected
          ? "border-cyan-400 bg-slate-950/95 text-cyan-200 shadow-[0_0_20px_#06b6d4] scale-110 ring-2 ring-cyan-400"
          : "border-slate-700/80 bg-slate-950/90 text-slate-200 hover:border-cyan-500/60";

        const dotClass = isSelected
          ? "bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-ping"
          : "bg-amber-400 shadow-[0_0_6px_#f59e0b]";

        el.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9.5px] font-bold shadow-xl backdrop-blur ${badgeClass}">
              <span class="text-amber-400">📍</span>
              <span class="tracking-wide">${v.name.split(" ")[0]}</span>
              <span class="text-[8px] font-mono text-cyan-400">${v.coordinates[2]}m</span>
              ${isSelected ? `<span class="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>` : ""}
            </div>
            <div class="h-3 w-0.5 ${isSelected ? "bg-cyan-400" : "bg-slate-400/80"}"></div>
            <div class="relative flex h-3 w-3 items-center justify-center">
              ${isSelected ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>` : ""}
              <span class="relative inline-flex rounded-full h-2 w-2 ${dotClass}"></span>
            </div>
          </div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          playTacticalClick();
          setSelectedEntity({ type: "VILLAGE", data: v });
          setCrossSectionLocId(v.id);
          showVillagePopup(map, v);
          if (onSelectLocation) onSelectLocation(v.id);
          if (onSelectWard) onSelectWard(v.wardId);
          if (onSelectStation) onSelectStation(v.id);

          map.flyTo({
            center: [v.coordinates[0], v.coordinates[1]],
            zoom: Math.max(14.8, map.getZoom()),
            pitch: 58,
            bearing: -20,
            duration: 800,
            essential: true,
          });

          const rowEl = document.getElementById(`lead-time-ward-${v.wardId}`);
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([v.coordinates[0], v.coordinates[1]])
          .addTo(map);

        markersRef.current.push(marker);
      });
    },
    [layers.criticalAssets, onSelectStation, onSelectLocation, onSelectWard, selectedLocationId, selectedWard, showVillagePopup, playTacticalClick]
  );

  // Update Dynamic Wavefront Marker position as time progresses
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!waveMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "flex flex-col items-center select-none pointer-events-none -translate-y-4";
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-10 w-10 rounded-full ${isGlof ? 'bg-amber-500/75' : 'bg-rose-500/75'}"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 ${isGlof ? 'bg-amber-400' : 'bg-rose-400'} shadow-[0_0_15px_#ef4444]"></span>
        </div>
        <div id="surge-wavefront-badge" class="mt-1 flex items-center gap-1.5 rounded-full border ${isGlof ? 'border-amber-400 bg-amber-950/95 text-amber-200' : 'border-rose-400 bg-slate-950/95 text-rose-200'} px-2.5 py-0.5 text-[9px] font-black shadow-2xl backdrop-blur">
          <span class="h-1.5 w-1.5 rounded-full ${isGlof ? 'bg-amber-400' : 'bg-rose-400'} animate-pulse"></span>
          <span id="surge-wavefront-text">WAVE CREST</span>
        </div>
      `;
      const [lng, lat] = getSurgeWavefrontCoord(waveProgressMin);
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      waveMarkerRef.current = marker;
    } else {
      const [lng, lat] = getSurgeWavefrontCoord(waveProgressMin);
      waveMarkerRef.current.setLngLat([lng, lat]);
      const textEl = document.getElementById("surge-wavefront-text");
      if (textEl) {
        textEl.textContent = `SURGE CREST: T+${waveProgressMin}m (${isGlof ? '+14.2m DEBRIS' : '+8.5m'})`;
      }
    }
  }, [waveProgressMin, isGlof]);

  // --------------------------------------------------------------------------
  // MAP INITIALIZATION WITH ULTRA-HD 2x RETINA TILES & SKY ATMOSPHERE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const mapStyle: maplibregl.StyleSpecification = {
      version: 8,
      name: "Tactical 3D Battlefield DEM Ultra-HD",
      // Sky Atmosphere Configuration
      sky: {
        "sky-color": "#020617",
        "horizon-color": "#1e293b",
        "fog-color": "#020617",
        "fog-ground-blend": 0.5,
        "atmosphere-blend": 0.75,
      },
      sources: {
        // High-DPI Google Hybrid 2x Retina (512px)
        "google-hybrid": {
          type: "raster",
          tiles: [
            "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2",
            "https://mt1.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2",
            "https://mt2.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2",
            "https://mt3.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2",
          ],
          tileSize: 512,
          maxzoom: 20,
          attribution: "© Google Maps Ultra-HD Hybrid 2x Retina, ISRO-NRSC",
        },
        // High-DPI Google Satellite 2x Retina (512px)
        "google-sat": {
          type: "raster",
          tiles: [
            "https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&scale=2",
            "https://mt1.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&scale=2",
            "https://mt2.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&scale=2",
            "https://mt3.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&scale=2",
          ],
          tileSize: 512,
          maxzoom: 20,
          attribution: "© Google Maps Ultra-HD Satellite 2x Retina, ISRO-NRSC",
        },
        // ESRI World Imagery Clarity
        "esri-sat": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: "© Esri World Imagery, DigitalGlobe, GeoEye",
        },
        // OpenTopoMap with verified contour curves
        "opentopo-base": {
          type: "raster",
          tiles: [
            "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          maxzoom: 17,
          attribution: "© OpenTopoMap, SRTM Contour Lines",
        },
        "terrain-dem": {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15,
        },
        "hillshade-dem": {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15,
        },
      },
      layers: [
        {
          id: "google-hybrid-base",
          type: "raster",
          source: "google-hybrid",
          minzoom: 0,
          maxzoom: 20,
          layout: { visibility: "visible" },
          paint: {
            "raster-opacity": 0.95,
            "raster-contrast": 0.18,
            "raster-brightness-min": 0.05,
          },
        },
        {
          id: "google-sat-base",
          type: "raster",
          source: "google-sat",
          minzoom: 0,
          maxzoom: 20,
          layout: { visibility: "none" },
          paint: {
            "raster-opacity": 0.95,
            "raster-contrast": 0.18,
            "raster-brightness-min": 0.05,
          },
        },
        {
          id: "esri-sat-base",
          type: "raster",
          source: "esri-sat",
          minzoom: 0,
          maxzoom: 20,
          layout: { visibility: "none" },
          paint: {
            "raster-opacity": 0.95,
            "raster-contrast": 0.15,
            "raster-brightness-min": 0.05,
          },
        },
        {
          id: "opentopo-base-layer",
          type: "raster",
          source: "opentopo-base",
          minzoom: 0,
          maxzoom: 17,
          layout: { visibility: "none" },
          paint: {
            "raster-opacity": 0.92,
            "raster-contrast": 0.2,
          },
        },
        {
          id: "tactical-hillshading",
          type: "hillshade",
          source: "hillshade-dem",
          layout: { visibility: "visible" },
          paint: {
            "hillshade-shadow-color": "#020617",
            "hillshade-highlight-color": "#38bdf8",
            "hillshade-accent-color": "#0f172a",
            "hillshade-exaggeration": 0.9,
            "hillshade-illumination-direction": 315,
          },
        },
      ],
      terrain: {
        source: "terrain-dem",
        exaggeration: 1.48,
      },
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [79.565, 30.555],
      zoom: 13.4,
      pitch: 62,
      bearing: -28,
      maxPitch: 85,
      minZoom: 10,
      maxZoom: 18,
      attributionControl: false,
      antialias: true,
    } as any);

    mapRef.current = map;

    // Navigation Controls
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    // Camera telemetry listener
    map.on("move", () => {
      setCameraTelemetry({
        pitch: Math.round(map.getPitch()),
        bearing: Math.round(map.getBearing()),
        zoom: parseFloat(map.getZoom().toFixed(2)),
      });
    });

    // Real-time mouse coordinate & ASL elevation tracker
    map.on("mousemove", (e) => {
      const { lng, lat } = e.lngLat;
      let elevation = 1418;
      try {
        if (typeof (map as any).queryTerrainElevation === "function") {
          const ele = (map as any).queryTerrainElevation([lng, lat]);
          if (ele !== null && !isNaN(ele)) {
            elevation = Math.round(ele);
          }
        }
      } catch {
        elevation = 1418;
      }
      setCursorPos({
        lng: parseFloat(lng.toFixed(4)),
        lat: parseFloat(lat.toFixed(4)),
        alt: elevation,
      });
    });

    // Click anywhere on terrain to drop Spot Elevation Pin
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      let elevation = 1418;
      try {
        if (typeof (map as any).queryTerrainElevation === "function") {
          const ele = (map as any).queryTerrainElevation([lng, lat]);
          if (ele !== null && !isNaN(ele)) elevation = Math.round(ele);
        }
      } catch {}

      const slope = Math.round(25 + Math.abs(lat - 30.55) * 500);

      setSpotInspection({
        lng: parseFloat(lng.toFixed(4)),
        lat: parseFloat(lat.toFixed(4)),
        alt: elevation,
        slopeEst: Math.min(65, slope),
      });

      if (spotMarkerRef.current) {
        spotMarkerRef.current.remove();
      }

      const el = document.createElement("div");
      el.className = "select-none pointer-events-none";
      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="flex items-center gap-1 rounded bg-slate-950/95 border border-amber-400 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 shadow-xl backdrop-blur">
            <span class="text-cyan-400">ASL ${elevation}m</span>
            <span>·</span>
            <span>${slope}° Slope</span>
          </div>
          <div class="h-3 w-0.5 bg-amber-400"></div>
          <div class="h-2 w-2 rounded-full bg-amber-400 animate-ping"></div>
        </div>
      `;

      spotMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
    });

    // Load GeoJSON Layers
    map.on("load", () => {
      map.resize();

      // Atmospheric Sky
      if (typeof (map as any).setSky === "function") {
        (map as any).setSky({
          "sky-color": "#020617",
          "horizon-color": "#1e293b",
          "fog-color": "#020617",
          "fog-ground-blend": 0.5,
          "atmosphere-blend": 0.75,
        });
      }

      // 2D Dynamic Inundation Shader Layer (Custom WebGL Layer)
      try {
        const shaderLayer = new InundationShaderLayer({
          initialTimeMin: waveProgressMin,
          sedimentConcentration: isGlof ? 0.48 : isCataclysmic ? 0.38 : 0.22,
        });
        map.addLayer(shaderLayer as any);
        inundationLayerRef.current = shaderLayer;
      } catch (err) {
        console.warn("[TacticalTerrain3D] Could not initialize WebGL InundationShaderLayer:", err);
      }

      // 1. NH-7 Highway Arteries
      map.addSource("nh7-highway", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { name: "National Highway 7 (NH-7)", type: "TRUNK_LIFELINE" },
          geometry: {
            type: "LineString",
            coordinates: NH7_HIGHWAY_LINESTRING.map((pt) => [pt[0], pt[1]]),
          },
        },
      });

      map.addLayer({
        id: "nh7-casing",
        type: "line",
        source: "nh7-highway",
        paint: {
          "line-color": "#020617",
          "line-width": 7,
          "line-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "nh7-line",
        type: "line",
        source: "nh7-highway",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3.5,
          "line-opacity": 0.95,
        },
      });

      // Mountain Pack-Trails
      map.addSource("mountain-trails", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: MOUNTAIN_PACK_TRAILS.map((trail) => ({
            type: "Feature",
            properties: { id: trail.id, name: trail.name },
            geometry: {
              type: "LineString",
              coordinates: trail.coordinates.map((pt) => [pt[0], pt[1]]),
            },
          })),
        },
      });

      map.addLayer({
        id: "mountain-trails-line",
        type: "line",
        source: "mountain-trails",
        paint: {
          "line-color": "#94a3b8",
          "line-width": 2.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      });

      // 2. Volumetric Hydraulic Inundation River Plane
      map.addSource("river-inundation", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {
            stage: "BASE",
            title: "Alaknanda-Dhauliganga Confluence Channel",
          },
          geometry: {
            type: "Polygon",
            coordinates: [RIVER_BASE_STAGE_POLYGON.map((pt) => [pt[0], pt[1]])],
          },
        },
      });

      map.addLayer({
        id: "river-inundation-fill",
        type: "fill",
        source: "river-inundation",
        paint: {
          "fill-color": "#0284c7",
          "fill-opacity": 0.88,
        },
      });

      map.addLayer({
        id: "river-inundation-stroke",
        type: "line",
        source: "river-inundation",
        paint: {
          "line-color": "#38bdf8",
          "line-width": 3,
          "line-opacity": 0.95,
        },
      });

      // 3. Uphill Evacuation Pathways
      map.addSource("evacuation-pathways", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: EVACUATION_PATHWAYS_3D.map((path) => ({
            type: "Feature",
            properties: {
              id: path.id,
              name: path.name,
              delta: path.elevationDeltaM,
            },
            geometry: {
              type: "LineString",
              coordinates: path.coordinates.map((pt) => [pt[0], pt[1]]),
            },
          })),
        },
      });

      map.addLayer({
        id: "evacuation-pathways-casing",
        type: "line",
        source: "evacuation-pathways",
        paint: {
          "line-color": "#022c22",
          "line-width": 8,
          "line-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "evacuation-pathways-flow",
        type: "line",
        source: "evacuation-pathways",
        paint: {
          "line-color": "#10b981",
          "line-width": 4,
          "line-dasharray": [1, 1],
          "line-opacity": 0.98,
        },
      });

      // 4. RF Signal Arcs
      const arcFeatures = RF_MESH_ARCS_3D.map((arc) => {
        const coords = generateParabolicArc(arc.fromCoord, arc.toCoord, arc.peakAltM, 50);
        return {
          type: "Feature",
          properties: {
            id: arc.id,
            fromId: arc.fromId,
            toId: arc.toId,
            snr: arc.snrDb,
          },
          geometry: {
            type: "LineString",
            coordinates: coords.map((c) => [c[0], c[1]]),
          },
        };
      });

      map.addSource("rf-mesh-arcs", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: arcFeatures as any,
        },
      });

      map.addLayer({
        id: "rf-mesh-arcs-glow",
        type: "line",
        source: "rf-mesh-arcs",
        paint: {
          "line-color": "#10b981",
          "line-width": 6,
          "line-opacity": 0.4,
          "line-blur": 3,
        },
      });

      map.addLayer({
        id: "rf-mesh-arcs-beam",
        type: "line",
        source: "rf-mesh-arcs",
        paint: {
          "line-color": "#34d399",
          "line-width": 2.5,
          "line-opacity": 0.95,
        },
      });

      // 5. Satellite Space Uplink
      map.addSource("satellite-space-burst", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { name: "Auli Satellite Uplink Zenith" },
          geometry: {
            type: "Point",
            coordinates: [SATELLITE_BURST_BEACON.origin[0], SATELLITE_BURST_BEACON.origin[1]],
          },
        },
      });

      map.addLayer({
        id: "satellite-space-burst-point",
        type: "circle",
        source: "satellite-space-burst",
        paint: {
          "circle-radius": 15,
          "circle-color": "#38bdf8",
          "circle-opacity": 0.4,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#0ea5e9",
        },
      });

      // 6. 3D Architectural Extruded Structures (Barrages, Bridges, Bunkers, Helipads)
      map.addSource("extruded-structures", {
        type: "geojson",
        data: EXTRUDED_STRUCTURES_3D_GEOJSON as any,
      });

      map.addLayer({
        id: "extruded-structures-3d",
        type: "fill-extrusion",
        source: "extruded-structures",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "minHeight"],
          "fill-extrusion-opacity": 0.88,
        },
      });

      // Click & Hover interactions for 3D Structures
      map.on("click", "extruded-structures-3d", (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties as any;
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;

        new maplibregl.Popup({ className: "tactical-dark-popup", closeButton: true })
          .setLngLat([lng, lat])
          .setHTML(`
            <div style="font-family: ui-monospace, SFMono-Regular, monospace; background: #020617; color: #f1f5f9; padding: 10px; border-radius: 8px; border: 1px solid #38bdf8; min-width: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
              <div style="font-size: 11px; font-weight: 800; color: #38bdf8; margin-bottom: 4px;">
                🏗️ ${props.name}
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">
                STRUCTURAL TYPE: <span style="color: #f1f5f9; font-weight: bold;">${props.structureType}</span>
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
                PARAPET ELEVATION: <span style="color: #34d399; font-weight: bold;">+${props.height}m above datum</span>
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
                CRITICALITY: <span style="color: ${props.criticality === "CRITICAL" ? "#f43f5e" : "#fbbf24"}; font-weight: bold;">${props.criticality}</span>
              </div>
              <div style="font-size: 9.5px; color: #38bdf8; margin-top: 6px; padding-top: 4px; border-top: 1px solid #1e293b;">
                ⚡ ISRO-NRSC & CWC HYDROLOGIC MONITORING
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", "extruded-structures-3d", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "extruded-structures-3d", () => {
        map.getCanvas().style.cursor = "";
      });

      // 7. Tactical Topographic Contour Lines (Vector HD Curves)
      map.addSource("topographic-contours", {
        type: "geojson",
        data: TOPOGRAPHIC_CONTOURS_GEOJSON as any,
      });

      map.addLayer({
        id: "topographic-contours-line",
        type: "line",
        source: "topographic-contours",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.8,
          "line-opacity": 0.75,
        },
      });

      syncMarkers(map, isCataclysmic);
    });

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (waveMarkerRef.current) waveMarkerRef.current.remove();
      if (spotMarkerRef.current) spotMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map canvas dimensions on fullscreen
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullScreen]);

  // Update map canvas dimensions on container height change
  useEffect(() => {
    if (mapRef.current) {
      requestAnimationFrame(() => {
        mapRef.current?.resize();
      });
    }
  }, [height]);

  // --------------------------------------------------------------------------
  // STATE REACTIVITY (Dynamic Updates to Water Plane, RF Arcs, Sky, Markers)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Dynamic Sky Atmosphere Tint
    if (typeof (map as any).setSky === "function") {
      (map as any).setSky({
        "sky-color": isGlof ? "#1c1004" : isCataclysmic ? "#1a0505" : "#020617",
        "horizon-color": isGlof ? "#451a03" : isCataclysmic ? "#450a0a" : "#1e293b",
        "fog-color": isGlof ? "#1c1004" : isCataclysmic ? "#1a0505" : "#020617",
        "fog-ground-blend": 0.55,
        "atmosphere-blend": 0.8,
      });
    }

    // 1. Water Plane Inundation
    const riverSource = map.getSource("river-inundation") as maplibregl.GeoJSONSource | undefined;
    if (riverSource) {
      if (isCataclysmic) {
        riverSource.setData({
          type: "Feature",
          properties: {
            stage: isGlof ? "GLOF_BULKED_SURGE" : "SURGE_CATACLYSMIC",
            title: isGlof ? "2021 GLOF Debris Wave: 2.1x Bulking, +14.2m Stage" : "Hydraulic Surge: 3.5x Dilation, +8.5m Stage",
          },
          geometry: {
            type: "Polygon",
            coordinates: [RIVER_CATACLYSMIC_INUNDATION_POLYGON.map((pt) => [pt[0], pt[1]])],
          },
        });
      } else {
        riverSource.setData({
          type: "Feature",
          properties: {
            stage: "BASE_STAGE",
            title: "Normal Baseline Channel",
          },
          geometry: {
            type: "Polygon",
            coordinates: [RIVER_BASE_STAGE_POLYGON.map((pt) => [pt[0], pt[1]])],
          },
        });
      }
    }

    if (map.getLayer("river-inundation-fill")) {
      map.setPaintProperty(
        "river-inundation-fill",
        "fill-color",
        isGlof ? "#b45309" : isCataclysmic ? "#dc2626" : isMonsoon ? "#0284c7" : "#0ea5e9"
      );
      map.setPaintProperty(
        "river-inundation-fill",
        "fill-opacity",
        isGlof ? 0.96 : isCataclysmic ? 0.94 : 0.8
      );
    }

    if (map.getLayer("river-inundation-stroke")) {
      map.setPaintProperty(
        "river-inundation-stroke",
        "line-color",
        isGlof ? "#f59e0b" : isCataclysmic ? "#f97316" : "#38bdf8"
      );
      map.setPaintProperty(
        "river-inundation-stroke",
        "line-width",
        isCataclysmic ? 4.5 : 2.5
      );
    }

    // 2. RF Mesh Arcs
    if (map.getLayer("rf-mesh-arcs-glow") && map.getLayer("rf-mesh-arcs-beam")) {
      if (isCataclysmic) {
        map.setPaintProperty("rf-mesh-arcs-glow", "line-color", "#f59e0b");
        map.setPaintProperty("rf-mesh-arcs-glow", "line-opacity", 0.7);
        map.setPaintProperty("rf-mesh-arcs-glow", "line-width", 8);
        map.setPaintProperty("rf-mesh-arcs-beam", "line-color", "#fbbf24");
      } else {
        map.setPaintProperty("rf-mesh-arcs-glow", "line-color", "#10b981");
        map.setPaintProperty("rf-mesh-arcs-glow", "line-opacity", 0.4);
        map.setPaintProperty("rf-mesh-arcs-glow", "line-width", 5);
        map.setPaintProperty("rf-mesh-arcs-beam", "line-color", "#34d399");
      }
    }

    syncMarkers(map, isCataclysmic);
  }, [activeState, isCataclysmic, isGlof, isMonsoon, syncMarkers]);

  // Fly to village when selected externally without forcing open the large details modal
  const isInitialLocMountRef = useRef(true);
  useEffect(() => {
    if (!selectedLocationId || !mapRef.current) return;
    if (isInitialLocMountRef.current) {
      isInitialLocMountRef.current = false;
      return;
    }
    const v = MONITORED_VILLAGES_3D.find((item) => item.id === selectedLocationId);
    if (v) {
      showVillagePopup(mapRef.current, v);
      mapRef.current.flyTo({
        center: [v.coordinates[0], v.coordinates[1]],
        zoom: Math.max(15.0, mapRef.current.getZoom()),
        pitch: 58,
        bearing: -20,
        duration: 900,
        essential: true,
      });
    }
  }, [selectedLocationId, showVillagePopup]);

  // --------------------------------------------------------------------------
  // CONTINUOUS 60FPS RAF ANIMATION (Auto-Orbit, Evac Dash, Weather Canvas)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let step = 0;
    const animate = () => {
      step = (step + 1) % 60;
      const map = mapRef.current;

      // 1. Auto-Orbit
      if (autoOrbit && map && !map.isMoving()) {
        map.setBearing((map.getBearing() + 0.12) % 360);
      }

      // 2. Evacuation Flow & Arcs
      if (map && map.isStyleLoaded()) {
        if (map.getLayer("evacuation-pathways-flow")) {
          const dash1 = Math.max(0.2, (step % 20) / 10);
          map.setPaintProperty("evacuation-pathways-flow", "line-dasharray", [
            dash1,
            Math.max(0.5, 2 - dash1),
          ]);
        }

        if (map.getLayer("rf-mesh-arcs-glow")) {
          const pulse = isCataclysmic
            ? 0.45 + 0.35 * Math.sin(step * 0.25)
            : 0.25 + 0.15 * Math.sin(step * 0.1);
          map.setPaintProperty("rf-mesh-arcs-glow", "line-opacity", pulse);
        }
      }

      // 3. Weather FX Canvas (Rain Simulation)
      if (weatherFxActive && weatherCanvasRef.current && (isMonsoon || isCataclysmic)) {
        const canvas = weatherCanvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = isGlof
            ? "rgba(245, 158, 11, 0.4)"
            : isCataclysmic
              ? "rgba(248, 113, 113, 0.45)"
              : "rgba(148, 163, 184, 0.3)";
          ctx.lineWidth = isCataclysmic ? 1.4 : 1.0;
          ctx.beginPath();

          const drops = rainDropsRef.current;
          for (let i = 0; i < drops.length; i++) {
            const d = drops[i];
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - 3, d.y + d.length);
            d.y += d.speed;
            d.x -= 1.5;
            if (d.y > canvas.height) {
              d.y = -20;
              d.x = Math.random() * canvas.width;
            }
          }
          ctx.stroke();

          // Lightning Flash
          if (isCataclysmic && Math.random() < 0.005) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoOrbit, isCataclysmic, isGlof, isMonsoon, weatherFxActive]);

  // Layer switches
  const toggleLayer = (layerKey: keyof typeof layers) => {
    playTacticalClick();
    setLayers((prev) => {
      const next = { ...prev, [layerKey]: !prev[layerKey] };
      const map = mapRef.current;
      if (map && map.isStyleLoaded()) {
        if (layerKey === "demRelief") {
          map.setTerrain(next.demRelief ? { source: "terrain-dem", exaggeration: 1.48 } : null);
          if (map.getLayer("tactical-hillshading")) {
            map.setLayoutProperty(
              "tactical-hillshading",
              "visibility",
              next.demRelief ? "visible" : "none"
            );
          }
        }
        if (layerKey === "rfMeshWaves") {
          const vis = next.rfMeshWaves ? "visible" : "none";
          if (map.getLayer("rf-mesh-arcs-glow")) map.setLayoutProperty("rf-mesh-arcs-glow", "visibility", vis);
          if (map.getLayer("rf-mesh-arcs-beam")) map.setLayoutProperty("rf-mesh-arcs-beam", "visibility", vis);
        }
        if (layerKey === "evacCorridors") {
          const vis = next.evacCorridors ? "visible" : "none";
          if (map.getLayer("evacuation-pathways-casing"))
            map.setLayoutProperty("evacuation-pathways-casing", "visibility", vis);
          if (map.getLayer("evacuation-pathways-flow"))
            map.setLayoutProperty("evacuation-pathways-flow", "visibility", vis);
        }
        if (layerKey === "inundationPlane") {
          const vis = next.inundationPlane ? "visible" : "none";
          if (map.getLayer("river-inundation-fill"))
            map.setLayoutProperty("river-inundation-fill", "visibility", vis);
          if (map.getLayer("river-inundation-stroke"))
            map.setLayoutProperty("river-inundation-stroke", "visibility", vis);
        }
        if (layerKey === "criticalAssets") {
          syncMarkers(map, isCataclysmic);
        }
        if (layerKey === "extruded3d") {
          const vis = next.extruded3d ? "visible" : "none";
          if (map.getLayer("extruded-structures-3d"))
            map.setLayoutProperty("extruded-structures-3d", "visibility", vis);
        }
        if (layerKey === "contourLines") {
          const vis = next.contourLines ? "visible" : "none";
          if (map.getLayer("topographic-contours-line"))
            map.setLayoutProperty("topographic-contours-line", "visibility", vis);
        }
      }
      return next;
    });
  };

  const currentTourWaypoint = CAMERA_WAYPOINTS.find((w) => w.id === TOUR_WAYPOINTS[tourStep]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 font-sans text-slate-100 shadow-2xl transition-all duration-300 ${
        isFullScreen ? "fixed inset-0 z-50 rounded-none border-none h-screen" : ""
      }`}
      style={{ height: isFullScreen ? "100vh" : height }}
    >
      {/* ---------------- WebGL Map Canvas Container ---------------- */}
      <div ref={mapContainerRef} className="h-full w-full bg-slate-950" />

      {/* ---------------- Weather FX Simulation Canvas Overlay ---------------- */}
      <canvas
        ref={weatherCanvasRef}
        width={1920}
        height={1080}
        className="pointer-events-none absolute inset-0 h-full w-full z-10"
      />

      {/* ---------------- Tactical Drone Recon Sensor Filter Overlays ---------------- */}
      {droneTourActive && reconSensorMode === "THERMAL" && (
        <div className="pointer-events-none absolute inset-0 z-15 bg-gradient-to-t from-purple-950/40 via-amber-950/25 to-rose-950/30 mix-blend-color-dodge" />
      )}
      {droneTourActive && reconSensorMode === "NVG" && (
        <div className="pointer-events-none absolute inset-0 z-15 bg-emerald-950/35 mix-blend-color-dodge ring-1 ring-inset ring-emerald-500/30" />
      )}

      {/* ---------------- Tactical Grid & Vignette Overlay ---------------- */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* ---------------- ZEN MODE / CLEAN MAP VIEW BADGE ---------------- */}
      {zenMode && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-cyan-500/40 bg-slate-950/85 px-3 py-1.5 text-xs font-mono text-cyan-300 shadow-2xl backdrop-blur-md">
            <Eye className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span className="font-bold">ZEN MAP VIEW</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-[10px]">Press [Z] or [ESC] to exit</span>
            <button
              type="button"
              onClick={() => setZenMode(false)}
              className="ml-1 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              title="Exit Zen Mode"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- AERIAL DRONE RECONNAISSANCE HUD OVERLAY (ACTIVE TOUR) ---------------- */}
      {droneTourActive && !zenMode && (
        <div className="absolute top-16 left-3 right-3 z-25 flex flex-col gap-2 pointer-events-none">
          {/* Top Drone Flight Banner */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/60 bg-slate-950/90 px-3.5 py-2 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-950/50 text-amber-300 animate-pulse">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-300 font-mono tracking-wider">
                    DRONE RECON VK-09 // WP {tourStep + 1} OF {TOUR_WAYPOINTS.length}
                  </span>
                  <span className="rounded bg-amber-950 px-1.5 py-0.2 text-[9px] font-mono text-amber-300 border border-amber-700 font-bold">
                    {currentTourWaypoint?.badge ?? "SURVEILLANCE"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-200 font-semibold truncate max-w-xs sm:max-w-md">
                  {currentTourWaypoint?.title} &middot; <span className="text-amber-400 font-mono">{currentTourWaypoint?.targetAltM}m ASL</span>
                </div>
              </div>
            </div>

            {/* Stepper Controls & Sensor Mode */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 text-[10px] font-mono">
                {(["OPTICAL", "THERMAL", "NVG"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setReconSensorMode(mode)}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      reconSensorMode === mode
                        ? mode === "THERMAL"
                          ? "bg-rose-500/30 text-rose-300 font-bold border border-rose-500/50"
                          : mode === "NVG"
                          ? "bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/50"
                          : "bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTourStep((prev) => (prev - 1 + TOUR_WAYPOINTS.length) % TOUR_WAYPOINTS.length)}
                  className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-mono text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition cursor-pointer"
                  title="Previous Recon Waypoint"
                >
                  &larr; Prev
                </button>
                <button
                  type="button"
                  onClick={() => setTourStep((prev) => (prev + 1) % TOUR_WAYPOINTS.length)}
                  className="rounded border border-amber-500/60 bg-amber-500/20 px-2 py-1 text-[10px] font-mono text-amber-300 hover:bg-amber-500/30 transition cursor-pointer font-bold"
                  title="Next Recon Waypoint"
                >
                  Next &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setDroneTourActive(false)}
                  className="rounded border border-rose-500/50 bg-rose-950/40 px-2 py-1 text-[10px] font-mono text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
                  title="Exit Drone Recon Tour"
                >
                  Exit Tour
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- DRONE RETICLE & CROSSHAIR (CENTER OF SCREEN) ---------------- */}
      {droneTourActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            {/* Corner brackets crosshairs */}
            <div className="relative h-28 w-28 border border-amber-400/30 rounded-lg">
              <span className="absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2 border-amber-400" />
              <span className="absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2 border-amber-400" />
              <span className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-amber-400" />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-amber-400" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-amber-400/80 animate-ping" />
                <span className="h-1 w-1 rounded-full bg-amber-300" />
              </div>
            </div>
            {/* Telemetry tape under crosshair */}
            <div className="mt-2 rounded bg-slate-950/80 px-2 py-0.5 text-[9px] font-mono text-amber-300 border border-amber-500/30 backdrop-blur">
              TRG LOCK &bull; RNG 480m &bull; BEARING {cameraTelemetry.bearing}&deg; &bull; PITCH {cameraTelemetry.pitch}&deg;
            </div>
          </div>
        </div>
      )}

      {/* ---------------- NORMAL MODE: COMMAND RIBBON & INTERACTIVE OVERLAYS ---------------- */}
      {!zenMode && (
        <>
          {/* ---------------- UNIFIED TOP COMMAND RIBBON ---------------- */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none rounded-xl border border-slate-800/90 bg-slate-950/90 px-2.5 py-1.5 shadow-2xl backdrop-blur-md">
            {/* Left Cluster: Telemetry, Compass & Settlement Focus */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Telemetry Indicator */}
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2 py-1 text-[10.5px] font-mono flex-shrink-0">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </div>
                <span className="font-bold text-slate-100">JOSHIMATH-C2</span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-300 font-semibold">{realtimeClock.istTime}</span>
                <span className="text-slate-600 hidden md:inline">|</span>
                <span className="text-amber-300 font-semibold hidden md:inline">ASL {cursorPos.alt}m</span>
              </div>

              {/* Compass / Straighten Button */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  if (!mapRef.current) return;
                  mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 800 });
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-[10.5px] font-mono text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200 transition cursor-pointer flex-shrink-0"
                title="Click to reset pitch to 0° and bearing to North"
              >
                <Compass
                  className="h-3 w-3 text-cyan-400 transition-transform duration-300"
                  style={{ transform: `rotate(${-cameraTelemetry.bearing}deg)` }}
                />
                <span>{cameraTelemetry.bearing}°</span>
              </button>

              {/* Focus Point Flyout Trigger */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setActiveFlyout((prev) => (prev === "focus" ? null : "focus"));
                }}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-mono font-medium transition cursor-pointer flex-shrink-0 ${
                  activeFlyout === "focus"
                    ? "border-amber-500/80 bg-amber-500/20 text-amber-200"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                }`}
                title="Monitored settlements and focus points"
              >
                <MapPin className="h-3 w-3 text-amber-400" />
                <span className="truncate max-w-[85px]">
                  {selectedLocationId
                    ? MONITORED_VILLAGES_3D.find((v) => v.id === selectedLocationId)?.name.split(" ")[0] ?? "Focus"
                    : "Focus"}
                </span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeFlyout === "focus" ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Right Cluster: Flyouts, Quick Tools, Zen & Fullscreen */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Basemaps Flyout Button */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setActiveFlyout((prev) => (prev === "basemap" ? null : "basemap"));
                }}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  activeFlyout === "basemap"
                    ? "border-emerald-500/80 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                }`}
                title="Switch 2x HD Satellite & Elevation Basemaps"
              >
                <Mountain className="h-3 w-3 text-emerald-400" />
                <span className="hidden xl:inline">Basemap</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeFlyout === "basemap" ? "rotate-180" : ""}`} />
              </button>

              {/* Overlays / Layers Flyout Button */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setActiveFlyout((prev) => (prev === "layers" ? null : "layers"));
                }}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  activeFlyout === "layers"
                    ? "border-cyan-500/80 bg-cyan-500/20 text-cyan-200"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                }`}
                title="Toggle 3D DEM, LoRa Mesh, Inundation, Assets, Evacuation layers"
              >
                <Layers className="h-3 w-3 text-cyan-400" />
                <span className="hidden xl:inline">Layers</span>
                <span className="rounded bg-cyan-950 px-1 text-[9px] font-bold text-cyan-300 border border-cyan-800/60">
                  {Object.values(layers).filter(Boolean).length}
                </span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeFlyout === "layers" ? "rotate-180" : ""}`} />
              </button>

              {/* Waypoints Flyout Button */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setActiveFlyout((prev) => (prev === "waypoints" ? null : "waypoints"));
                }}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  activeFlyout === "waypoints"
                    ? "border-amber-500/80 bg-amber-500/20 text-amber-200"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                }`}
                title="Cinematic Camera Views"
              >
                <Eye className="h-3 w-3 text-amber-400" />
                <span className="hidden xl:inline">Waypoints</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeFlyout === "waypoints" ? "rotate-180" : ""}`} />
              </button>

              {/* Scenario Flyout Button */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setActiveFlyout((prev) => (prev === "scenario" ? null : "scenario"));
                }}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  activeFlyout === "scenario"
                    ? "border-rose-500/80 bg-rose-500/20 text-rose-200"
                    : activeState === "CLOUDBURST_CATACLYSMIC" || isGlof
                    ? "border-rose-500/50 bg-rose-950/40 text-rose-300"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                }`}
                title="Change simulation scenarios (Baseline, Monsoon, Cloudburst, GLOF, Live 5-API)"
              >
                <Zap className="h-3 w-3 text-rose-400" />
                <span className="hidden xl:inline">
                  {isGlof ? "GLOF" : isCataclysmic ? "Cloudburst" : "Scenario"}
                </span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeFlyout === "scenario" ? "rotate-180" : ""}`} />
              </button>

              <div className="h-4 w-px bg-slate-800 hidden xl:block" />

              {/* Verified 5-API Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setVerifiedModalOpen(true);
                }}
                className="hidden md:flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/60 transition cursor-pointer"
                title="Inspect Verified Multi-Source Data: GloFAS Streamflow, Copernicus DEM, ECMWF, USGS, CAMS"
              >
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                <span>5-API</span>
              </button>

              {/* Elevation Transect Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setCrossSectionOpen(true);
                }}
                className="hidden md:flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-2 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-900/60 transition cursor-pointer"
                title="Inspect 2D Geotechnical Elevation & Valley Surcharge Profile"
              >
                <TrendingUp className="h-3 w-3 text-cyan-400" />
                <span>Profile</span>
              </button>

              {/* Drone Recon Valley Tour Toggle */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setDroneTourActive(!droneTourActive);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                  droneTourActive
                    ? "border-amber-500 bg-amber-500/25 text-amber-300 animate-pulse"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                }`}
                title="Drone Recon Valley Flythrough"
              >
                <Video className="h-3.5 w-3.5" />
              </button>

              {/* Auto-Orbit 360° Toggle */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setAutoOrbit(!autoOrbit);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                  autoOrbit
                    ? "border-emerald-500 bg-emerald-500/25 text-emerald-300"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                }`}
                title="Toggle 360° Continuous Auto-Orbit"
              >
                <Orbit className={`h-3.5 w-3.5 ${autoOrbit ? "animate-spin-slow" : ""}`} />
              </button>

              {/* Weather FX Rain Toggle */}
              <button
                type="button"
                onClick={() => setWeatherFxActive(!weatherFxActive)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                  weatherFxActive
                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                }`}
                title="Toggle Rain & Storm Particle FX"
              >
                <Droplets className="h-3.5 w-3.5" />
              </button>

              {/* Siren Mute Toggle */}
              <button
                type="button"
                onClick={() => {
                  setSirenMuted(!sirenMuted);
                  if (sirenMuted) playSiren();
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                  !sirenMuted
                    ? "border-rose-500 bg-rose-600/30 text-rose-300"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                }`}
                title="Toggle Emergency Defense Audio Siren"
              >
                {!sirenMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>

              {/* Zen Mode / Clean View Button */}
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  setZenMode(true);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition cursor-pointer"
                title="Clean Map View (Zen Mode - hides all overlays)"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title={isFullScreen ? "Exit Fullscreen" : "Tactical Fullscreen"}
              >
                {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* ---------------- COLLAPSIBLE FLYOUT: LAYERS ---------------- */}
          {activeFlyout === "layers" && (
            <div className="absolute top-14 right-3 z-30 w-72 rounded-xl border border-cyan-500/50 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" />
                  Tactical 3D Overlays
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFlyout(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Close Layers Panel (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1 text-[11px]">
                <label className="flex items-center justify-between gap-3 cursor-pointer rounded px-2 py-1 hover:bg-slate-900 transition">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Mountain className="h-3.5 w-3.5 text-cyan-400" />
                    3D Relief DEM (1.48x HD)
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.demRelief}
                    onChange={() => toggleLayer("demRelief")}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer rounded px-2 py-1 hover:bg-slate-900 transition">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Radio className="h-3.5 w-3.5 text-emerald-400" />
                    LoRa Mesh Waves
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.rfMeshWaves}
                    onChange={() => toggleLayer("rfMeshWaves")}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer rounded px-2 py-1 hover:bg-slate-900 transition">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Navigation className="h-3.5 w-3.5 text-emerald-400" />
                    Evacuation Corridors
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.evacCorridors}
                    onChange={() => toggleLayer("evacCorridors")}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer rounded px-2 py-1 hover:bg-slate-900 transition">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Waves className="h-3.5 w-3.5 text-blue-400" />
                    Inundation Plane
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.inundationPlane}
                    onChange={() => toggleLayer("inundationPlane")}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer rounded px-2 py-1 hover:bg-slate-900 transition">
                  <span className="flex items-center gap-2 text-slate-300">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    Critical Assets &amp; Nodes
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.criticalAssets}
                    onChange={() => toggleLayer("criticalAssets")}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer rounded px-2 py-1 hover:bg-slate-900 transition">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Layers className="h-3.5 w-3.5 text-rose-400" />
                    3D Structures (Barrage/Bridges)
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.extruded3d}
                    onChange={() => toggleLayer("extruded3d")}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer rounded px-2 py-1 hover:bg-slate-900 transition">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Mountain className="h-3.5 w-3.5 text-indigo-400" />
                    Topographic Contours (HD)
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.contourLines}
                    onChange={() => toggleLayer("contourLines")}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* ---------------- COLLAPSIBLE FLYOUT: WAYPOINTS ---------------- */}
          {activeFlyout === "waypoints" && (
            <div className="absolute top-14 right-3 z-30 w-80 rounded-xl border border-amber-500/50 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <Eye className="h-3.5 w-3.5 text-amber-400" />
                  Cinematic Waypoints
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFlyout(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Close Waypoints (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                {CAMERA_WAYPOINTS.map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => {
                      flyToWaypoint(wp);
                      setActiveFlyout(null);
                    }}
                    className={`flex items-center justify-start gap-1.5 rounded-lg border px-2 py-1.5 text-left font-medium transition cursor-pointer ${
                      activeWaypoint === wp.id
                        ? "border-amber-500/80 bg-amber-500/20 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <Eye className="h-3 w-3 flex-shrink-0 text-amber-400" />
                    <span className="truncate">{wp.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---------------- COLLAPSIBLE FLYOUT: BASEMAP ---------------- */}
          {activeFlyout === "basemap" && (
            <div className="absolute top-14 right-3 z-30 w-72 rounded-xl border border-emerald-500/50 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                  <Mountain className="h-3.5 w-3.5 text-emerald-400" />
                  HD Satellite &amp; Basemaps
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFlyout(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Close Basemap Selector (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1 text-[11px]">
                {[
                  { id: "google-hybrid" as const, label: "Google Hybrid 2x HD", desc: "Satellite with road and contour labels" },
                  { id: "google-sat" as const, label: "Google Satellite HD", desc: "Pure high-res optical imagery" },
                  { id: "esri-sat" as const, label: "ESRI World Imagery", desc: "Alternative multispectral satellite" },
                  { id: "opentopo" as const, label: "OpenTopo Contours", desc: "Detailed topographic relief curves" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      changeBasemap(item.id);
                      setActiveFlyout(null);
                    }}
                    className={`flex flex-col text-left rounded-lg p-2 transition cursor-pointer ${
                      basemapMode === item.id
                        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/60"
                        : "border border-transparent hover:bg-slate-900 text-slate-300"
                    }`}
                  >
                    <span className="font-semibold text-xs">{item.label}</span>
                    <span className="text-[10px] text-slate-400">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---------------- COLLAPSIBLE FLYOUT: FOCUS / SETTLEMENTS ---------------- */}
          {activeFlyout === "focus" && (
            <div className="absolute top-14 left-3 z-30 w-80 sm:w-96 max-h-[75vh] flex flex-col rounded-xl border border-amber-500/50 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  Monitored Settlements &amp; Nodes
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFlyout(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Close Focus Points (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                {MONITORED_VILLAGES_3D.map((loc) => {
                  const isCurr = selectedLocationId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        playTacticalClick();
                        setSelectedEntity({ type: "VILLAGE", data: loc });
                        setCrossSectionLocId(loc.id);
                        if (onSelectLocation) onSelectLocation(loc.id);
                        if (onSelectWard) onSelectWard(loc.wardId);
                        if (mapRef.current) {
                          showVillagePopup(mapRef.current, loc);
                          mapRef.current.flyTo({
                            center: [loc.coordinates[0], loc.coordinates[1]],
                            zoom: Math.max(14.8, mapRef.current.getZoom()),
                            pitch: 58,
                            bearing: -20,
                            duration: 800,
                            essential: true,
                          });
                        }
                        setActiveFlyout(null);
                      }}
                      className={`flex flex-col rounded-lg border p-2 text-left transition cursor-pointer ${
                        isCurr
                          ? "border-amber-500/80 bg-amber-500/20 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                          : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                      }`}
                    >
                      <span className="font-bold truncate">{loc.name.split(" ")[0]}</span>
                      <span className="font-mono text-[9.5px] text-slate-400">{loc.coordinates[2]}m ASL · T+{loc.leadTimeMin}m</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------- COLLAPSIBLE FLYOUT: SCENARIO SELECTOR ---------------- */}
          {activeFlyout === "scenario" && (
            <div className="absolute top-14 right-3 z-30 w-80 rounded-xl border border-rose-500/50 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-300">
                  <Zap className="h-3.5 w-3.5 text-rose-400" />
                  Disaster Scenario Trigger
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFlyout(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Close Scenario Selector (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 text-[11px]">
                {/* Pre-Monsoon Normal */}
                <button
                  type="button"
                  onClick={() => {
                    handleScenarioTrigger("DRY_BASELINE");
                    setActiveFlyout(null);
                  }}
                  className={`flex items-center justify-between rounded-lg p-2 border transition cursor-pointer ${
                    activeState === "DRY_BASELINE" && !liveMeteoActive
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold">Pre-Monsoon Normal</span>
                  </div>
                  <span className="font-mono text-[9px] text-emerald-400">Baseline</span>
                </button>

                {/* Active Saturated */}
                <button
                  type="button"
                  onClick={() => {
                    handleScenarioTrigger("MONSOON_SATURATED");
                    setActiveFlyout(null);
                  }}
                  className={`flex items-center justify-between rounded-lg p-2 border transition cursor-pointer ${
                    activeState === "MONSOON_SATURATED"
                      ? "border-amber-500 bg-amber-500/20 text-amber-200"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="font-semibold">Monsoon Saturated</span>
                  </div>
                  <span className="font-mono text-[9px] text-amber-400">45 mm/h</span>
                </button>

                {/* Cataclysmic Cloudburst */}
                <button
                  type="button"
                  onClick={() => {
                    handleScenarioTrigger("CLOUDBURST_CATACLYSMIC");
                    setActiveFlyout(null);
                  }}
                  className={`flex items-center justify-between rounded-lg p-2 border transition cursor-pointer ${
                    activeState === "CLOUDBURST_CATACLYSMIC"
                      ? "border-rose-500 bg-rose-600/30 text-rose-200 animate-pulse"
                      : "border-rose-950/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-rose-400" />
                    <span className="font-bold">Cloudburst Surge</span>
                  </div>
                  <span className="font-mono text-[9px] text-rose-300">185 mm/h</span>
                </button>

                {/* 2021 GLOF Cataclysm */}
                <button
                  type="button"
                  onClick={() => {
                    handleScenarioTrigger("glof");
                    setActiveFlyout(null);
                  }}
                  className={`flex items-center justify-between rounded-lg p-2 border transition cursor-pointer ${
                    isGlof
                      ? "border-amber-500 bg-amber-600/30 text-amber-200 animate-pulse"
                      : "border-amber-950/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Mountain className="h-3.5 w-3.5 text-amber-400" />
                    <span className="font-bold">2021 GLOF Cataclysm</span>
                  </div>
                  <span className="font-mono text-[9px] text-amber-300">2.1x Debris</span>
                </button>

                {/* Live 5-API Sync */}
                <button
                  type="button"
                  onClick={() => {
                    syncLiveMultiApi();
                    setActiveFlyout(null);
                  }}
                  disabled={liveLoading}
                  className={`flex items-center justify-between rounded-lg p-2 border transition cursor-pointer ${
                    liveMeteoActive
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-200"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Radio className={`h-3.5 w-3.5 ${liveLoading ? "animate-spin text-cyan-300" : "text-cyan-400"}`} />
                    <span className="font-semibold">{liveLoading ? "Syncing..." : "Realtime Multi-API"}</span>
                  </div>
                  <span className="font-mono text-[9px] text-cyan-300">GloFAS + Cop-30</span>
                </button>
              </div>
            </div>
          )}

          {/* ---------------- 4D FLOOD SURGE PROPAGATION CONTROLS (BOTTOM-CENTER) ---------------- */}
          {showWaveController && (
            <>
              {waveControllerMinimized ? (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-rose-500/50 bg-slate-950/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-300">
                    <Waves className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                    <span>SURGE: T+{Math.round(waveProgressMin)}m</span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      playTacticalClick();
                      setWaveSimActive(!waveSimActive);
                    }}
                    className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
                    title={waveSimActive ? "Pause Surge" : "Play Surge"}
                  >
                    {waveSimActive ? <Pause className="h-3 w-3 text-rose-400" /> : <Play className="h-3 w-3 text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaveControllerMinimized(false)}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title="Expand Surge Simulator"
                  >
                    <span>Expand</span>
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWaveController(false)}
                    className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    title="Hide Surge Controller"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-xl border border-rose-500/60 bg-slate-950/95 px-4 py-2 shadow-2xl backdrop-blur-xl ring-1 ring-rose-500/40 animate-in fade-in zoom-in-95 duration-150 max-w-[95vw]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playTacticalClick();
                        setWaveSimActive(!waveSimActive);
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                        waveSimActive
                          ? "bg-rose-600 text-white shadow-[0_0_15px_#e11d48]"
                          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {waveSimActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-rose-400" />}
                      <span className="hidden sm:inline">{waveSimActive ? "Pause" : "Simulate Flood Wave"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playTacticalClick();
                        setWaveProgressMin(0);
                        setWaveSimActive(false);
                      }}
                      className="rounded p-1 text-slate-400 hover:text-slate-100 transition cursor-pointer"
                      title="Reset Wave Simulator to T+00m"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Wave Timeline Scrubber */}
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={45}
                      step={0.5}
                      value={waveProgressMin}
                      onChange={(e) => {
                        setWaveProgressMin(parseFloat(e.target.value));
                      }}
                      className="w-24 sm:w-40 accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="font-mono text-xs font-black text-rose-300 w-16">
                      T+{Math.round(waveProgressMin)} min
                    </span>
                  </div>

                  {/* Telemetry metrics & status */}
                  <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800 text-[10px] font-mono">
                    {activeEngineMode === "LOCAL_TYPESCRIPT_FALLBACK" ? (
                      <span className="text-amber-300 font-bold flex items-center gap-1.5 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        [EDGE: 1D Kinematic Wave]
                      </span>
                    ) : activeEngineMode === "JETSON_ORIN_EDGE_FP16" ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1.5 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        JETSON ORIN (256x256)
                      </span>
                    ) : (
                      <span className="text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        NEBIUS H100 (512x512 FBO)
                      </span>
                    )}
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400">VELOCITY:</span>
                    <span className="text-amber-400 font-bold">{isGlof ? "8.2 m/s" : "6.8 m/s"}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400">STAGE:</span>
                    <span className="text-rose-400 font-bold">{isGlof ? "+14.2m" : "+8.5m"}</span>
                  </div>

                  {/* Minimize and Close Controls */}
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
                    <button
                      type="button"
                      onClick={() => setWaveControllerMinimized(true)}
                      className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                      title="Minimize Surge Controls"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWaveController(false)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      title="Close Surge Controls"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Floating Re-Open Button when Surge Controller is Closed */}
          {!showWaveController && (
            <button
              type="button"
              onClick={() => {
                playTacticalClick();
                setShowWaveController(true);
                setWaveControllerMinimized(false);
              }}
              className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-rose-500/50 bg-slate-950/90 px-3 py-1.5 text-xs font-mono font-bold text-rose-300 shadow-xl backdrop-blur-md hover:border-rose-400 hover:bg-slate-900 transition cursor-pointer"
              title="Re-open 4D Flood Surge Propagation Simulator"
            >
              <Waves className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              <span>SURGE SIMULATOR</span>
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}

          {/* ---------------- POP-OPEN STUDIED LOCATION & ASSET INFORMATION TABLE ---------------- */}
          {selectedEntity && (
            <div className="absolute top-16 left-3 z-30 w-80 sm:w-[460px] max-h-[75vh] flex flex-col rounded-xl border border-cyan-500/60 bg-slate-950/95 p-3.5 sm:p-4 shadow-[0_0_40px_rgba(0,0,0,0.85)] backdrop-blur-xl ring-1 ring-cyan-500/40 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedEntity.type === "VILLAGE" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex-shrink-0">
                      <MapPin className="h-4.5 w-4.5" />
                    </div>
                  )}
                  {selectedEntity.type === "STATION" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex-shrink-0">
                      <RadioTower className="h-4.5 w-4.5" />
                    </div>
                  )}
                  {selectedEntity.type === "INTERDICTION" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 flex-shrink-0">
                      <AlertTriangle className="h-4.5 w-4.5" />
                    </div>
                  )}
                  {selectedEntity.type === "SHELTER" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex-shrink-0">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                        {selectedEntity.data.name || selectedEntity.data.title}
                      </h4>
                      {selectedEntity.type === "VILLAGE" && (
                        <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[9px] font-mono font-bold text-cyan-300 border border-cyan-800/60 flex-shrink-0">
                          {selectedEntity.data.wardId}
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] font-mono text-slate-400 truncate">
                      {selectedEntity.type === "VILLAGE"
                        ? `${selectedEntity.data.hindiName} · ${selectedEntity.data.coordinates[2]}m ASL · ${selectedEntity.data.category}`
                        : (selectedEntity.data.callsign || selectedEntity.data.locationName || selectedEntity.data.tehsil)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntity(null);
                    if (activePopupRef.current) activePopupRef.current.remove();
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition flex-shrink-0 cursor-pointer"
                  title="Close Information Table (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Details Table */}
              <div className="mt-2.5 space-y-2 text-[11px] text-slate-300">
                {selectedEntity.type === "VILLAGE" && (
                  <>
                    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 shadow-inner">
                      <table className="w-full text-left font-mono text-[10.5px]">
                        <thead className="border-b border-slate-800 bg-slate-900 text-[9.5px] uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-2.5 py-1.5 font-semibold">Observed Metric</th>
                            <th className="px-2.5 py-1.5 font-semibold text-right">Computed Value</th>
                            <th className="px-2.5 py-1.5 font-semibold hidden sm:table-cell">Assessment &amp; Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-200">
                          <tr>
                            <td className="px-2.5 py-1.5 text-slate-400">Coordinates</td>
                            <td className="px-2.5 py-1.5 text-right font-bold text-slate-100">
                              {selectedEntity.data.coordinates[0]}°E, {selectedEntity.data.coordinates[1]}°N
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-400 text-[10px] hidden sm:table-cell">
                              Alaknanda River Corridor
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2.5 py-1.5 text-slate-400">Datum Elevation</td>
                            <td className="px-2.5 py-1.5 text-right font-bold text-cyan-400">
                              {selectedEntity.data.coordinates[2]} m ASL
                            </td>
                            <td className="px-2.5 py-1.5 text-cyan-300 text-[10px] hidden sm:table-cell">
                              {selectedEntity.data.category} Flank Zone
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2.5 py-1.5 text-slate-400">Wave Surge Lead Time</td>
                            <td className="px-2.5 py-1.5 text-right font-black text-amber-400">
                              {selectedEntity.data.leadTimeMin === 0 ? "0 min (EPICENTER)" : `${selectedEntity.data.leadTimeMin} min`}
                            </td>
                            <td className="px-2.5 py-1.5 text-[10px] hidden sm:table-cell">
                              {waveProgressMin >= selectedEntity.data.leadTimeMin && selectedEntity.data.leadTimeMin > 0 ? (
                                <span className="text-rose-400 font-extrabold animate-pulse">BREACHED AT T+{waveProgressMin}m</span>
                              ) : selectedEntity.data.leadTimeMin < 10 ? (
                                <span className="text-rose-400 font-bold animate-pulse">SURGE IMMINENT</span>
                              ) : (
                                <span className="text-emerald-400 font-medium">CLEARANCE WINDOW</span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2.5 py-1.5 text-slate-400">Civilians at Risk</td>
                            <td className="px-2.5 py-1.5 text-right font-bold text-rose-400">
                              {selectedEntity.data.population.toLocaleString()}
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-400 text-[10px] hidden sm:table-cell">
                              Priority Evac Population
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2.5 py-1.5 text-slate-400">Toe Slope Gradient</td>
                            <td className="px-2.5 py-1.5 text-right font-bold text-slate-200">
                              {selectedEntity.data.toeSlopeDeg}°
                            </td>
                            <td className="px-2.5 py-1.5 text-amber-300 text-[10px] hidden sm:table-cell">
                              High Surcharge Shear Risk
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2.5 py-1.5 text-slate-400">Designated Shelter</td>
                            <td className="px-2.5 py-1.5 text-right font-bold text-emerald-400 truncate max-w-[140px]">
                              {selectedEntity.data.evacuationShelter}
                            </td>
                            <td className="px-2.5 py-1.5 text-emerald-300 text-[10px] hidden sm:table-cell">
                              Safe Highland Assembly
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCrossSectionLocId(selectedEntity.data.id);
                          setCrossSectionOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded border border-cyan-500/60 bg-cyan-950/60 py-1.5 text-center text-[10.5px] font-bold text-cyan-300 hover:bg-cyan-900/80 transition cursor-pointer"
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        Elevation Transect
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (mapRef.current) {
                            mapRef.current.flyTo({
                              center: [selectedEntity.data.coordinates[0], selectedEntity.data.coordinates[1]],
                              zoom: 15.5,
                              pitch: 62,
                              bearing: -15,
                              duration: 900,
                              essential: true,
                            });
                          }
                        }}
                        className="flex items-center justify-center gap-1 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10.5px] font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                        title="Focus 3D View on Pin"
                      >
                        <Navigation className="h-3 w-3 text-cyan-400" />
                        Focus Pin
                      </button>
                    </div>
                  </>
                )}

                {selectedEntity.type === "STATION" && (
                  <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 shadow-inner">
                    <table className="w-full text-left font-mono text-[10.5px]">
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Coordinates</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-slate-100">{selectedEntity.data.coordinates[0]}°E, {selectedEntity.data.coordinates[1]}°N</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Elevation ASL</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-cyan-400">{selectedEntity.data.coordinates[2]}m</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Telemetry Protocol</td>
                          <td className="px-2.5 py-1.5 text-right text-emerald-400 font-semibold">{selectedEntity.data.protocol}</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Tx Frequency / Power</td>
                          <td className="px-2.5 py-1.5 text-right">{selectedEntity.data.frequencyMhz} MHz · {selectedEntity.data.txPowerDbm} dBm</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Battery Status</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-emerald-400">{selectedEntity.data.batteryPct}%</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="p-2.5 text-[10px] text-slate-400 border-t border-slate-800">{selectedEntity.data.description}</p>
                  </div>
                )}

                {selectedEntity.type === "SHELTER" && (
                  <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 shadow-inner">
                    <table className="w-full text-left font-mono text-[10.5px]">
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Coordinates</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-slate-100">{selectedEntity.data.coordinates[0]}°E, {selectedEntity.data.coordinates[1]}°N</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Highland Elevation</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-cyan-400">{selectedEntity.data.elevationM}m ASL</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Safe Capacity</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-emerald-400">{selectedEntity.data.capacityPersons} Persons</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-slate-400">Helipad Accessible</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-slate-100">{selectedEntity.data.helipadCapable ? "YES (Mi-17 / ALH)" : "NO (Foot Trail Only)"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedEntity.type === "INTERDICTION" && (
                  <div className="rounded bg-rose-950/40 p-3 border border-rose-800/40 text-[10.5px] text-rose-200 space-y-1">
                    <div className="font-bold text-rose-300">INTERDICTION LEVEL: ZERO TRANSIT</div>
                    <div>Cut-Off Distance: {selectedEntity.data.cutOffLengthM}m of highway entrained.</div>
                    <div className="font-mono text-slate-400">Detour: {selectedEntity.data.detourVia}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------- BOTTOM-RIGHT TACTICAL LEAD-TIME DOCK ---------------- */}
          {showLeadTimeDock && (
            <div className="absolute bottom-4 right-3 z-20 flex flex-col items-end">
              {leadTimeOpen ? (
                <div className="w-72 rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Timer
                        className={`h-3.5 w-3.5 ${
                          isCataclysmic ? "text-rose-400 animate-pulse" : "text-amber-400"
                        }`}
                      />
                      <span className="text-[11px] font-bold tracking-wider text-slate-100 uppercase">
                        Confluence Wave Lead-Time
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLeadTimeOpen(false)}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                        title="Collapse Dock"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLeadTimeDock(false)}
                        className="rounded p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Hide Lead-Time Dock"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className="block text-[9px] font-mono text-slate-400">SURGE ARRIVAL</span>
                      <span
                        className={`font-mono text-lg font-black tracking-wider ${
                          isCataclysmic ? "text-rose-400 animate-pulse" : "text-amber-300"
                        }`}
                      >
                        T - {String(displayMin).padStart(2, "0")}:{String(displaySec).padStart(2, "0")} MIN
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] font-mono text-slate-400">
                        LIVE C2 CLOCK: <span className="text-cyan-300 font-bold">{realtimeClock.istTime}</span>
                      </span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          isCataclysmic ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {isCataclysmic ? "-3 min DEFICIT" : "+11 min MARGIN"}
                      </span>
                    </div>
                  </div>

                  {/* Wave chain mini stepper */}
                  <div className="mt-2.5 grid grid-cols-4 gap-1 text-[8.5px] font-mono">
                    <div className="flex flex-col rounded bg-slate-900/80 p-1 text-center border border-slate-800">
                      <span className="text-slate-400">AULI</span>
                      <span className="font-bold text-cyan-400">T+00m</span>
                    </div>
                    <div className="flex flex-col rounded bg-slate-900/80 p-1 text-center border border-slate-800">
                      <span className="text-slate-400">JOSHIMATH</span>
                      <span className="font-bold text-amber-400">T+08m</span>
                    </div>
                    <div className="flex flex-col rounded bg-slate-900/80 p-1 text-center border border-slate-800">
                      <span className="text-slate-400">HELANG</span>
                      <span className="font-bold text-rose-400">T+14m</span>
                    </div>
                    <div className="flex flex-col rounded bg-slate-900/80 p-1 text-center border border-slate-800">
                      <span className="text-slate-400">CONFLUENCE</span>
                      <span className="font-bold text-rose-300">T+{effectiveLeadMin}m</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-lg border border-amber-500/50 bg-slate-950/90 p-1 shadow-xl backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setLeadTimeOpen(true)}
                    className="flex items-center gap-2 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-slate-900 transition cursor-pointer"
                  >
                    <Timer className="h-3.5 w-3.5 animate-pulse text-amber-400" />
                    <span>LEAD TIME: T - {String(displayMin).padStart(2, "0")}:{String(displaySec).padStart(2, "0")}</span>
                    <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeadTimeDock(false)}
                    className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    title="Hide Lead-Time Dock"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Floating Re-Open Button when Lead Time Dock is hidden */}
          {!showLeadTimeDock && (
            <button
              type="button"
              onClick={() => {
                setShowLeadTimeDock(true);
                setLeadTimeOpen(true);
              }}
              className="absolute bottom-4 right-3 z-20 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-amber-300 hover:border-amber-500/50 shadow-lg backdrop-blur transition cursor-pointer"
              title="Show Lead-Time Dock"
            >
              <Timer className="h-3.5 w-3.5 text-amber-400" />
              <span>LEAD-TIME</span>
            </button>
          )}
        </>
      )}

      {/* ---------------- GEOTECHNICAL VALLEY CROSS-SECTION PROFILER MODAL ---------------- */}
      <ValleyCrossSectionModal
        isOpen={crossSectionOpen}
        onClose={() => setCrossSectionOpen(false)}
        defaultLocationId={crossSectionLocId}
        activeScenario={activeState}
      />

      {/* ---------------- VERIFIED MULTI-API GROUND-TRUTH MODAL ---------------- */}
      <VerifiedDataFeedModal
        isOpen={verifiedModalOpen}
        onClose={() => setVerifiedModalOpen(false)}
        data={verifiedApiData}
      />
    </div>
  );
}

export default TacticalTerrain3D;
