"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioId } from "@/lib/hydrologyEngine";

/**
 * usePresentationControls
 * ----------------------------------------------------------------------------
 * A global keyboard hotkey listener engineered for high-tempo tactical operations.
 * Allows incident commanders to drive the entire C2 dashboard from the keyboard:
 *
 *   Key 1  → Dry / Pre-Monsoon Baseline (all green, Q ≈ 16 m³/s)
 *   Key 2  → Active Monsoon Saturated (yellow/orange, soil moisture 89%)
 *   Key 3  → Cataclysmic Cloudburst Cascade (red, sirens, countdown, surge)
 *   Key 4  → 2021 Chamoli GLOF & Debris Flow Scenario
 *   Key T  → 60-Second Tactical Mission Briefing
 *   Key L  → Non-Newtonian Rheology Lab (2.10x Bulking)
 *   Key V  → Garhwali & Hindi Voice Megaphone
 *   Key U  → UAV Drone Recon Sentry HUD
 *   Key M  → Toggle Audio Klaxon Siren (mute/unmute)
 *   Key D  → Open the CAP Emergency Dispatch Modal
 *   Key S  → Auto-download the NDRF Incident SITREP JSON
 *
 * The hook ignores key events when the user is typing in an input/textarea
 * (so telemetry sliders don't misfire). It also exposes a collapsible
 * "Tactical Controls Guide" badge state for command-line operations.
 */

export interface PresentationControlsOptions {
  onScenario: (id: ScenarioId) => void;
  onToggleSiren: () => void;
  onOpenDispatch: () => void;
  onDownloadSitrep: () => void;
  onOpenSitrep?: () => void;
  onOpenMultiSource?: () => void;
  onOpenJudgeTour?: () => void;
  onOpenRheologyLab?: () => void;
  onOpenVoiceBroadcast?: () => void;
  onOpenNebiusHpc?: () => void;
  onOpenValleyCrossSection?: () => void;
  onStartDroneTour?: () => void;
  onOpenNdrfCommandPost?: () => void;
  onToggleZenMode?: () => void;
  /** When false, the hotkey listener is suspended (e.g. dispatch modal open). */
  enabled?: boolean;
}

export interface PresentationControlsApi {
  /** Whether the tactical controls guide badge is expanded. */
  guideVisible: boolean;
  toggleGuide: () => void;
  /** The last key pressed (for a subtle "key received" visual confirmation). */
  lastKey: string | null;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable ||
    el.getAttribute("role") === "slider" ||
    el.getAttribute("role") === "textbox"
  );
}

export function usePresentationControls(
  opts: PresentationControlsOptions
): PresentationControlsApi {
  const [guideVisible, setGuideVisible] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const optsRef = useRef(opts);
  // Keep the ref in sync with the latest options inside an effect (not during
  // render) so the keydown handler always sees fresh callbacks.
  useEffect(() => {
    optsRef.current = opts;
  });

  const toggleGuide = useCallback(() => {
    setGuideVisible((v) => !v);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when the user is interacting with a form control.
      if (isTypingTarget(e.target)) return;
      // Skip when explicitly disabled (e.g. a modal overlay is open).
      if (optsRef.current.enabled === false) return;
      // Skip modifier combos (Ctrl+S, Cmd+S, etc. should use browser defaults).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toUpperCase();
      const o = optsRef.current;

      switch (key) {
        case "1":
          o.onScenario("dry");
          setLastKey("1");
          break;
        case "2":
          o.onScenario("monsoon");
          setLastKey("2");
          break;
        case "3":
          o.onScenario("cloudburst");
          setLastKey("3");
          break;
        case "4":
          o.onScenario("glof");
          setLastKey("4");
          break;
        case "M":
          o.onToggleSiren();
          setLastKey("M");
          break;
        case "D":
          o.onOpenDispatch();
          setLastKey("D");
          break;
        case "S":
          o.onDownloadSitrep();
          setLastKey("S");
          break;
        case "R":
          if (o.onOpenSitrep) o.onOpenSitrep();
          setLastKey("R");
          break;
        case "F":
          if (o.onOpenMultiSource) o.onOpenMultiSource();
          setLastKey("F");
          break;
        case "T":
          if (o.onOpenJudgeTour) o.onOpenJudgeTour();
          setLastKey("T");
          break;
        case "L":
          if (o.onOpenRheologyLab) o.onOpenRheologyLab();
          setLastKey("L");
          break;
        case "V":
          if (o.onOpenVoiceBroadcast) o.onOpenVoiceBroadcast();
          setLastKey("V");
          break;
        case "P":
          if (o.onOpenNebiusHpc) o.onOpenNebiusHpc();
          setLastKey("P");
          break;
        case "X":
          if (o.onOpenValleyCrossSection) o.onOpenValleyCrossSection();
          setLastKey("X");
          break;
        case "U":
          if (o.onStartDroneTour) o.onStartDroneTour();
          setLastKey("U");
          break;
        case "I":
          if (o.onOpenNdrfCommandPost) o.onOpenNdrfCommandPost();
          setLastKey("I");
          break;
        case "Z":
          if (o.onToggleZenMode) o.onToggleZenMode();
          else window.dispatchEvent(new CustomEvent("ews:toggle-zen-mode"));
          setLastKey("Z");
          break;
        default:
          return; // don't preventDefault for unmapped keys
      }
      e.preventDefault();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-hide the "last key" confirmation after 1.5 s.
  useEffect(() => {
    if (!lastKey) return;
    const id = setTimeout(() => setLastKey(null), 1500);
    return () => clearTimeout(id);
  }, [lastKey]);

  return { guideVisible, toggleGuide, lastKey };
}
