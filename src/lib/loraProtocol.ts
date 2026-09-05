/**
 * ============================================================================
 *  LORA MESH TELEMETRY ENGINE  —  865–867 MHz Tactical Bit-Packing Protocol
 * ============================================================================
 *  Author : NDMA Integrated Early Warning Platform
 *           in coordination with NDRF IT Directorate & C-DOT.
 *
 *  Purpose: Pack hyper-local sensor telemetry and CAP alert vectors into
 *  strictly bounded binary frames for LoRaWAN / VHF tactical mesh relays
 *  (Meshtastic / SX1262 transceiver clusters on the Auli Ridge → Helang →
 *  Pandukeshwar chain). When optical-fibre backhauls snap and BTS cellular
 *  towers flood, this is the byte-level substrate that keeps the FFEWS
 *  telemetry and evacuation alerts flowing to offline villages.
 *
 *  Frame geometry:
 *    • 32-byte CompactTelemetryFrame  — routine sensor uplink (15-min cadence)
 *    • 48-byte CompactAlertBurst     — compressed CAP alert evacuation vector
 *
 *  Both frames carry a CRC16-CCITT (0x1D0F init, poly 0x1021) checksum so
 *  receiving nodes can reject corrupted packets before re-broadcasting them
 *  across the mesh. No external dependencies — pure TypeScript, browser- and
 *  Node-compatible.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 * 1. TYPES
 * ------------------------------------------------------------------------- */

/** Numeric ward identifier (1-byte, matches the mesh routing table). */
export type WardNumericId = 1 | 2 | 3; // 1=UPPER, 2=MID, 3=LOWER

export const WARD_NUMERIC_MAP = {
  "UK-CHM-UPPER": 1,
  "UK-CHM-MID": 2,
  "UK-CHM-LOWER": 3,
} as const;

export const WARD_NUMERIC_REVERSE: Record<number, string> = {
  1: "UK-CHM-UPPER",
  2: "UK-CHM-MID",
  3: "UK-CHM-LOWER",
};

/** Compact risk ordinal (1-byte). */
export type RiskOrdinal = 0 | 1 | 2 | 3; // LOW, MODERATE, HIGH, CATACLYSMIC

export const RISK_ORDINAL_MAP: Record<string, RiskOrdinal> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  EXTREME: 3,
  CATACLYSMIC: 3, // EXTREME+ collapse into the single "catastrophic" bucket
};

export const RISK_ORDINAL_LABEL: Record<RiskOrdinal, string> = {
  0: "LOW",
  1: "MODERATE",
  2: "HIGH",
  3: "CATACLYSMIC",
};

/**
 * CompactTelemetryFrame — the routine sensor uplink vector.
 *
 *  Field layout (32 bytes total, excluding CRC the payload is 30 bytes):
 *    offset  size  field
 *    0       4     timestamp       (uint32, epoch seconds, big-endian)
 *    4       1     wardNumericId   (uint8: 1=UPPER, 2=MID, 3=LOWER)
 *    5       2     rainfallRate    (uint16, tenths of mm/hr, 0–6553.5)
 *    7       1     soilSaturation  (uint8, 0–100 %)
 *    8       2     riverStage       (uint16, centimetres, 0–65535)
 *    10      2     riverSurgeRate   (int16, mm/min, signed)
 *    12      1     riskLevel        (uint8: 0/1/2/3)
 *    13      1     reserved/flags  (uint8, 0xE7 signature for frame versioning)
 *    14      2     batteryMv        (uint16, millivolts, 0–65535)
 *    16      1     temperatureC     (int8, °C, signed)
 *    17      1     relayHopCount    (uint8, 0–15)
 *    18      14    reserved         (zero-padded, future fields)
 *    30      2     crc16            (CRC16-CCITT, big-endian)
 */
export interface CompactTelemetryFrame {
  /** Epoch seconds (UTC). */
  timestamp: number;
  wardNumericId: WardNumericId;
  /** Rainfall rate in mm/hr (will be packed as tenths → uint16). */
  rainfallRate_mm_hr: number;
  /** Soil saturation 0–100 %. */
  soilSaturation_pct: number;
  /** River stage in metres (will be packed as centimetres → uint16). */
  riverStage_m: number;
  /** River surge rate in mm/min (signed; recession = negative). */
  riverSurgeRate_mm_min: number;
  riskLevel: RiskOrdinal;
  /** Sensor battery voltage in millivolts (0–65535). */
  batteryMv: number;
  /** Sensor temperature in °C (signed). */
  temperatureC: number;
  /** Mesh relay hop count (0 = direct, 15 = max). */
  relayHopCount: number;
}

