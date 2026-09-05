"use client";

import { useEffect, useRef, useState } from "react";
import {
  Satellite,
  RadioTower,
  Radio as RadioIcon,
  Signal,
  Wifi,
  Loader2,
  TriangleAlert,
  ShieldCheck,
  Activity,
  Cpu,
  Copy,
  Check,
  Download,
} from "lucide-react";

/**
 * CommsLayerPanel
 * ----------------------------------------------------------------------------
 * Multi-tier resilient failover topology visualizer + LoRa packet inspector.
 * Answers the operational question disaster officers always ask:
 *
 *   "When a cloudburst occurs, optical fiber backhauls snap, BTS cellular
 *    towers flood, and commercial grid power cuts out — how does your early
 *    warning telemetry survive, and how does your alert reach an offline
 *    village?"
 *
 * Fetches the dispatch bundle from /api/dispatch on demand (when the officer
 * opens the panel with an active cascade) and renders:
 *   1. The 4-tier failover topology (SATCOM → LoRa mesh → VHF → cellular)
 *      with live status, protocol, bitrate, latency, reach.
 *   2. The LoRa packet inspector — the 32-byte telemetry frames + the 48-byte
 *      CAP alert burst, with hex + base64 + decoded fields.
 *   3. The offline-village reach verdict (reachable via LoRa mesh even when
 *      cellular is blacked out).
 *   4. A "Transmit via LoRa mesh" simulator that steps the burst through the
 *      Auli Ridge → Helang → Pandukeshwar relay chain with ACK states.
 */

interface DispatchInput {
  wardId: string;
  riskLevel: string;
  peakQ: number;
  leadTimeMins: number;
  rainfallIntensity: number;
  soilMoisturePct: number;
  confluenceDischarge: number;
  evacuationShelters: Array<{
    name: string;
    elevationM: number;
    capacity: number;
    coordinates: [number, number];
  }>;
}

interface FailoverTier {
  id: string;
  label: string;
  tier: number;
  status: "ACTIVE" | "CONNECTED" | "STANDBY" | "DEGRADED" | "FAILED";
  protocol: string;
  bitrate_kbps: number;
  latency_ms: number;
  reach: string;
  notes: string;
}

interface LoRaTelemetryFrame {
  ward_id: string;
  ward_numeric_id: number;
  hex: string;
  base64: string;
  byte_size: number;
  decoded: {
    timestamp: number;
    rainfall_rate_mm_hr: number;
    soil_saturation_pct: number;
    river_stage_m: number;
    risk_ordinal: number;
    risk_label: string;
    relay_hop_count: number;
  };
}

interface LoRaAlertBurst {
  hexString: string;
  base64: string;
  byteSize: number;
  snrMarginDb: number;
  airtimeMs: number;
}

interface BroadcastChannel {
  id: string;
  label: string;
  description: string;
  active: boolean;
  metadata?: string;
}

interface DispatchResponse {
  cap: {
    alert: {
      identifier: string;
      sender: string;
      sent: string;
    };
  };
  cap_xml: string;
  lora_telemetry: LoRaTelemetryFrame[];
  lora_alert_burst: LoRaAlertBurst;
  broadcast_channels: BroadcastChannel[];
  failover_topology: {
    severe: boolean;
    active_path: string;
    survivability_pct: number;
    tiers: FailoverTier[];
    offline_village_reach: {
      reachable: boolean;
      via: string;
      latency_ms: number;
      note: string;
    };
  };
  dispatch_meta: {
    received_at: string;
    sender: string;
    profile: string;
    frame_sizes: { telemetry_bytes: number; alert_burst_bytes: number };
  };
}

interface CommsLayerPanelProps {
  /** The active cascade telemetry the officer is dispatching on behalf of. */
  dispatchInput: DispatchInput | null;
  /** Controlled-open flag (the panel mounts only when the officer opens it). */
  open: boolean;
}

type RelayState = "idle" | "tx" | "ack";

const TIER_ICON: Record<string, typeof Satellite> = {
  satcom: Satellite,
  "lora-mesh": RadioTower,
  vhf: RadioIcon,
  cellular: Signal,
};

const STATUS_STYLE: Record<
  FailoverTier["status"],
  { dot: string; text: string; border: string; bg: string }
