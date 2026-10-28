"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface SimulationTimelineState {
  /** Current simulation time in minutes [0..120] */
  currentTimeMin: number;
  /** Whether the simulation playback loop is actively running */
  isPlaying: boolean;
  /** Playback speed factor (e.g., 1x, 2x, 5x, 10x real-time simulation) */
  playbackSpeed: number;
  /** Maximum duration of scenario in minutes (default: 120) */
  maxDurationMin: number;
  /** Inundation wave front position [0..1] along gorge axis */
  waveFrontProgress: number;
  /** Estimated downstream flood arrival count in minutes */
  confluenceArrivalMin: number;
  /** Dynamic wet-dry bed front tracking active */
  isWetDryTrackingActive: boolean;
  /** Total submerged bed area estimate (km2) */
  submergedAreaKm2: number;
}

export interface UseSimulationTimelineReturn extends SimulationTimelineState {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  reset: () => void;
  seek: (timeMin: number) => void;
  setSpeed: (speed: number) => void;
  stepForward: (stepMin?: number) => void;
  stepBackward: (stepMin?: number) => void;
}

export function useSimulationTimeline(
  initialTimeMin: number = 0,
  maxDurationMin: number = 120,
  defaultSpeed: number = 2
): UseSimulationTimelineReturn {
  const [currentTimeMin, setCurrentTimeMin] = useState<number>(initialTimeMin);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(defaultSpeed);

  const requestRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);
  const updateLoopRef = useRef<(now: number) => void>(() => {});

  // Advance simulation clock loop
  const updateLoop = useCallback(
    (now: number) => {
      if (lastTickTimeRef.current !== null) {
        const deltaMs = now - lastTickTimeRef.current;
        // 1 real second = (playbackSpeed) simulation minutes
        const deltaSimMinutes = (deltaMs / 1000.0) * playbackSpeed;

        setCurrentTimeMin((prev) => {
          const next = prev + deltaSimMinutes;
          if (next >= maxDurationMin) {
            setIsPlaying(false);
            return maxDurationMin;
          }
          return next;
        });
      }
      lastTickTimeRef.current = now;
      if (isPlaying) {
        requestRef.current = requestAnimationFrame((n) => updateLoopRef.current(n));
      }
    },
    [isPlaying, playbackSpeed, maxDurationMin]
  );

  useEffect(() => {
    updateLoopRef.current = updateLoop;
  }, [updateLoop]);

  useEffect(() => {
    if (isPlaying) {
      lastTickTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame((n) => updateLoopRef.current(n));
    } else {
      lastTickTimeRef.current = null;
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, updateLoop]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTimeMin(0);
  }, []);
  const seek = useCallback(
    (timeMin: number) => {
      setCurrentTimeMin(Math.max(0, Math.min(maxDurationMin, timeMin)));
    },
    [maxDurationMin]
  );
  const setSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(Math.max(0.5, Math.min(20, speed)));
  }, []);
  const stepForward = useCallback(
    (stepMin: number = 2) => {
      setCurrentTimeMin((prev) => Math.min(maxDurationMin, prev + stepMin));
    },
    [maxDurationMin]
  );
  const stepBackward = useCallback((stepMin: number = 2) => {
    setCurrentTimeMin((prev) => Math.max(0, prev - stepMin));
  }, []);

  // Derived physics metrics
  // Wave travels down the 18km gorge reaching confluence at t ~ 16 minutes
  const waveFrontProgress = Math.min(1.0, currentTimeMin / 45.0);
  const confluenceArrivalMin = Math.max(0, 16.5 - currentTimeMin);
  const submergedAreaKm2 = Number(
    (0.45 + waveFrontProgress * 3.82 * (currentTimeMin > 4 ? 1.0 : 0.2)).toFixed(2)
  );

  return {
    currentTimeMin,
    isPlaying,
    playbackSpeed,
    maxDurationMin,
    waveFrontProgress,
    confluenceArrivalMin,
    isWetDryTrackingActive: true,
    submergedAreaKm2,
    play,
    pause,
    togglePlay,
    reset,
    seek,
    setSpeed,
    stepForward,
    stepBackward,
  };
}