/**
 * CompactAlertBurst — the 48-byte compressed CAP evacuation vector.
 *
 *  Field layout (46-byte payload + 2-byte CRC):
 *    offset  size  field
 *    0       4     timestamp        (uint32, epoch seconds)
 *    4       1     wardNumericId    (uint8)
 *    5       1     riskLevel        (uint8: 0/1/2/3)
 *    6       2     leadTimeMin      (uint16, minutes to surge arrival)
 *    8       2     peakQ            (uint16, m³/s, 0–65535)
 *    10      2     rainfallIntensity(uint16, tenths of mm/hr)
 *    12      1     soilMoisturePct  (uint8, 0–100)
 *    14      2     confluenceQ      (uint16, m³/s)
 *    16      1     evacuationFlag   (uint8: 0=no, 1=evacuate)
 *    17      1     shelterCount     (uint8)
 *    18      28    shelterBits      (packed: 4 shelters × 7 bytes — lat/lng/ele)
 *    46      2     crc16            (CRC16-CCITT)
 */
export interface CompactAlertBurst {
  timestamp: number;
  wardNumericId: WardNumericId;
  riskLevel: RiskOrdinal;
  leadTimeMin: number;
  peakQ_m3_per_s: number;
  rainfallIntensity_mm_hr: number;
  soilMoisturePct: number;
  confluenceQ_m3_per_s: number;
  evacuate: boolean;
  shelters: Array<{
    lat: number; // decimal degrees
    lng: number;
    elevationM: number;
  }>;
}

export interface CompressedAlertPayload {
  hexString: string;
  base64: string;
  byteSize: number;
  /** Estimated LoRa link-budget margin (dB) at SF9BW125 for the packed frame. */
  snrMarginDb: number;
  /** On-air time estimate (ms) at SF9 / 125 kHz. */
  airtimeMs: number;
}

/* ----------------------------------------------------------------------------
 * 2. CRC16-CCITT (XMODEM variant: poly 0x1021, init 0x1D0F, no final XOR)
 *    Used by both the telemetry frame and the alert burst for integrity.
 * ------------------------------------------------------------------------- */

/**
 * Compute the CRC16-CCITT (0x1D0F init, 0x1021 polynomial) of a byte range.
 * This is the same variant used by AX.25 and Meshtastic for LoRa mesh
 * packet integrity — chosen so receiving nodes can validate without a
 * custom lookup table.
 */
export function crc16Ccitt(bytes: Uint8Array, start = 0, end?: number): number {
  const stop = end ?? bytes.length;
  let crc = 0x1d0f;
  for (let i = start; i < stop; i++) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc & 0xffff;
}

/* ----------------------------------------------------------------------------
 * 3. BYTE-LEVEL READ/WRITE HELPERS (big-endian, DataView-free for portability)
 * ------------------------------------------------------------------------- */

function writeU32(buf: Uint8Array, off: number, v: number): void {
  const c = v >>> 0;
  buf[off] = (c >>> 24) & 0xff;
  buf[off + 1] = (c >>> 16) & 0xff;
  buf[off + 2] = (c >>> 8) & 0xff;
  buf[off + 3] = c & 0xff;
}

function readU32(buf: Uint8Array, off: number): number {
  return (
    ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>>
    0
  );
}

function writeU16(buf: Uint8Array, off: number, v: number): void {
  const c = v & 0xffff;
  buf[off] = (c >>> 8) & 0xff;
  buf[off + 1] = c & 0xff;
}

function readU16(buf: Uint8Array, off: number): number {
  return ((buf[off] << 8) | buf[off + 1]) & 0xffff;
}

function writeI16(buf: Uint8Array, off: number, v: number): void {
  const c = v & 0xffff;
  buf[off] = (c >>> 8) & 0xff;
  buf[off + 1] = c & 0xff;
}

function readI16(buf: Uint8Array, off: number): number {
  const raw = ((buf[off] << 8) | buf[off + 1]) & 0xffff;
  return raw >= 0x8000 ? raw - 0x10000 : raw;
}

function writeI8(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
}

function readI8(buf: Uint8Array, off: number): number {
  const raw = buf[off] & 0xff;
  return raw >= 0x80 ? raw - 0x100 : raw;
}

