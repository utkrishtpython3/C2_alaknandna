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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Printer,
  Download,
  Copy,
  Check,
  FileText,
  Radio,
  Users,
  Anchor,
} from "lucide-react";
import type { BasinCascadeResult, RiskLevel } from "@/lib/hydrologyEngine";

interface SitrepModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telemetry: { wardId: string; rainfall: number; moisture: number }[];
  cascade: BasinCascadeResult | null;
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
    info: Array<{
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
    }>;
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
  critical_infrastructure: Array<{
    name: string;
    type: string;
    coordinates: [number, number];
    critical_gauge_level_m: number;
  }>;
  evacuation_plan: Array<{
    shelter_id: string;
    name: string;
    elevation_m: number;
    capacity_persons: number;
    coordinates: [number, number];
    route_id: string;
    safe_elevation_differential_m: number;
  }>;
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

interface SitrepBundle {
  cap: CapAlert;
  sitrep: Sitrep;
  cascade: BasinCascadeResult;
}

const RISK_STROKE: Record<RiskLevel, string> = {
  LOW: "border-emerald-600/40",
  MODERATE: "border-amber-600/50",
  HIGH: "border-orange-600/60",
  EXTREME: "border-red-600/70",
  CATACLYSMIC: "border-rose-600/80",
};
const RISK_TXT: Record<RiskLevel, string> = {
  LOW: "text-emerald-300",
  MODERATE: "text-amber-300",
  HIGH: "text-orange-300",
  EXTREME: "text-red-300",
  CATACLYSMIC: "text-rose-300",
};

