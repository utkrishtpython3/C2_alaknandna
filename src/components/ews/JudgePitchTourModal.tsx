"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Server,
  Droplets,
  Video,
  Radio,
  Mountain,
  CheckCircle2,
  ChevronRight,
  FileText,
} from "lucide-react";
import type { ScenarioId } from "@/lib/hydrologyEngine";

interface JudgePitchTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScenario: (scenario: ScenarioId) => void;
  onOpenNebiusHpc: () => void;
  onOpenRheologyLab: () => void;
  onOpenVoiceBroadcast: () => void;
  onStartDroneTour: () => void;
  onOpenSitrep: () => void;
}

interface TourStep {
  stepNumber: number;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  scenarioToTrigger?: ScenarioId;
  problemStatement: string;
  innovationSolution: string;
  judgeTakeaways: string[];
  actionLabel?: string;
  actionIcon?: any;
  actionHandler?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    stepNumber: 1,
    badge: "1. THE PROBLEM & OPERATIONAL CRISIS",
    badgeClass: "border-rose-500/50 bg-rose-950/40 text-rose-300",
    title: "The Fatal 15-Minute Evacuation Window in Steep Gorges",
    subtitle: "2021 Chamoli GLOF Disaster Re-enactment & High-Gradient Hazard",
    scenarioToTrigger: "glof",
    problemStatement:
      "When hanging glaciers or cloudbursts breach in the high Himalayas, torrents transform into hyper-concentrated debris slurries traveling at over 6.8 m/s. Traditional 1D routing misses 2D valley inundation, while conventional 2D CFD solvers take hours to compute—missing the 15-minute evacuation window entirely.",
    innovationSolution:
      "Alaknanda C2 couples physics-ML surrogate models with WebGL2 GPGPU advection to deliver sub-second 2D inundation depth and velocity forecasts directly to disaster commanders.",
    judgeTakeaways: [
      "2021 Chamoli benchmark scenario automatically loaded with 384.9 m³/s bulked discharge.",
      "Negative evacuation lead-time margin (-3 min deficit at Tapovan) clearly visualized.",
      "High-gradient terrain (mean slope 38.4°) renders traditional flood zoning obsolete.",
    ],
  },
  {
    stepNumber: 2,
    badge: "2. NVIDIA MODULUS & NEBIUS AI CLOUD",
    badgeClass: "border-emerald-500/50 bg-emerald-950/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]",
    title: "NVIDIA Modulus PINN & TensorRT 10 on Nebius 8x H100",
    subtitle: "Sub-3.8 ms P99 Latency (260x Faster than Real-Time Hydrodynamics)",
    problemStatement:
      "Standard Navier-Stokes and Shallow Water finite volume solvers require high-end multi-core nodes running overnight, making real-time evacuation steering during an active cloudburst impossible.",
    innovationSolution:
      "Physics-Informed Neural Network (PINN) trained with NVIDIA Modulus solving 2D Saint-Venant mass & momentum conservation. Exported via TensorRT 10 FP16/FP8 and served on Nebius AI Cloud with dynamic batching on Triton Inference Server.",
    judgeTakeaways: [
      "Inference time drops from 118 ms (CPU baseline) to 3.78 ms on Nebius H100 SXM5.",
      "Zero-latency multi-ward cascade routing over InfiniBand NDR 400 Gbps fabric.",
      "Fully documented Nsight Systems trace & Slurm cluster deployment files.",
    ],
    actionLabel: "Launch Nebius HPC & TensorRT HUD",
    actionIcon: Server,
    actionHandler: "nebius",
  },
  {
    stepNumber: 3,
    badge: "3. COUPLED NON-NEWTONIAN RHEOLOGY",
    badgeClass: "border-purple-500/50 bg-purple-950/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]",
    title: "Coupled Green-Ampt Suction & Takahashi Debris Bulking",
    subtitle: "Non-Newtonian Bingham Plastic Yield Stress (2.10x Surge Multiplier)",
    problemStatement:
      "Floods in the Himalayas are not clear water; they entrain boulders, gravel, and silt. Ignoring sediment rheology underestimates peak flood crest by over 200%, leading to catastrophic barrage inundation.",
    innovationSolution:
      "Couples Green-Ampt unsaturated soil matrix suction to dynamic Takahashi sediment entrainment (α = 0.35). Evaluates Mohr-Coulomb yield stress (τ_y) and Krieger-Dougherty slurry viscosity (μ_m), accurately predicting the 2.10x bulked discharge.",
    judgeTakeaways: [
      "Interactive Rheology Lab with live Bingham stress-strain and bulking curves.",
      "Clear distinction between solid plug-flow regime and shear deformation.",
      "Direct integration between soil saturation and surge volume amplification.",
    ],
    actionLabel: "Open Non-Newtonian Rheology Lab",
    actionIcon: Droplets,
    actionHandler: "rheology",
  },
  {
    stepNumber: 4,
    badge: "4. TACTICAL 3D DIGITAL TWIN & FLUID SOLVER",
    badgeClass: "border-cyan-500/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]",
    title: "WebGL2 Multi-Pass Ping-Pong FBO Fluid Solver & Drone Recon",
    subtitle: "3D MapLibre Elevation Mesh, Dynamic Wavefront Scrubber & Sentry Cam",
    problemStatement:
      "Commanders in disaster operation centers need spatial situational awareness with accurate topographical context, not flat static 2D maps with delayed updates.",
    innovationSolution:
      "Industrial-grade client-side WebGL2 ping-pong FBO hydrodynamic solver running at 60 FPS on 10m Terrain-RGB DEM, coupled with 360° drone recon flythrough and 4D surge wavefront scrubber.",
    judgeTakeaways: [
      "Real-time hydraulic head advection with non-Newtonian sediment color grading.",
      "Automated drone recon flythrough across Tapovan, Joshimath, and Vishnuprayag.",
      "Geotechnical valley cross-section profile revealing safe uphill elevation horizons.",
    ],
    actionLabel: "Start Aerial Drone Recon Flyover",
    actionIcon: Video,
    actionHandler: "drone",
  },
  {
    stepNumber: 5,
    badge: "5. ZERO-TELECOM CIVIL PROTECTION & MESH",
    badgeClass: "border-amber-500/50 bg-amber-950/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    title: "Tactical LoRaWAN Mesh, OASIS CAP & Garhwali Voice Sirens",
    subtitle: "Zero-Telecom Blackout Resilient Lifeline Protocol (865–867 MHz)",
    problemStatement:
      "During Himalayan cloudbursts, cellular towers and fiber optic backbones are severed within minutes, isolating mountain hamlets from evacuation directives.",
    innovationSolution:
      "Custom 32-byte & 48-byte binary LoRa SX1262 bit-packing with CRC16-CCITT broadcasting through offline mountain relay hops, coupled with multilingual OASIS CAP alerts in English, हिन्दी SMS, and गढ़वाली VHF megaphone sirens.",
    judgeTakeaways: [
      "Hardware-level binary bit-packing verified with zero telecom dependencies.",
      "Official printable NDRF Commandant Situation Report (SITREP) PDF generation.",
      "Authentic synthesized Garhwali & Hindi megaphone siren broadcast with radio audio.",
    ],
    actionLabel: "Test Garhwali Megaphone Voice Siren",
    actionIcon: Radio,
    actionHandler: "voice",
  },
];

