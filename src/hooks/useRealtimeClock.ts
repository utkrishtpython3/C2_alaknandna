"use client";

import { useSyncExternalStore } from "react";

export interface RealtimeClockState {
  istTime: string; // "HH:MM:SS" 24-hr format
  utcTime: string; // "HH:MM:SS" 24-hr format
  istDate: string; // "DD MMM YYYY"
  utcDate: string; // "DD MMM YYYY"
  isoString: string;
  isMounted: boolean;
  dateObj: Date | null;
}

function subscribe(callback: () => void) {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Real-time tactical clock hook that ticks every second.
 * Provides synchronized Indian Standard Time (IST - Chamoli / Uttarakhand local)
 * and Coordinated Universal Time (UTC) formatted with seconds.
 * Hydration-safe for Next.js SSR using useSyncExternalStore.
 */
export function useRealtimeClock(): RealtimeClockState {
  const currentSec = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = currentSec > 0 ? new Date(currentSec * 1000) : null;

  if (!now) {
    return {
      istTime: "--:--:--",
      utcTime: "--:--:--",
      istDate: "-- --- ----",
      utcDate: "-- --- ----",
      isoString: "",
      isMounted: false,
      dateObj: null,
    };
  }

  const istTime = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const utcTime = now.toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const istDate = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const utcDate = now.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return {
    istTime,
    utcTime,
    istDate,
    utcDate,
    isoString: now.toISOString(),
    isMounted: true,
    dateObj: now,
  };
}