export function SitrepModal({
  open,
  onOpenChange,
  telemetry,
  cascade,
}: SitrepModalProps) {
  const [bundle, setBundle] = useState<SitrepBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reqId = ++reqIdRef.current;
    // Defer the fetch so the loading state is derived from `open && !bundle`
    // rather than a synchronous setState in the effect body (which the React
    // lint rule flags). All setStates happen inside async callbacks.
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
      .then((data: SitrepBundle) => {
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

  const handlePrint = () => {
    if (!bundle) return;
    const html = renderPrintableSitrep(bundle);
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      setErr("Pop-up blocked — allow pop-ups to print the SITREP.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Give the new document a tick to lay out before printing.
    w.onload = () => {
      w.focus();
      w.print();
    };
  };

  const handleDownload = () => {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.sitrep.sitrep_id}.cap.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-print max-h-[92vh] max-w-3xl overflow-hidden border-slate-700 bg-slate-950 p-0 text-slate-100 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-800 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-50">
            <Radio className="h-4 w-4 text-amber-400" />
            NDRF SITREP — Tactical Dispatch
          </DialogTitle>
          <DialogDescription className="text-[11px] text-slate-500">
            OASIS CAP 1.2 (JSON profile) + NDRF Situation Report. Dispatch to
            field commanders or print to PDF for the ops log.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 text-[12px] leading-relaxed">
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
            <SitrepDocument bundle={bundle} />
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
            {copied ? "Copied" : "Copy JSON"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={!bundle}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CAP-JSON
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={!bundle}
            className="bg-amber-500 text-slate-950 hover:bg-amber-400"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 *  Printable SITREP document
 * ------------------------------------------------------------------ */

function SitrepDocument({ bundle }: { bundle: SitrepBundle }) {
  const { cap, sitrep } = bundle;
  const info = cap.alert.info[0];
  return (
    <div className="space-y-4 text-slate-200">
      {/* Header / classification */}
      <div className="flex items-center justify-between border-b-2 border-amber-500/60 pb-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
            RESTRICTED · OPERATIONAL · NDRF USE
          </p>
          <h3 className="font-mono text-sm font-bold text-slate-50">
            {sitrep.sitrep_id}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">Issued</p>
          <p className="font-mono text-[11px] text-slate-200">
            {fmt(sitrep.issued_at)}
          </p>
        </div>
      </div>

      {/* Alert classification */}
      <div
        className={`rounded-md border ${RISK_STROKE[sitrep.basin_wide_alert_level]} bg-slate-900/60 p-3`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`border-current ${RISK_TXT[sitrep.basin_wide_alert_level]} text-[10px] font-bold`}
          >
            {sitrep.basin_wide_alert_level}
          </Badge>
          <span className="text-[11px] font-semibold text-slate-100">
            {info.event}
          </span>
          <span className="ml-auto font-mono text-[10px] text-slate-400">
            {info.severity} · {info.urgency} · {info.certainty}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] font-semibold text-amber-200">
          {info.headline}
        </p>
      </div>

      {/* CAP identifiers */}
      <Section title="CAP Identifiers" icon={<FileText className="h-3 w-3" />}>
        <Grid>
          <Field label="CAP Identifier" value={cap.alert.identifier} mono />
          <Field label="Sender" value={cap.alert.sender} mono />
          <Field label="Status / MsgType / Scope" value={`${cap.alert.status} · ${cap.alert.msgType} · ${cap.alert.scope}`} />
          <Field label="Effective" value={fmt(info.effective)} mono />
          <Field label="Onset" value={fmt(info.onset)} mono />
          <Field label="Expires" value={fmt(info.expires)} mono />
          <Field label="Audience" value={info.audience} />
          <Field label="Sender" value={info.senderName} />
          <Field label="Contact" value={info.contact} />
        </Grid>
      </Section>

      {/* Tactical summary */}
      <Section title="Tactical Summary" icon={<Radio className="h-3 w-3" />}>
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
            label="Routing"
            value={sitrep.routing_order.map((r) => r.replace("UK-CHM-", "")).join("→")}
          />
          <Stat
            label="Shelter coverage"
            value={`${sitrep.tactical_summary.shelter_coverage_pct}%`}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            icon={<Users className="h-3 w-3" />}
            label="Vulnerable"
            value={sitrep.tactical_summary.vulnerable_population_total.toLocaleString()}
          />
          <Stat
            label="Livestock"
            value={sitrep.tactical_summary.livestock_total.toLocaleString()}
          />
          <Stat
            icon={<Anchor className="h-3 w-3" />}
            label="Shelter cap."
            value={sitrep.tactical_summary.shelter_capacity_total.toLocaleString()}
          />
          <Stat
            label="Basin"
            value={sitrep.basin}
          />
        </div>
        <div className="mt-3 rounded-md border border-rose-700/50 bg-rose-950/40 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
            NDRF Deployment Directive
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-100">
            ▸ {sitrep.ndrf_deployment_directive}
          </p>
        </div>
      </Section>

      {/* Per-ward table */}
      <Section title="Per-Ward Assessment" icon={<FileText className="h-3 w-3" />}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="py-1 pr-2">Ward</th>
                <th className="py-1 pr-2">Risk</th>
                <th className="py-1 pr-2">Rain / Thr</th>
                <th className="py-1 pr-2">Peak Q</th>
                <th className="py-1 pr-2">Debris</th>
                <th className="py-1 pr-2">Arrival</th>
                <th className="py-1 pr-2">Vuln. pop.</th>
              </tr>
            </thead>
            <tbody>
              {sitrep.per_ward.map((w) => (
                <tr
                  key={w.ward_id}
                  className="border-b border-slate-800/60 align-top"
                >
                  <td className="py-1 pr-2 font-semibold text-slate-200">
                    {w.ward_id.replace("UK-CHM-", "")}
                    <div className="text-[9px] font-normal text-slate-500">
                      {w.ward_name}
                    </div>
                  </td>
                  <td className={`py-1 pr-2 font-bold ${RISK_TXT[w.risk_level]}`}>
                    {w.risk_level}
                  </td>
                  <td className="py-1 pr-2 font-mono text-slate-300">
                    {w.rainfall_intensity_mm_hr}/{w.dynamic_threshold_mm_hr}
                    <div className="text-[9px] text-slate-500">
                      {w.exceedance_ratio.toFixed(2)}×
                    </div>
                  </td>
                  <td className="py-1 pr-2 font-mono text-cyan-300">
                    {w.peak_discharge_m3_per_s}
                  </td>
                  <td className="py-1 pr-2 font-mono text-rose-300">
                    {(w.debris_flow_probability * 100).toFixed(0)}%
                  </td>
                  <td className="py-1 pr-2 font-mono text-amber-300">
                    {Math.round(w.estimated_flood_arrival_min)}m
                  </td>
                  <td className="py-1 pr-2 font-mono text-slate-300">
                    {w.vulnerable_population.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Critical infrastructure + evacuation */}
      <Section title="Critical Assets & Evacuation Plan" icon={<Anchor className="h-3 w-3" />}>
        <div className="space-y-2">
          {sitrep.per_ward.map((w) => (
            <div
              key={w.ward_id}
              className="rounded-md border border-slate-800 bg-slate-900/50 p-2"
            >
              <p className="text-[10px] font-bold text-slate-200">
                {w.ward_id.replace("UK-CHM-", "")} —{" "}
                <span className="font-normal text-slate-400">
                  {w.recommended_action.slice(0, 80)}…
                </span>
              </p>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">
                    Critical infrastructure
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {w.critical_infrastructure.map((c) => (
                      <li
                        key={c.name}
                        className="text-[10px] text-slate-300"
                      >
                        <span className="font-mono text-amber-300">
                          [{c.type}]
                        </span>{" "}
                        {c.name}{" "}
                        <span className="text-slate-500">
                          (gauge {c.critical_gauge_level_m}m)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">
                    Evacuation assembly
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {w.evacuation_plan.map((e) => (
                      <li
                        key={e.shelter_id}
                        className="text-[10px] text-slate-300"
                      >
                        <span className="font-mono text-emerald-300">
                          +{e.safe_elevation_differential_m.toFixed(0)}m
                        </span>{" "}
                        {e.name}{" "}
                        <span className="text-slate-500">
                          (cap. {e.capacity_persons}, {e.route_id})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CAP area */}
      <Section title="CAP Area" icon={<FileText className="h-3 w-3" />}>
        <p className="text-[11px] text-slate-300">{info.area.areaDesc}</p>
        <p className="mt-1 font-mono text-[9px] leading-relaxed text-slate-500">
          polygon (lat,lng pairs):
          <br />
          {info.area.polygon}
        </p>
        <p className="mt-1 text-[10px] text-slate-400">
          geocodes:{" "}
          {info.area.geocode
            .map((g) => `${g.valueName}=${g.value}`)
            .join("; ")}
        </p>
      </Section>

      <div className="border-t border-slate-800 pt-2 text-[9px] text-slate-600">
        Generated by ISRO-NRSC FFEWS v1.4.0-ops · CAP profile:{" "}
        {cap.cap_profile} v{cap.cap_version} · Coordinated with{" "}
        {sitrep.coordinated_with.join(", ")}.
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{children}</div>;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`text-[11px] text-slate-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function fmt(iso: string): string {
  return iso.replace("T", " · ").replace(/\..+Z$/, " UTC");
}

/* ------------------------------------------------------------------ *
 *  Printable SITREP — a self-contained HTML document opened in a new
 *  window for browser print-to-PDF. White background, monospace tables,
 *  A4 portrait, no app chrome.
 * ------------------------------------------------------------------ */
function renderPrintableSitrep(bundle: SitrepBundle): string {
  const { cap, sitrep } = bundle;
  const info = cap.alert.info[0];
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const wardRows = sitrep.per_ward
    .map(
      (w) => `
      <tr>
        <td><strong>${w.ward_id.replace("UK-CHM-", "")}</strong><br><span class="dim">${esc(w.ward_name)}</span></td>
        <td class="risk">${w.risk_level}</td>
        <td class="mono">${w.rainfall_intensity_mm_hr} / ${w.dynamic_threshold_mm_hr}<br><span class="dim">${w.exceedance_ratio.toFixed(2)}×</span></td>
        <td class="mono">${w.peak_discharge_m3_per_s}</td>
        <td class="mono">${(w.debris_flow_probability * 100).toFixed(0)}%</td>
        <td class="mono">${Math.round(w.estimated_flood_arrival_min)}m</td>
        <td class="mono">${w.vulnerable_population.toLocaleString()}</td>
      </tr>`
    )
    .join("");

  const wardBlocks = sitrep.per_ward
    .map(
      (w) => `
      <div class="block">
        <h4>${w.ward_id} — ${esc(w.ward_name)}</h4>
        <p class="action">${esc(w.recommended_action)}</p>
        <div class="cols">
          <div>
            <p class="cap">Critical infrastructure</p>
            <ul>${w.critical_infrastructure
              .map(
                (c) =>
                  `<li><span class="tag">[${c.type}]</span> ${esc(c.name)} <span class="dim">(gauge ${c.critical_gauge_level_m}m)</span></li>`
              )
              .join("")}</ul>
          </div>
          <div>
            <p class="cap">Evacuation assembly</p>
            <ul>${w.evacuation_plan
              .map(
                (e) =>
                  `<li><span class="tag ok">+${e.safe_elevation_differential_m.toFixed(0)}m</span> ${esc(e.name)} <span class="dim">(cap. ${e.capacity_persons}, ${e.route_id})</span></li>`
              )
              .join("")}</ul>
          </div>
        </div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(sitrep.sitrep_id)} — NDRF SITREP</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", Consolas, monospace; color:#111; font-size:10px; line-height:1.45; margin:0; }
  h1 { font-size:15px; margin:0 0 2px; }
  h2 { font-size:12px; margin:14px 0 4px; border-bottom:2px solid #b45309; padding-bottom:2px; text-transform:uppercase; letter-spacing:0.5px; }
  h3 { font-size:11px; margin:8px 0 3px; }
  h4 { font-size:10px; margin:6px 0 2px; }
  .classif { color:#b45309; font-weight:bold; letter-spacing:1.5px; font-size:9px; }
  .header { display:flex; justify-content:space-between; border-bottom:2px solid #b45309; padding-bottom:4px; }
  .alert-box { border:2px solid #dc2626; background:#fef2f2; padding:6px 8px; margin:8px 0; }
  .alert-box .lvl { display:inline-block; background:#dc2626; color:#fff; padding:1px 6px; font-weight:bold; font-size:9px; }
  table { width:100%; border-collapse:collapse; margin:4px 0; }
  th, td { text-align:left; padding:3px 5px; border-bottom:1px solid #ddd; vertical-align:top; font-size:9px; }
  th { background:#f1f5f9; text-transform:uppercase; font-size:8px; letter-spacing:0.5px; }
  .mono { font-family:"Courier New", monospace; }
  .dim { color:#666; font-size:8px; }
  .risk { font-weight:bold; color:#dc2626; }
  .tag { font-weight:bold; color:#b45309; }
  .tag.ok { color:#059669; }
  .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin:4px 0; }
  .grid > div { border:1px solid #ddd; padding:3px 5px; }
  .cap { font-size:8px; text-transform:uppercase; letter-spacing:0.5px; color:#555; margin:2px 0 1px; }
  .block { border:1px solid #ccc; padding:5px 7px; margin:5px 0; }
  .action { font-style:italic; color:#7c2d12; margin:2px 0 4px; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .cols ul { margin:0; padding-left:14px; }
  .cols li { margin:1px 0; }
  .directive { border-left:4px solid #dc2626; background:#fef2f2; padding:5px 8px; margin:6px 0; font-size:9.5px; }
  .foot { margin-top:10px; border-top:1px solid #ccc; padding-top:4px; font-size:8px; color:#666; }
  .poly { font-size:7.5px; color:#444; word-break:break-all; background:#f8fafc; padding:4px; border:1px solid #e2e8f0; margin:3px 0; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="classif">RESTRICTED · OPERATIONAL · NDRF USE</div>
      <h1>${esc(sitrep.sitrep_id)}</h1>
      <div class="dim">${esc(sitrep.issuing_authority)}</div>
    </div>
    <div style="text-align:right">
      <div class="dim">Issued</div>
      <div class="mono">${esc(fmt(sitrep.issued_at))}</div>
      <div class="dim" style="margin-top:3px">Telemetry obs.</div>
      <div class="mono">${esc(fmt(sitrep.telemetry_observed_at))}</div>
    </div>
  </div>

  <div class="alert-box">
    <span class="lvl">${sitrep.basin_wide_alert_level}</span>
    &nbsp;<strong>${esc(info.event)}</strong>
    <span class="dim" style="float:right">${info.severity} · ${info.urgency} · ${info.certainty}</span>
    <div style="margin-top:3px"><strong>${esc(info.headline)}</strong></div>
  </div>

  <h2>CAP Identifiers</h2>
  <table>
    <tr><th>Identifier</th><td class="mono">${esc(cap.alert.identifier)}</td><th>Sender</th><td class="mono">${esc(cap.alert.sender)}</td></tr>
    <tr><th>Status</th><td>${cap.alert.status} · ${cap.alert.msgType} · ${cap.alert.scope}</td><th>Codes</th><td>${cap.alert.code.join(", ")}</td></tr>
    <tr><th>Effective</th><td class="mono">${esc(fmt(info.effective))}</td><th>Expires</th><td class="mono">${esc(fmt(info.expires))}</td></tr>
    <tr><th>Sender name</th><td colspan="3">${esc(info.senderName)}</td></tr>
    <tr><th>Audience</th><td colspan="3">${esc(info.audience)}</td></tr>
    <tr><th>Contact</th><td colspan="3">${esc(info.contact)}</td></tr>
  </table>

  <h2>Tactical Summary</h2>
  <div class="grid">
    <div><div class="cap">Confluence Q</div><div class="mono"><strong>${sitrep.cumulative_lower_basin_discharge_m3_per_s} m³/s</strong></div></div>
    <div><div class="cap">Surge lead</div><div class="mono"><strong>${sitrep.lower_basin_surge_arrival_min} min</strong></div></div>
    <div><div class="cap">Routing</div><div class="mono">${sitrep.routing_order.map((r) => r.replace("UK-CHM-", "")).join(" → ")}</div></div>
    <div><div class="cap">Vulnerable pop.</div><div class="mono">${sitrep.tactical_summary.vulnerable_population_total.toLocaleString()}</div></div>
    <div><div class="cap">Livestock</div><div class="mono">${sitrep.tactical_summary.livestock_total.toLocaleString()}</div></div>
    <div><div class="cap">Shelter capacity / coverage</div><div class="mono">${sitrep.tactical_summary.shelter_capacity_total.toLocaleString()} (${sitrep.tactical_summary.shelter_coverage_pct}%)</div></div>
  </div>
  <div class="directive">
    <strong>NDRF DEPLOYMENT DIRECTIVE</strong><br>
    ▸ ${esc(sitrep.ndrf_deployment_directive)}
  </div>

  <h2>Per-Ward Assessment</h2>
  <table>
    <thead><tr><th>Ward</th><th>Risk</th><th>Rain / Thr</th><th>Peak Q (m³/s)</th><th>Debris</th><th>Arrival</th><th>Vuln. pop.</th></tr></thead>
    <tbody>${wardRows}</tbody>
  </table>

  <h2>Critical Assets &amp; Evacuation Plan</h2>
  ${wardBlocks}

  <h2>CAP Area</h2>
  <p>${esc(info.area.areaDesc)}</p>
  <p class="cap">Polygon (lat,lng pairs — OASIS CAP 1.2 §3.2.4)</p>
  <div class="poly">${esc(info.area.polygon)}</div>
  <p class="dim">geocodes: ${info.area.geocode.map((g) => `${g.valueName}=${g.value}`).join("; ")}</p>

  <div class="foot">
    Generated by ISRO-NRSC FFEWS v1.4.0-ops · CAP profile: ${cap.cap_profile} v${cap.cap_version}<br>
    Coordinated with: ${sitrep.coordinated_with.join(", ")}.
  </div>
</body>
</html>`;
}