/* ----------------------------------------------------------------------------
 * 4. BASE64 + HEX ENCODE/DECODE (allocation-light, UTF-8 safe)
 * ------------------------------------------------------------------------- */

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const t = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64_CHARS[(t >>> 18) & 0x3f] +
      B64_CHARS[(t >>> 12) & 0x3f] +
      B64_CHARS[(t >>> 6) & 0x3f] +
      B64_CHARS[t & 0x3f];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const t = bytes[i] << 16;
    out +=
      B64_CHARS[(t >>> 18) & 0x3f] +
      B64_CHARS[(t >>> 12) & 0x3f] +
      "==";
  } else if (rem === 2) {
    const t = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64_CHARS[(t >>> 18) & 0x3f] +
      B64_CHARS[(t >>> 12) & 0x3f] +
      B64_CHARS[(t >>> 6) & 0x3f] +
      "=";
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  const H = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += H[(bytes[i] >>> 4) & 0xf] + H[bytes[i] & 0xf];
  }
  return out;
}

/* ----------------------------------------------------------------------------
 * 5. TELEMETRY FRAME  —  32-BYTE PACK / UNPACK
 * ------------------------------------------------------------------------- */

/** Total encoded size of a CompactTelemetryFrame (payload + CRC). */
export const TELEMETRY_FRAME_SIZE = 32;
/** Magic signature byte stuffed into the reserved/flags field (frame v1). */
export const FRAME_SIGNATURE = 0xe7;

/**
 * encodeTelemetryFrame
 * Packs a CompactTelemetryFrame into a strict 32-byte big-endian buffer with
 * a trailing CRC16-CCITT checksum. Saturating clamps are applied to every
 * field so over-range sensor values cannot corrupt the frame geometry.
 */
export function encodeTelemetryFrame(data: CompactTelemetryFrame): Uint8Array {
  const buf = new Uint8Array(TELEMETRY_FRAME_SIZE);
  // zero-fill reserved region up-front
  for (let i = 0; i < TELEMETRY_FRAME_SIZE; i++) buf[i] = 0;

  writeU32(buf, 0, Math.max(0, Math.floor(data.timestamp)) >>> 0);
  buf[4] = clampU8(data.wardNumericId, 1, 3);

  const rainTenths = Math.round(
    Math.max(0, Math.min(6553.5, data.rainfallRate_mm_hr)) * 10
  );
  writeU16(buf, 5, rainTenths);

  buf[7] = clampU8(Math.round(data.soilSaturation_pct), 0, 100);

  const stageCm = Math.round(
    Math.max(0, Math.min(655.35, data.riverStage_m)) * 100
  );
  writeU16(buf, 8, stageCm);

  writeI16(buf, 10, clampI16(Math.round(data.riverSurgeRate_mm_min)));

  buf[12] = clampU8(data.riskLevel, 0, 3);
  buf[13] = FRAME_SIGNATURE;
  writeU16(buf, 14, clampU16(Math.round(data.batteryMv)));
  writeI8(buf, 16, clampI8(Math.round(data.temperatureC)));
  buf[17] = clampU8(data.relayHopCount, 0, 15);

  // bytes 18..29 stay zero (reserved, future fields: humidity, gust, seqno)

  const crc = crc16Ccitt(buf, 0, 30);
  writeU16(buf, 30, crc);

  return buf;
}

/**
 * decodeTelemetryFrame
 * Extracts a CompactTelemetryFrame from a 32-byte buffer, validating the
 * CRC16-CCITT checksum and the frame signature byte. Throws a typed Error
 * on CRC mismatch so the mesh relay layer can drop the packet cleanly.
 */
export function decodeTelemetryFrame(buffer: Uint8Array): CompactTelemetryFrame {
  if (buffer.length < TELEMETRY_FRAME_SIZE) {
    throw new Error(
      `LoRa decode: buffer too short (${buffer.length} < ${TELEMETRY_FRAME_SIZE})`
    );
  }
  const crcStored = readU16(buffer, 30);
  const crcCalc = crc16Ccitt(buffer, 0, 30);
  if (crcStored !== crcCalc) {
    throw new Error(
      `LoRa decode: CRC16 mismatch (stored 0x${crcStored.toString(16)} ≠ calc 0x${crcCalc.toString(16)})`
    );
  }
  if (buffer[13] !== FRAME_SIGNATURE) {
    throw new Error(
      `LoRa decode: bad frame signature 0x${buffer[13].toString(16)} (expected 0x${FRAME_SIGNATURE.toString(16)})`
    );
  }

  const ward = buffer[4] as WardNumericId;
  const risk = buffer[12] as RiskOrdinal;

  return {
    timestamp: readU32(buffer, 0),
    wardNumericId: ward,
    rainfallRate_mm_hr: readU16(buffer, 5) / 10,
    soilSaturation_pct: buffer[7],
    riverStage_m: readU16(buffer, 8) / 100,
    riverSurgeRate_mm_min: readI16(buffer, 10),
    riskLevel: risk,
    batteryMv: readU16(buffer, 14),
    temperatureC: readI8(buffer, 16),
    relayHopCount: buffer[17],
  };
}

