/**
 * ============================================================================
 *  TERRAIN 3D GEOSPATIAL DATASET (Joshimath–Helang–Vishnuprayag Gorge Corridor)
 * ============================================================================
 *  National Disaster Response Force (NDRF) IT Directorate & ISRO-NRSC
 *  Upper Alaknanda–Dhauliganga Flash Flood Early Warning System (EWS)
 *
 *  Corridor Bounds: [79.52° E, 30.52° N] to [79.62° E, 30.60° N]
 *  Confluence Anchor: Vishnuprayag [79.565° E, 30.555° N]
 * ============================================================================
 */

export interface TransceiverStation3D {
  id: "station-a" | "station-b" | "station-c" | "station-d";
  callsign: string;
  name: string;
  role: "PRIMARY_UPLINK" | "COMMAND_HUB" | "MID_RELAY" | "RIVERBED_IOT";
  tier: "SATCOM_GATEWAY" | "C2_FOB" | "GORGE_REPEAT" | "HYDRO_SENSOR";
  coordinates: [number, number, number]; // [lng, lat, alt_m]
  frequencyMhz: number;
  txPowerDbm: number;
  protocol: "LoRaWAN 865-867MHz" | "VHF 144MHz" | "SATCOM GSAT-7A";
  batteryPct: number;
  status: "ONLINE" | "FAILOVER" | "BREACH_CRITICAL";
  description: string;
}

export interface RFMeshArc3D {
  id: string;
  fromId: string;
  toId: string;
  fromCoord: [number, number, number];
  toCoord: [number, number, number];
  peakAltM: number;
  distanceKm: number;
  fresnelClearanceM: number;
  snrDb: number;
  nominalColor: string;
  failoverColor: string;
}

export interface EvacuationPathway3D {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  elevationDeltaM: number;
  transitDistanceM: number;
  safeCapacityPersons: number;
  coordinates: [number, number, number][]; // Linestring [lng, lat, alt_m]
  urgency: "CRITICAL" | "HIGH" | "PRECAUTIONARY";
}

export interface EvacuationShelter3D {
  id: string;
  name: string;
  tehsil: string;
  elevationM: number;
  coordinates: [number, number, number];
  capacityPersons: number;
  medicalFacility: boolean;
  helipadCapable: boolean;
  loraRepeaterActive: boolean;
}

export interface CriticalInfra3D {
  id: string;
  name: string;
  type: "BRIDGE" | "HIGHWAY_TUNNEL" | "SUBSTATION" | "HOSPITAL" | "BARRAGE_INTAKE";
  coordinates: [number, number, number];
  criticalGaugeStageM: number;
  vulnerabilityStatusNormal: "NOMINAL" | "MONITOR";
  vulnerabilityStatusCataclysmic: "INUNDATION_IMMINENT" | "INTERDICTED" | "SHUTDOWN" | "CRITICAL_DEFEND";
}

export interface CameraWaypointPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  pitch: number;
  bearing: number;
  zoom: number;
  center: [number, number];
  targetAltM: number;
}

// ----------------------------------------------------------------------------
// 1. TRANSCEIVER STATIONS (Physical Radio Frequency Nodes in 3D Space)
// ----------------------------------------------------------------------------
export const STATIONS_3D: TransceiverStation3D[] = [
  {
    id: "station-a",
    callsign: "UPLINK-AULI-01",
    name: "Auli Ridge Optical/RF Repeater",
    role: "PRIMARY_UPLINK",
    tier: "SATCOM_GATEWAY",
    coordinates: [79.568, 30.571, 3120],
    frequencyMhz: 865.2,
    txPowerDbm: 27,
    protocol: "SATCOM GSAT-7A",
    batteryPct: 98,
    status: "ONLINE",
    description: "High-altitude primary space link and optical telemetry relay with line-of-sight to the Tibetan border crest.",
  },
  {
    id: "station-b",
    callsign: "C2-JOSHIMATH-HQ",
    name: "Joshimath FOB C2 Hub",
    role: "COMMAND_HUB",
    tier: "C2_FOB",
    coordinates: [79.562, 30.556, 1890],
    frequencyMhz: 866.5,
    txPowerDbm: 22,
    protocol: "LoRaWAN 865-867MHz",
    batteryPct: 92,
    status: "ONLINE",
    description: "Forward Operating Base Command & Control bunker, tactical fiber hub & municipal siren controller.",
  },
  {
    id: "station-c",
    callsign: "RELAY-HELANG-03",
    name: "Helang Gorge Relay",
    role: "MID_RELAY",
    tier: "GORGE_REPEAT",
    coordinates: [79.548, 30.531, 1540],
    frequencyMhz: 865.8,
    txPowerDbm: 20,
    protocol: "LoRaWAN 865-867MHz",
    batteryPct: 84,
    status: "ONLINE",
    description: "Mid-canyon solar mast providing Fresnel zone coverage around the Helang spur and NH-7 hairpin.",
  },
  {
    id: "station-d",
    callsign: "RADAR-VISHNUPRAYAG-04",
    name: "Vishnuprayag Gauge Terminal",
    role: "RIVERBED_IOT",
    tier: "HYDRO_SENSOR",
    coordinates: [79.558, 30.552, 1410],
    frequencyMhz: 866.1,
    txPowerDbm: 14,
    protocol: "LoRaWAN 865-867MHz",
    batteryPct: 76,
    status: "ONLINE",
    description: "Confluence ultrasonic stage radar & Doppler discharge meter anchored on reinforced concrete abutment.",
  },
];

