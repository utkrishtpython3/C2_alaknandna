/**
 * ============================================================================
 *  HYDROLOGY ENGINE — SERVER-ONLY SINGLETON FACTORY
 * ============================================================================
 *  Loads the operational `catchments.geojson` from disk and instantiates the
 *  HydrologyEngine singleton. This module imports `node:fs` and must NEVER be
 *  imported from client components — only from server routes / server actions.
 *
 *  Client components import the class, types, and SCENARIO_PRESETS directly
 *  from `@/lib/hydrologyEngine` (which has no Node built-in imports).
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import {
  HydrologyEngine,
  type CatchmentCollection,
} from "@/lib/hydrologyEngine";

const CATCHMENTS_FILE = path.join(
  process.cwd(),
  "src",
  "data",
  "catchments.geojson"
);

let _data: CatchmentCollection | null = null;

/** Loads & caches the operational catchment GeoJSON from disk. */
export function loadCatchments(): CatchmentCollection {
  if (_data) return _data;
  const raw = fs.readFileSync(CATCHMENTS_FILE, "utf8");
  _data = JSON.parse(raw) as CatchmentCollection;
  return _data;
}

let _instance: HydrologyEngine | null = null;

/** Returns the shared HydrologyEngine singleton (server-only). */
export function getHydrologyEngine(): HydrologyEngine {
  if (!_instance) _instance = new HydrologyEngine(loadCatchments());
  return _instance;
}

export { HydrologyEngine };
