---
Task ID: 1
Agent: main (Z.ai Code)
Task: Engineer an operational GeoJSON catchment engine (`catchments.geojson`) + TypeScript spatial-hydrology controller (`hydrologyEngine.ts`) for hyper-local flash flood / debris-flow early warning in the Upper Alaknanda–Dhauliganga basin (Joshimath–Vishnuprayag–Helang gorge), plus an operational dashboard.

Work Log:
- Authored `src/data/catchments.geojson` — RFC 7946 FeatureCollection, 3 hydrologically contiguous micro-catchments (UK-CHM-UPPER → MID → LOWER), closed rings, [lng,lat] order. Verified: rings closed, shared border vertices confirm contiguity, planimetric areas 5.39 / 5.22 / 3.31 km² (declared contributing areas 6.42 / 5.38 / 4.06, all within 3.5–7.8 spec band). Full property schema: admin/cadastral, topographic (Kirpich Tc 25.5/30/29.8 min), geotechnical Green-Ampt (Ksat, porosity, ψ, recession), dynamic FFG dry/saturated thresholds, NDRF critical_infrastructure + evacuation points, downstream_target_ward_id.
- Authored `src/lib/hydrologyEngine.ts` — strict TS types (CatchmentFeature, CatchmentProperties, TelemetryInput, FlashFloodRiskVector, BasinCascadeResult). HydrologyEngine class with: `calculateDynamicThreshold` (Green-Ampt 1-hr infiltration ceiling + convex moisture interpolation between dry/saturated FFG), `estimatePeakDischarge` (Rational Q=0.278·C·I·A with non-linear sigmoid runoff C of soil-moisture + slope), `simulateBasinCascade` (kinematic-wave topological routing UPPER→MID→LOWER, transmission factor, cumulative surge + arrival lead time, debris-flow probability, NDRF directive), `getEvacuationPlan` (sorted by safe elevation differential), `computeAreaSqkm` (spherical shoelace), `haversineKm`. Server-only fs loader (`loadCatchments`/`getHydrologyEngine`) keeps the `.geojson` deliverable pristine.
- API routes: `src/app/api/hydrology/cascade/route.ts` (GET catalogue w/ geometry; POST cascade), `src/app/api/hydrology/ward/route.ts` (GET single-ward FFG + evacuation).
- Dashboard (`src/app/page.tsx` + `src/components/ews/{CatchmentMap,TelemetryControls,Results,WardDetailPanel}.tsx`): dark tactical UI, SVG catchment map (projected lng/lat → SVG, risk-colored, infra + shelter markers, river stem), per-ward telemetry sliders + Dry/Monsoon/Cloudburst presets (auto-run), cascade result cards, basin-wide alert banner + NDRF directive, ward hydro-physics panel with dynamic FFG threshold meter + evacuation plan. Sticky footer via `min-h-screen flex flex-col` + `mt-auto`.
- Fixed: Turbopack `.geojson` loader error (switched to server-side fs load + API-served geometry), ESLint `react-hooks/set-state-in-effect` (debounced fetch + render-side stale-data guard), slider/button dark-theme overrides in globals.css, preset auto-run UX.
- Verification: `bun run lint` clean. dev.log all 200, no errors. Agent Browser: page renders (VLM-confirmed map/cards/sliders/footer), Cloudburst preset → all wards CATACLYSMIC with Q cascading 149→252→310 m³/s, debris 98%, exceedance 4.26×/5.15×/5.89×; Dry preset → LOW. Ward card click → detail panel updates. Mobile 390px: single column, no horizontal overflow.

Stage Summary:
- Deliverable 1: `src/data/catchments.geojson` — valid, un-truncated, RFC 7946 compliant.
- Deliverable 2: `src/lib/hydrologyEngine.ts` — typed, production-ready, directly importable.
- Operational dashboard live on `/` (port 3000). All golden-path interactions browser-verified.