// ----------------------------------------------------------------------------
// 2. ANIMATED 3D RF SIGNAL ARCS (D -> C -> B -> A + Auli Space Uplink)
// ----------------------------------------------------------------------------
export const RF_MESH_ARCS_3D: RFMeshArc3D[] = [
  {
    id: "rf-arc-d-to-c",
    fromId: "station-d",
    toId: "station-c",
    fromCoord: [79.558, 30.552, 1410],
    toCoord: [79.548, 30.531, 1540],
    peakAltM: 1780,
    distanceKm: 2.54,
    fresnelClearanceM: 42,
    snrDb: 11.8,
    nominalColor: "#10b981",
    failoverColor: "#f59e0b",
  },
  {
    id: "rf-arc-c-to-b",
    fromId: "station-c",
    toId: "station-b",
    fromCoord: [79.548, 30.531, 1540],
    toCoord: [79.562, 30.556, 1890],
    peakAltM: 2210,
    distanceKm: 3.12,
    fresnelClearanceM: 65,
    snrDb: 14.2,
    nominalColor: "#10b981",
    failoverColor: "#f59e0b",
  },
  {
    id: "rf-arc-b-to-a",
    fromId: "station-b",
    toId: "station-a",
    fromCoord: [79.562, 30.556, 1890],
    toCoord: [79.568, 30.571, 3120],
    peakAltM: 3450,
    distanceKm: 1.78,
    fresnelClearanceM: 110,
    snrDb: 18.5,
    nominalColor: "#10b981",
    failoverColor: "#f59e0b",
  },
];

// Vertical Volumetric Space Burst (Auli -> GSAT-7A orbit >6000m)
export const SATELLITE_BURST_BEACON = {
  origin: [79.568, 30.571, 3120] as [number, number, number],
  zenith: [79.568, 30.571, 7500] as [number, number, number],
  satelliteName: "GSAT-7A (RUKMINI) / INSAT-3DR",
  frequencyGhz: 14.25,
  uplinkRateKbps: 512,
  burstDurationMs: 420,
};

// ----------------------------------------------------------------------------
// 3. GEOSPATIAL ROAD ARTERIES & INTERDICTION NODES
// ----------------------------------------------------------------------------
// NH-7 valley trunk highway contour line
export const NH7_HIGHWAY_LINESTRING: [number, number, number][] = [
  [79.539, 30.521, 1480],
  [79.544, 30.526, 1510],
  [79.548, 30.531, 1540], // Helang gorge spur
  [79.551, 30.537, 1585],
  [79.554, 30.542, 1630],
  [79.557, 30.546, 1690],
  [79.560, 30.550, 1750],
  [79.562, 30.556, 1890], // Joshimath town bypass
  [79.564, 30.560, 1840],
  [79.563, 30.565, 1720],
  [79.559, 30.558, 1520],
  [79.558, 30.552, 1410], // Vishnuprayag bypass bridge
  [79.561, 30.555, 1425],
  [79.567, 30.561, 1510],
  [79.574, 30.572, 1680],
  [79.582, 30.584, 1890], // Towards Govindghat / Badrinath
];

// Secondary Mountain Pack-Trails climbing steeply
export const MOUNTAIN_PACK_TRAILS: { id: string; name: string; coordinates: [number, number, number][] }[] = [
  {
    id: "trail-joshimath-auli",
    name: "Joshimath–Auli Pilgrim Pack-Trail",
    coordinates: [
      [79.562, 30.556, 1890],
      [79.564, 30.561, 2180],
      [79.565, 30.566, 2560],
      [79.567, 30.569, 2890],
      [79.568, 30.571, 3120],
    ],
  },
  {
    id: "trail-helang-urgam",
    name: "Helang–Urgam Valley High Trail",
    coordinates: [
      [79.548, 30.531, 1540],
      [79.542, 30.535, 1720],
      [79.537, 30.541, 1980],
      [79.532, 30.549, 2240],
    ],
  },
];

// Road Interdiction Node on NH-7 Helang Cut-Slope
export const ROAD_INTERDICTION_NODE = {
  id: "interdiction-helang-nh7",
  title: "INTERDICTED - DEBRIS FLOW ROAD CUT-OFF",
  coordinates: [79.5482, 30.5312, 1542] as [number, number, number],
  locationName: "NH-7 Helang Cut-Slope Choke Point",
  hazardType: "Catastrophic Debris-Flow Slide / Slope Failure",
  severity: "IMPASSABLE_ZERO_TRANSIT",
  cutOffLengthM: 480,
  detourVia: "Helang-Urgam Mountain Ridge Trail (Pedestrian only)",
};

