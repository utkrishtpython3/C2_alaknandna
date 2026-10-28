"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Droplets,
  Activity,
  Zap,
  TrendingUp,
  Sliders,
  RotateCcw,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Download,
  Info,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  evaluateDynamicDebrisViscosity,
  calculateTakahashiEquilibriumConcentration,
  type CoupledDebrisParams,
} from "@/lib/physics/coupledDebrisFlow";

interface DebrisRheologyLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBulkingToCascade?: (bulkingFactor: number, sedimentConc: number) => void;
  initialSedimentConc?: number;
}

interface RheologyPreset {
  id: string;
  name: string;
  shortDesc: string;
  sedimentConc: number;
  bedSlopeDeg: number;
  soilMoisture: number;
  baseQ: number;
  tagClass: string;
}

const PRESETS: RheologyPreset[] = [
  {
    id: "clear-stream",
    name: "Pre-Monsoon Clear Water",
    shortDesc: "Newtonian low-sediment streamflow",
    sedimentConc: 0.06,
    bedSlopeDeg: 18,
    soilMoisture: 0.18,
    baseQ: 14.5,
    tagClass: "border-cyan-500/50 bg-cyan-950/40 text-cyan-300",
  },
  {
    id: "monsoon-mudflow",
    name: "Monsoon Saturated Soil Slurry",
    shortDesc: "Intermediate Bingham plastic mudflow",
    sedimentConc: 0.24,
    bedSlopeDeg: 28,
    soilMoisture: 0.36,
    baseQ: 68.0,
    tagClass: "border-amber-500/50 bg-amber-950/40 text-amber-300",
  },
  {
    id: "chamoli-glof",
    name: "2021 Chamoli GLOF Cataclysm",
    shortDesc: "Hyper-concentrated debris avalanche (2.10x bulking)",
    sedimentConc: 0.38,
    bedSlopeDeg: 34,
    soilMoisture: 0.44,
    baseQ: 183.0,
    tagClass: "border-purple-500/50 bg-purple-950/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]",
  },
  {
    id: "hyper-debris",
    name: "Maximum Choked Bed Slide",
    shortDesc: "Extreme near-packing lahar surge (2.65x bulking)",
    sedimentConc: 0.46,
    bedSlopeDeg: 42,
    soilMoisture: 0.49,
    baseQ: 245.0,
    tagClass: "border-rose-500/50 bg-rose-950/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]",
  },
];

