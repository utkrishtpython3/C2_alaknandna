"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  Radio,
  Copy,
  Check,
  Download,
  FileText,
  Send,
  CheckCircle2,
  Circle,
  RadioTower,
} from "lucide-react";
import type {
  BasinCascadeResult,
  BroadcastChannel,
  RiskLevel,
} from "@/lib/hydrologyEngine";

interface DisasterDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telemetry: { wardId: string; rainfall: number; moisture: number }[];
  cascade: BasinCascadeResult | null;
}

interface CapInfo {
  language: string;
  category: string[];
  event: string;
  urgency: string;
  severity: string;
  certainty: string;
  responseTypes: string[];
  audience: string;
  effective: string;
  onset: string;
  expires: string;
  senderName: string;
  headline: string;
  description: string;
  instruction: string;
  web: string;
  contact: string;
  parameter: Array<{ valueName: string; value: string }>;
  area: {
    areaDesc: string;
    polygon: string;
    geocode: Array<{ valueName: string; value: string }>;
  };
}
interface CapAlert {
  alert: {
    identifier: string;
    sender: string;
    sent: string;
    status: string;
    msgType: string;
    scope: string;
    code: string[];
    references: unknown[];
    incidents: string[];
    info: CapInfo[];
  };
  cap_version: string;
  cap_profile: string;
}

interface SitrepWard {
  ward_id: string;
  ward_name: string;
  risk_level: RiskLevel;
  rainfall_intensity_mm_hr: number;
  dynamic_threshold_mm_hr: number;
  exceedance_ratio: number;
  threshold_exceeded: boolean;
  peak_discharge_m3_per_s: number;
  estimated_flood_arrival_min: number;
  debris_flow_probability: number;
  recommended_action: string;
  vulnerable_population: number;
  livestock_count: number;
}

interface Sitrep {
  sitrep_id: string;
  issued_at: string;
  telemetry_observed_at: string;
  issuing_authority: string;
  coordinated_with: string[];
  basin: string;
  corridor: string;
  basin_wide_alert_level: RiskLevel;
  routing_order: string[];
  cumulative_lower_basin_discharge_m3_per_s: number;
  lower_basin_surge_arrival_min: number;
  ndrf_deployment_directive: string;
  tactical_summary: {
    vulnerable_population_total: number;
    livestock_total: number;
    shelter_capacity_total: number;
    shelter_coverage_pct: number;
  };
  per_ward: SitrepWard[];
}

interface DispatchBundle {
  cap: CapAlert;
  cap_xml: string;
  sitrep: Sitrep;
  broadcast_channels: BroadcastChannel[];
  cascade: BasinCascadeResult;
}

type PayloadFormat = "xml" | "json";

