"use client";

import { useEffect, useState } from "react";
import { Satellite, RadioTower, Signal, Wifi, AlertTriangle } from "lucide-react";

/**
 * TelemetryHealthBar
 * ----------------------------------------------------------------------------
 * A compact telemetry-uplink survivability strip for the C2 dashboard footer.
 * Disaster officers always question whether telemetry survives when cell
 * towers drown — this bar surfaces three uplink tiers with live status:
 *
 *   1. SATCOM (GSAT-7A)           — primary, active 99.8% SNR
 *   2. VHF / LoRa Mesh Repeater   — secondary, 4-node chain connected
 *   3. Cellular 4G/5G             — tertiary, DEGRADED (simulated failover)
 *
 * When the alert level is ORANGE/RED, the 4G/5G tier drops to FAILED and the
 * bar shows the active uplink path + a survivability score.
 */

export type UplinkStatus = "ACTIVE" | "CONNECTED" | "DEGRADED" | "FAILED";

interface Uplink {
  id: string;
  label: string;
  detail: string;
  status: UplinkStatus;
  metric: string;
  icon: typeof Satellite;
}

interface TelemetryHealthBarProps {
  /** When severe (EXTREME/CATACLYSMIC), the 4G tier drops to FAILED. */
  severe: boolean;
}

const BASE_UPLINKS: Uplink[] = [
  {
    id: "satcom",
    label: "SATCOM (GSAT-7A)",
    detail: "Ku-band · ISRO hub Lucknow",
    status: "ACTIVE",
    metric: "99.8% SNR",
    icon: Satellite,
  },
  {
    id: "lora-mesh",
    label: "VHF / LoRa Mesh Repeater",
    detail: "868 MHz · Auli Ridge chain",
    status: "CONNECTED",
    metric: "4 nodes",
    icon: RadioTower,
  },
  {
    id: "cellular",
    label: "Cellular 4G/5G",
    detail: "Airtel/Jio/BSNL · Joshimath BTS",
    status: "DEGRADED",
    metric: "failover",
    icon: Signal,
  },
];

const STATUS_STYLE: Record<
  UplinkStatus,
  { dot: string; text: string; border: string; bg: string; label: string }
> = {
  ACTIVE: {
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    border: "border-emerald-600/50",
    bg: "bg-emerald-500/10",
    label: "ACTIVE",
  },
  CONNECTED: {
    dot: "bg-cyan-400",
    text: "text-cyan-300",
    border: "border-cyan-600/50",
    bg: "bg-cyan-500/10",
    label: "CONNECTED",
  },
  DEGRADED: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-600/50",
    bg: "bg-amber-500/10",
    label: "DEGRADED",
  },
  FAILED: {
    dot: "bg-rose-500",
    text: "text-rose-300",
    border: "border-rose-600/60",
    bg: "bg-rose-500/15",
    label: "FAILED",
  },
};

export function TelemetryHealthBar({ severe }: TelemetryHealthBarProps) {
  // Simulated live SNR jitter for the SATCOM tier (visual liveliness).
  const [snr, setSnr] = useState(99.8);
  useEffect(() => {
    const id = setInterval(() => {
      setSnr(99.5 + Math.random() * 0.4);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const uplinks: Uplink[] = BASE_UPLINKS.map((u) => {
    if (u.id === "cellular") {
      return {
        ...u,
        status: severe ? "FAILED" : "DEGRADED",
        detail: severe
          ? "BTS inundated · cellular blackout"
          : "Simulated failover · degraded",
      };
    }
    return u;
  });

  const activePath = severe
    ? "SATCOM → LoRa Mesh (4G/5G BLACKOUT)"
    : "SATCOM (primary) + LoRa Mesh + 4G/5G failover";

  // Survivability score: 3 active = 100%, lose a tier → -33%.
  const tierWeights = { ACTIVE: 1, CONNECTED: 1, DEGRADED: 0.5, FAILED: 0 };
  const score = Math.round(
    (uplinks.reduce((s, u) => s + tierWeights[u.status], 0) / 3) * 100
  );

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
          <Wifi className="h-3 w-3 text-cyan-400" />
          Telemetry Uplink Survivability
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-slate-500">
          Active path
          <span className="font-mono text-cyan-300">{activePath}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-slate-500">Survivability</span>
          <span
            className={`font-mono font-bold ${
              score >= 80
                ? "text-emerald-300"
                : score >= 50
                  ? "text-amber-300"
                  : "text-rose-300"
            }`}
          >
            {score}%
          </span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {uplinks.map((u) => {
          const Icon = u.icon;
          const st = STATUS_STYLE[u.status];
          const metric =
            u.id === "satcom" ? `${snr.toFixed(1)}% SNR` : u.metric;
          const pulse = u.status === "ACTIVE" || u.status === "FAILED";
          return (
            <div
              key={u.id}
              className={`flex items-center gap-2 rounded-md border ${st.border} ${st.bg} px-2 py-1.5`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${st.text}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold text-slate-200">
                  {u.label}
                </p>
                <p className="truncate text-[9px] text-slate-500">{u.detail}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${st.dot} ${
                      pulse ? "animate-pulse" : ""
                    }`}
                  />
                  <span className={st.text}>{st.label}</span>
                </span>
                <span className="font-mono text-[9px] text-slate-400">{metric}</span>
              </div>
            </div>
          );
        })}
      </div>
      {severe && (
        <div className="flex items-center gap-1.5 text-[10px] text-rose-300">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>
            Cellular blackout confirmed — all CAP alerts must relay via SATCOM
            + LoRa mesh. IAF Bareilly SAR notified on DEFSAT-1.
          </span>
        </div>
      )}
    </div>
  );
}