// ----------------------------------------------------------------------------
// 4. ANIMATED TACTICAL EVACUATION PATHWAYS (Uphill vector ribbons)
// ----------------------------------------------------------------------------
export const EVACUATION_PATHWAYS_3D: EvacuationPathway3D[] = [
  {
    id: "evac-riverbed-pandukeshwar",
    name: "Corridor 1: Riverbed Settlements → Pandukeshwar High Grounds",
    originName: "Vishnuprayag Riverbed Inundation Zone",
    destinationName: "Pandukeshwar Temple Plateau Shelter",
    elevationDeltaM: 140,
    transitDistanceM: 1180,
    safeCapacityPersons: 650,
    urgency: "CRITICAL",
    coordinates: [
      [79.558, 30.552, 1410],
      [79.556, 30.548, 1445],
      [79.553, 30.542, 1485],
      [79.550, 30.536, 1520],
      [79.548, 30.530, 1550], // Pandukeshwar Temple terrace
    ],
  },
  {
    id: "evac-joshimath-gorson",
    name: "Corridor 2: Lower Joshimath Flank → Gorson Bugyal High-Altitude Shelter",
    originName: "Lower Joshimath Subsidence Flank (NH-7)",
    destinationName: "Gorson Bugyal Tactical Assembly Grounds",
    elevationDeltaM: 340,
    transitDistanceM: 2450,
    safeCapacityPersons: 1400,
    urgency: "CRITICAL",
    coordinates: [
      [79.562, 30.556, 1890],
      [79.564, 30.560, 2080],
      [79.566, 30.564, 2350],
      [79.570, 30.568, 2710],
      [79.576, 30.573, 3050], // Gorson Bugyal plateau
    ],
  },
  {
    id: "evac-tapovan-highland",
    name: "Corridor 3: Tapovan Lowlands → Army Base Ridge Camp",
    originName: "Tapovan Riverside Settlement & Barrage",
    destinationName: "Tapovan Army Base Ridge Shelter",
    elevationDeltaM: 260,
    transitDistanceM: 920,
    safeCapacityPersons: 450,
    urgency: "CRITICAL",
    coordinates: [
      [79.625, 30.495, 1850],
      [79.623, 30.498, 1940],
      [79.620, 30.502, 2020],
      [79.617, 30.506, 2110],
    ],
  },
  {
    id: "evac-helang-urgam",
    name: "Corridor 4: Helang Culvert → Urgam High Terrace",
    originName: "Helang Riverbed Road Junction",
    destinationName: "Urgam Highland Terrace Relief Camp",
    elevationDeltaM: 280,
    transitDistanceM: 1450,
    safeCapacityPersons: 550,
    urgency: "HIGH",
    coordinates: [
      [79.548, 30.531, 1540],
      [79.544, 30.534, 1630],
      [79.540, 30.538, 1720],
      [79.536, 30.543, 1820],
    ],
  },
];

// Designated Safe Assembly Shelters
export const EVACUATION_SHELTERS_3D: EvacuationShelter3D[] = [
  {
    id: "shelter-pandukeshwar",
    name: "Pandukeshwar Temple High Grounds",
    tehsil: "Joshimath",
    elevationM: 1550,
    coordinates: [79.548, 30.530, 1550],
    capacityPersons: 650,
    medicalFacility: true,
    helipadCapable: false,
    loraRepeaterActive: true,
  },
  {
    id: "shelter-gorson-bugyal",
    name: "Gorson Bugyal High-Altitude Shelter",
    tehsil: "Joshimath / Auli",
    elevationM: 3050,
    coordinates: [79.576, 30.573, 3050],
    capacityPersons: 1400,
    medicalFacility: true,
    helipadCapable: true,
    loraRepeaterActive: true,
  },
  {
    id: "shelter-cantonment",
    name: "Joshimath Cantonment Upper Ground",
    tehsil: "Joshimath",
    elevationM: 2040,
    coordinates: [79.569, 30.562, 2040],
    capacityPersons: 1800,
    medicalFacility: true,
    helipadCapable: true,
    loraRepeaterActive: true,
  },
];