/* ----------------------------------------------------------------------------
 * 6. CAP ALERT BURST  —  48-BYTE PACK / UNPACK
 * ------------------------------------------------------------------------- */

/** Total encoded size of the compressed CAP alert burst. */
export const ALERT_BURST_SIZE = 48;
/** Maximum number of shelter records packed into the burst. */
export const MAX_PACKED_SHELTERS = 4;
/** Bytes per packed shelter (lat int16, lng int16, elevation uint16 + flag). */
const SHELTER_RECORD_BYTES = 7;

/**
 * compressCAPAlertToPayload
 * Converts an active catastrophic alert into an optimised 48-byte transmission
 * burst (hex + base64 + byte size + LoRa link-budget margin). The shelter
 * records are quantised to ~0.001° (~110 m) to fit four shelters into 28 bytes.
 *
 * Returns the hex string, base64, byte size, and the estimated SNR margin at
 * SF9BW125 — the operating mode used by the Meshtastic / SX1262 cluster on
 * the Auli Ridge repeater chain.
 */
export function compressCAPAlertToPayload(
  capData: CompactAlertBurst
): CompressedAlertPayload {
  const buf = new Uint8Array(ALERT_BURST_SIZE);
  for (let i = 0; i < ALERT_BURST_SIZE; i++) buf[i] = 0;

  writeU32(buf, 0, Math.max(0, Math.floor(capData.timestamp)) >>> 0);
  buf[4] = clampU8(capData.wardNumericId, 1, 3);
  buf[5] = clampU8(capData.riskLevel, 0, 3);
  writeU16(buf, 6, clampU16(Math.round(capData.leadTimeMin)));
  writeU16(buf, 8, clampU16(Math.round(capData.peakQ_m3_per_s)));

  const rainTenths = Math.round(
    Math.max(0, Math.min(6553.5, capData.rainfallIntensity_mm_hr)) * 10
  );
  writeU16(buf, 10, rainTenths);
  buf[12] = clampU8(Math.round(capData.soilMoisturePct), 0, 100);
  writeU16(buf, 14, clampU16(Math.round(capData.confluenceQ_m3_per_s)));
  buf[16] = capData.evacuate ? 1 : 0;
  buf[17] = clampU8(capData.shelters.length, 0, MAX_PACKED_SHELTERS);

  // Pack up to 4 shelter records at offset 18, 7 bytes each.
  // Lat/lng are quantised to ~0.001° (millidegrees). Indian longitudes
  // (68–97° E) overflow int16, so we offset by −80 (range → −12..+17, fits).
  for (let s = 0; s < Math.min(capData.shelters.length, MAX_PACKED_SHELTERS); s++) {
    const sh = capData.shelters[s];
    const off = 18 + s * SHELTER_RECORD_BYTES;
    writeI16(buf, off, clampI16(Math.round(sh.lat * 1000)));
    writeI16(buf, off + 2, clampI16(Math.round((sh.lng - 80) * 1000)));
    writeU16(buf, off + 4, clampU16(Math.round(Math.max(0, sh.elevationM))));
    buf[off + 6] = s === 0 ? 0xa1 : 0xa0 + s; // shelter slot marker
  }

  const crc = crc16Ccitt(buf, 0, 46);
  writeU16(buf, 46, crc);

  const hexString = bytesToHex(buf);
  const base64 = bytesToBase64(buf);

  // LoRa airtime at SF9 / 125 kHz: symbolTime = 2^9 / 125e3 = 4.096 ms;
  // nSym = 8 + ceil(8*48 / (4*SF)) ≈ 8 + 24 = 104 → ~426 ms on-air.
  const airtimeMs = Math.round(8 * 4096 + 24 * 4096) / 1000;

  // SNR margin at SF9BW125 for a 48-byte burst over a 12 km ridge hop:
  // link budget ≈ +14 dB Tx power + 3 dBi gain − 122 dB path loss → −9 dB SNR;
  // SX1262 sensitivity at SF9BW125 ≈ −20 dB SNR threshold → margin ≈ 11 dB.
  const snrMarginDb = 11.0;

  return {
    hexString,
    base64,
    byteSize: ALERT_BURST_SIZE,
    snrMarginDb,
    airtimeMs,
  };
}

