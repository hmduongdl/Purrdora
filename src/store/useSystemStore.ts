import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  SystemTelemetry,
  AudioState,
  MediaInfo,
  AppSettings,
  PerformanceProfile,
  ControlToggleResult,
  NetworkHistoryPoint,
  PerformanceHistoryPoint,
  ShutdownTimerResult,
  ShutdownTimerState,
  SystemControlState,
} from "../types/schema";

/* ── Defaults ── */

const DEFAULT_PROFILE: PerformanceProfile = {
  name: "balanced",
  cpu_governor: "schedutil",
  gpu_power_profile: "auto",
  gamemode_enabled: false,
};

const DEFAULT_SETTINGS: AppSettings = {
  refresh_interval_ms: 1000,
  active_profile: DEFAULT_PROFILE,
};

export const PERFORMANCE_HISTORY_LIMIT = 120;
export type DashboardView = "dashboard" | "audio" | "media" | "optimizer";

export type { PerformanceHistoryPoint } from "../types/schema";

/* ── Store ── */

export interface SystemStore {
  telemetry: SystemTelemetry | null;
  performanceHistory: PerformanceHistoryPoint[];
  networkHistory: NetworkHistoryPoint[];
  audio: AudioState | null;
  media: MediaInfo | null;
  settings: AppSettings;
  controls: SystemControlState;
  shutdownTimer: ShutdownTimerState;
  activeView: DashboardView;
  isTelemetryConnected: boolean;

  setTelemetry: (data: SystemTelemetry) => void;
  setAudio: (data: AudioState) => void;
  setMedia: (data: MediaInfo) => void;
  setSettings: (data: Partial<AppSettings>) => void;
  setIsGamemodeActive: (active: boolean) => void;
  setActiveView: (view: DashboardView) => void;

  toggleGamemode: () => Promise<string>;
  clearRamCache: () => Promise<string>;
  toggleDoNotDisturb: () => Promise<string>;
  toggleKeepAwake: () => Promise<string>;
  setShutdownTimer: (minutes: number | null) => Promise<string>;
  setVolume: (deviceId: number, volumePercent: number) => Promise<void>;
  toggleMute: (deviceId: number) => Promise<void>;
  mediaPlayPause: () => Promise<void>;
  mediaNext: () => Promise<void>;
  mediaPrevious: () => Promise<void>;
  seekMedia: (positionSeconds: number) => Promise<void>;
}