// ----------------------------------------------------------------------------
// 5. CRITICAL INFRASTRUCTURE ASSETS
// ----------------------------------------------------------------------------
export const CRITICAL_INFRA_3D: CriticalInfra3D[] = [
  {
    id: "infra-vishnuprayag-bridge",
    name: "Vishnuprayag Confluence Footbridge",
    type: "BRIDGE",
    coordinates: [79.558, 30.552, 1410],
    criticalGaugeStageM: 4.5,
    vulnerabilityStatusNormal: "NOMINAL",
    vulnerabilityStatusCataclysmic: "INUNDATION_IMMINENT",
  },
  {
    id: "infra-helang-culvert",
    name: "NH-7 Helang Culvert & Cut-Slope",
    type: "HIGHWAY_TUNNEL",
    coordinates: [79.548, 30.531, 1540],
    criticalGaugeStageM: 5.2,
    vulnerabilityStatusNormal: "NOMINAL",
    vulnerabilityStatusCataclysmic: "INTERDICTED",
  },
  {
    id: "infra-barrage-substation",
    name: "Vishnuprayag HEP Barrage & Substation",
    type: "SUBSTATION",
    coordinates: [79.564, 30.557, 1428],
    criticalGaugeStageM: 6.0,
    vulnerabilityStatusNormal: "NOMINAL",
    vulnerabilityStatusCataclysmic: "SHUTDOWN",
  },
  {
    id: "infra-joshimath-chc",
    name: "Joshimath Community Health Centre (CHC)",
    type: "HOSPITAL",
    coordinates: [79.563, 30.557, 1910],
    criticalGaugeStageM: 99.0, // High above gorge
    vulnerabilityStatusNormal: "NOMINAL",
    vulnerabilityStatusCataclysmic: "CRITICAL_DEFEND",
  },
  {
    id: "infra-tapovan-barrage",
    name: "Tapovan NTPC Headworks & Tunnel Intake",
    type: "BARRAGE_INTAKE",
    coordinates: [79.625, 30.495, 1850],
    criticalGaugeStageM: 4.8,
    vulnerabilityStatusNormal: "NOMINAL",
    vulnerabilityStatusCataclysmic: "INUNDATION_IMMINENT",
  },
  {
    id: "infra-helang-bridge",
    name: "Helang NH-7 Steel Girder Bridge",
    type: "BRIDGE",
    coordinates: [79.547, 30.530, 1515],
    criticalGaugeStageM: 5.5,
    vulnerabilityStatusNormal: "NOMINAL",
    vulnerabilityStatusCataclysmic: "INTERDICTED",
  },
];

// ----------------------------------------------------------------------------
// 6. VOLUMETRIC HYDRAULIC INUNDATION WATER PLANE (Alaknanda & Dhauliganga)
// ----------------------------------------------------------------------------
// Centerline of the gorge riverbed
export const RIVER_CENTERLINE_3D: [number, number, number][] = [
  // Upper Dhauliganga tributary
  [79.585, 30.575, 1490],
  [79.578, 30.567, 1465],
  [79.572, 30.560, 1440],
  // Confluence point at Vishnuprayag
  [79.565, 30.555, 1418],
  [79.558, 30.552, 1410],
  // Alaknanda gorge downstream towards Helang
  [79.554, 30.544, 1395],
  [79.551, 30.538, 1380],
  [79.547, 30.530, 1365],
  [79.542, 30.522, 1350],
];

// Base Stage River Polygon (~30m width, crystalline azure ribbon)
export const RIVER_BASE_STAGE_POLYGON: [number, number, number][] = [
  [79.5852, 30.5753, 1490],
  [79.5782, 30.5672, 1465],
  [79.5722, 30.5602, 1440],
  [79.5652, 30.5552, 1418],
  [79.5582, 30.5522, 1410],
  [79.5542, 30.5442, 1395],
  [79.5512, 30.5382, 1380],
  [79.5472, 30.5302, 1365],
  [79.5422, 30.5222, 1350],
  // Return bank
  [79.5418, 30.5218, 1350],
  [79.5468, 30.5298, 1365],
  [79.5508, 30.5378, 1380],
  [79.5538, 30.5438, 1395],
  [79.5578, 30.5518, 1410],
  [79.5648, 30.5548, 1418],
  [79.5718, 30.5598, 1440],
  [79.5778, 30.5668, 1465],
  [79.5848, 30.5747, 1490],
  [79.5852, 30.5753, 1490],
];

// Dilated Cataclysmic Inundation Polygon (3.5x width dilation, +8.5m elevation stage)
export const RIVER_CATACLYSMIC_INUNDATION_POLYGON: [number, number, number][] = [
  [79.5862, 30.5765, 1498.5],
  [79.5792, 30.5684, 1473.5],
  [79.5735, 30.5615, 1448.5],
  [79.5666, 30.5568, 1426.5],
  [79.5595, 30.5536, 1418.5], // Submerges footbridge and access ramps
  [79.5556, 30.5456, 1403.5],
  [79.5524, 30.5396, 1388.5],
  [79.5486, 30.5316, 1373.5],
  [79.5434, 30.5235, 1358.5],
  // Return bank with wide dilation
  [79.5406, 30.5205, 1358.5],
  [79.5454, 30.5284, 1373.5],
  [79.5496, 30.5364, 1388.5],
  [79.5524, 30.5424, 1403.5],
  [79.5565, 30.5504, 1418.5],
  [79.5634, 30.5532, 1426.5],
  [79.5705, 30.5585, 1448.5],
  [79.5764, 30.5654, 1473.5],
  [79.5838, 30.5735, 1498.5],
  [79.5862, 30.5765, 1498.5],
];

