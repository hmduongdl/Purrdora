import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSystemStore } from "../store/useSystemStore";
import { dashboardFetchQueue } from "../lib/dashboardFetchQueue";
import type { SystemTelemetry, AudioState, MediaInfo, GameFpsUpdate } from "../types/schema";

type ByteStreamPayload = {
  encoding: "json-utf8";
  byte_len: number;
  data: number[];
};

function decodeIpcPayload<T>(payload: T | ByteStreamPayload): T {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "encoding" in payload &&
    payload.encoding === "json-utf8" &&
    Array.isArray(payload.data)
  ) {
    const bytes = new Uint8Array(payload.data);
    if (bytes.byteLength !== payload.byte_len) {
      throw new Error("IPC byte-stream length mismatch");
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }
  return payload as T;
}

export type ActivePage = "dashboard" | "game" | "msi" | "drivers" | "settings";

const AUDIO_CACHE_TTL_MS = 10_000;
const MEDIA_CACHE_TTL_MS = 120_000;
const PROCESS_CACHE_TTL_MS = 10_000;
const BATTERY_CACHE_TTL_MS = 30_000;
const MSI_EC_CACHE_TTL_MS = 10_000;

function isFresh(updatedAt: number, maxAgeMs: number) {
  return updatedAt > 0 && Date.now() - updatedAt <= maxAgeMs;
}

function gameQueueDelayMs() {
  const ramPercent = useSystemStore.getState().telemetry?.ram.usage_percent ?? 0;
  // Scale linearly from +3s at 0% RAM to +5s at 100% RAM.
  return 3_000 + Math.min(100, Math.max(0, ramPercent)) * 20;
}

export function useIpcListener(activePage: ActivePage) {
  const setTelemetry   = useSystemStore((s) => s.setTelemetry);
  const setAudio       = useSystemStore((s) => s.setAudio);
  const setMedia       = useSystemStore((s) => s.setMedia);
  const fetchProcesses = useSystemStore((s) => s.fetchProcesses);
  const fetchBattery   = useSystemStore((s) => s.fetchBattery);
  const fetchRunningGame = useSystemStore((s) => s.fetchRunningGame);
  const fetchMsiEcState = useSystemStore((s) => s.fetchMsiEcState);
  const fetchAudio = useSystemStore((s) => s.fetchAudio);
  const fetchMedia = useSystemStore((s) => s.fetchMedia);
  const isGameRunning = useSystemStore((s) => s.runningGame !== null);
  const setGameFps = useSystemStore((s) => s.setGameFps);
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      // ── IPC event listeners ───────────────────────────────────────
      const u1 = await listen<SystemTelemetry>("system-tick", (event) => {
        try {
          setTelemetry(decodeIpcPayload<SystemTelemetry>(event.payload));
        } catch (error) {
          console.error("[system-tick] invalid IPC payload", error);
        }
      });
      unlisteners.push(u1);

      const u2 = await listen<MediaInfo | null>("media-update", (event) => {
        try {
          setMedia(decodeIpcPayload<MediaInfo | null>(event.payload));
        } catch (error) {
          console.error("[media-update] invalid IPC payload", error);
        }
      });
      unlisteners.push(u2);

      const u4 = await listen<GameFpsUpdate>("game-fps-update", (event) => {
        try {
          const update = decodeIpcPayload<GameFpsUpdate>(event.payload);
          setGameFps(update);
          // MangoHud is an event-driven wake-up signal. It lets Game polling
          // stay fully asleep while idle, yet detects a newly launched game.
          if (
            activePageRef.current === "game" &&
            update.fps !== null &&
            useSystemStore.getState().runningGame === null
          ) {
            dashboardFetchQueue.enqueue("detect-running-game", fetchRunningGame);
          }
        } catch (error) {
          console.error("[game-fps-update] invalid IPC payload", error);
        }
      });
      unlisteners.push(u4);

      try {
        const u3 = await listen<AudioState>("audio-update", (event) => {
          try {
            setAudio(decodeIpcPayload<AudioState>(event.payload));
          } catch (error) {
            console.error("[audio-update] invalid IPC payload", error);
          }
        });
        unlisteners.push(u3);
      } catch (error) { console.error("[audio-update] listener unavailable", error); }

    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [setTelemetry, setAudio, setMedia, setGameFps, fetchRunningGame]);

  useEffect(() => {
    if (activePage !== "game") return;
    // One detection on page entry. If no game exists, no recurring Game task
    // is registered; MangoHud wakes detection when a game starts later.
    dashboardFetchQueue.enqueue("detect-running-game", fetchRunningGame);
  }, [activePage, fetchRunningGame]);

  useEffect(() => {
    const unregisterFetches: Array<() => void> = [];
    let initialDataFrame: number | null = null;

    if (activePage === "dashboard") {
      const cache = useSystemStore.getState().cacheUpdatedAt;
      // Dashboard-only reads sleep as soon as another page is selected.
      unregisterFetches.push(
        dashboardFetchQueue.register("battery", fetchBattery, {
          cadenceTicks: 3,
          initialDelayMs: 100,
          runInitially: !isFresh(cache.battery, BATTERY_CACHE_TTL_MS),
        }),
        dashboardFetchQueue.register("processes", fetchProcesses, {
          initialDelayMs: 800,
          runInitially: !isFresh(cache.processes, PROCESS_CACHE_TTL_MS),
        }),
      );

      // Yield one frame so the dashboard shell and skeletons paint first.
      initialDataFrame = globalThis.requestAnimationFrame(() => {
        dashboardFetchQueue.enqueue("initial-audio", () => fetchAudio(AUDIO_CACHE_TTL_MS));
        dashboardFetchQueue.enqueue("initial-media", () => fetchMedia(MEDIA_CACHE_TTL_MS));
      });
    } else if (activePage === "msi") {
      const cache = useSystemStore.getState().cacheUpdatedAt;
      // Keep only data consumed by MSI Center awake.
      unregisterFetches.push(
        dashboardFetchQueue.register("battery", fetchBattery, {
          cadenceTicks: 3,
          initialDelayMs: 100,
          runInitially: !isFresh(cache.battery, BATTERY_CACHE_TTL_MS),
        }),
        dashboardFetchQueue.register("msi-ec", fetchMsiEcState, {
          initialDelayMs: 500,
          runInitially: !isFresh(cache.msiEc, MSI_EC_CACHE_TTL_MS),
        }),
      );
    } else if (isGameRunning) {
      // Poll only while a game truly exists. Extend the normal 10-second
      // cadence by a RAM-aware 3-5 seconds (13-15 seconds total).
      unregisterFetches.push(
        dashboardFetchQueue.register("running-game", fetchRunningGame, {
          runInitially: false,
          deferMs: gameQueueDelayMs,
        }),
      );
    }

    return () => {
      if (initialDataFrame !== null) globalThis.cancelAnimationFrame(initialDataFrame);
      unregisterFetches.forEach((unregister) => unregister());
    };
  }, [activePage, isGameRunning, fetchAudio, fetchMedia, fetchProcesses, fetchBattery, fetchRunningGame, fetchMsiEcState]);
}
