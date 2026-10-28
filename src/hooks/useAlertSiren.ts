"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useAlertSiren
 * ----------------------------------------------------------------------------
 * A self-contained evacuation siren synthesised with the Web Audio API — no
 * audio asset files required. Produces an alternating two-tone wail (high-low
 * sweep) reminiscent of civil-defence air-raid sirens, used by the FFEWS to
 * audibly flag an active evacuation trigger (alert level ≥ EXTREME).
 *
 * Browser autoplay policy: the AudioContext is created lazily and resumed
 * inside a user-gesture handler (`arm()`), then `start()/stop()` can fire the
 * siren from non-gesture code (effect hooks) without being blocked.
 *
 * Returns:
 *   armed   — true once the AudioContext has been unlocked by a gesture
 *   muted   — master mute flag (persists to localStorage)
 *   active   — true while the siren is currently sounding
 *   arm()    — call on first user interaction (click/keydown) to unlock audio
 *   start()  — begin the siren loop (no-op if muted or already active)
 *   stop()   — stop the siren loop
 *   toggleMute() — flip the master mute
 */
export interface AlertSirenApi {
  armed: boolean;
  muted: boolean;
  active: boolean;
  arm: () => void;
  start: () => void;
  stop: () => void;
  toggleMute: () => void;
}

const MUTE_KEY = "ews.siren.muted";

export function useAlertSiren(): AlertSirenApi {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscHiRef = useRef<OscillatorNode | null>(null);
  const oscLoRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiRef = useRef(760);
  const stateRef = useRef({ armed: false, muted: false, active: false });

  const [armed, setArmed] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [active, setActive] = useState(false);

  // Keep the ref in sync with the muted state (ref is read inside callbacks
  // where setState would be inappropriate). Ref mutation is not flagged.
  useEffect(() => {
    stateRef.current.muted = muted;
  }, [muted]);

  /** Lazily create / resume the AudioContext (must run in a user gesture). */
  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      try {
        ctxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  /** Unlock audio on first user gesture. Safe to call repeatedly. */
  const arm = useCallback(() => {
    if (stateRef.current.armed) return;
    const ctx = ensureContext();
    if (!ctx) return;
    stateRef.current.armed = true;
    setArmed(true);
  }, [ensureContext]);

  /** Tear down the current siren voices + LFO. */
  const teardown = useCallback(() => {
    const stopNode = (n: { stop?: () => void; disconnect?: () => void } | null) => {
      try {
        n?.stop?.();
      } catch {
        /* already stopped */
      }
      try {
        n?.disconnect?.();
      } catch {
        /* ignore */
      }
    };
    stopNode(oscHiRef.current);
    stopNode(oscLoRef.current);
    stopNode(lfoRef.current);
    stopNode(lfoGainRef.current);
    oscHiRef.current = null;
    oscLoRef.current = null;
    lfoRef.current = null;
    lfoGainRef.current = null;
    gainRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Start the siren loop (no-op if muted / not armed / already active). */
  const start = useCallback(() => {
    if (stateRef.current.muted || stateRef.current.active) return;
    const ctx = ctxRef.current ?? ensureContext();
    if (!ctx) {
      // Not armed yet — mark intent; the effect in page.tsx will retry on arm.
      return;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    // --- Voice graph ---------------------------------------------------
    // Two detuned sawtooth oscillators (hi + lo) → master gain → destination.
    // An LFO modulates the master gain to produce the wail envelope, and a
    // step timer toggles the carrier frequencies between high/low tones to
    // simulate the alternating air-raid pattern.
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.22, now + 0.25);
    master.connect(ctx.destination);
    gainRef.current = master;

    const oscHi = ctx.createOscillator();
    oscHi.type = "sawtooth";
    oscHi.frequency.setValueAtTime(760, now);
    const oscLo = ctx.createOscillator();
    oscLo.type = "sawtooth";
    oscLo.frequency.setValueAtTime(380, now);
    oscLo.detune.setValueAtTime(-8, now); // slight chorus
    oscHi.connect(master);
    oscLo.connect(master);

    // Wail envelope — LFO on master gain (≈ 0.55 Hz, deep tremolo).
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.55, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.14, now);
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);

    oscHi.start();
    oscLo.start();
    lfo.start();
    oscHiRef.current = oscHi;
    oscLoRef.current = oscLo;
    lfoRef.current = lfo;
    lfoGainRef.current = lfoGain;

    // Alternating two-tone step (every 0.9 s) — high ↔ low sweep.
    hiRef.current = 760;
    timerRef.current = setInterval(() => {
      const c = ctxRef.current;
      const gHi = oscHiRef.current;
      const gLo = oscLoRef.current;
      if (!c || !gHi || !gLo) return;
      const t = c.currentTime;
      hiRef.current = hiRef.current > 600 ? 480 : 760;
      gHi.frequency.cancelScheduledValues(t);
      gHi.frequency.setValueAtTime(gHi.frequency.value, t);
      gHi.frequency.linearRampToValueAtTime(hiRef.current, t + 0.18);
      gLo.frequency.cancelScheduledValues(t);
      gLo.frequency.setValueAtTime(gLo.frequency.value, t);
      gLo.frequency.linearRampToValueAtTime(hiRef.current / 2, t + 0.18);
    }, 900);

    stateRef.current.active = true;
    setActive(true);
  }, [ensureContext]);

  /** Stop the siren loop with a fast fade to avoid clicks. */
  const stop = useCallback(() => {
    if (!stateRef.current.active && !gainRef.current) return;
    const ctx = ctxRef.current;
    const g = gainRef.current;
    if (ctx && g) {
      const t = ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      } catch {
        /* ignore */
      }
    }
    // Defer teardown until after the fade.
    setTimeout(teardown, 180);
    if (stateRef.current.active) {
      stateRef.current.active = false;
      setActive(false);
    }
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const next = !stateRef.current.muted;
    stateRef.current.muted = next;
    setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next) {
      // Muting immediately silences an active siren.
      teardown();
      stateRef.current.active = false;
      setActive(false);
    }
  }, [teardown]);

  // Cleanup on unmount.
  useEffect(() => teardown, [teardown]);

  return useMemo(
    () => ({ armed, muted, active, arm, start, stop, toggleMute }),
    [armed, muted, active, arm, start, stop, toggleMute]
  );
}