export const useSystemStore = create<SystemStore>((set) => ({
  telemetry: null,
  performanceHistory: [],
  networkHistory: [],
  audio: null,
  media: null,
  settings: DEFAULT_SETTINGS,
  controls: {
    is_gamemode_active: false,
    is_do_not_disturb_active: false,
    is_keep_awake_active: false,
  },
  shutdownTimer: { minutes: null, scheduled_at_ms: null },
  activeView: "dashboard",
  isTelemetryConnected: false,

  setTelemetry: (data) => {
    set((state) => {
      const point: PerformanceHistoryPoint = {
        timestamp_ms: data.timestamp_ms,
        cpu_percent: data.cpu.total_usage_percent,
        ram_percent: data.ram.usage_percent,
        latency_ms: data.network.latency_ms,
      };
      const history = state.performanceHistory;
      const performanceHistory = history.at(-1)?.timestamp_ms === point.timestamp_ms
        ? history
        : [...history, point].slice(-PERFORMANCE_HISTORY_LIMIT);
      const interfaces = data.network.interfaces.filter((networkInterface) => networkInterface.name !== "lo");
      const networkPoint: NetworkHistoryPoint = {
        timestamp_ms: data.timestamp_ms,
        download_bytes_per_sec: interfaces.reduce((total, networkInterface) => total + networkInterface.rx_bytes_per_sec, 0),
        upload_bytes_per_sec: interfaces.reduce((total, networkInterface) => total + networkInterface.tx_bytes_per_sec, 0),
        latency_ms: data.network.latency_ms,
      };
      const networkHistory = state.networkHistory.at(-1)?.timestamp_ms === networkPoint.timestamp_ms
        ? state.networkHistory
        : [...state.networkHistory, networkPoint].slice(-PERFORMANCE_HISTORY_LIMIT);

      return { telemetry: data, performanceHistory, networkHistory, isTelemetryConnected: true };
    });
  },

  setAudio: (data) => {
    set({ audio: data });
  },

  setMedia: (data) => {
    set({ media: data });
  },

  setSettings: (data) => {
    set((s) => ({ settings: { ...s.settings, ...data } }));
  },

  setIsGamemodeActive: (active) => {
    set((state) => ({ controls: { ...state.controls, is_gamemode_active: active } }));
  },

  setActiveView: (view) => {
    set({ activeView: view });
  },

  /* ── Tauri invoke actions ── */

  toggleGamemode: async () => {
    try {
      const result = await invoke<string>("toggle_gamemode");
      const check = await invoke<string>("check_gamemode_status");
      set((state) => ({ controls: { ...state.controls, is_gamemode_active: check.includes("active") } }));
      return result;
    } catch (e) {
      console.error("[toggleGamemode]", e);
      throw e;
    }
  },

  clearRamCache: async () => {
    try {
      return await invoke<string>("clear_ram_cache");
    } catch (e) {
      console.error("[clearRamCache]", e);
      throw e;
    }
  },

  toggleDoNotDisturb: async () => {
    try {
      const result = await invoke<ControlToggleResult>("toggle_do_not_disturb");
      set((state) => ({ controls: { ...state.controls, is_do_not_disturb_active: result.active } }));
      return result.message;
    } catch (e) {
      console.error("[toggleDoNotDisturb]", e);
      throw e;
    }
  },

  toggleKeepAwake: async () => {
    try {
      const result = await invoke<ControlToggleResult>("toggle_keep_awake");
      set((state) => ({ controls: { ...state.controls, is_keep_awake_active: result.active } }));
      return result.message;
    } catch (e) {
      console.error("[toggleKeepAwake]", e);
      throw e;
    }
  },

  setShutdownTimer: async (minutes) => {
    try {
      const result = await invoke<ShutdownTimerResult>("set_shutdown_timer", { minutes });
      set({
        shutdownTimer: {
          minutes: result.minutes,
          scheduled_at_ms: result.active && result.minutes != null
            ? Date.now() + result.minutes * 60_000
            : null,
        },
      });
      return result.message;
    } catch (e) {
      console.error("[setShutdownTimer]", e);
      throw e;
    }
  },

  setVolume: async (deviceId, volumePercent) => {
    try {
      await invoke("set_audio_volume", { id: deviceId, volumePercent });
    } catch (e) {
      console.error("[setVolume]", e);
      throw e;
    }
  },

  toggleMute: async (deviceId) => {
    try {
      await invoke("toggle_audio_mute", { id: deviceId });
    } catch (e) {
      console.error("[toggleMute]", e);
      throw e;
    }
  },

  mediaPlayPause: async () => {
    set((s) => {
      if (!s.media) return {};
      const currentStatus = s.media.playback_status;
      const nextStatus =
        currentStatus === "Playing" ? "Paused" : "Playing";
      return { media: { ...s.media, playback_status: nextStatus } };
    });
    try {
      await invoke("media_play_pause");
    } catch (e) {
      console.error("[mediaPlayPause]", e);
      set((s) => {
        if (!s.media) return {};
        const revertedStatus =
          s.media.playback_status === "Playing" ? "Paused" : "Playing";
        return { media: { ...s.media, playback_status: revertedStatus } };
      });
    }
  },

  mediaNext: async () => {
    try {
      await invoke("media_next");
    } catch (e) {
      console.error("[mediaNext]", e);
    }
  },

  mediaPrevious: async () => {
    try {
      await invoke("media_previous");
    } catch (e) {
      console.error("[mediaPrevious]", e);
    }
  },

  seekMedia: async (positionSeconds) => {
    try {
      await invoke("seek_media", { positionSeconds });
      set((s) => s.media ? { media: { ...s.media, position_seconds: positionSeconds } } : {});
    } catch (e) {
      console.error("[seekMedia]", e);
    }
  },
}));
