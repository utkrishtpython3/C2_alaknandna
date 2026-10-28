"use client";

import { useEffect, useRef, useState } from "react";
import type { RiskLevel } from "@/lib/hydrologyEngine";
import { useAlertSiren } from "@/hooks/useAlertSiren";
import {
  ShieldAlert,
  Volume2,
  VolumeX,
  Timer,
  Waves,
  Radio,
  Siren,
  Clock,
} from "lucide-react";
import { useRealtimeClock } from "@/hooks/useRealtimeClock";

/**
 * TacticalAlertBanner
 * ----------------------------------------------------------------------------
 * Operational early-warning banner with four severity levels mapped to the
 * NDRF / NDMA colour code:
 *
 *   GREEN   (Normal)       — LOW / MODERATE
 *   YELLOW  (Advisory)     — HIGH
 *   ORANGE  (Preparedness) — EXTREME
 *   RED     (Cataclysmic)  — CATACLYSMIC / Imminent Flash Flood
 *
 * When the state is RED (CATACLYSMIC) or ORANGE (EXTREME):
 *  - a pulsating CSS perimeter strobe wraps the banner;
 *  - the Web Audio API klaxon (useAlertSiren) wails;
 *  - an emergency countdown timer ticks down to surge arrival.
 *
 * The siren is driven from this component directly (arm on first user
 * gesture, start/stop on severity change) so the banner is self-contained.
 */

type SeverityCode = "GREEN" | "YELLOW" | "ORANGE" | "RED";

interface TacticalAlertBannerProps {
  alertLevel: RiskLevel;
  /** Surge-arrival lead time at the terminal (Vishnuprayag) basin, minutes. */
  surgeArrivalMin: number;
  /** Cumulative confluence discharge (m³/s) — shown in the status strip. */
  confluenceQ: number;
  /** Cascade timestamp (ISO). */
  timestamp: string;
  /** NDRF deployment directive string. */
  directive: string;
}

const LEVEL_MAP: Record<RiskLevel, SeverityCode> = {
  LOW: "GREEN",
  MODERATE: "GREEN",
  HIGH: "YELLOW",
  EXTREME: "ORANGE",
  CATACLYSMIC: "RED",
};

const SEVERITY_STYLE: Record<
  SeverityCode,
  {
    border: string;
    bg: string;
    text: string;
    label: string;
    stateLabel: string;
    icon: typeof ShieldAlert;
  }
> = {
  GREEN: {
    border: "border-emerald-600/50",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    label: "NORMAL",
    stateLabel: "All clear — routine monitoring",
    icon: ShieldAlert,
  },
  YELLOW: {
    border: "border-amber-500/60",
    bg: "bg-amber-500/12",
    text: "text-amber-300",
    label: "ADVISORY",
    stateLabel: "Flash Flood Watch — heightened surveillance",
    icon: ShieldAlert,
  },
  ORANGE: {
    border: "border-orange-500/70",
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    label: "PREPAREDNESS",
    stateLabel: "Flash Flood Warning — stage NDRF QRT",
    icon: ShieldAlert,
  },
  RED: {
    border: "border-rose-600/80",
    bg: "bg-rose-600/20",
    text: "text-rose-300",
    label: "CATACLYSMIC",
    stateLabel: "Imminent Flash Flood — EVACUATE NOW",
    icon: Siren,
  },
};