> = {
  ACTIVE: {
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    border: "border-emerald-600/50",
    bg: "bg-emerald-500/10",
  },
  CONNECTED: {
    dot: "bg-cyan-400",
    text: "text-cyan-300",
    border: "border-cyan-600/50",
    bg: "bg-cyan-500/10",
  },
  STANDBY: {
    dot: "bg-slate-400",
    text: "text-slate-300",
    border: "border-slate-600/50",
    bg: "bg-slate-500/10",
  },
  DEGRADED: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-600/50",
    bg: "bg-amber-500/10",
  },
  FAILED: {
    dot: "bg-rose-500",
    text: "text-rose-300",
    border: "border-rose-600/60",
    bg: "bg-rose-500/15",
  },
};

export function CommsLayerPanel({ dispatchInput, open }: CommsLayerPanelProps) {
  const [bundle, setBundle] = useState<DispatchResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [relayState, setRelayState] = useState<
    Record<string, RelayState>
  >({});
  const [copied, setCopied] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  // Fetch the dispatch bundle (debounced + reqId-guarded to satisfy the
  // react-hooks/set-state-in-effect lint rule).
  useEffect(() => {
    if (!open || !dispatchInput) return;
    let cancelled = false;
    const reqId = ++reqIdRef.current;
    const timer = setTimeout(() => {
      if (cancelled || reqIdRef.current !== reqId) return;
      fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dispatchInput),
      })
        .then((r) => {
          if (!r.ok) throw new Error("dispatch request failed");
          return r.json();
        })
        .then((data: DispatchResponse) => {
          if (cancelled || reqIdRef.current !== reqId) return;
          setBundle(data);
          setErr(null);
          // Default-select the first telemetry frame for the inspector.
          setSelectedFrame(data.lora_telemetry[0]?.ward_id ?? null);
        })
        .catch((e) => {
          if (cancelled || reqIdRef.current !== reqId) return;
          setErr(e instanceof Error ? e.message : "dispatch failed");
          setBundle(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, dispatchInput]);

  const loading = open && !bundle && !err;

  /** Step the LoRa alert burst through the Auli Ridge → Helang → Pandukeshwar
   *  relay chain with per-node ACK states. */
  const handleTransmit = () => {
    if (!bundle) return;
    const nodes = ["auli-ridge", "helang", "pandukeshwar", "vishnuprayag"];
    const next: Record<string, RelayState> = {};
    setRelayState(next);
    nodes.forEach((n, i) => {
      next[n] = "tx";
      setRelayState({ ...next });
      setTimeout(() => {
        next[n] = "ack";
        setRelayState({ ...next });
      }, 500 * (i + 1));
    });
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {});
  };

  const handleDownloadBurst = () => {
    if (!bundle) return;
    const blob = new Blob(
      [bundle.lora_alert_burst.hexString.match(/.{2}/g)?.join(" ") ?? ""],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.cap.alert.identifier}.lora-burst.hex`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  const topo = bundle?.failover_topology;
  const selectedTelemetry = bundle?.lora_telemetry.find(
    (t) => t.ward_id === selectedFrame
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-slate-100">
            Tactical Communications &amp; Resilient Failover
          </span>
        </div>
        {bundle && (
          <span className="rounded border border-amber-700/50 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
            {bundle.dispatch_meta.profile}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px]">
          {topo && (
            <>
              <span className="font-mono text-slate-500">
                survivability{" "}
                <span
                  className={
                    topo.survivability_pct >= 75
                      ? "text-emerald-300"
                      : topo.survivability_pct >= 50
                        ? "text-amber-300"
                        : "text-rose-300"
                  }
                >
                  {topo.survivability_pct}%
                </span>
              </span>
              <Button onClick={handleTransmit} size="sm">
                <RadioTower className="mr-1.5 h-3.5 w-3.5" />
                Transmit via LoRa mesh
              </Button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex h-32 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Packing telemetry + CAP alert into LoRa frames…
        </div>
      )}
      {err && (
        <div className="rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
          ⚠ {err}
        </div>
      )}

      {bundle && topo && (
        <>
          {/* Active path strip */}
          <div className="rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Active uplink path
            </p>
            <p className="mt-0.5 font-mono text-[12px] font-semibold text-cyan-300">
              {topo.active_path}
            </p>
          </div>

          {/* 4-tier topology grid */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {topo.tiers.map((tier) => {
              const Icon = TIER_ICON[tier.id] ?? Signal;
              const st = STATUS_STYLE[tier.status];
              return (
                <div
                  key={tier.id}
                  className={`rounded-md border ${st.border} ${st.bg} p-2.5`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${st.text}`} />
                    <span className="text-[10px] font-bold text-slate-100">
                      T{tier.tier} · {tier.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[9px]">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${st.dot} ${
                        tier.status === "ACTIVE" || tier.status === "FAILED"
                          ? "animate-pulse"
                          : ""
                      }`}
                    />
                    <span className={`font-bold ${st.text}`}>{tier.status}</span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-slate-400">
                    {tier.protocol} · {tier.bitrate_kbps} kbps · {tier.latency_ms}ms
                  </p>
                  <p className="mt-0.5 text-[9px] text-slate-500">{tier.reach}</p>
                  <p className="mt-1 text-[9px] leading-tight text-slate-500">
                    {tier.notes}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Offline-village reach verdict */}
          <div
            className={`rounded-md border p-3 ${
              topo.offline_village_reach.reachable
                ? "border-emerald-600/50 bg-emerald-500/5"
                : "border-rose-600/60 bg-rose-500/10"
            }`}
          >
            <div className="flex items-center gap-2">
              {topo.offline_village_reach.reachable ? (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              ) : (
                <TriangleAlert className="h-4 w-4 text-rose-400" />
              )}
              <span className="text-[11px] font-bold text-slate-100">
                Offline-village reach verdict
              </span>
              <span
                className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                  topo.offline_village_reach.reachable
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {topo.offline_village_reach.reachable ? "REACHABLE" : "ISOLATED"}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-cyan-300">
              via {topo.offline_village_reach.via} · {topo.offline_village_reach.latency_ms}ms
            </p>
            <p className="mt-1 text-[10px] leading-snug text-slate-400">
              {topo.offline_village_reach.note}
            </p>
          </div>

          {/* LoRa packet inspector */}
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Cpu className="h-3 w-3 text-amber-400" />
              LoRa Packet Inspector — 866 MHz Mesh Payloads
            </h4>

            {/* Telemetry frame selector */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {bundle.lora_telemetry.map((t) => (
                <button
                  key={t.ward_id}
                  onClick={() => setSelectedFrame(t.ward_id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition ${
                    selectedFrame === t.ward_id
                      ? "border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="font-mono font-bold">{t.ward_id.replace("UK-CHM-", "")}</span>
                  <span className="font-mono text-[9px] text-slate-500">{t.byte_size}B</span>
                  <span className="font-mono text-[9px] text-rose-300">{t.decoded.risk_label}</span>
                </button>
              ))}
            </div>

            {/* Selected telemetry frame inspector */}
            {selectedTelemetry && (
              <div className="rounded-md border border-slate-700 bg-slate-950/60 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-amber-300">
                    {selectedTelemetry.ward_id} · 32-byte telemetry frame
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        handleCopy(
                          `tel-${selectedTelemetry.ward_id}-hex`,
                          selectedTelemetry.hex
                        )
                      }
                      className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700"
                    >
                      {copied === `tel-${selectedTelemetry.ward_id}-hex` ? (
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-2.5 w-2.5" />
                      )}
                      hex
                    </button>
                    <button
                      onClick={() =>
                        handleCopy(
                          `tel-${selectedTelemetry.ward_id}-b64`,
                          selectedTelemetry.base64
                        )
                      }
                      className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700"
                    >
                      {copied === `tel-${selectedTelemetry.ward_id}-b64` ? (
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-2.5 w-2.5" />
                      )}
                      base64
                    </button>
                  </div>
                </div>
                <div className="mb-2 font-mono text-[10px] leading-relaxed break-all text-emerald-300/80">
                  {groupHex(selectedTelemetry.hex)}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <PacketField label="timestamp" value={String(selectedTelemetry.decoded.timestamp)} />
                  <PacketField label="rain mm/hr" value={selectedTelemetry.decoded.rainfall_rate_mm_hr.toFixed(1)} />
                  <PacketField label="soil %" value={String(selectedTelemetry.decoded.soil_saturation_pct)} />
                  <PacketField label="stage m" value={selectedTelemetry.decoded.river_stage_m.toFixed(2)} />
                  <PacketField label="risk" value={selectedTelemetry.decoded.risk_label} tone="rose" />
                  <PacketField label="hop count" value={String(selectedTelemetry.decoded.relay_hop_count)} />
                  <PacketField label="ward id" value={String(selectedTelemetry.ward_numeric_id)} />
                  <PacketField label="size" value={`${selectedTelemetry.byte_size}B`} />
                </div>
              </div>
            )}

            {/* Alert burst inspector */}
            <div className="mt-2 rounded-md border border-rose-700/50 bg-rose-500/5 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-rose-300">
                  48-byte CAP alert burst · {bundle.lora_alert_burst.byteSize}B
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      handleCopy("burst-hex", bundle.lora_alert_burst.hexString)
                    }
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700"
                  >
                    {copied === "burst-hex" ? (
                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-2.5 w-2.5" />
                    )}
                    hex
                  </button>
                  <button
                    onClick={() =>
                      handleCopy("burst-b64", bundle.lora_alert_burst.base64)
                    }
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700"
                  >
                    {copied === "burst-b64" ? (
                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-2.5 w-2.5" />
                    )}
                    base64
                  </button>
                  <button
                    onClick={handleDownloadBurst}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700"
                  >
                    <Download className="h-2.5 w-2.5" />
                    .hex
                  </button>
                </div>
              </div>
              <div className="mb-2 font-mono text-[10px] leading-relaxed break-all text-rose-300/80">
                {groupHex(bundle.lora_alert_burst.hexString)}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <PacketField label="SNR margin" value={`${bundle.lora_alert_burst.snrMarginDb} dB`} tone="cyan" />
                <PacketField label="airtime" value={`${bundle.lora_alert_burst.airtimeMs} ms`} tone="amber" />
                <PacketField label="size" value={`${bundle.lora_alert_burst.byteSize}B`} />
                <PacketField label="encoding" value="SF9BW125" tone="slate" />
              </div>
            </div>
          </div>

          {/* Mesh relay simulator */}
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Activity className="h-3 w-3 text-cyan-400" />
              LoRa Mesh Relay Chain — Auli Ridge → Pandukeshwar
            </h4>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "auli-ridge", label: "Auli Ridge" },
                { id: "helang", label: "Helang" },
                { id: "pandukeshwar", label: "Pandukeshwar" },
                { id: "vishnuprayag", label: "Vishnuprayag" },
              ].map((node, i, arr) => {
                const st = relayState[node.id] ?? "idle";
                return (
                  <div key={node.id} className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition ${
                        st === "ack"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                          : st === "tx"
                            ? "border-amber-500 bg-amber-500/15 text-amber-300"
                            : "border-slate-700 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      {st === "ack" ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : st === "tx" ? (
                        <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                      ) : (
                        <RadioTower className="h-3 w-3" />
                      )}
                      <span className="font-mono font-semibold">{node.label}</span>
                      <span className="font-mono text-[9px]">
                        {st === "ack" ? "ACK" : st === "tx" ? "TX…" : "IDLE"}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <span className="text-slate-600">→</span>
                    )}
                  </div>
                );
              })}
            </div>
            {Object.keys(relayState).length === 0 && (
              <p className="mt-1.5 text-[9px] text-slate-500">
                Click <span className="font-mono text-amber-300">Transmit via LoRa mesh</span> to step the 48-byte CAP burst through the relay chain.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PacketField({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "cyan" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-200",
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 px-1.5 py-1">
      <p className="text-[8px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`font-mono text-[10px] font-semibold ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function Button({
  children,
  onClick,
  size = "sm",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  size?: "sm";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md bg-amber-500 text-slate-950 transition hover:bg-amber-400 disabled:opacity-50 ${
        size === "sm" ? "h-7 px-2.5 text-[11px] font-semibold" : "h-9 px-4 text-sm"
      }`}
    >
      {children}
    </button>
  );
}

/** Group a hex string into space-separated byte pairs for readability. */
function groupHex(hex: string): string {
  return hex.match(/.{2}/g)?.join(" ") ?? hex;
}