export function DisasterDispatchModal({
  open,
  onOpenChange,
  telemetry,
  cascade,
}: DisasterDispatchModalProps) {
  const [bundle, setBundle] = useState<DispatchBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payloadTab, setPayloadTab] = useState<PayloadFormat>("xml");
  const [copied, setCopied] = useState(false);
  const [relayState, setRelayState] = useState<
    Record<string, "idle" | "transmitting" | "ack">
  >({});
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reqId = ++reqIdRef.current;
    const rainfall: Record<string, number> = {};
    const soilMoisture: Record<string, number> = {};
    for (const t of telemetry) {
      rainfall[t.wardId] = t.rainfall;
      soilMoisture[t.wardId] = t.moisture;
    }
    const ts = cascade?.timestamp ?? new Date().toISOString();
    fetch("/api/hydrology/sitrep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rainfall,
        soilMoisture,
        telemetryTimestamp: ts,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("SITREP request failed");
        return r.json();
      })
      .then((data: DispatchBundle) => {
        if (cancelled || reqIdRef.current !== reqId) return;
        setBundle(data);
        setErr(null);
      })
      .catch((e) => {
        if (cancelled || reqIdRef.current !== reqId) return;
        setErr(e instanceof Error ? e.message : "SITREP failed");
        setBundle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, telemetry, cascade]);

  const loading = open && !bundle && !err;

  const payloadText = (() => {
    if (!bundle) return "";
    if (payloadTab === "xml") return bundle.cap_xml;
    return JSON.stringify(bundle.cap, null, 2);
  })();

  const handleCopy = async () => {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(payloadText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    if (!bundle) return;
    const isXml = payloadTab === "xml";
    const blob = new Blob([payloadText], {
      type: isXml ? "application/xml" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isXml
      ? `${bundle.sitrep.sitrep_id}.cap.xml`
      : `${bundle.sitrep.sitrep_id}.cap.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /** Simulate a LoRa/SATCOM radio relay transmission — steps each channel
   * through transmitting → ack with a small delay. */
  const handleSimulateRelay = () => {
    if (!bundle) return;
    const channels = bundle.broadcast_channels.filter((c) => c.active);
    const next: Record<string, "idle" | "transmitting" | "ack"> = {};
    setRelayState(next);
    channels.forEach((c, i) => {
      next[c.id] = "transmitting";
      setRelayState({ ...next });
      setTimeout(() => {
        next[c.id] = "ack";
        setRelayState({ ...next });
      }, 600 * (i + 1));
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-print max-h-[94vh] max-w-3xl overflow-hidden border-slate-700 bg-slate-950 p-0 text-slate-100 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-800 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-50">
            <Radio className="h-4 w-4 text-amber-400" />
            DISASTER DISPATCH — CAP v1.2 ALERT
            {bundle && (
              <span className="ml-1.5 rounded bg-rose-600/20 px-1.5 py-0.5 font-mono text-[10px] text-rose-300">
                {bundle.sitrep.basin_wide_alert_level}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-slate-500">
            OASIS CAP 1.2 XML + JSON profile · NDRF 08 Bn Chamoli sender ·
            multi-channel broadcast checklist. Dispatch to field commanders.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] overflow-y-auto px-5 py-4 text-[12px] leading-relaxed">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating dispatch bundle…
            </div>
          )}
          {err && (
            <div className="rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-rose-300">
              ⚠ {err}
            </div>
          )}

          {bundle && (
            <DispatchDocument
              bundle={bundle}
              payloadTab={payloadTab}
              onPayloadTab={setPayloadTab}
              payloadText={payloadText}
              relayState={relayState}
            />
          )}
        </div>

        <DialogFooter className="no-print flex flex-wrap items-center gap-2 border-t border-slate-800 bg-slate-950 px-5 py-3">
          <div className="mr-auto text-[10px] text-slate-500">
            {bundle
              ? `${bundle.sitrep.sitrep_id} · ${bundle.cap.alert.identifier}`
              : "—"}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!bundle}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy Payload"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSimulateRelay}
            disabled={!bundle}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <RadioTower className="mr-1.5 h-3.5 w-3.5" />
            Simulate Radio Relay
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={!bundle}
            className="bg-amber-500 text-slate-950 hover:bg-amber-400"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download SITREP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 *  Dispatch document (CAP payload + broadcast checklist)
 * ------------------------------------------------------------------ */

function DispatchDocument({
  bundle,
  payloadTab,
  onPayloadTab,
  payloadText,
  relayState,
}: {
  bundle: DispatchBundle;
  payloadTab: PayloadFormat;
  onPayloadTab: (t: PayloadFormat) => void;
  payloadText: string;
  relayState: Record<string, "idle" | "transmitting" | "ack">;
}) {
  const { cap, sitrep } = bundle;
  const info = cap.alert.info[0];
  return (
    <div className="space-y-4 text-slate-200">
      {/* Classification + CAP header */}
      <div className="flex items-center justify-between border-b-2 border-amber-500/60 pb-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
            RESTRICTED · OPERATIONAL · NDRF DISPATCH
          </p>
          <h3 className="font-mono text-sm font-bold text-slate-50">
            {sitrep.sitrep_id}
          </h3>
          <p className="text-[10px] text-slate-500">
            sender:{" "}
            <span className="font-mono text-amber-300">{cap.alert.sender}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">Sent (UTC)</p>
          <p className="font-mono text-[11px] text-slate-200">
            {fmt(cap.alert.sent)}
          </p>
        </div>
      </div>

      {/* CAP classification strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <CapField label="Status" value={cap.alert.status} />
        <CapField label="MsgType" value={cap.alert.msgType} />
        <CapField label="Scope" value={cap.alert.scope} />
        <CapField label="Urgency" value={info.urgency} tone="amber" />
        <CapField label="Severity" value={info.severity} tone="rose" />
        <CapField label="Certainty" value={info.certainty} tone="cyan" />
      </div>

      {/* Headline */}
      <div className="rounded-md border border-amber-600/40 bg-amber-500/5 p-2.5">
        <p className="text-[10px] uppercase tracking-wider text-amber-400">
          Headline
        </p>
        <p className="mt-0.5 text-[12px] font-semibold text-amber-100">
          {info.headline}
        </p>
      </div>

      {/* CAP payload (XML / JSON tabs) */}
      <div>
        <Tabs value={payloadTab} onValueChange={(v) => onPayloadTab(v as PayloadFormat)}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <FileText className="h-3 w-3" />
              CAP 1.2 Payload
            </h4>
            <TabsList className="h-7 bg-slate-900 p-0.5">
              <TabsTrigger
                value="xml"
                className="h-6 px-2 text-[10px] data-[state=active]:bg-slate-700 data-[state=active]:text-amber-300"
              >
                XML
              </TabsTrigger>
              <TabsTrigger
                value="json"
                className="h-6 px-2 text-[10px] data-[state=active]:bg-slate-700 data-[state=active]:text-amber-300"
              >
                JSON
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="xml">
            <CodeBlock text={payloadText} lang="xml" />
          </TabsContent>
          <TabsContent value="json">
            <CodeBlock text={payloadText} lang="json" />
          </TabsContent>
        </Tabs>
      </div>

      {/* Polygon bounds */}
      <div>
        <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Send className="h-3 w-3" />
          Polygon Coordinate Bounds (CAP §3.2.4)
        </h4>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
          <p className="text-[10px] text-slate-400">{info.area.areaDesc}</p>
          <p className="mt-1 font-mono text-[9px] leading-relaxed text-emerald-300/80">
            {info.area.polygon}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            geocodes:{" "}
            {info.area.geocode.map((g) => `${g.valueName}=${g.value}`).join("; ")}
          </p>
        </div>
      </div>

      {/* Multi-channel broadcast checklist */}
      <div>
        <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <RadioTower className="h-3 w-3" />
          Multi-Channel Broadcast Checklist
        </h4>
        <ul className="space-y-1">
          {bundle.broadcast_channels.map((c) => {
            const st = relayState[c.id] ?? (c.active ? "idle" : "idle");
            return (
              <li
                key={c.id}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
                  c.active
                    ? "border-slate-700 bg-slate-900/60"
                    : "border-slate-800/60 bg-slate-900/30 opacity-60"
                }`}
              >
                {st === "ack" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : st === "transmitting" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" />
                ) : c.active ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-slate-200">
                    {c.label}
                  </p>
                  <p className="truncate text-[9px] text-slate-500">
                    {c.description}
                  </p>
                </div>
                {c.metadata && (
                  <span className="shrink-0 font-mono text-[9px] text-slate-400">
                    {c.metadata}
                  </span>
                )}
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    st === "ack"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : st === "transmitting"
                        ? "bg-amber-500/20 text-amber-300"
                        : c.active
                          ? "bg-slate-700 text-slate-300"
                          : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {st === "ack"
                    ? "ACK"
                    : st === "transmitting"
                      ? "TX…"
                      : c.active
                        ? "READY"
                        : "STBY"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Tactical summary */}
      <div>
        <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Tactical Summary
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Confluence Q"
            value={`${sitrep.cumulative_lower_basin_discharge_m3_per_s} m³/s`}
          />
          <Stat
            label="Surge lead"
            value={`${sitrep.lower_basin_surge_arrival_min} min`}
          />
          <Stat
            label="Vulnerable"
            value={sitrep.tactical_summary.vulnerable_population_total.toLocaleString()}
          />
          <Stat
            label="Shelter cov."
            value={`${sitrep.tactical_summary.shelter_coverage_pct}%`}
          />
        </div>
        <div className="mt-2 rounded-md border border-rose-700/50 bg-rose-950/40 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
            NDRF Deployment Directive
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-100">
            ▸ {sitrep.ndrf_deployment_directive}
          </p>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ text, lang }: { text: string; lang: "xml" | "json" }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-md border border-slate-800 bg-slate-950/80 p-2.5">
      <code className={`font-mono text-[10px] leading-relaxed text-slate-300`}>
        {lang === "xml"
          ? colorizeXml(text)
          : colorizeJson(text)}
      </code>
    </pre>
  );
}

