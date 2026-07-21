import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  OrphanDevice,
  MissingFirmware,
  FwupdStatus,
  FullHardwareDevice,
  PhysicalDiskInfo,
  SmartHealthData
} from "../types/schema";

export interface HardwareHealthStore {
  orphanDevices: OrphanDevice[];
  fullHardwareDevices: FullHardwareDevice[];
  physicalDisks: PhysicalDiskInfo[];
  smartHealthMap: Record<string, SmartHealthData>;
  missingFirmware: MissingFirmware[];
  firmwareStatus: FwupdStatus | null;
  isLoading: boolean;
  lastScanned: number | null;
  error: string | null;

  fetchHardwareHealth: () => Promise<void>;
  fetchSmartHealth: (devPath: string) => Promise<SmartHealthData>;
  installFirmware: (ids: string[]) => Promise<void>;
  showOnDashboard: boolean;
  toggleShowOnDashboard: () => void;
}

export const useHardwareHealthStore = create<HardwareHealthStore>((set, get) => ({
  orphanDevices: [],
  fullHardwareDevices: [],
  physicalDisks: [],
  smartHealthMap: {},
  missingFirmware: [],
  firmwareStatus: null,
  isLoading: false,
  lastScanned: null,
  error: null,
  showOnDashboard: localStorage.getItem("purrdora_show_hardware_health") !== "false",

  fetchHardwareHealth: async () => {
    set({ isLoading: true, error: null });
    try {
      const [
        orphanDevices,
        fullHardwareDevices,
        physicalDisks,
        missingFirmware,
        firmwareStatus
      ] = await Promise.all([
        invoke<OrphanDevice[]>("scan_orphan_devices"),
        invoke<FullHardwareDevice[]>("scan_full_hardware_devices"),
        invoke<PhysicalDiskInfo[]>("scan_physical_disks"),
        invoke<MissingFirmware[]>("scan_missing_firmware"),
        invoke<FwupdStatus>("check_firmware_updates"),
      ]);

      set({
        orphanDevices,
        fullHardwareDevices,
        physicalDisks,
        missingFirmware,
        firmwareStatus,
        isLoading: false,
        lastScanned: Date.now(),
        error: null,
      });

      // Async trigger SMART scan for all discovered physical disks
      if (physicalDisks.length > 0) {
        for (const disk of physicalDisks) {
          void get().fetchSmartHealth(disk.dev_path);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch hardware health:", err);
      set({
        isLoading: false,
        error: err?.message || String(err) || "Failed to scan hardware health",
      });
    }
  },

  fetchSmartHealth: async (devPath: string) => {
    try {
      const smart = await invoke<SmartHealthData>("get_disk_smart_health", { devPath });
      set((state) => ({
        smartHealthMap: {
          ...state.smartHealthMap,
          [devPath]: smart,
        },
      }));
      return smart;
    } catch (err) {
      console.error(`Failed to fetch SMART for ${devPath}:`, err);
      const fallback: SmartHealthData = {
        installed: true,
        supported: false,
        passed: false,
        error_msg: String(err),
      };
      set((state) => ({
        smartHealthMap: {
          ...state.smartHealthMap,
          [devPath]: fallback,
        },
      }));
      return fallback;
    }
  },

  installFirmware: async (ids: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await invoke<void>("install_firmware_updates", { deviceIds: ids });
      await get().fetchHardwareHealth();
    } catch (err: any) {
      console.error("Failed to install firmware:", err);
      set({
        isLoading: false,
        error: err?.message || String(err) || "Failed to install firmware updates",
      });
      throw err;
    }
  },

  toggleShowOnDashboard: () => {
    const next = !get().showOnDashboard;
    localStorage.setItem("purrdora_show_hardware_health", String(next));
    set({ showOnDashboard: next });
  },
}));