export function TacticalAlertBanner({
  alertLevel,
  surgeArrivalMin,
  confluenceQ,
  timestamp,
  directive,
}: TacticalAlertBannerProps) {
  const severity = LEVEL_MAP[alertLevel] ?? "GREEN";
  const style = SEVERITY_STYLE[severity];
  const isRed = severity === "RED";
  const isOrange = severity === "ORANGE";
  const isSevere = isRed || isOrange;

  const siren = useAlertSiren();
  const { arm: armSiren, start: startSiren, stop: stopSiren, toggleMute: toggleSirenMute, muted: sirenMuted } = siren;
  const realtimeClock = useRealtimeClock();

  // Arm the Web Audio context on the first user gesture (autoplay policy).
  useEffect(() => {
    const onGesture = () => armSiren();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [armSiren]);

  // Drive the klaxon from the severity. RED / ORANGE → wail; else silent.
  useEffect(() => {
    if (isSevere && !sirenMuted) {
      startSiren();
    } else {
      stopSiren();
    }
  }, [isSevere, sirenMuted, startSiren, stopSiren]);

  // Listen for external "toggle siren" requests (from the presentation
  // hotkey controller at the page level — the M key).
  useEffect(() => {
    const onToggle = () => toggleSirenMute();
    window.addEventListener("ews:toggle-siren", onToggle);
    return () => window.removeEventListener("ews:toggle-siren", onToggle);
  }, [toggleSirenMute]);

  // Animated countdown timer (seconds) to surge arrival at Vishnuprayag.
  // Seeded lazily inside the interval callback (no synchronous setState in
  // the effect body) to satisfy react-hooks/set-state-in-effect.
  const [countdown, setCountdown] = useState(0);
  const seededRef = useRef(false);
  useEffect(() => {
    seededRef.current = false;
  }, [isSevere, surgeArrivalMin]);
  useEffect(() => {
    const id = setInterval(() => {
      if (!isSevere) {
        setCountdown(0);
        return;
      }
      if (!seededRef.current) {
        seededRef.current = true;
        setCountdown(Math.max(0, Math.round(surgeArrivalMin * 60)));
        return;
      }
      setCountdown((c) => (c <= 0 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isSevere, surgeArrivalMin]);

  const cdMin = Math.floor(countdown / 60);
  const cdSec = countdown % 60;
  const countdownStr = `${cdMin.toString().padStart(2, "0")}:${cdSec
    .toString()
    .padStart(2, "0")}`;

  const Icon = style.icon;
  const strobeClass = isRed
    ? "strobe-red"
    : isOrange
      ? "strobe-amber"
      : "";

  return (
    <div
      className={`relative overflow-hidden rounded-lg border-2 ${style.border} ${style.bg} ${
        isSevere ? strobeClass : ""
      }`}
    >
      {/* Top status strip */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800/60 px-4 py-2.5">
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${style.bg} ${style.text} ${
            isSevere ? strobeClass : ""
          }`}
        >
          <Icon className={`h-5 w-5 ${isSevere ? "animate-pulse" : ""}`} />
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">
              {severity} · {style.label}
            </div>
            <div className="text-sm font-bold leading-tight">
              {style.stateLabel}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              Basin-wide alert — Upper Alaknanda–Dhauliganga
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-900/90 px-2 py-0.5 text-[10.5px] font-mono text-cyan-300 border border-cyan-800/60 shadow-sm">
              <Clock className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span className="font-bold text-cyan-200">{realtimeClock.istTime}</span>
              <span className="text-[9px] text-cyan-400 font-semibold">IST</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">{realtimeClock.utcTime}</span>
              <span className="text-[9px] text-slate-500">UTC</span>
            </span>
          </div>
          <p className="font-mono text-[11px] text-slate-300 mt-0.5">
            SITREP MODEL EPOCH: {timestamp.replace("T", " · ").replace(/\..+Z$/, " UTC")}
          </p>
        </div>

        {/* Siren mute toggle */}
        <button
          type="button"
          onClick={siren.toggleMute}
          aria-label={siren.muted ? "Unmute siren" : "Mute siren"}
          title={
            siren.muted
              ? "Siren muted"
              : siren.armed
                ? "Siren armed"
                : "Click anywhere to arm siren"
          }
          className={`flex h-7 w-7 items-center justify-center rounded-md border text-[10px] transition ${
            siren.muted
              ? "border-slate-700 bg-slate-800 text-slate-500 hover:bg-slate-700"
              : siren.active
                ? `border-rose-500 bg-rose-500/20 text-rose-300 alert-strobe-pulse`
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {siren.muted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-2 px-4 py-2.5 sm:grid-cols-4">
        <Metric
          icon={<Timer className="h-3.5 w-3.5" />}
          label="Surge arrival"
          value={isSevere ? countdownStr : `${Math.round(surgeArrivalMin)} min`}
          tone={isSevere ? "rose" : "slate"}
          mono
        />
        <Metric
          icon={<Waves className="h-3.5 w-3.5" />}
          label="Confluence Q"
          value={`${confluenceQ.toFixed(1)} m³/s`}
          tone="cyan"
          mono
        />
        <Metric
          icon={<Radio className="h-3.5 w-3.5" />}
          label="Directive"
          value={style.label}
          tone={isRed ? "rose" : isOrange ? "amber" : "slate"}
          mono
        />
        <Metric
          icon={<Siren className="h-3.5 w-3.5" />}
          label="Siren"
          value={
            siren.muted
              ? "MUTED"
              : siren.active
                ? "ACTIVE"
                : siren.armed
                  ? "ARMED"
                  : "STANDBY"
          }
          tone={siren.active ? "rose" : siren.muted ? "slate" : "emerald"}
          mono
        />
      </div>

      {/* Directive strip */}
      <div className="border-t border-slate-800/60 bg-slate-950/50 px-4 py-2">
        <p className="font-mono text-[11px] leading-relaxed text-amber-200">
          ▸ {directive}
        </p>
      </div>

      {/* Full-width red perimeter glow overlay for RED state (refined —
          keeps text readable, no hard background flips) */}
      {isRed && (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            boxShadow:
              "inset 0 0 0 2px rgba(244,63,94,0.5), inset 0 0 24px 2px rgba(244,63,94,0.18)",
            animation: "ews-strobe-red 1.2s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "amber" | "rose" | "emerald" | "slate";
  mono?: boolean;
}) {
  const tones: Record<string, string> = {
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    emerald: "text-emerald-300",
    slate: "text-slate-300",
  };
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500">
        <span className={tones[tone]}>{icon}</span>
        {label}
      </div>
      <div
        className={`mt-0.5 text-[13px] font-semibold ${tones[tone]} ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
