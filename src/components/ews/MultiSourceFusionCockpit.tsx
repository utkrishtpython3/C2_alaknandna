"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Satellite,
  Radio,
  RadioTower,
  Waves,
  Cpu,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Zap,
  TrendingUp,
  ShieldCheck,
  Compass,
  Gauge,
  CloudRain,
  Eye,
  RefreshCw,
} from "lucide-react";

interface MultiSourceFusionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rainfallTelemetry?: Record<string, number>;
  soilMoistureTelemetry?: Record<string, number>;
}

export function MultiSourceFusionCockpit({
  open,
  onOpenChange,
  rainfallTelemetry = {},
  soilMoistureTelemetry = {},
}: MultiSourceFusionProps) {
  const [activeTab, setActiveTab] = useState<string>("streams");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const avgRain =
    Object.values(rainfallTelemetry).length > 0
      ? (
          Object.values(rainfallTelemetry).reduce((a, b) => a + b, 0) /
          Object.values(rainfallTelemetry).length
        ).toFixed(1)
      : "32.0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-500/50 shadow-lg">
                <Layers className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-50 flex items-center gap-2">
                  Multi-Source Data Ingestion &amp; Sensor Fusion Engine
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                    ● 5/5 Feeds Active
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Real-time multi-spectral sensor assimilation · ISRO-MOSDAC · IMD-DWR · CWC Hydrometry · NWP Ensemble · LoRa Mesh
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
                Resync Feeds
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Top Summary Bar: Fusion Confidence */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-cyan-800/40 bg-cyan-950/20 p-3">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Fusion Consensus</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-cyan-200">98.6%</span>
              <span className="text-[10px] text-emerald-400 font-semibold">High Credibility</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Multi-modal Bayesian agreement</p>
          </div>

          <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">Doppler Reflectivity</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-300">54.2 dBZ</span>
              <span className="text-[10px] text-rose-400 font-semibold">Convective Cell</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">IMD Mukteshwar X-band Radar</p>
          </div>

          <div className="rounded-lg border border-purple-800/40 bg-purple-950/20 p-3">
            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">Satellite Cloud Top</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-purple-300">-64.8°C</span>
              <span className="text-[10px] text-amber-400 font-semibold">Overshooting Top</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">ISRO INSAT-3DR TIR-1 Channel</p>
          </div>

          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Ground In-Situ LoRa</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-300">6/6 Nodes</span>
              <span className="text-[10px] text-emerald-400 font-semibold">0% Loss</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">865MHz SX1262 Tactical Mesh</p>
          </div>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="bg-slate-900 border border-slate-800 p-0.5">
            <TabsTrigger value="streams" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              5 Multi-Source Streams
            </TabsTrigger>
            <TabsTrigger value="fusion" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Bayesian Fusion Matrix
            </TabsTrigger>
            <TabsTrigger value="aiml" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Cpu className="h-3.5 w-3.5 mr-1.5" />
              AI DeepSurge™ Hydro-ML
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: 5 MULTI-SOURCE STREAMS */}
          <TabsContent value="streams" className="space-y-3 mt-3">
            {/* Stream 1: ISRO Satellite */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-purple-500/20 text-purple-300">
                    <Satellite className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Stream 1: ISRO INSAT-3DR &amp; Sentinel-1 SAR Satellite Earth Observation
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Geostationary Imager (74°E) + ESA/ISRO C-band SAR soil backscatter assimilation
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                  ONLINE · 8.2m latency
                </Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9.5px]">CLOUD TOP TEMP (CTT):</span>
                  <span className="text-purple-300 font-bold">-64.8°C (convective)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">SATELLITE QPE:</span>
                  <span className="text-cyan-300 font-bold">38.4 mm/hr (hydro-est)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">SAR SOIL MOISTURE (VV/VH):</span>
                  <span className="text-emerald-300 font-bold">0.428 m³/m³ (86% sat)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">FRAME IDENTIFIER:</span>
                  <span className="text-slate-300">MOSDAC_20260926_0815</span>
                </div>
              </div>
            </div>

            {/* Stream 2: IMD Doppler Weather Radar */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-amber-500/20 text-amber-300">
                    <Radio className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Stream 2: IMD Doppler Weather Radar (DWR) Polarimetric Nowcasting
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      IMD Mukteshwar / Surkanda Devi radar sweep · Volume scan rate 10 min
                    </p>
                  </div>
                </div>
                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]">
                  ECHO DETECTED · 3.5m latency
                </Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9.5px]">MAX REFLECTIVITY (Z):</span>
                  <span className="text-amber-300 font-bold">54.2 dBZ (severe burst)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">RADIAL VELOCITY (Vr):</span>
                  <span className="text-rose-300 font-bold">+18.4 m/s (updraft)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">VERT. LIQUID (VIL):</span>
                  <span className="text-cyan-300 font-bold">46.5 kg/m²</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">STORM CELL DRIFT:</span>
                  <span className="text-slate-300">215° SW @ 24 km/h</span>
                </div>
              </div>
            </div>

            {/* Stream 3: CWC River Hydrometry */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-300">
                    <Waves className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Stream 3: Central Water Commission (CWC) Telemetric River Stage Gauges
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Acoustic &amp; Microwave Radar water level gauges along Alaknanda-Dhauliganga gorges
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                  STREAMING · 1.0m latency
                </Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9.5px]">VISHNUPRAYAG STAGE:</span>
                  <span className="text-cyan-300 font-bold">2.42 m (Warning: 2.80m)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">RATE OF RISE:</span>
                  <span className="text-amber-300 font-bold">+8.4 cm/10 min</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">JOSHIMATH FLANK STAGE:</span>
                  <span className="text-emerald-300 font-bold">1.85 m (Normal)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">BED SHEAR VELOCITY (U*):</span>
                  <span className="text-slate-300">0.42 m/s</span>
                </div>
              </div>
            </div>

            {/* Stream 4: NWP Ensembles */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-blue-500/20 text-blue-300">
                    <CloudRain className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Stream 4: High-Resolution NWP (IMD WRF 3km &amp; ECMWF HRES Assimilation)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Hydro-meteorological forecast models · 24h &amp; 48h convective instability indices
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                  CYCLE 06Z · ASSIMILATED
                </Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9.5px]">CONVECTIVE CAPE:</span>
                  <span className="text-amber-300 font-bold">1,840 J/kg (Very High)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">PRECIPITABLE WATER:</span>
                  <span className="text-cyan-300 font-bold">48.2 mm</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">6-HR QPF FORECAST:</span>
                  <span className="text-purple-300 font-bold">68 – 110 mm</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">MODEL CONFIDENCE:</span>
                  <span className="text-emerald-300 font-bold">89.4% (Ensemble Spread)</span>
                </div>
              </div>
            </div>

            {/* Stream 5: Tactical LoRa Ground Mesh */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-300">
                    <RadioTower className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Stream 5: Resilient IoT LoRa SX1262 Field Transceiver Mesh (UKSDMA / NDRF)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      865–867 MHz off-grid ground truth · Piezometers, TDR soil moisture &amp; tipping buckets
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                  MESH HEALTH: 100%
                </Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9.5px]">ACTIVE MESH NODES:</span>
                  <span className="text-emerald-300 font-bold">6 of 6 Synchronized</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">PORE-WATER PRESSURE:</span>
                  <span className="text-rose-300 font-bold">142 kPa (Near Failure)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">AVG SNR MARGIN:</span>
                  <span className="text-cyan-300 font-bold">+9.4 dB</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">PACKET LOSS:</span>
                  <span className="text-emerald-300 font-bold">0.0% (CRC-16 OK)</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: BAYESIAN FUSION MATRIX */}
          <TabsContent value="fusion" className="space-y-4 mt-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Dynamic Kalman-Bayesian Sensor Weight Allocation
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                When dense mountain cloud-cover impedes satellite infrared sensors, Doppler radar and in-situ piezometers dynamically scale up in weight. When radar beams experience terrain shadowing in steep gorges, the LoRa mesh and SAR backscatter take precedence.
              </p>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">IMD Doppler Weather Radar (Polarimetric Z):</span>
                    <span className="text-amber-300 font-bold">32% Weight</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: "32%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">CWC River Gauges &amp; Stage Radar:</span>
                    <span className="text-cyan-300 font-bold">26% Weight</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: "26%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">ISRO INSAT-3DR QPE &amp; Sentinel-1 SAR:</span>
                    <span className="text-purple-300 font-bold">24% Weight</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: "24%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">Ground IoT LoRa Mesh (Soil TDR + Piezometer):</span>
                    <span className="text-emerald-300 font-bold">12% Weight</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "12%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">IMD WRF / ECMWF NWP Numerical Prior:</span>
                    <span className="text-blue-300 font-bold">6% Weight</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "6%" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Multi-Sensor Congruence &amp; Anomaly Detection
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-semibold mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Radar &amp; In-Situ Cross-Validation
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Auli ridge AWS rainfall rate (34 mm/hr) cross-correlates with DWR Mukteshwar reflectivity (54.2 dBZ) within ±4.2% error tolerance.
                  </p>
                </div>
                <div className="rounded border border-cyan-500/30 bg-cyan-950/20 p-2.5">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Soil Moisture &amp; SAR Saturation
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ground TDR dielectric probe confirms Sentinel-1 SAR C-band saturation state, verifying Green-Ampt infiltration deficit under 6%.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: AI DEEPSURGE HYDRO-ML */}
          <TabsContent value="aiml" className="space-y-4 mt-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-cyan-400" />
                    AI DeepSurge™ — Physics-Informed Neural Network (PINN) Engine
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Hybrid AI surrogate model: 1D Saint-Venant hydraulic conservation law embedded into an LSTM-GCN architecture
                  </p>
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-mono">
                  Inference: 14.2 ms
                </Badge>
              </div>

              {/* Model Performance Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center text-xs mb-4">
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">NASH-SUTCLIFFE (NSE):</span>
                  <span className="text-emerald-400 font-bold text-sm">0.942</span>
                </div>
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">ROOT MEAN SQ. ERROR:</span>
                  <span className="text-cyan-400 font-bold text-sm">3.8 m³/s</span>
                </div>
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CRITICAL SUCCESS INDEX:</span>
                  <span className="text-purple-400 font-bold text-sm">0.910</span>
                </div>
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">EARLY WARNING ADVANTAGE:</span>
                  <span className="text-amber-400 font-bold text-sm">+42 mins</span>
                </div>
              </div>

              {/* Feature Importance (SHAP values) */}
              <h5 className="text-[11px] font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                Key Predictor Feature Importance (SHAP Sensitivity)
              </h5>
              <div className="space-y-2 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Antecedent 7-day Soil Saturation Index:</span>
                    <span className="text-cyan-300 font-bold">34.2%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: "34.2%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">1-hr Radar Reflectivity Peak (dBZ gradient):</span>
                    <span className="text-amber-300 font-bold">28.4%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: "28.4%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Catchment Steepness Gradient (&gt;35° channel slope):</span>
                    <span className="text-rose-300 font-bold">18.6%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: "18.6%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">INSAT-3DR Cloud-Top Rapid Cooling Rate:</span>
                    <span className="text-purple-300 font-bold">11.8%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-full bg-purple-400 rounded-full" style={{ width: "11.8%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">CWC River Gauge Upstream Surge Velocity:</span>
                    <span className="text-emerald-300 font-bold">7.0%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "7.0%" }} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