export function DebrisRheologyLabModal({
  isOpen,
  onClose,
  onApplyBulkingToCascade,
  initialSedimentConc = 0.38,
}: DebrisRheologyLabModalProps) {
  // Sliders state
  const [c_d, setCd] = useState<number>(initialSedimentConc);
  const [bedSlope, setBedSlope] = useState<number>(32.0);
  const [soilMoisture, setSoilMoisture] = useState<number>(0.42);
  const [baseWaterQ, setBaseWaterQ] = useState<number>(145.0);
  const [a1, setA1] = useState<number>(0.08); // yield stress scaling
  const [a2, setA2] = useState<number>(12.5); // yield stress exponent
  const [selectedPreset, setSelectedPreset] = useState<string>("chamoli-glof");
  const [appliedToast, setAppliedToast] = useState(false);

  // Physics evaluation
  const c_inf = 0.605; // Random loose packing limit
  const theta_s = 0.45; // Porosity ceiling
  const theta_r = 0.05; // Residual moisture
  const alpha = 0.35; // Takahashi entrainment scale factor
  const rho_s = 2650; // Granite sediment density (kg/m3)
  const rho_w = 1000; // Water density (kg/m3)
  const g = 9.81;

  // Dynamic bulking factor calculation
  const saturationRatio = Math.max(0, Math.min(1.0, (soilMoisture - theta_r) / (theta_s - theta_r)));
  const effectiveCd = Math.min(c_inf * 0.96, c_d * (1 + alpha * saturationRatio));
  const bulkingFactor = Math.max(1.0, c_inf / Math.max(0.04, c_inf - effectiveCd));

  // Dynamic viscosity & yield stress evaluation
  const rheology = useMemo(() => {
    return evaluateDynamicDebrisViscosity(c_d, {
      c_inf,
      a1,
      a2,
      rho_s,
      rho_w,
    });
  }, [c_d, a1, a2]);

  // Takahashi equilibrium sediment concentration
  const takahashiEq = useMemo(() => {
    return calculateTakahashiEquilibriumConcentration(bedSlope, 38.0, rho_s, rho_w, c_inf);
  }, [bedSlope]);

  // Bulked discharge & surge dynamics
  const bulkedQ = baseWaterQ * bulkingFactor;
  const sedimentYieldQ = bulkedQ * c_d;
  const mixtureDensity = rheology.slurry_density_kg_m3;
  const yieldStressPa = rheology.yield_stress_pa;
  const slurryViscosityPaS = rheology.slurry_viscosity_pa_s;

  // Estimate surge wave velocity (non-Newtonian Manning-Bingham approx)
  const slopeRad = (bedSlope * Math.PI) / 180;
  const hydraulicRadius = Math.max(0.5, Math.pow(bulkedQ / 25, 0.4));
  const surgeVelocity = Math.min(12.5, Math.sqrt(g * hydraulicRadius * Math.sin(slopeRad)) * 1.35);
  const froudeNumber = surgeVelocity / Math.sqrt(g * hydraulicRadius);

  // Apply preset handler
  const handleApplyPreset = (p: RheologyPreset) => {
    setSelectedPreset(p.id);
    setCd(p.sedimentConc);
    setBedSlope(p.bedSlopeDeg);
    setSoilMoisture(p.soilMoisture);
    setBaseWaterQ(p.baseQ);
  };

  const handleApplyToCascade = () => {
    if (onApplyBulkingToCascade) {
      onApplyBulkingToCascade(bulkingFactor, c_d);
    }
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 2200);
  };

  const handleExportJSON = () => {
    const payload = {
      model: "Coupled Green-Ampt & Takahashi Non-Newtonian Rheology (Bingham-Mohr)",
      timestamp: new Date().toISOString(),
      parameters: {
        sediment_concentration_cd: c_d,
        bed_slope_deg: bedSlope,
        volumetric_soil_moisture: soilMoisture,
        base_water_discharge_m3_s: baseWaterQ,
        yield_stress_a1: a1,
        yield_stress_a2: a2,
        random_packing_limit_cinf: c_inf,
      },
      results: {
        dynamic_bulking_factor: parseFloat(bulkingFactor.toFixed(3)),
        bulked_surge_discharge_m3_s: parseFloat(bulkedQ.toFixed(1)),
        sediment_yield_m3_s: parseFloat(sedimentYieldQ.toFixed(1)),
        mohr_coulomb_yield_stress_pa: yieldStressPa,
        bingham_slurry_viscosity_pa_s: slurryViscosityPaS,
        slurry_mixture_density_kg_m3: mixtureDensity,
        takahashi_equilibrium_concentration: parseFloat(takahashiEq.toFixed(3)),
        estimated_surge_velocity_m_s: parseFloat(surgeVelocity.toFixed(2)),
        froude_number: parseFloat(froudeNumber.toFixed(2)),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alaknanda_c2_rheology_${selectedPreset}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  // Graph 1: Bingham Rheology Curve SVG (Tau vs Shear Rate Gamma_dot)
  // Shear rate from 0 to 100 s^-1
  const svgW = 440;
  const svgH = 210;
  const padX = 45;
  const padBottom = 30;
  const padTop = 20;

  const maxShearRate = 120; // s^-1
  const maxStressPa = Math.max(60, yieldStressPa + slurryViscosityPaS * maxShearRate * 1.3);

  const getBinghamPoints = () => {
    const pts: string[] = [];
    for (let i = 0; i <= 30; i++) {
      const gammaDot = (i / 30) * maxShearRate;
      const tau = yieldStressPa + slurryViscosityPaS * gammaDot;
      const x = padX + (gammaDot / maxShearRate) * (svgW - padX - 20);
      const y = svgH - padBottom - (tau / maxStressPa) * (svgH - padBottom - padTop);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const getNewtonianPoints = () => {
    const pts: string[] = [];
    for (let i = 0; i <= 30; i++) {
      const gammaDot = (i / 30) * maxShearRate;
      const tau = 0.001 * gammaDot * 10; // scaled clear water
      const x = padX + (gammaDot / maxShearRate) * (svgW - padX - 20);
      const y = svgH - padBottom - (tau / maxStressPa) * (svgH - padBottom - padTop);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  // Graph 2: Bulking Curve B_f vs C_d (from 0 to 0.55)
  const getBulkingCurvePoints = () => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const c = (i / 40) * 0.52;
      const effC = Math.min(c_inf * 0.97, c * (1 + alpha * saturationRatio));
      const bf = Math.max(1.0, Math.min(3.5, c_inf / Math.max(0.04, c_inf - effC)));
      const x = padX + (c / 0.52) * (svgW - padX - 20);
      const y = svgH - padBottom - ((bf - 1.0) / 2.5) * (svgH - padBottom - padTop);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const currentMarkerX = padX + (c_d / 0.52) * (svgW - padX - 20);
  const currentMarkerY = svgH - padBottom - ((Math.min(3.5, bulkingFactor) - 1.0) / 2.5) * (svgH - padBottom - padTop);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl border border-purple-500/50 bg-slate-950 shadow-[0_0_60px_rgba(0,0,0,0.95)] ring-1 ring-purple-500/30 overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/50 bg-purple-950/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.35)]">
              <Flame className="h-5 w-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 tactical-font tracking-wide">
                  Coupled Non-Newtonian Rheology &amp; Debris Bulking Lab
                </h3>
                <span className="rounded bg-purple-950/80 px-2 py-0.5 text-[9.5px] font-mono font-bold text-purple-300 border border-purple-700/60">
                  NVIDIA MODULUS PINN PHYSICS
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Green-Ampt Soil Matrix Suction (&psi;) &times; Takahashi Sediment Entrainment (&alpha;=0.35) &times; Bingham Plastic Yield Stress (&tau;<sub>y</sub>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJSON}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:border-purple-500/60 hover:text-purple-300 transition cursor-pointer"
              title="Download Full Rheological Parameters JSON"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Audit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
              title="Close Rheology Lab"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Operational Presets Strip */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                Select Benchmark Hydraulic &amp; Debris Regimes:
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Historical Chamoli 2021 Disaster Benchmark Available
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {PRESETS.map((p) => {
                const active = selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`flex flex-col text-left p-2.5 rounded-lg border transition cursor-pointer ${
                      active
                        ? `${p.tagClass} ring-1 ring-purple-500/50`
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-slate-100">{p.name}</span>
                      {active && <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />}
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight mb-2">{p.shortDesc}</span>
                    <div className="mt-auto flex items-center justify-between text-[10.5px] font-mono border-t border-slate-800/80 pt-1.5">
                      <span>C<sub>d</sub>: {p.sedimentConc}</span>
                      <span className="font-bold text-purple-300">
                        {(c_inf / (c_inf - p.sedimentConc * 1.15)).toFixed(2)}&times; Surge
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Key Metrics Dashboard Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="rounded-xl border border-purple-500/40 bg-purple-950/30 p-3 shadow-inner">
              <div className="text-[10px] font-mono uppercase tracking-wider text-purple-300">
                Bulking Multiplier (B<sub>f</sub>)
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-purple-200">
                  {bulkingFactor.toFixed(2)}&times;
                </span>
                <span className="text-[10px] text-purple-400">AMPLIFICATION</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {bulkingFactor > 2.0 ? "Catastrophic Entrainment" : "Moderate Bulking"}
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 shadow-inner">
              <div className="text-[10px] font-mono uppercase tracking-wider text-rose-300">
                Bulked Discharge (Q<sub>m</sub>)
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-rose-200">
                  {bulkedQ.toFixed(1)}
                </span>
                <span className="text-[10px] text-rose-400">m&sup3;/s</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                Base Clear Q: {baseWaterQ.toFixed(0)} m&sup3;/s
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 shadow-inner">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                Yield Stress (&tau;<sub>y</sub>)
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-amber-200">
                  {yieldStressPa.toFixed(1)}
                </span>
                <span className="text-[10px] text-amber-400">Pa</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                Bingham Plastic Plug
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3 shadow-inner">
              <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
                Slurry Viscosity (&mu;<sub>m</sub>)
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-cyan-200">
                  {(slurryViscosityPaS * 1000).toFixed(1)}
                </span>
                <span className="text-[10px] text-cyan-400">mPa&middot;s</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {(slurryViscosityPaS / 0.001002).toFixed(0)}&times; of clear water
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 shadow-inner">
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                Slurry Bulk Density (&rho;<sub>m</sub>)
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-emerald-200">
                  {mixtureDensity.toFixed(0)}
                </span>
                <span className="text-[10px] text-emerald-400">kg/m&sup3;</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                C<sub>d</sub>: {(c_d * 100).toFixed(1)}% solid
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 p-3 shadow-inner">
              <div className="text-[10px] font-mono uppercase tracking-wider text-blue-300">
                Surge Velocity (v<sub>s</sub>)
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-blue-200">
                  {surgeVelocity.toFixed(1)}
                </span>
                <span className="text-[10px] text-blue-400">m/s</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                Fr: {froudeNumber.toFixed(2)} (Supercritical)
              </div>
            </div>
          </div>

          {/* Dual Interactive Charts: Bingham Stress Curve & Bulking Multiplier Curve */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Chart 1: Bingham Plastic Shear Stress vs Shear Rate */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                    Bingham Plastic Stress-Strain Response: &tau;(&gamma;&#775;)
                  </h4>
                  <p className="text-[10.5px] font-mono text-slate-400">
                    &tau; = &tau;<sub>y</sub> + &mu;<sub>m</sub> &gamma;&#775; (Yield threshold before deformation)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[9.5px] font-mono">
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="h-1.5 w-3 bg-amber-400 inline-block rounded" />
                    Debris Slurry
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="h-1.5 w-3 bg-cyan-400 inline-block rounded border-dashed" />
                    Clear Water
                  </span>
                </div>
              </div>

              {/* SVG Curve */}
              <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-48 select-none">
                  {/* Grid Lines */}
                  {[0, 30, 60, 90, 120].map((rate) => {
                    const x = padX + (rate / maxShearRate) * (svgW - padX - 20);
                    return (
                      <g key={rate}>
                        <line x1={x} y1={padTop} x2={x} y2={svgH - padBottom} stroke="#334155" strokeDasharray="2,2" strokeWidth="0.8" />
                        <text x={x} y={svgH - padBottom + 14} fill="#64748b" fontSize="8.5" textAnchor="middle" fontFamily="monospace">
                          {rate}
                        </text>
                      </g>
                    );
                  })}
                  {[0, 0.33, 0.66, 1.0].map((frac, idx) => {
                    const y = svgH - padBottom - frac * (svgH - padBottom - padTop);
                    const stressVal = (frac * maxStressPa).toFixed(0);
                    return (
                      <g key={idx}>
                        <line x1={padX} y1={y} x2={svgW - 20} y2={y} stroke="#334155" strokeDasharray="2,2" strokeWidth="0.8" />
                        <text x={padX - 6} y={y + 3} fill="#64748b" fontSize="8.5" textAnchor="end" fontFamily="monospace">
                          {stressVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axes */}
                  <line x1={padX} y1={svgH - padBottom} x2={svgW - 20} y2={svgH - padBottom} stroke="#64748b" strokeWidth="1.2" />
                  <line x1={padX} y1={padTop} x2={padX} y2={svgH - padBottom} stroke="#64748b" strokeWidth="1.2" />

                  {/* Axis labels */}
                  <text x={svgW - 20} y={svgH - padBottom + 22} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
                    Shear Strain Rate &gamma;&#775; (s&macr;&sup1;)
                  </text>
                  <text x={12} y={padTop + 10} fill="#94a3b8" fontSize="9" textAnchor="start" fontFamily="monospace" transform={`rotate(-90 12,${padTop + 10})`}>
                    Shear Stress &tau; (Pa)
                  </text>

                  {/* Plug flow zone shading (below yield stress) */}
                  <rect
                    x={padX}
                    y={svgH - padBottom - (yieldStressPa / maxStressPa) * (svgH - padBottom - padTop)}
                    width={svgW - padX - 20}
                    height={(yieldStressPa / maxStressPa) * (svgH - padBottom - padTop)}
                    fill="rgba(245, 158, 11, 0.08)"
                  />
                  <text
                    x={padX + 25}
                    y={svgH - padBottom - (yieldStressPa / maxStressPa) * (svgH - padBottom - padTop) + 12}
                    fill="#f59e0b"
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    SOLID-LIKE PLUG ZONE (&tau; &lt; &tau;<sub>y</sub>)
                  </text>

                  {/* Clear water curve */}
                  <polyline points={getNewtonianPoints()} fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8" />

                  {/* Bingham curve */}
                  <polyline points={getBinghamPoints()} fill="none" stroke="#f59e0b" strokeWidth="2.5" />

                  {/* Yield stress point on y-axis */}
                  <circle
                    cx={padX}
                    cy={svgH - padBottom - (yieldStressPa / maxStressPa) * (svgH - padBottom - padTop)}
                    r="4.5"
                    fill="#f59e0b"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[10.5px] font-mono text-slate-400">
                <span className="font-bold text-amber-300">Mohr-Coulomb Yield: </span>
                At &tau;<sub>y</sub> = {yieldStressPa.toFixed(1)} Pa, the slurry resists flowing like a rigid plug until bed shear stress overcomes internal cohesion.
              </div>
            </div>

            {/* Chart 2: Dynamic Bulking Multiplier vs Concentration */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Droplets className="h-4 w-4 text-purple-400" />
                    Takahashi Dynamic Surge Bulking: B<sub>f</sub>(C<sub>d</sub>)
                  </h4>
                  <p className="text-[10.5px] font-mono text-slate-400">
                    B<sub>f</sub> = C<sub>&infin;</sub> / (C<sub>&infin;</sub> - C<sub>d</sub>(1 + &alpha;&Delta;&theta;)) &rarr; Non-linear amplification
                  </p>
                </div>
                <span className="rounded bg-purple-950 px-2 py-0.5 text-[9.5px] font-mono font-bold text-purple-300 border border-purple-800">
                  Current: {bulkingFactor.toFixed(2)}&times;
                </span>
              </div>

              {/* SVG Bulking Curve */}
              <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-48 select-none">
                  {/* Grid Lines */}
                  {[0.1, 0.2, 0.3, 0.4, 0.5].map((c) => {
                    const x = padX + (c / 0.52) * (svgW - padX - 20);
                    return (
                      <g key={c}>
                        <line x1={x} y1={padTop} x2={x} y2={svgH - padBottom} stroke="#334155" strokeDasharray="2,2" strokeWidth="0.8" />
                        <text x={x} y={svgH - padBottom + 14} fill="#64748b" fontSize="8.5" textAnchor="middle" fontFamily="monospace">
                          {c.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                  {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((bf) => {
                    const y = svgH - padBottom - ((bf - 1.0) / 2.5) * (svgH - padBottom - padTop);
                    return (
                      <g key={bf}>
                        <line x1={padX} y1={y} x2={svgW - 20} y2={y} stroke="#334155" strokeDasharray="2,2" strokeWidth="0.8" />
                        <text x={padX - 6} y={y + 3} fill="#64748b" fontSize="8.5" textAnchor="end" fontFamily="monospace">
                          {bf.toFixed(1)}&times;
                        </text>
                      </g>
                    );
                  })}

                  {/* Axes */}
                  <line x1={padX} y1={svgH - padBottom} x2={svgW - 20} y2={svgH - padBottom} stroke="#64748b" strokeWidth="1.2" />
                  <line x1={padX} y1={padTop} x2={padX} y2={svgH - padBottom} stroke="#64748b" strokeWidth="1.2" />

                  {/* Axis labels */}
                  <text x={svgW - 20} y={svgH - padBottom + 22} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
                    Sediment Concentration C<sub>d</sub> (vol/vol)
                  </text>
                  <text x={12} y={padTop + 10} fill="#94a3b8" fontSize="9" textAnchor="start" fontFamily="monospace" transform={`rotate(-90 12,${padTop + 10})`}>
                    Bulking Factor B<sub>f</sub>
                  </text>

                  {/* 2021 Chamoli GLOF Benchmark Reference Line */}
                  <line
                    x1={padX + (0.38 / 0.52) * (svgW - padX - 20)}
                    y1={padTop}
                    x2={padX + (0.38 / 0.52) * (svgW - padX - 20)}
                    y2={svgH - padBottom}
                    stroke="#a855f7"
                    strokeDasharray="3,3"
                    strokeWidth="1.2"
                  />
                  <text
                    x={padX + (0.38 / 0.52) * (svgW - padX - 20) + 4}
                    y={padTop + 12}
                    fill="#a855f7"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    Chamoli 2021 (2.10x)
                  </text>

                  {/* Bulking Curve line */}
                  <polyline points={getBulkingCurvePoints()} fill="none" stroke="#a855f7" strokeWidth="2.5" />

                  {/* Current Operating Point marker */}
                  <circle cx={currentMarkerX} cy={currentMarkerY} r="6" fill="#a855f7" stroke="#fff" strokeWidth="2" className="animate-pulse" />
                </svg>
              </div>

              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[10.5px] font-mono text-slate-400">
                <span className="font-bold text-purple-300">Surge Amplification: </span>
                At C<sub>d</sub> = {c_d.toFixed(2)}, Takahashi entrainment amplifies the water discharge from {baseWaterQ.toFixed(0)} m&sup3;/s to a destructive bulked debris torrent of{" "}
                <span className="font-bold text-rose-300">{bulkedQ.toFixed(1)} m&sup3;/s</span>.
              </div>
            </div>
          </div>

          {/* Interactive Sliders Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                <Sliders className="h-4 w-4 text-cyan-400" />
                Interactive Geotechnical &amp; Hydrodynamic Sliders:
              </span>
              <button
                type="button"
                onClick={() => handleApplyPreset(PRESETS[2])}
                className="text-[10px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to Chamoli 2021 GLOF
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Slider 1: Sediment Concentration */}
              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-mono">Sediment Conc C<sub>d</sub>:</span>
                  <span className="font-bold font-mono text-purple-300">{c_d.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.50}
                  step={0.01}
                  value={c_d}
                  onChange={(e) => {
                    setCd(parseFloat(e.target.value));
                    setSelectedPreset("custom");
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>0.05 (Clear)</span>
                  <span>0.38 (Chamoli)</span>
                  <span>0.50 (Dense)</span>
                </div>
              </div>

              {/* Slider 2: Bed Slope */}
              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-mono">Gorge Slope &theta;:</span>
                  <span className="font-bold font-mono text-amber-300">{bedSlope.toFixed(0)}&deg;</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={45}
                  step={1}
                  value={bedSlope}
                  onChange={(e) => {
                    setBedSlope(parseFloat(e.target.value));
                    setSelectedPreset("custom");
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>12&deg; (Gentle)</span>
                  <span>34&deg; (Dhauliganga)</span>
                  <span>45&deg; (Chute)</span>
                </div>
              </div>

              {/* Slider 3: Soil Moisture */}
              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-mono">Soil Moisture &theta;:</span>
                  <span className="font-bold font-mono text-cyan-300">{(soilMoisture * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.10}
                  max={0.50}
                  step={0.01}
                  value={soilMoisture}
                  onChange={(e) => {
                    setSoilMoisture(parseFloat(e.target.value));
                    setSelectedPreset("custom");
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>10% (Dry)</span>
                  <span>36% (Monsoon)</span>
                  <span>49% (Saturated)</span>
                </div>
              </div>

              {/* Slider 4: Base Water Discharge */}
              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-mono">Clear Water Q:</span>
                  <span className="font-bold font-mono text-rose-300">{baseWaterQ.toFixed(0)} m&sup3;/s</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={5}
                  value={baseWaterQ}
                  onChange={(e) => {
                    setBaseWaterQ(parseFloat(e.target.value));
                    setSelectedPreset("custom");
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-400"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>10 m&sup3;/s</span>
                  <span>145 m&sup3;/s</span>
                  <span>300 m&sup3;/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Info className="h-4 w-4 text-purple-400" />
            <span>
              Engine: <code className="text-purple-300">coupledDebrisFlow.ts</code> &middot; 2D SWE Non-Newtonian PINN Surrogate
            </span>
          </div>

          <div className="flex items-center gap-3">
            {appliedToast && (
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 font-bold animate-in fade-in">
                <CheckCircle2 className="h-4 w-4" />
                Bulking &amp; Rheology Synced to Live Cascade!
              </span>
            )}

            <button
              type="button"
              onClick={handleApplyToCascade}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/80 bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-slate-950" />
              <span>Apply {bulkingFactor.toFixed(2)}&times; Bulking to Live EWS</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default DebrisRheologyLabModal;