export function JudgePitchTourModal({
  isOpen,
  onClose,
  onApplyScenario,
  onOpenNebiusHpc,
  onOpenRheologyLab,
  onOpenVoiceBroadcast,
  onStartDroneTour,
  onOpenSitrep,
}: JudgePitchTourModalProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [countdownSec, setCountdownSec] = useState(12);

  const step = TOUR_STEPS[currentStepIdx];

  const lastTriggeredStepRef = useRef<number | null>(null);

  // Auto-trigger the scenario for this step exactly once per step navigation
  useEffect(() => {
    if (!isOpen) {
      lastTriggeredStepRef.current = null;
      return;
    }
    if (step.scenarioToTrigger && lastTriggeredStepRef.current !== currentStepIdx) {
      lastTriggeredStepRef.current = currentStepIdx;
      onApplyScenario(step.scenarioToTrigger);
    }
  }, [isOpen, currentStepIdx, step.scenarioToTrigger, onApplyScenario]);

  // Auto-advance timer
  useEffect(() => {
    if (!isOpen || !autoAdvance) return;
    const interval = setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          setCurrentStepIdx((idx) => (idx + 1) % TOUR_STEPS.length);
          return 12;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoAdvance, currentStepIdx]);

  const handleNext = () => {
    setCurrentStepIdx((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1));
    setCountdownSec(12);
  };

  const handlePrev = () => {
    setCurrentStepIdx((prev) => Math.max(0, prev - 1));
    setCountdownSec(12);
  };

  const handleTriggerAction = () => {
    onClose();
    if (step.actionHandler === "nebius") onOpenNebiusHpc();
    else if (step.actionHandler === "rheology") onOpenRheologyLab();
    else if (step.actionHandler === "drone") onStartDroneTour();
    else if (step.actionHandler === "voice") onOpenVoiceBroadcast();
    else if (step.actionHandler === "sitrep") onOpenSitrep();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl border border-amber-500/60 bg-slate-950 shadow-[0_0_60px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30 overflow-hidden font-sans">
        
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-950/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.35)]">
              <Zap className="h-5 w-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 tactical-font tracking-wide">
                  60-Second Tactical Mission Briefing &bull; System Architecture
                </h3>
                <span className="rounded bg-amber-950/80 px-2 py-0.5 text-[9.5px] font-mono font-bold text-amber-300 border border-amber-700/60">
                  STEP {step.stepNumber} OF {TOUR_STEPS.length}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Architectural walkthrough of the 5 core operational engineering pillars
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-Advance Toggle */}
            <button
              type="button"
              onClick={() => setAutoAdvance(!autoAdvance)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition cursor-pointer ${
                autoAdvance
                  ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
              title="Auto-advance through briefing slides"
            >
              {autoAdvance ? (
                <>
                  <Pause className="h-3 w-3 text-emerald-400" />
                  <span>Auto ({countdownSec}s)</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  <span>Auto-Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
              title="Close Mission Briefing"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Step Progression Tabs */}
          <div className="grid grid-cols-5 gap-1.5">
            {TOUR_STEPS.map((s, idx) => {
              const isCurrent = idx === currentStepIdx;
              const isPast = idx < currentStepIdx;
              return (
                <button
                  key={s.stepNumber}
                  type="button"
                  onClick={() => {
                    setCurrentStepIdx(idx);
                    setCountdownSec(12);
                  }}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                      : isPast
                      ? "bg-slate-600 hover:bg-slate-500"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                  title={`Jump to Step ${s.stepNumber}: ${s.title}`}
                />
              );
            })}
          </div>

          {/* Current Step Hero Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded px-2.5 py-0.5 text-[10px] font-mono font-bold border ${step.badgeClass}`}>
                {step.badge}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Pillar {step.stepNumber} / 5
              </span>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-50 tactical-font leading-snug">
                {step.title}
              </h2>
              <p className="text-xs font-mono text-amber-300 mt-0.5">
                {step.subtitle}
              </p>
            </div>

            {/* Problem vs Solution Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3.5 space-y-1.5">
                <div className="text-[10.5px] font-mono font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Operational Challenge:
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {step.problemStatement}
                </p>
              </div>

              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3.5 space-y-1.5">
                <div className="text-[10.5px] font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Engineering Breakthrough:
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {step.innovationSolution}
                </p>
              </div>
            </div>

            {/* Core Operational Proofs Bullet Points */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3.5 space-y-2 mt-2">
              <div className="text-[10.5px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Core Operational &amp; Engineering Proofs:
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {step.judgeTakeaways.map((point, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Tool Trigger Button */}
            {step.actionLabel && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTriggerAction}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/80 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition cursor-pointer w-full sm:w-auto"
                >
                  {step.actionIcon && <step.actionIcon className="h-4 w-4 text-amber-400" />}
                  <span>{step.actionLabel}</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-auto sm:ml-0" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStepIdx === 0}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              currentStepIdx === 0
                ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Slide {currentStepIdx + 1} of {TOUR_STEPS.length}</span>
          </div>

          {currentStepIdx < TOUR_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500 bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)] transition cursor-pointer"
            >
              <span>Next Pillar</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-950" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)] transition cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-950" />
              <span>Complete Tour</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default JudgePitchTourModal;