// ----------------------------------------------------------------------------
// 7. CINEMATIC CAMERA WAYPOINT PRESETS
// ----------------------------------------------------------------------------
export const CAMERA_WAYPOINTS: CameraWaypointPreset[] = [
  {
    id: "default-tactical",
    title: "Default Tactical Corridor",
    badge: "CORRIDOR C2",
    description: "Looking up the steep Alaknanda gorge corridor towards Badrinath & Auli crest.",
    pitch: 62,
    bearing: -28,
    zoom: 13.4,
    center: [79.565, 30.555],
    targetAltM: 1418,
  },
  {
    id: "top-down-nadir",
    title: "Straight Top-Down (2D Nadir)",
    badge: "TOP VIEW (0°)",
    description: "Orthogonal top-down planimetric view (0° tilt, North-up) for tactical grid orientation.",
    pitch: 0,
    bearing: 0,
    zoom: 13.5,
    center: [79.562, 30.556],
    targetAltM: 1890,
  },
  {
    id: "macro-overview",
    title: "Corridor Macro Overview",
    badge: "MACRO BIRD-EYE",
    description: "Wide-angle situational view from Helang gorge to Upper Nanda Devi rim.",
    pitch: 45,
    bearing: 0,
    zoom: 12.0,
    center: [79.560, 30.550],
    targetAltM: 2100,
  },
  {
    id: "auli-ridge",
    title: "Auli Ridge Inception",
    badge: "UPLINK RIDGE",
    description: "Steep 3050m ASL ridge focus where orographic cloudburst cells initiate and SATCOM bursts fire.",
    pitch: 70,
    bearing: -45,
    zoom: 14.8,
    center: [79.568, 30.571],
    targetAltM: 3050,
  },
  {
    id: "joshimath-midslope",
    title: "Joshimath Mid-Slope Settlement",
    badge: "CIVIC FLANK",
    description: "High-density settlement flank on NH-7 vulnerable to toe-erosion and debris surcharge.",
    pitch: 65,
    bearing: -15,
    zoom: 15.2,
    center: [79.562, 30.556],
    targetAltM: 1890,
  },
  {
    id: "vishnuprayag-gorge",
    title: "Vishnuprayag Confluence Gorge",
    badge: "CHOKE POINT",
    description: "Alaknanda and Dhauliganga hydraulic junction where backwater surge and bridge submergence occur.",
    pitch: 75,
    bearing: 80,
    zoom: 16.0,
    center: [79.558, 30.552],
    targetAltM: 1410,
  },
  {
    id: "tapovan-barrage",
    title: "Tapovan NTPC Barrage (2021 GLOF Epicenter)",
    badge: "GLOF ORIGIN",
    description: "Dhauliganga gorge headworks where the catastrophic rock-ice avalanche breached the intake tunnels in 2021.",
    pitch: 68,
    bearing: 45,
    zoom: 14.8,
    center: [79.625, 30.495],
    targetAltM: 1850,
  },
  {
    id: "helang-chokepoint",
    title: "Helang Gorge NH-7 Chokepoint",
    badge: "LIFELINE CUT",
    description: "Steep rocky defile carrying NH-7; primary road interdiction risk when flood surges entrain highway footings.",
    pitch: 72,
    bearing: -60,
    zoom: 15.5,
    center: [79.548, 30.531],
    targetAltM: 1540,
  },
  {
    id: "dhauliganga-canyon",
    title: "Dhauliganga Deep V-Shaped Canyon",
    badge: "CANYON AXIS",
    description: "Extreme gradient mountain gorge running from Raini down to Vishnuprayag junction.",
    pitch: 78,
    bearing: -115,
    zoom: 15.0,
    center: [79.575, 30.565],
    targetAltM: 1450,
  },
];

// ----------------------------------------------------------------------------
// 6. MONITORED VILLAGES & SETTLEMENT LOCATIONS (Interactive Map Pins)
// ----------------------------------------------------------------------------
export interface MonitoredVillage3D {
  id: string;
  name: string;
  hindiName: string;
  wardId: "UK-CHM-UPPER" | "UK-CHM-MID" | "UK-CHM-LOWER";
  coordinates: [number, number, number]; // [lng, lat, alt_m]
  category: "VILLAGE" | "TOWN" | "HAMLET" | "CONFLUENCE";
  population: number;
  riskDescription: string;
  evacuationShelter: string;
  leadTimeMin: number;
  toeSlopeDeg: number;
  highlightColor: string;
}

