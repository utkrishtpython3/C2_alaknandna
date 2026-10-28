"use client";

import React, { useState } from "react";
import {
  X,
  ShieldAlert,
  FileText,
  Radio,
  RadioTower,
  Download,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  Users,
  Anchor,
  Truck,
  AlertTriangle,
  Send,
  Layers,
  Activity,
  PhoneCall,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import type { BasinCascadeResult, RiskLevel } from "@/lib/hydrologyEngine";

interface NdrfCommandPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  cascade: BasinCascadeResult | null;
  leadTimeMin?: number;
  confluenceQ?: number;
  alertLevel?: RiskLevel;
}

type NdrfTab = "sachet" | "ics204" | "cwc" | "bhuvan" | "sop" | "comms" | "shelters";

export function NdrfCommandPostModal({
  isOpen,
  onClose,
  cascade,
  leadTimeMin = 26,
  confluenceQ = 146.0,
  alertLevel = "EXTREME",
}: NdrfCommandPostModalProps) {
  const [activeTab, setActiveTab] = useState<NdrfTab>("sachet");
  const [copiedXml, setCopiedXml] = useState(false);
  const [copiedCbs, setCopiedCbs] = useState(false);
  const [copiedBhuvan, setCopiedBhuvan] = useState(false);
  const [bhuvanDownloadSuccess, setBhuvanDownloadSuccess] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [selectedCwcStation, setSelectedCwcStation] = useState<string>("001-M-CWC-ALAK-01");

  // SOP interactive task states
  const [sopTasks, setSopTasks] = useState<Record<string, boolean>>({
    p1_verify: true,
    p1_seoc: true,
    p1_klaxon: true,
    p1_cap: true,
    p2_nh7: true,
    p2_gates: true,
    p2_sdrf: true,
    p3_evac: false,
    p3_livestock: false,
    p3_med: false,
    p4_drone: true,
    p4_damming: false,
    p4_sitrep: false,
  });

  if (!isOpen) return null;

  const incidentId = `NDRF-08BN-GLOF-CHAMOLI-${Date.now().toString().slice(-6)}`;
  const timestampIso = new Date().toISOString();
  const timestampIst = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // NDMA SACHET CAP-CP v1.2 Valid XML
  const capXmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${incidentId}</identifier>
  <sender>commandant.08bn-ndrf@gov.in</sender>
  <sent>${timestampIso}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <code authority="NDMA-CAP-CP-v1.2">IN-UT-CHM-FL-106</code>
  <info>
    <language>en-IN</language>
    <category>Met</category>
    <event>Flash Flood / High-Gradient Debris Surge</event>
    <urgency>Immediate</urgency>
    <severity>${alertLevel === "CATACLYSMIC" || alertLevel === "EXTREME" ? "Extreme" : "Severe"}</severity>
    <certainty>Observed</certainty>
    <eventCode>
      <valueName>DisasterType</valueName>
      <value>106</value>
    </eventCode>
    <effective>${timestampIso}</effective>
    <onset>${new Date(Date.now() + leadTimeMin * 60000).toISOString()}</onset>
    <expires>${new Date(Date.now() + 6 * 3600000).toISOString()}</expires>
    <senderName>Commandant, 08 Battalion NDRF (Chamoli FOB) in coordination with SDMA Uttarakhand</senderName>
    <headline>IMMEDIATE EVACUATION DIRECTIVE: Catastrophic Surge in Alaknanda-Dhauliganga Basin</headline>
    <description>Orographic cloudburst and Hanging Glacial Lake outburst detected upstream of Raini/Tapovan. Debris wave velocity 6.8 m/s with peak discharge ${confluenceQ.toFixed(1)} m³/s. River stage forecast to rise +8.5m overtopping Vishnuprayag bridge within ${leadTimeMin} minutes.</description>
    <instruction>Execute immediate vertical evacuation to uphill terrain at least 150m above riverbed. Do not attempt road transit on NH-7. Proceed to Pandukeshwar Pilgrim Shelter or Joshimath GIC Ground. Unshackle livestock immediately.</instruction>
    <contact>NDRF State EOC: 1070 / 1078 | Satellite FOB: 01372-252101</contact>
    <area>
      <areaDesc>Alaknanda-Dhauliganga River Gorge corridor: Tapovan, Joshimath, Helang, Vishnuprayag, Pandukeshwar</areaDesc>
      <polygon>30.552,79.564 30.538,79.571 30.525,79.578 30.510,79.582 30.495,79.579 30.485,79.568 30.512,79.554 30.540,79.558 30.552,79.564</polygon>
    </area>
  </info>
  <info>
    <language>hi-IN</language>
    <category>Met</category>
    <event>भीषण फ्लैश फ्लड / मलबा प्रवाह</event>
    <urgency>Immediate</urgency>
    <severity>Extreme</severity>
    <certainty>Observed</certainty>
    <senderName>कमान्डेंट, 08वीं वाहिनी एन.डी.आर.एफ. (चमोली बेस)</senderName>
    <headline>तत्काल निकासी चेतावनी: अलकनंदा-धौलीगंगा घाटी में भीषण बाढ़ का खतरा</headline>
    <description>धौलीगंगा एवं अलकनंदा घाटी में विनाशकारी फ्लैश फ्लड। संगम स्थल पर जलस्तर 8.5 मीटर बढ़ने का अनुमान। नदी किनारे के सभी गांव तुरंत खाली करें।</description>
    <instruction>नदी के किनारे तुरंत छोड़ें और कम से कम 150 मीटर ऊंचे पहाड़ी स्थानों (गोरसों बुग्याल / जोशीमठ जीआईसी) की ओर प्रस्थान करें। राष्ट्रीय राजमार्ग 7 पर वाहनों का आवागमन बंद है।</instruction>
    <area>
      <areaDesc>जोशीमठ, विष्णुप्रयाग, हेलंग गॉर्ज, तपोवन, पाण्डुकेश्वर</areaDesc>
      <polygon>30.552,79.564 30.538,79.571 30.525,79.578 30.510,79.582 30.495,79.579 30.485,79.568 30.512,79.554 30.540,79.558 30.552,79.564</polygon>
    </area>
  </info>
</alert>`;

  const cbsSmsEnglish = `NDRF RED ALERT: Flash flood surge in Dhauliganga gorge. Evacuate riverbanks immediately to high ground (+150m). NH-7 closed. NDRF Helpline: 1078.`;
  const cbsSmsHindi = `एनडीआरएफ लाल चेतावनी: धौलीगंगा में भीषण बाढ़। तुरंत नदी किनारे छोड़ ऊंचे सुरक्षित स्थानों पर जाएं। बद्रीनाथ मार्ग बंद। हेल्पलाइन: 1078.`;

  const handleCopyXml = async () => {
    try {
      await navigator.clipboard.writeText(capXmlPayload);
      setCopiedXml(true);
      setTimeout(() => setCopiedXml(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleDownloadXml = () => {
    const blob = new Blob([capXmlPayload], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${incidentId}_CAP_CP_v1.2.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCbs = async () => {
    try {
      await navigator.clipboard.writeText(`${cbsSmsEnglish}\n\n${cbsSmsHindi}`);
      setCopiedCbs(true);
      setTimeout(() => setCopiedCbs(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleBroadcastSachet = () => {
    setIsBroadcasting(true);
    setTimeout(() => {
      setIsBroadcasting(false);
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 4000);
    }, 1800);
  };

  // ISRO Bhuvan / NRSC Disaster Management Support (DMS) Standard OGC GeoJSON
  const bhuvanGeoJson = JSON.stringify(
    {
      type: "FeatureCollection",
      name: "NRSC_ISRO_DMS_CHAMOLI_FLASHFLOOD_INUNDATION",
      crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
      },
      metadata: {
        organization: "NRSC_ISRO_EARTH_OBSERVATION_DISASTER_MANAGEMENT_SUPPORT",
        portal: "BHUVAN_GEOPLATFORM_DISASTER_MANAGEMENT",
        disaster_event: "GLOF_AND_DEBRIS_CASCADE_ALAKNANDA",
        state: "UTTARAKHAND",
        district: "CHAMOLI",
        hpc_surrogate: "NEBIUS_8X_H100_MODULUS_PINN_TENSORRT_10",
        timestamp_utc: timestampIso,
        peak_discharge_m3_s: Number(confluenceQ.toFixed(1)),
        evacuation_lead_min: leadTimeMin,
        alert_status: alertLevel,
        sensor_fusion: ["CARTOSAT-2S", "RISAT-1A_SAR", "INSAT-3DR_HEM", "TERRAIN_RGB_10M"],
      },
      features: [
        {
          type: "Feature",
          id: "INUNDATION_EXTENT_SECTOR_1_TAPOVAN",
          properties: {
            sector: "Sector 1: Tapovan / Dhauliganga",
            risk_level: "CATACLYSMIC",
            peak_stage_m_asl: 1797.4,
            max_depth_m: 8.9,
            debris_bulking_ratio: 2.1,
            velocity_m_s: 7.2,
            infrastructure_at_risk: ["Tapovan Barrage Intake", "Dhauliganga Bridge", "NH-07 Low Bridge"],
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [79.625, 30.495],
                [79.638, 30.505],
                [79.645, 30.518],
                [79.635, 30.525],
                [79.62, 30.512],
                [79.615, 30.5],
                [79.625, 30.495],
              ],
            ],
          },
        },
        {
          type: "Feature",
          id: "INUNDATION_EXTENT_SECTOR_2_JOSHIMATH_ESCARPMENT",
          properties: {
            sector: "Sector 2: Joshimath Flank",
            risk_level: "EXTREME",
            peak_stage_m_asl: 1894.2,
            max_depth_m: 6.4,
            debris_bulking_ratio: 1.85,
            velocity_m_s: 5.8,
            infrastructure_at_risk: ["Joshimath Escarpment Toe", "Alaknanda Riverbed Access Road"],
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [79.56, 30.55],
                [79.575, 30.562],
                [79.585, 30.57],
                [79.572, 30.578],
                [79.555, 30.565],
                [79.56, 30.55],
              ],
            ],
          },
        },
        {
          type: "Feature",
          id: "INUNDATION_EXTENT_SECTOR_3_HELANG_CHOKEPOINT",
          properties: {
            sector: "Sector 3: Helang Gorge Chokepoint",
            risk_level: "EXTREME",
            peak_stage_m_asl: 1542.2,
            max_depth_m: 9.7,
            debris_bulking_ratio: 2.15,
            velocity_m_s: 8.4,
            infrastructure_at_risk: ["Helang Chokepoint NH-07 Cut-off", "Riverbed Encampments"],
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [79.51, 30.52],
                [79.525, 30.532],
                [79.535, 30.54],
                [79.52, 30.548],
                [79.505, 30.535],
                [79.51, 30.52],
              ],
            ],
          },
        },
        {
          type: "Feature",
          id: "INUNDATION_EXTENT_SECTOR_4_VISHNUPRAYAG_CONFLUENCE",
          properties: {
            sector: "Sector 4: Vishnuprayag Confluence",
            risk_level: "EXTREME",
            peak_stage_m_asl: 1378.1,
            max_depth_m: 7.9,
            debris_bulking_ratio: 1.95,
            velocity_m_s: 6.9,
            infrastructure_at_risk: ["Vishnuprayag Confluence Bridge Deck", "Pilgrim Ghats"],
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [79.565, 30.56],
                [79.58, 30.575],
                [79.59, 30.585],
                [79.578, 30.592],
                [79.558, 30.575],
                [79.565, 30.56],
              ],
            ],
          },
        },
      ],
    },
    null,
    2
  );

  const handleCopyBhuvan = async () => {
    try {
      await navigator.clipboard.writeText(bhuvanGeoJson);
      setCopiedBhuvan(true);
      setTimeout(() => setCopiedBhuvan(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleDownloadBhuvan = () => {
    const blob = new Blob([bhuvanGeoJson], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NRSC_ISRO_Bhuvan_Inundation_Chamoli_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    setBhuvanDownloadSuccess(true);
    setTimeout(() => setBhuvanDownloadSuccess(false), 3000);
  };

  const cwcStations = [
    {
      id: "001-M-CWC-ALAK-01",
      name: "Vishnuprayag Confluence Hydrometric Station",
      river: "Alaknanda / Dhauliganga Confluence",
      zeroGaugeAltM: 1370.2,
      warningLevelM: 1374.5,
      dangerLevelM: 1376.0,
      highestFloodLevelM: 1382.4,
      highestFloodDate: "07-02-2021",
      currentStageM: 1378.1,
      ratingFormula: "Q = 14.82 · (H - 1370.20)^1.68",
      dischargeQ: Math.round(confluenceQ),
      status: "DANGER",
    },
    {
      id: "002-M-CWC-DHAULI-02",
      name: "Tapovan Barrage Intake Gauge Station",
      river: "Dhauliganga River",
      zeroGaugeAltM: 1788.0,
      warningLevelM: 1792.0,
      dangerLevelM: 1794.5,
      highestFloodLevelM: 1805.2,
      highestFloodDate: "07-02-2021",
      currentStageM: 1797.4,
      ratingFormula: "Q = 9.45 · (H - 1788.00)^1.75",
      dischargeQ: 384.9,
      status: "CRITICAL",
    },
    {
      id: "003-M-CWC-ALAK-03",
      name: "Helang Bridge Gorge Chokepoint Station",
      river: "Alaknanda River",
      zeroGaugeAltM: 1532.5,
      warningLevelM: 1538.0,
      dangerLevelM: 1540.5,
      highestFloodLevelM: 1546.8,
      highestFloodDate: "17-06-2013",
      currentStageM: 1542.2,
      ratingFormula: "Q = 12.10 · (H - 1532.50)^1.71",
      dischargeQ: 248.7,
      status: "DANGER",
    },
  ];

  const handlePrintIcs = () => {
    window.print();
  };

  const toggleTask = (taskId: string) => {
    setSopTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl border border-rose-500/60 bg-slate-950 shadow-[0_0_60px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/30 overflow-hidden font-sans">
        
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/50 bg-rose-950/50 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.35)]">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 tactical-font tracking-wide">
                  NDRF Incident Command Post (ICP) &bull; NDMA Sachet Integration Center
                </h3>
                <span className="rounded bg-rose-950/80 px-2 py-0.5 text-[9.5px] font-mono font-bold text-rose-300 border border-rose-700/60 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                  08 BN NDRF &bull; MHA INDIA
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Official Incident Command System (ICS-204), C-DOT Cell Broadcast &amp; Sachet CAP-CP v1.2 Gateway
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
            title="Close NDRF Command Post"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tactical Sub-Nav Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900/60 px-4 py-2 sm:px-6">
          {[
            { id: "sachet", label: "NDMA Sachet & C-DOT CBC", icon: RadioTower },
            { id: "ics204", label: "ICS-204 Tasking Order", icon: FileText },
            { id: "cwc", label: "CWC Hydro Stations & DL", icon: Activity },
            { id: "bhuvan", label: "ISRO Bhuvan GeoJSON", icon: Layers },
            { id: "sop", label: "MHA Flood SOP Checklist", icon: CheckCircle2 },
            { id: "comms", label: "Radio Comms Plan (ICS-205)", icon: Radio },
            { id: "shelters", label: "Shelter & Triage Matrix", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as NdrfTab)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition cursor-pointer ${
                  active
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* TAB 1: NDMA SACHET & C-DOT CELL BROADCAST CENTRE */}
          {activeTab === "sachet" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                      ITU-T X.1303 / NDMA CAP-CP v1.2 Standard Dissemination Payload
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono text-cyan-300">
                    Incident ID: {incidentId}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="rounded border border-slate-800 bg-slate-950/80 p-2.5">
                    <span className="text-slate-500 block text-[10px]">ALERT TYPE / URGENCY</span>
                    <strong className="text-rose-400 font-bold">106 FLASH FLOOD &bull; IMMEDIATE</strong>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/80 p-2.5">
                    <span className="text-slate-500 block text-[10px]">DISCHARGE AT CONFLUENCE</span>
                    <strong className="text-cyan-300 font-bold">{confluenceQ.toFixed(1)} m³/s (+8.5m Rise)</strong>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/80 p-2.5">
                    <span className="text-slate-500 block text-[10px]">T-MINUS LEAD TIME</span>
                    <strong className="text-amber-300 font-bold">{leadTimeMin} Minutes Window</strong>
                  </div>
                </div>

                {/* Live XML Code Area */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-rose-400" />
                      Authorized CAP-CP XML Payload:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyXml}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:text-slate-100 transition cursor-pointer"
                      >
                        {copiedXml ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedXml ? "Copied!" : "Copy XML"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadXml}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-cyan-300 hover:text-cyan-100 transition cursor-pointer"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download .xml</span>
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[10.5px] leading-relaxed text-slate-300 select-all">
                    {capXmlPayload}
                  </pre>
                </div>
              </div>

              {/* C-DOT Cell Broadcast Service (CBS) SMS String */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
                    <RadioTower className="h-4 w-4 text-amber-400" />
                    C-DOT Cell Broadcast Service (CBS) Tower SMS Payloads (DoT Standard):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCbs}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:text-slate-100 transition cursor-pointer"
                  >
                    {copiedCbs ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCbs ? "Copied!" : "Copy SMS"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">English GSM Broadcast (90 chars):</span>
                    <p className="font-mono text-slate-200 bg-slate-900/60 p-2 rounded border border-slate-800/80">{cbsSmsEnglish}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
                    <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">हिन्दी सेल ब्रॉडकास्ट (देवनागरी):</span>
                    <p className="font-sans text-slate-200 bg-slate-900/60 p-2 rounded border border-slate-800/80">{cbsSmsHindi}</p>
                  </div>
                </div>

                {/* Cellular Tower Delivery Status */}
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>Airtel: <strong className="text-emerald-400">99.2% ACK (14 BTS)</strong></span>
                    <span>Jio: <strong className="text-emerald-400">98.8% ACK (12 BTS)</strong></span>
                    <span>BSNL: <strong className="text-emerald-400">97.4% ACK (9 BTS)</strong></span>
                  </div>

                  <button
                    type="button"
                    disabled={isBroadcasting}
                    onClick={handleBroadcastSachet}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500 bg-rose-600 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] transition cursor-pointer disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5 fill-slate-950" />
                    <span>{isBroadcasting ? "Transmitting to Sachet Nodes..." : "Transmit to NDMA Sachet & C-DOT CBC"}</span>
                  </button>
                </div>

                {broadcastSuccess && (
                  <div className="rounded border border-emerald-500/50 bg-emerald-950/40 p-2.5 text-xs font-mono text-emerald-300 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Successfully injected into NDMA Sachet National Server (164.100.112.52) &bull; Broadcast active across Chamoli mobile cells</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: OFFICIAL MHA FORM ICS-204 (ASSIGNMENT LIST) */}
          {activeTab === "ics204" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-rose-400" />
                    NDMA / MHA Form ICS-204 &bull; Incident Assignment List
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400">
                    Tactical tasking orders for 08 Battalion NDRF Coys &amp; SDRF Uttarakhand QRTs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintIcs}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print ICS-204 Order</span>
                </button>
              </div>

              {/* Printable High-Contrast Military ICS-204 Form */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 font-mono text-xs">
                {/* Form Header Box */}
                <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/60 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10.5px]">
                  <div>
                    <span className="text-slate-500 block">1. INCIDENT NAME:</span>
                    <strong className="text-slate-100 font-bold">CHAMOLI GLOF FLASH FLOOD</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">2. OPERATIONAL PERIOD:</span>
                    <strong className="text-slate-100 font-bold">{timestampIst} &rarr; +06:00h</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">3. BRANCH:</span>
                    <strong className="text-slate-100 font-bold">ALAKNANDA-DHAULIGANGA</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">4. INCIDENT COMMANDER:</span>
                    <strong className="text-rose-400 font-bold">COMMANDANT, 08 BN NDRF</strong>
                  </div>
                </div>

                {/* Operations Assignment Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Division / Sector</th>
                        <th className="px-3 py-2 font-semibold">Assigned Unit &amp; Leader</th>
                        <th className="px-3 py-2 font-semibold">Personnel &amp; Equipment</th>
                        <th className="px-3 py-2 font-semibold">Tactical Directives &amp; Mission</th>
                        <th className="px-3 py-2 font-semibold">Callsign &amp; VHF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      <tr>
                        <td className="px-3 py-2.5 font-bold text-amber-300">
                          SECTOR 1<br /><span className="text-[9.5px] font-normal text-slate-400">Tapovan Barrage Reach</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <strong className="text-slate-100">08 BN NDRF COY-A</strong><br />
                          <span className="text-slate-400">Insp. R. S. Rawat</span>
                        </td>
                        <td className="px-3 py-2.5">
                          45 Personnel &bull; 4 IRBs (40HP)<br />
                          2 Deep Divers &bull; 1 VLD &bull; LoRa Gateway
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          Evacuate labor camp; establish cordon at NTPC tunnel mouth; deploy safety lifelines.
                        </td>
                        <td className="px-3 py-2.5 text-rose-300 font-bold">
                          EAGLE-1<br /><span className="text-[9.5px] font-mono text-cyan-400">146.525 MHz</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-bold text-cyan-300">
                          SECTOR 2<br /><span className="text-[9.5px] font-normal text-slate-400">Joshimath Flank &amp; HLZ</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <strong className="text-slate-100">08 BN NDRF COY-B</strong><br />
                          <span className="text-slate-400">SI Amit Negi</span>
                        </td>
                        <td className="px-3 py-2.5">
                          35 Personnel &bull; 2 Drone SAR (FLIR)<br />
                          4 BGAN Terminals &bull; 10 Trauma Kits
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          Secure Army Helipad for CASEVAC; manage uphill evacuation to GIC Relief Grounds (+150m ASL).
                        </td>
                        <td className="px-3 py-2.5 text-rose-300 font-bold">
                          HAWK-2<br /><span className="text-[9.5px] font-mono text-cyan-400">147.100 MHz</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-bold text-purple-300">
                          SECTOR 3<br /><span className="text-[9.5px] font-normal text-slate-400">Helang Gorge &amp; NH-7</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <strong className="text-slate-100">SDRF Uttarakhand Coy-2</strong><br />
                          <span className="text-slate-400">SI Vikram Singh</span>
                        </td>
                        <td className="px-3 py-2.5">
                          25 Personnel &bull; 2 JCB Earthmovers<br />
                          1 VHF Repeater Van &bull; Spike Cordon
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          Complete highway interdiction on NH-7; halt pilgrim transit; divert to Urgam high terrace.
                        </td>
                        <td className="px-3 py-2.5 text-rose-300 font-bold">
                          CHETAK-3<br /><span className="text-[9.5px] font-mono text-cyan-400">147.100 MHz</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-bold text-rose-300">
                          SECTOR 4<br /><span className="text-[9.5px] font-normal text-slate-400">Vishnuprayag Confluence</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <strong className="text-slate-100">ITBP 1st Bn + NDRF Divers</strong><br />
                          <span className="text-slate-400">Asst. Cmdt P. K. Sharma</span>
                        </td>
                        <td className="px-3 py-2.5">
                          30 Personnel &bull; 2 White-water Rafts<br />
                          High-strength Lifelines &bull; Megaphones
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          Clear confluence footbridge; backwater monitoring; guide Pandukeshwar bank to safe pilgrim shelter.
                        </td>
                        <td className="px-3 py-2.5 text-rose-300 font-bold">
                          TRISHUL-4<br /><span className="text-[9.5px] font-mono text-cyan-400">146.525 MHz</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
                  <span>Prepared by: Planning Section Chief (08 BN NDRF)</span>
                  <span>Approved by: Incident Commander (Commandant 08 BN NDRF)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CENTRAL WATER COMMISSION (CWC) RIVER GAUGING & RATING CURVES */}
          {activeTab === "cwc" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Central Water Commission (CWC) &bull; Hydrometric River Gauging Network
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400">
                    Official CWC Warning Levels (WL), Danger Levels (DL), HFL benchmarks &amp; Stage-Discharge Rating Curves
                  </p>
                </div>
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  HYDRO TELEMETRY SYNCED
                </span>
              </div>

              {/* Station Selector Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {cwcStations.map((st) => {
                  const isSel = selectedCwcStation === st.id;
                  const isCritical = st.status === "CRITICAL";
                  const surchargeM = (st.currentStageM - st.dangerLevelM).toFixed(2);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedCwcStation(st.id)}
                      className={`flex flex-col text-left p-3.5 rounded-xl border transition cursor-pointer ${
                        isSel
                          ? "border-cyan-500 bg-cyan-950/40 text-cyan-200 ring-1 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                          : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold text-slate-400">{st.id}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold border ${
                            isCritical
                              ? "bg-rose-950 text-rose-300 border-rose-700 animate-pulse"
                              : "bg-amber-950 text-amber-300 border-amber-700"
                          }`}
                        >
                          +{surchargeM}m OVER DANGER
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-100 leading-tight mb-2">{st.name}</span>
                      <div className="mt-auto space-y-1 font-mono text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Current Gauge:</span>
                          <span className="font-bold text-rose-400">{st.currentStageM.toFixed(2)} m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Danger Level (DL):</span>
                          <span className="text-amber-400">{st.dangerLevelM.toFixed(2)} m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Warning Level (WL):</span>
                          <span className="text-cyan-400">{st.warningLevelM.toFixed(2)} m</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detailed Station Gauge & Stage-Discharge Profile */}
              {(() => {
                const cur = cwcStations.find((s) => s.id === selectedCwcStation) ?? cwcStations[0];
                const stageHeight = cur.currentStageM - cur.zeroGaugeAltM;
                const dangerRel = cur.dangerLevelM - cur.zeroGaugeAltM;
                const warningRel = cur.warningLevelM - cur.zeroGaugeAltM;
                const hflRel = cur.highestFloodLevelM - cur.zeroGaugeAltM;
                const maxScale = Math.max(stageHeight, hflRel) * 1.15;
                const pctStage = Math.min(100, Math.round((stageHeight / maxScale) * 100));
                const pctDanger = Math.min(100, Math.round((dangerRel / maxScale) * 100));
                const pctWarning = Math.min(100, Math.round((warningRel / maxScale) * 100));
                const pctHfl = Math.min(100, Math.round((hflRel / maxScale) * 100));

                return (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">{cur.name}</span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded">
                            {cur.river}
                          </span>
                        </div>
                        <span className="text-[10.5px] font-mono text-slate-400">
                          Zero Gauge Datum: {cur.zeroGaugeAltM.toFixed(2)}m Above MSL &bull; Benchmark HFL: {cur.highestFloodLevelM.toFixed(2)}m ({cur.highestFloodDate})
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-slate-400">Rating Formula Computed Q:</span>
                        <div className="text-base font-bold text-rose-400">{cur.dischargeQ.toFixed(1)} m&sup3;/s</div>
                      </div>
                    </div>

                    {/* Gauge Level Progress Bar Visualizer */}
                    <div className="space-y-2">
                      <div className="flex justify-between font-mono text-[10.5px]">
                        <span className="text-slate-400">Hydrometric Gauge Stage Scale</span>
                        <span className="font-bold text-rose-400">
                          Stage {cur.currentStageM.toFixed(2)}m ({(cur.currentStageM - cur.dangerLevelM).toFixed(2)}m above DL)
                        </span>
                      </div>
                      <div className="relative h-6 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                        {/* Warning Marker */}
                        <div
                          className="absolute top-0 bottom-0 border-r-2 border-dashed border-cyan-400 z-10"
                          style={{ left: `${pctWarning}%` }}
                          title={`Warning Level: ${cur.warningLevelM}m`}
                        />
                        {/* Danger Marker */}
                        <div
                          className="absolute top-0 bottom-0 border-r-2 border-dashed border-amber-400 z-10"
                          style={{ left: `${pctDanger}%` }}
                          title={`Danger Level: ${cur.dangerLevelM}m`}
                        />
                        {/* HFL Marker */}
                        <div
                          className="absolute top-0 bottom-0 border-r-2 border-rose-500 z-10"
                          style={{ left: `${pctHfl}%` }}
                          title={`Historical HFL: ${cur.highestFloodLevelM}m`}
                        />
                        {/* Current Water Level Fill */}
                        <div
                          className="h-full bg-gradient-to-r from-cyan-600 via-amber-500 to-rose-600 transition-all duration-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                          style={{ width: `${pctStage}%` }}
                        />
                      </div>
                      <div className="flex justify-between font-mono text-[9px] text-slate-400">
                        <span>Zero ({cur.zeroGaugeAltM}m)</span>
                        <span className="text-cyan-400">WL ({cur.warningLevelM}m)</span>
                        <span className="text-amber-400">DL ({cur.dangerLevelM}m)</span>
                        <span className="text-rose-400 font-bold">Current ({cur.currentStageM}m)</span>
                        <span className="text-slate-400">HFL ({cur.highestFloodLevelM}m)</span>
                      </div>
                    </div>

                    {/* Rating Formula Box */}
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 text-[10px]">CWC STAGE-DISCHARGE RATING EQUATION:</span>
                        <div className="text-sm font-bold text-cyan-300">{cur.ratingFormula}</div>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Calibrated against 2021 Chamoli Acoustic Doppler Current Profiler (ADCP) telemetry
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: ISRO BHUVAN & NRSC DISASTER MANAGEMENT SUPPORT (DMS) STANDARD GEOJSON */}
          {activeTab === "bhuvan" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    ISRO Bhuvan &bull; NRSC Disaster Management Support (DMS) Standard GeoJSON
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400">
                    OGC-compliant RFC 7946 Polygon Inundation Layers formatted for ISRO Bhuvan Disaster Geo-Portal ingestion
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBhuvan}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                  >
                    {copiedBhuvan ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedBhuvan ? "Copied" : "Copy GeoJSON"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadBhuvan}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-mono font-bold text-slate-950 hover:bg-emerald-500 transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download GeoJSON</span>
                  </button>
                </div>
              </div>

              {bhuvanDownloadSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/40 p-2 text-xs font-mono text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>GeoJSON exported successfully: Ready for ISRO Bhuvan Disaster Management Support upload.</span>
                </div>
              )}

              {/* GeoJSON Technical Code Block */}
              <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
                <div className="flex items-center justify-between mb-2 text-[10px] text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="text-emerald-400 font-bold">RFC 7946 &bull; WGS84 EPSG:4326 &bull; 4 Delineated Inundation Sectors</span>
                  <span>Sensor Fusion: Cartosat-2S &bull; RISAT-1A SAR &bull; INSAT-3DR</span>
                </div>
                <pre className="max-h-72 overflow-y-auto text-[11px] leading-relaxed text-emerald-300/90 select-all">
                  {bhuvanGeoJson}
                </pre>
              </div>

              {/* ISRO / NRSC Interoperability Info Banner */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  <span>Compatible with ISRO Bhuvan API v3.2 &bull; NDMA National Flood Risk Mapping Portal</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  Metadata schema: OGC CRS84 &bull; Inundation depth vertices attached
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: MHA STANDARD OPERATING PROCEDURE (SOP) CHECKLIST */}
          {activeTab === "sop" && (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Ministry of Home Affairs &bull; GLOF &amp; Flash Flood SOP Phase Protocol
                </h4>
                <p className="text-[11px] font-mono text-slate-400">
                  Interactive operational protocol checklist with automatic execution logging
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Phase 1 */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono font-bold text-rose-300 text-[11px]">
                      PHASE 1: ALERT VERIFICATION &amp; EOC (T-0 to T+5m)
                    </span>
                    <span className="text-[10px] font-mono rounded bg-rose-950 px-1.5 py-0.2 text-rose-400 border border-rose-800">
                      CRITICAL
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {[
                      { id: "p1_verify", text: "Verify Triton surrogate hydrodynamic surge crest (> 120 m³/s)" },
                      { id: "p1_seoc", text: "Activate State Emergency Operations Centre (SEOC) Dehradun" },
                      { id: "p1_klaxon", text: "Trigger acoustic civil defense klaxon siren along valley reach" },
                      { id: "p1_cap", text: "Broadcast NDMA Sachet CAP-CP v1.2 XML to C-DOT CBC cell towers" },
                    ].map((item) => (
                      <label key={item.id} className="flex items-start gap-2 cursor-pointer p-1 rounded hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          checked={sopTasks[item.id]}
                          onChange={() => toggleTask(item.id)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
                        />
                        <span className={sopTasks[item.id] ? "text-slate-300 line-through opacity-80" : "text-slate-100 font-medium"}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Phase 2 */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono font-bold text-amber-300 text-[11px]">
                      PHASE 2: INTERDICTION &amp; SLUICE GATES (T+5 to T+15m)
                    </span>
                    <span className="text-[10px] font-mono rounded bg-amber-950 px-1.5 py-0.2 text-amber-400 border border-amber-800">
                      ACTIVE
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {[
                      { id: "p2_nh7", text: "Total highway interdiction on Badrinath NH-7 at Helang & Pandukeshwar" },
                      { id: "p2_gates", text: "Order NTPC & NHPC barrage engineers to open bottom sluice gates" },
                      { id: "p2_sdrf", text: "Deploy SDRF QRTs with megaphone loudspeakers into riverbed hamlets" },
                    ].map((item) => (
                      <label key={item.id} className="flex items-start gap-2 cursor-pointer p-1 rounded hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          checked={sopTasks[item.id]}
                          onChange={() => toggleTask(item.id)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <span className={sopTasks[item.id] ? "text-slate-300 line-through opacity-80" : "text-slate-100 font-medium"}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Phase 3 */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono font-bold text-cyan-300 text-[11px]">
                      PHASE 3: VERTICAL EVACUATION (+150m ASL) (T+15 to T+30m)
                    </span>
                    <span className="text-[10px] font-mono rounded bg-cyan-950 px-1.5 py-0.2 text-cyan-400 border border-cyan-800">
                      IN PROGRESS
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {[
                      { id: "p3_evac", text: "Guide vulnerable population to designated uphill relief shelters" },
                      { id: "p3_livestock", text: "Unshackle cattle & sheep herds and herd toward higher pastures" },
                      { id: "p3_med", text: "Stock Forward Medical Post at Joshimath GIC with trauma triage packs" },
                    ].map((item) => (
                      <label key={item.id} className="flex items-start gap-2 cursor-pointer p-1 rounded hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          checked={sopTasks[item.id]}
                          onChange={() => toggleTask(item.id)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                        <span className={sopTasks[item.id] ? "text-slate-300 line-through opacity-80" : "text-slate-100 font-medium"}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Phase 4 */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono font-bold text-purple-300 text-[11px]">
                      PHASE 4: SAR &amp; SECONDARY WATCH (T+30m+)
                    </span>
                    <span className="text-[10px] font-mono rounded bg-purple-950 px-1.5 py-0.2 text-purple-400 border border-purple-800">
                      ON DECK
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {[
                      { id: "p4_drone", text: "Launch sentry UAV drone recon patrol over Ronti Gad headwaters" },
                      { id: "p4_damming", text: "Inspect tributary gorges for secondary landslide dam formation" },
                      { id: "p4_sitrep", text: "Compile and transmit MHA Commandant Incident Situation Report (SITREP)" },
                    ].map((item) => (
                      <label key={item.id} className="flex items-start gap-2 cursor-pointer p-1 rounded hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          checked={sopTasks[item.id]}
                          onChange={() => toggleTask(item.id)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-800 text-purple-500 focus:ring-0 cursor-pointer"
                        />
                        <span className={sopTasks[item.id] ? "text-slate-300 line-through opacity-80" : "text-slate-100 font-medium"}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RADIO COMMS PLAN (ICS-205) */}
          {activeTab === "comms" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-cyan-400" />
                  NDRF / Inter-Agency Radio Communication Plan (ICS-205)
                </h4>
                <p className="text-[11px] font-mono text-slate-400">
                  Tactical frequency plan for zero-telecom blackout resilient wireless communication
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Ch #</th>
                      <th className="px-3 py-2 font-semibold">Channel Function</th>
                      <th className="px-3 py-2 font-semibold">Tx / Rx Frequency</th>
                      <th className="px-3 py-2 font-semibold">Tone / Mode</th>
                      <th className="px-3 py-2 font-semibold">Assignment / Net Control</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200 text-[11px]">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-rose-400">CH-01</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-100">Tactical Command Net</td>
                      <td className="px-3 py-2.5 text-cyan-300 font-bold">146.525 MHz</td>
                      <td className="px-3 py-2.5 text-slate-400">FM &bull; CTCSS 88.5 Hz</td>
                      <td className="px-3 py-2.5">08 BN NDRF Forward Base (Joshimath)</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-amber-400">CH-02</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-100">Ground SAR &amp; Evacuation</td>
                      <td className="px-3 py-2.5 text-cyan-300 font-bold">147.100 MHz</td>
                      <td className="px-3 py-2.5 text-slate-400">FM &bull; CTCSS 100.0 Hz</td>
                      <td className="px-3 py-2.5">Tapovan &amp; Helang Sector Teams</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-cyan-400">CH-03</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-100">Air-to-Ground / Medevac</td>
                      <td className="px-3 py-2.5 text-cyan-300 font-bold">154.600 MHz</td>
                      <td className="px-3 py-2.5 text-slate-400">AM &bull; Wideband</td>
                      <td className="px-3 py-2.5">Army Aviation Chetak / ALH Dhruv</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-purple-400">CH-04</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-100">National RRC Backhaul HF</td>
                      <td className="px-3 py-2.5 text-cyan-300 font-bold">7120.0 kHz</td>
                      <td className="px-3 py-2.5 text-slate-400">USB (Upper Sideband)</td>
                      <td className="px-3 py-2.5">NDRF HQ New Delhi &bull; Rishikesh Base</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">STANDBY</span></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-emerald-400">CH-05</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-100">Zero-Telecom LoRaWAN Mesh</td>
                      <td className="px-3 py-2.5 text-cyan-300 font-bold">865.200 MHz</td>
                      <td className="px-3 py-2.5 text-slate-400">LoRa SF10 &bull; BW 125 kHz</td>
                      <td className="px-3 py-2.5">Autonomous Valley Acoustic Relays</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">ACTIVE</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SHELTERS & DEMOGRAPHICS TRIAGE MATRIX */}
          {activeTab === "shelters" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" />
                  NDRF Evacuation Shelter Capacities &amp; Population Triage Matrix
                </h4>
                <p className="text-[11px] font-mono text-slate-400">
                  Designated safe refuge zones with uphill elevation gains above catastrophic inundation stage
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                  <span className="text-slate-500 text-[10px]">TOTAL AT-RISK POPULATION</span>
                  <div className="text-lg font-bold text-rose-400">8,420 Persons</div>
                  <span className="text-[10px] text-slate-400">4 Monitored Gorge Wards</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                  <span className="text-slate-500 text-[10px]">LIVESTOCK HEADCOUNT</span>
                  <div className="text-lg font-bold text-amber-300">3,150 Head</div>
                  <span className="text-[10px] text-slate-400">Gau-bhais &bull; Sheep &bull; Equine</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                  <span className="text-slate-500 text-[10px]">TOTAL SHELTER CAPACITY</span>
                  <div className="text-lg font-bold text-emerald-400">11,500 Beds</div>
                  <span className="text-[10px] text-slate-400">136% Evacuation Coverage</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                  <span className="text-slate-500 text-[10px]">LEAD-TIME SAFETY MARGIN</span>
                  <div className="text-lg font-bold text-cyan-300">+{leadTimeMin - 12} Min Delta</div>
                  <span className="text-[10px] text-slate-400">Against Uphill Transit</span>
                </div>
              </div>

              {/* Shelters Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Designated Safe Shelter</th>
                      <th className="px-3 py-2 font-semibold">Shelter Elevation</th>
                      <th className="px-3 py-2 font-semibold">Safe Elevation Gain</th>
                      <th className="px-3 py-2 font-semibold">Pedestrian Transit</th>
                      <th className="px-3 py-2 font-semibold">Bed Capacity</th>
                      <th className="px-3 py-2 font-semibold">Readiness Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200 text-[11px]">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-100">
                        Pandukeshwar Pilgrim Shelter &bull; High Terrace
                      </td>
                      <td className="px-3 py-2.5 text-cyan-300">1,550m ASL</td>
                      <td className="px-3 py-2.5 text-emerald-400 font-bold">+178m above riverbed</td>
                      <td className="px-3 py-2.5 text-amber-300 font-bold">12 min ascent</td>
                      <td className="px-3 py-2.5 font-bold">2,500 Persons</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">OPEN / STOCKED</span></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-100">
                        Joshimath Govt Inter College (GIC) Ground
                      </td>
                      <td className="px-3 py-2.5 text-cyan-300">2,040m ASL</td>
                      <td className="px-3 py-2.5 text-emerald-400 font-bold">+150m above riverbed</td>
                      <td className="px-3 py-2.5 text-amber-300 font-bold">18 min ascent</td>
                      <td className="px-3 py-2.5 font-bold">4,000 Persons</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">OPEN / STOCKED</span></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-100">
                        Tapovan High Ridge Army Encampment
                      </td>
                      <td className="px-3 py-2.5 text-cyan-300">2,110m ASL</td>
                      <td className="px-3 py-2.5 text-emerald-400 font-bold">+260m above riverbed</td>
                      <td className="px-3 py-2.5 text-rose-400 font-bold">9 min ascent</td>
                      <td className="px-3 py-2.5 font-bold">1,200 Persons</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-amber-950 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-400 border border-amber-800">ACTIVE EVAC</span></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-100">
                        Urgam Highland Plateau Relief Camp
                      </td>
                      <td className="px-3 py-2.5 text-cyan-300">1,820m ASL</td>
                      <td className="px-3 py-2.5 text-emerald-400 font-bold">+280m above riverbed</td>
                      <td className="px-3 py-2.5 text-amber-300 font-bold">14 min ascent</td>
                      <td className="px-3 py-2.5 font-bold">1,800 Persons</td>
                      <td className="px-3 py-2.5"><span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-400 border border-emerald-800">OPEN / STOCKED</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <span>Authorized by Commandant, 08 Battalion NDRF (Ghaziabad/Chamoli FOB) &bull; MHA</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition cursor-pointer"
          >
            Close Incident Command Post
          </button>
        </div>

      </div>
    </div>
  );
}

export default NdrfCommandPostModal;