/** Minimal syntax highlighter for the CAP XML payload display. */
function colorizeXml(xml: string): React.ReactNode {
  // Split into tokens: tags, attributes, text. Render as spans.
  const parts: React.ReactNode[] = [];
  const regex = /(<\/?[\w:-]+)|([\w:-]+="[^"]*")|(>)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    if (m.index > last) {
      parts.push(
        <span key={key++} className="text-slate-400">
          {xml.slice(last, m.index)}
        </span>
      );
    }
    if (m[1]) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {m[1]}
        </span>
      );
    } else if (m[2]) {
      const [name, , ...valRest] = m[2].split("=");
      const val = valRest.join("=");
      parts.push(
        <span key={key++}>
          <span className="text-cyan-300">{name}</span>
          <span className="text-slate-500">=</span>
          <span className="text-emerald-300">{val}</span>
        </span>
      );
    } else if (m[3]) {
      parts.push(
        <span key={key++} className="text-slate-400">
          {m[3]}
        </span>
      );
    }
    last = regex.lastIndex;
  }
  if (last < xml.length) {
    parts.push(
      <span key={key++} className="text-slate-400">
        {xml.slice(last)}
      </span>
    );
  }
  return parts;
}

/** Minimal syntax highlighter for the CAP JSON payload display. */
function colorizeJson(json: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex =
    /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b-?\d+\.?\d*\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(json)) !== null) {
    if (m.index > last) {
      parts.push(
        <span key={key++} className="text-slate-400">
          {json.slice(last, m.index)}
        </span>
      );
    }
    if (m[1]) {
      parts.push(
        <span key={key++} className="text-cyan-300">
          {m[1]}
        </span>
      );
    } else if (m[2]) {
      parts.push(
        <span key={key++} className="text-emerald-300">
          {m[2]}
        </span>
      );
    } else if (m[3]) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {m[3]}
        </span>
      );
    } else if (m[4]) {
      parts.push(
        <span key={key++} className="text-rose-300">
          {m[4]}
        </span>
      );
    }
    last = regex.lastIndex;
  }
  if (last < json.length) {
    parts.push(
      <span key={key++} className="text-slate-400">
        {json.slice(last)}
      </span>
    );
  }
  return parts;
}

function CapField({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "amber" | "rose" | "cyan";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-200",
    amber: "text-amber-300",
    rose: "text-rose-300",
    cyan: "text-cyan-300",
  };
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`font-mono text-[11px] font-semibold ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function fmt(iso: string): string {
  return iso.replace("T", " · ").replace(/\..+Z$/, " UTC");
}