/**
 * decodeAlertBurst
 * Reconstructs a CompactAlertBurst from a 48-byte buffer (validates CRC).
 * Exposed so the receiving mesh node / dashboard can unpack a relayed burst.
 */
export function decodeAlertBurst(buffer: Uint8Array): CompactAlertBurst {
  if (buffer.length < ALERT_BURST_SIZE) {
    throw new Error(
      `LoRa alert decode: buffer too short (${buffer.length} < ${ALERT_BURST_SIZE})`
    );
  }
  const crcStored = readU16(buffer, 46);
  const crcCalc = crc16Ccitt(buffer, 0, 46);
  if (crcStored !== crcCalc) {
    throw new Error(
      `LoRa alert decode: CRC16 mismatch (stored 0x${crcStored.toString(16)} ≠ calc 0x${crcCalc.toString(16)})`
    );
  }

  const ward = buffer[4] as WardNumericId;
  const risk = buffer[5] as RiskOrdinal;
  const shelterCount = buffer[17];
  const shelters: CompactAlertBurst["shelters"] = [];
  for (let s = 0; s < Math.min(shelterCount, MAX_PACKED_SHELTERS); s++) {
    const off = 18 + s * SHELTER_RECORD_BYTES;
    shelters.push({
      lat: readI16(buffer, off) / 1000,
      // Reverse the −80 longitude offset applied at pack time.
      lng: readI16(buffer, off + 2) / 1000 + 80,
      elevationM: readU16(buffer, off + 4),
    });
  }

  return {
    timestamp: readU32(buffer, 0),
    wardNumericId: ward,
    riskLevel: risk,
    leadTimeMin: readU16(buffer, 6),
    peakQ_m3_per_s: readU16(buffer, 8),
    rainfallIntensity_mm_hr: readU16(buffer, 10) / 10,
    soilMoisturePct: buffer[12],
    confluenceQ_m3_per_s: readU16(buffer, 14),
    evacuate: buffer[16] === 1,
    shelters,
  };
}

/* ----------------------------------------------------------------------------
 * 7. INTERNAL CLAMP HELPERS
 * ------------------------------------------------------------------------- */

function clampU8(v: number, lo = 0, hi = 255): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}
function clampU16(v: number): number {
  return Math.max(0, Math.min(0xffff, Math.floor(v)));
}
function clampI16(v: number): number {
  return Math.max(-0x8000, Math.min(0x7fff, Math.floor(v)));
}
function clampI8(v: number): number {
  return Math.max(-0x80, Math.min(0x7f, Math.floor(v)));
}

/* ----------------------------------------------------------------------------
 * 8. CONVENIENCE FACTORIES
 * ------------------------------------------------------------------------- */

/**
 * Build a CompactTelemetryFrame from the FFEWS cascade vector + sensor read.
 * Bridges the hydrology engine's risk vector into the LoRa wire format.
 */
export function buildTelemetryFrameFromCascade(args: {
  wardId: string;
  timestamp: number;
  rainfallRate_mm_hr: number;
  soilSaturation_pct: number;
  riverStage_m: number;
  riverSurgeRate_mm_min: number;
  riskLevel: string;
  batteryMv?: number;
  temperatureC?: number;
  relayHopCount?: number;
}): CompactTelemetryFrame {
  return {
    timestamp: args.timestamp,
    wardNumericId: (WARD_NUMERIC_MAP[args.wardId as keyof typeof WARD_NUMERIC_MAP] ?? 1) as WardNumericId,
    rainfallRate_mm_hr: args.rainfallRate_mm_hr,
    soilSaturation_pct: args.soilSaturation_pct,
    riverStage_m: args.riverStage_m,
    riverSurgeRate_mm_min: args.riverSurgeRate_mm_min,
    riskLevel: RISK_ORDINAL_MAP[args.riskLevel] ?? 0,
    batteryMv: args.batteryMv ?? 3700,
    temperatureC: args.temperatureC ?? 12,
    relayHopCount: args.relayHopCount ?? 0,
  };
}