export const MONITORED_VILLAGES_3D: MonitoredVillage3D[] = [
  {
    id: "loc-auli",
    name: "Auli (Bugyal / Ridge)",
    hindiName: "औली बुग्याल",
    wardId: "UK-CHM-UPPER",
    coordinates: [79.568, 30.571, 3050],
    category: "VILLAGE",
    population: 850,
    riskDescription: "Orographic burst initiation zone with steep colluvial runoff.",
    evacuationShelter: "Gorson Bugyal Highland Camp",
    leadTimeMin: 0,
    toeSlopeDeg: 42.5,
    highlightColor: "#38bdf8",
  },
  {
    id: "loc-joshimath",
    name: "Joshimath Town (Upper Bazaar)",
    hindiName: "जोशीमठ नगर",
    wardId: "UK-CHM-MID",
    coordinates: [79.562, 30.556, 1890],
    category: "TOWN",
    population: 16700,
    riskDescription: "High-density civic cut-slope on NH-7, vulnerable to active toe-subsidence.",
    evacuationShelter: "Govt. Inter College Relief Camp",
    leadTimeMin: 8,
    toeSlopeDeg: 34.0,
    highlightColor: "#fbbf24",
  },
  {
    id: "loc-sunil",
    name: "Sunil Village (Flank Slope)",
    hindiName: "सुनील गाँव",
    wardId: "UK-CHM-MID",
    coordinates: [79.565, 30.562, 2180],
    category: "VILLAGE",
    population: 1240,
    riskDescription: "Active reactivation slip zone above Joshimath with ground fissures.",
    evacuationShelter: "Upper Bugyal Meadow Shelter",
    leadTimeMin: 6,
    toeSlopeDeg: 38.2,
    highlightColor: "#f59e0b",
  },
  {
    id: "loc-helang",
    name: "Helang (Alaknanda Spur)",
    hindiName: "हेलांग गॉर्ज",
    wardId: "UK-CHM-MID",
    coordinates: [79.548, 30.531, 1540],
    category: "VILLAGE",
    population: 920,
    riskDescription: "NH-7 choke-point culvert; critical highway interdiction risk during flash surges.",
    evacuationShelter: "Urgam Ridge Assembly Point",
    leadTimeMin: 14,
    toeSlopeDeg: 36.8,
    highlightColor: "#f97316",
  },
  {
    id: "loc-vishnuprayag",
    name: "Vishnuprayag Confluence",
    hindiName: "विष्णुप्रयाग संगम",
    wardId: "UK-CHM-LOWER",
    coordinates: [79.558, 30.552, 1410],
    category: "CONFLUENCE",
    population: 620,
    riskDescription: "Alaknanda & Dhauliganga hydraulic junction; +8.5m stage rise & bridge overtopping.",
    evacuationShelter: "Vishnuprayag Pilgrim Shelter",
    leadTimeMin: 85,
    toeSlopeDeg: 28.5,
    highlightColor: "#f43f5e",
  },
  {
    id: "loc-pandukeshwar",
    name: "Pandukeshwar Village",
    hindiName: "पांडुकेश्वर",
    wardId: "UK-CHM-LOWER",
    coordinates: [79.588, 30.598, 1820],
    category: "VILLAGE",
    population: 1850,
    riskDescription: "Upstream riverside transit village on Badrinath route.",
    evacuationShelter: "Yog Dhyan Badri Shelter",
    leadTimeMin: 45,
    toeSlopeDeg: 24.0,
    highlightColor: "#a855f7",
  },
  {
    id: "loc-tapovan",
    name: "Tapovan Gorge Basin",
    hindiName: "तपोवन",
    wardId: "UK-CHM-UPPER",
    coordinates: [79.625, 30.495, 1850],
    category: "VILLAGE",
    population: 2100,
    riskDescription: "Dhauliganga flash-flood corridor; debris accumulation and barrage zone.",
    evacuationShelter: "Tapovan High Ridge Camp",
    leadTimeMin: 22,
    toeSlopeDeg: 39.0,
    highlightColor: "#06b6d4",
  },
];

// ----------------------------------------------------------------------------
// 7. GEOTECHNICAL VALLEY CROSS-SECTION PROFILES (Elevation vs Distance)
// ----------------------------------------------------------------------------
export interface ValleyCrossSection {
  id: string;
  name: string;
  locationName: string;
  riverbedAltM: number;
  baseStageWaterAltM: number;
  cloudburstSurgeAltM: number;
  glofDebrisSurgeAltM: number;
  bridgeDeckAltM?: number;
  settlementToeAltM: number;
  shelterAltM: number;
  shelterName: string;
  valleySlopeDeg: number;
  distanceToShelterM: number;
  pedestrianWalkTimeMin: number;
  waveLeadTimeMin: number;
  summaryText: string;
}

