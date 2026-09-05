"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioId } from "@/lib/hydrologyEngine";

/**
 * usePresentationControls
 * ----------------------------------------------------------------------------
 * A global keyboard hotkey listener engineered for 3-minute hackathon pitch
 * pacing. During a live demo, fumbling with tiny UI buttons ruins the flow —
 * this hook lets the presenter drive the entire C2 dashboard from the
 * keyboard:
 *
 *   Key 1  → Dry / Pre-Monsoon Baseline (all green, Q ≈ 16 m³/s)
 *   Key 2  → Active Monsoon Saturated (yellow/orange, soil moisture 89%)
 *   Key 3  → Cataclysmic Cloudburst Cascade (red, sirens, countdown, surge)
 *   Key M  → Toggle Audio Klaxon Siren (mute/unmute)
 *   Key D  → Open the CAP Emergency Dispatch Modal
 *   Key S  → Auto-download the NDRF Incident SITREP JSON
 *
 * The hook ignores key events when the user is typing in an input/textarea
 * (so telemetry sliders don't misfire). It also exposes a collapsible
 * "Pitch Controls Guide" badge state so judges see the system is engineered
 * for rapid command-line operations.
 */

export interface PresentationControlsOptions {
  onScenario: (id: ScenarioId) => void;
  onToggleSiren: () => void;
  onOpenDispatch: () => void;
  onDownloadSitrep: () => void;
  /** When false, the hotkey listener is suspended (e.g. dispatch modal open). */
  enabled?: boolean;
}

export interface PresentationControlsApi {
  /** Whether the pitch-controls guide badge is expanded. */
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
