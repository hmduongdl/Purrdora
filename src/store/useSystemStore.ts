import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  SystemTelemetry,
  AudioState,
  MediaInfo,
  AppSettings,
  PerformanceProfile,
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

/* ── Store ── */

export interface SystemStore {
  telemetry: SystemTelemetry | null;
  audio: AudioState | null;
  media: MediaInfo | null;
  settings: AppSettings;
  isGamemodeActive: boolean;
  isTelemetryConnected: boolean;

  setTelemetry: (data: SystemTelemetry) => void;
  setAudio: (data: AudioState) => void;
  setMedia: (data: MediaInfo) => void;
  setSettings: (data: Partial<AppSettings>) => void;
  setIsGamemodeActive: (active: boolean) => void;

  toggleGamemode: () => Promise<string>;
  clearRamCache: () => Promise<string>;
  setVolume: (deviceId: number, volumePercent: number) => Promise<void>;
  toggleMute: (deviceId: number) => Promise<void>;
  mediaPlayPause: () => Promise<void>;
  mediaNext: () => Promise<void>;
  mediaPrevious: () => Promise<void>;
}

export const useSystemStore = create<SystemStore>((set) => ({
  telemetry: null,
  audio: null,
  media: null,
  settings: DEFAULT_SETTINGS,
  isGamemodeActive: false,
  isTelemetryConnected: false,

  setTelemetry: (data) => {
    set({ telemetry: data, isTelemetryConnected: true });
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
    set({ isGamemodeActive: active });
  },

  /* ── Tauri invoke actions ── */

  toggleGamemode: async () => {
    try {
      const result = await invoke<string>("toggle_gamemode");
      const check = await invoke<string>("check_gamemode_status");
      set({ isGamemodeActive: check.includes("active") });
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
      await invoke("play_pause");
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
      await invoke("next");
    } catch (e) {
      console.error("[mediaNext]", e);
    }
  },

  mediaPrevious: async () => {
    try {
      await invoke("previous");
    } catch (e) {
      console.error("[mediaPrevious]", e);
    }
  },
}));