export const VALLEY_CROSS_SECTIONS: Record<string, ValleyCrossSection> = {
  "loc-vishnuprayag": {
    id: "loc-vishnuprayag",
    name: "Vishnuprayag Confluence Chokepoint",
    locationName: "Alaknanda–Dhauliganga Confluence",
    riverbedAltM: 1372,
    baseStageWaterAltM: 1373.8,
    cloudburstSurgeAltM: 1382.3, // +8.5m stage rise
    glofDebrisSurgeAltM: 1386.2, // +12.4m Takahashi bulking
    bridgeDeckAltM: 1380.5,     // Submerged during cloudburst!
    settlementToeAltM: 1410,
    shelterAltM: 1550,
    shelterName: "Pandukeshwar Pilgrim Shelter (+178m Safe Elevation)",
    valleySlopeDeg: 28.5,
    distanceToShelterM: 1180,
    pedestrianWalkTimeMin: 12,
    waveLeadTimeMin: 28,
    summaryText: "Backwater surge at junction causes rapid +8.5m stage rise, overtopping the footbridge deck at 1380.5m. Escape corridor requires immediate uphill ascent of 140m to Pandukeshwar terrace.",
  },
  "loc-joshimath": {
    id: "loc-joshimath",
    name: "Joshimath Town Flank & Toe-Erosion Zone",
    locationName: "Joshimath Municipal Cut-Slope",
    riverbedAltM: 1418,
    baseStageWaterAltM: 1420.0,
    cloudburstSurgeAltM: 1428.5,
    glofDebrisSurgeAltM: 1434.5,
    settlementToeAltM: 1890,
    shelterAltM: 2040,
    shelterName: "Govt. Inter College Relief Camp (+150m High Ridge)",
    valleySlopeDeg: 34.0,
    distanceToShelterM: 1650,
    pedestrianWalkTimeMin: 18,
    waveLeadTimeMin: 35,
    summaryText: "Joshimath sits high (+472m) above riverbed, but active toe scouring and landslide surcharge along NH-7 create flank slope instability during prolonged high-stage flows.",
  },
  "loc-tapovan": {
    id: "loc-tapovan",
    name: "Tapovan Barrage & Debris Funnel",
    locationName: "Tapovan NTPC Headworks Basin",
    riverbedAltM: 1845,
    baseStageWaterAltM: 1847.2,
    cloudburstSurgeAltM: 1856.5,
    glofDebrisSurgeAltM: 1864.8, // Catastrophic +17.6m debris surge
    bridgeDeckAltM: 1852.0,     // Destroyed in 2021 disaster
    settlementToeAltM: 1850,
    shelterAltM: 2110,
    shelterName: "Tapovan High Ridge Army Camp (+260m Safe Plateau)",
    valleySlopeDeg: 39.0,
    distanceToShelterM: 920,
    pedestrianWalkTimeMin: 9,
    waveLeadTimeMin: 14,
    summaryText: "Critical narrow constriction where 2021 rock-ice debris surge backed up, demolishing the barrage and headrace tunnels. Evacuation lead time is only 14 min against a 9 min uphill scramble.",
  },
  "loc-helang": {
    id: "loc-helang",
    name: "Helang Gorge & NH-7 Chokepoint",
    locationName: "Helang Valley Spur",
    riverbedAltM: 1480,
    baseStageWaterAltM: 1482.0,
    cloudburstSurgeAltM: 1490.5,
    glofDebrisSurgeAltM: 1495.0,
    bridgeDeckAltM: 1489.0,
    settlementToeAltM: 1540,
    shelterAltM: 1820,
    shelterName: "Urgam Highland Terrace Relief Camp (+280m Safe)",
    valleySlopeDeg: 36.8,
    distanceToShelterM: 1450,
    pedestrianWalkTimeMin: 14,
    waveLeadTimeMin: 42,
    summaryText: "Gorge spur causes heavy sediment accretion. NH-7 culvert at 1540m prone to debris blockages, severing evacuation traffic and isolating the upper valley.",
  },
};

// ----------------------------------------------------------------------------
// 10. 3D ARCHITECTURAL EXTRUDED STRUCTURES (BARRAGES, BRIDGES, BUNKERS)
// ----------------------------------------------------------------------------
export const EXTRUDED_STRUCTURES_3D_GEOJSON: GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  {
    id: string;
    name: string;
    structureType: "dam-barrage" | "bridge" | "viaduct" | "bunker" | "helipad";
    height: number;
    minHeight: number;
    color: string;
    status: string;
    criticality: "CRITICAL" | "ELEVATED" | "NOMINAL";
  }
> = {
  type: "FeatureCollection",
  features: [
    // Tapovan-Vishnugad Dam Barrage Wall
    {
      type: "Feature",
      properties: {
        id: "struct-tapovan-barrage",
        name: "Tapovan-Vishnugad Concrete Barrage Wall",
        structureType: "dam-barrage",
        height: 28,
        minHeight: 0,
        color: "#f43f5e",
        status: "ACTIVE_SPILLWAY_MONITORED",
        criticality: "CRITICAL",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [79.6242, 30.4948],
            [79.6258, 30.4952],
            [79.6256, 30.4956],
            [79.6240, 30.4952],
            [79.6242, 30.4948],
          ],
        ],
      },
    },
    // Vishnuprayag Confluence Suspension Bridge Deck
    {
      type: "Feature",
      properties: {
        id: "struct-vishnuprayag-bridge",
        name: "Vishnuprayag Suspension Bridge & Hydro Intake",
        structureType: "bridge",
        height: 22,
        minHeight: 12,
        color: "#f59e0b",
        status: "OVERTOPPING_THREAT_MONITORED",
        criticality: "CRITICAL",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [79.5572, 30.5518],
            [79.5588, 30.5524],
            [79.5586, 30.5528],
            [79.5570, 30.5522],
            [79.5572, 30.5518],
          ],
        ],
      },
    },
    // Helang NH-7 Chokepoint Highway Viaduct
    {
      type: "Feature",
      properties: {
        id: "struct-helang-viaduct",
        name: "Helang Gorge Highway Viaduct & Debris Gantry",
        structureType: "viaduct",
        height: 18,
        minHeight: 8,
        color: "#38bdf8",
        status: "CLEAR_TRANSIT",
        criticality: "ELEVATED",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [79.5472, 30.5308],
            [79.5486, 30.5314],
            [79.5484, 30.5318],
            [79.5470, 30.5312],
            [79.5472, 30.5308],
          ],
        ],
      },
    },
    // Joshimath ITBP Emergency Forward Operating Base & Bunker
    {
      type: "Feature",
      properties: {
        id: "struct-joshimath-itbp",
        name: "Joshimath ITBP Sector Headquarters & Command Bunker",
        structureType: "bunker",
        height: 16,
        minHeight: 0,
        color: "#10b981",
        status: "OPERATIONAL_STAGING",
        criticality: "NOMINAL",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [79.5625, 30.5562],
            [79.5638, 30.5562],
            [79.5638, 30.5572],
            [79.5625, 30.5572],
            [79.5625, 30.5562],
          ],
        ],
      },
    },
    // Auli High-Altitude Tactical Helipad Platform
    {
      type: "Feature",
      properties: {
        id: "struct-auli-helipad",
        name: "Auli High-Altitude Military Helipad (LZ-ALPHA)",
        structureType: "helipad",
        height: 5,
        minHeight: 0,
        color: "#a855f7",
        status: "READY_FOR_SAR_SORTIE",
        criticality: "NOMINAL",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [79.5678, 30.5708],
            [79.5688, 30.5708],
            [79.5688, 30.5716],
            [79.5678, 30.5716],
            [79.5678, 30.5708],
          ],
        ],
      },
    },
  ],
};

// ----------------------------------------------------------------------------
// 11. TOPOGRAPHIC CONTOUR LINES GEOJSON (TACTICAL ELEVATION CURVES)
// ----------------------------------------------------------------------------
export const TOPOGRAPHIC_CONTOURS_GEOJSON: GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  {
    id: string;
    elevationM: number;
    color: string;
    label: string;
    lineType: "index" | "intermediate";
  }
> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "contour-1400m",
        elevationM: 1400,
        color: "#06b6d4",
        label: "1400m ASL • Gorge Datum",
        lineType: "index",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.554, 30.548],
          [79.556, 30.550],
          [79.558, 30.552],
          [79.560, 30.554],
          [79.563, 30.557],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "contour-1600m",
        elevationM: 1600,
        color: "#38bdf8",
        label: "1600m ASL • Valley Flank",
        lineType: "intermediate",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.550, 30.536],
          [79.553, 30.541],
          [79.556, 30.546],
          [79.559, 30.550],
          [79.564, 30.555],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "contour-1800m",
        elevationM: 1800,
        color: "#fbbf24",
        label: "1800m ASL • Joshimath Foot",
        lineType: "index",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.546, 30.528],
          [79.551, 30.535],
          [79.557, 30.544],
          [79.561, 30.553],
          [79.565, 30.558],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "contour-2000m",
        elevationM: 2000,
        color: "#34d399",
        label: "2000m ASL • Highland Shelter Safe Zone",
        lineType: "index",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.542, 30.525],
          [79.548, 30.532],
          [79.554, 30.541],
          [79.560, 30.551],
          [79.564, 30.560],
          [79.566, 30.564],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "contour-2200m",
        elevationM: 2200,
        color: "#a78bfa",
        label: "2200m ASL • Auli Ridge Sub-Alpine",
        lineType: "intermediate",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.539, 30.521],
          [79.545, 30.529],
          [79.552, 30.539],
          [79.559, 30.549],
          [79.565, 30.562],
          [79.567, 30.568],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "contour-2400m",
        elevationM: 2400,
        color: "#f472b6",
        label: "2400m ASL • High Escarpment",
        lineType: "index",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.536, 30.518],
          [79.542, 30.526],
          [79.550, 30.536],
          [79.558, 30.547],
          [79.566, 30.565],
          [79.568, 30.571],
        ],
      },
    },
  ],
};



