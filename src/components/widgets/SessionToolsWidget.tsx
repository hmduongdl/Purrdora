import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BatteryCharging, BellOff, Bluetooth, BriefcaseBusiness, CameraOff, ChevronDown, Coffee, Gamepad2, Gauge, LoaderCircle, LockKeyhole, Moon, MouseOff, Plane, Power, RotateCcw, Settings, Shuffle, Timer, VolumeX, Wifi, Zap } from "lucide-react";
import { useSystemStore } from "../../store/useSystemStore";
import { LiveSessionTime } from "../LiveSessionTime";
import { WidgetFactory } from "./factory";

const SHUTDOWN_OPTIONS = [
  { label: "1H", minutes: 60 },
  { label: "2H", minutes: 120 },
  { label: "4H", minutes: 240 },
  { label: "6H", minutes: 360 },
];

const POWER_PROFILES = [
  { id: "powersave", command: "power-saver", label: "Tiết kiệm", icon: BatteryCharging },
  { id: "balanced", command: "balanced", label: "Cân bằng", icon: Gauge },
  { id: "performance", command: "performance", label: "Hiệu năng", icon: Zap },
] as const;

interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  active: boolean;
}

interface ConnectivityState {
  wifi_enabled: boolean;
  wifi_networks: WifiNetwork[];
}

interface BluetoothState {
  powered: boolean;
}

interface TouchpadState {
  enabled: boolean;
}

interface MsiKeyState {
  is_supported: boolean;
  win_key: string;
  fn_key: string;
  webcam: boolean;
}

export function SessionToolsWidget() {
  const controls     = useSystemStore((s) => s.controls);
  const toggleDnd    = useSystemStore((s) => s.toggleDoNotDisturb);
  const toggleAwake  = useSystemStore((s) => s.toggleKeepAwake);
  const setTimer     = useSystemStore((s) => s.setShutdownTimer);
  const profile      = useSystemStore((s) => s.settings.active_profile.name);
  const setPowerProfile = useSystemStore((s) => s.setPowerProfile);
  const operatingMode = useSystemStore((s) => s.operatingMode);

  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<(typeof POWER_PROFILES)[number]["id"] | null>(null);
  const [pendingTimer, setPendingTimer] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [pendingPower, setPendingPower] = useState<"poweroff" | "reboot" | "suspend" | "lock" | null>(null);
  const [powerError, setPowerError] = useState<string | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityState | null>(null);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [quickActionBusy, setQuickActionBusy] = useState<"wifi" | "bluetooth" | "airplane" | "settings" | "connect" | null>(null);
  const [quickActionError, setQuickActionError] = useState<string | null>(null);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [selectedWifi, setSelectedWifi] = useState<WifiNetwork | null>(null);
  const [wifiPassword, setWifiPassword] = useState("");
  const [airplaneMode, setAirplaneMode] = useState(false);
  const [touchpadEnabled, setTouchpadEnabled] = useState<boolean | null>(null);
  const [msiKeys, setMsiKeys] = useState<MsiKeyState | null>(null);
  const [hardwareBusy, setHardwareBusy] = useState<"touchpad" | "keys" | "webcam" | null>(null);
  const [hardwareError, setHardwareError] = useState<string | null>(null);

  const refreshConnectivity = async () => {
    const nextConnectivity = await invoke<ConnectivityState>("get_connectivity_state");
    setConnectivity(nextConnectivity);
    try {
      const nextBluetooth = await invoke<BluetoothState>("get_bluetooth_state");
      setBluetoothEnabled(nextBluetooth.powered);
    } catch {
      // Wi-Fi controls remain available on computers without a Bluetooth adapter.
      setBluetoothEnabled(false);
    }
  };

  const refreshTouchpad = async () => {
    try {
      const state = await invoke<TouchpadState>("get_touchpad_state");
      setTouchpadEnabled(state.enabled);
    } catch (error) {
      setHardwareError(String(error));
    }
  };

  useEffect(() => {
    void refreshConnectivity().catch((error) => setQuickActionError(String(error)));
  }, []);

  useEffect(() => {
    void refreshTouchpad();
    const refreshTimer = window.setInterval(() => void refreshTouchpad(), 1500);
    return () => window.clearInterval(refreshTimer);
  }, []);

  // Once the touchpad is disabled it cannot be used to click its own button.
  // Keep a keyboard path available while this window has focus.
  useEffect(() => {
    const enableTouchpadShortcut = (event: KeyboardEvent) => {
      if (
        touchpadEnabled !== false ||
        hardwareBusy !== null ||
        !event.ctrlKey ||
        !event.shiftKey ||
        event.key.toLowerCase() !== "t"
      ) {
        return;
      }

      event.preventDefault();
      setHardwareError(null);
      setHardwareBusy("touchpad");
      void invoke<TouchpadState>("set_touchpad_enabled", { enabled: true })
        .then((state) => setTouchpadEnabled(state.enabled))
        .catch((error) => setHardwareError(String(error)))
        .finally(() => setHardwareBusy(null));
    };

    window.addEventListener("keydown", enableTouchpadShortcut);
    return () => window.removeEventListener("keydown", enableTouchpadShortcut);
  }, [hardwareBusy, touchpadEnabled]);

  useEffect(() => {
    void invoke<MsiKeyState>("get_msi_ec_state")
      .then(setMsiKeys)
      .catch((error) => setHardwareError(String(error)));
  }, []);
  
  const handleShutdown = async () => {
    if (selectedMinutes == null) return;
    setTimerError(null);
    setPendingTimer(true);
    try {
      await setTimer(selectedMinutes);
    } catch (error) {
      setTimerError(`Không thể hẹn giờ tắt máy: ${String(error)}`);
    } finally {
      setPendingTimer(false);
    }
  };

  const handleProfile = async (p: "powersave" | "balanced" | "performance") => {
    setProfileError(null);
    setPendingProfile(p);
    try {
      await setPowerProfile(p === "powersave" ? "power-saver" : p);
    } catch {
      setProfileError("Không thể đổi chế độ nguồn");
    } finally {
      setPendingProfile(null);
    }
  };

  const activeProfileIndex = Math.max(0, POWER_PROFILES.findIndex(({ id }) => id === profile));
  const modeDisplay = {
    work: { label: "WORK", icon: BriefcaseBusiness, color: "text-cyan-300" },
    game: { label: "GAME", icon: Gamepad2, color: "text-emerald-400" },
    silent: { label: "SILENT", icon: VolumeX, color: "text-violet-300" },
  }[operatingMode];
  const ModeIcon = modeDisplay.icon;

  const handlePowerAction = async (action: "poweroff" | "reboot" | "suspend" | "lock") => {
    const verb = {
      poweroff: "tắt máy",
      reboot: "khởi động lại máy",
      suspend: "đưa máy vào chế độ ngủ",
      lock: "khóa màn hình",
    }[action];
    if (action !== "lock" && !window.confirm(`Bạn có chắc chắn muốn ${verb} ngay bây giờ?`)) return;
    setPowerError(null);
    setPendingPower(action);
    try {
      await invoke("system_power_action", { action });
    } catch (error) {
      setPowerError(`Không thể ${verb}: ${String(error)}`);
      setPendingPower(null);
    }
  };

  const handleWifiToggle = async () => {
    if (!connectivity) return;
    setQuickActionError(null);
    setQuickActionBusy("wifi");
    try {
      const next = await invoke<ConnectivityState>("set_wifi_enabled", { enabled: !connectivity.wifi_enabled });
      setConnectivity(next);
      if (!next.wifi_enabled) setWifiOpen(false);
    } catch (error) {
      setQuickActionError(String(error));
    } finally {
      setQuickActionBusy(null);
    }
  };

  const handleTouchpadToggle = async () => {
    if (touchpadEnabled == null) return;
    setHardwareError(null);
    setHardwareBusy("touchpad");
    try {
      const next = await invoke<TouchpadState>("set_touchpad_enabled", { enabled: !touchpadEnabled });
      setTouchpadEnabled(next.enabled);
    } catch (error) {
      setHardwareError(String(error));
    } finally {
      setHardwareBusy(null);
    }
  };

  const handleWinFnSwap = async () => {
    if (!msiKeys?.is_supported) return;
    setHardwareError(null);
    setHardwareBusy("keys");
    const nextWin = msiKeys.win_key === "left" ? "right" : "left";
    const nextFn = msiKeys.fn_key === "left" ? "right" : "left";
    try {
      await Promise.all([
        invoke("set_msi_ec_win_key", { mode: nextWin }),
        invoke("set_msi_ec_fn_key", { mode: nextFn }),
      ]);
      setMsiKeys({ ...msiKeys, win_key: nextWin, fn_key: nextFn });
    } catch (error) {
      setHardwareError(String(error));
    } finally {
      setHardwareBusy(null);
    }
  };

  const handleWebcamToggle = async () => {
    if (!msiKeys?.is_supported) return;
    setHardwareError(null);
    setHardwareBusy("webcam");
    try {
      await invoke("set_msi_ec_webcam", { enabled: !msiKeys.webcam });
      setMsiKeys({ ...msiKeys, webcam: !msiKeys.webcam });
    } catch (error) {
      setHardwareError(String(error));
    } finally {
      setHardwareBusy(null);
    }
  };

  const handleBluetoothToggle = async () => {
    setQuickActionError(null);
    setQuickActionBusy("bluetooth");
    try {
      const next = await invoke<BluetoothState>("set_bluetooth_power", { enabled: !bluetoothEnabled });
      setBluetoothEnabled(next.powered);
    } catch (error) {
      setQuickActionError(String(error));
    } finally {
      setQuickActionBusy(null);
    }
  };

  const handleAirplaneToggle = async () => {
    setQuickActionError(null);
    setQuickActionBusy("airplane");
    try {
      const next = await invoke<ConnectivityState>("set_airplane_mode", { enabled: !airplaneMode });
      setConnectivity(next);
      setAirplaneMode((active) => !active);
      setWifiOpen(false);
    } catch (error) {
      setQuickActionError(String(error));
    } finally {
      setQuickActionBusy(null);
    }
  };

  const handleWifiConnect = async () => {
    if (!selectedWifi) return;
    setQuickActionError(null);
    setQuickActionBusy("connect");
    try {
      const next = await invoke<ConnectivityState>("connect_wifi", { ssid: selectedWifi.ssid, password: wifiPassword || null });
      setConnectivity(next);
      setWifiOpen(false);
      setSelectedWifi(null);
      setWifiPassword("");
    } catch (error) {
      setQuickActionError(String(error));
    } finally {
      setQuickActionBusy(null);
    }
  };

  const openSettings = async () => {
    setQuickActionError(null);
    setQuickActionBusy("settings");
    try {
      await invoke("open_fedora_settings");
    } catch (error) {
      setQuickActionError(String(error));
    } finally {
      setQuickActionBusy(null);
    }
  };

  return (
    <WidgetFactory title="SESSION TOOLS" className="session-tools-widget">
      <div className="space-y-3 text-[11px]">
        {/* Session timer display */}
        <div className="flex items-center justify-between">
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-1.5">
            <p className="text-[9px] font-bold uppercase text-primary/60">Tổng thời gian</p>
            <p className="big-number glow-purple text-xl text-primary"><LiveSessionTime /></p>
          </div>
          <div className="flex items-stretch gap-1.5">
            <div className={`flex min-w-[86px] items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 ${modeDisplay.color}`} title={`Chế độ máy: ${modeDisplay.label}`}>
              <ModeIcon size={14} />
              <div>
                <p className="text-[8px] uppercase text-slate-500">Chế độ máy</p>
                <p className="text-[10px] font-bold leading-tight">{modeDisplay.label}</p>
              </div>
            </div>
            <button type="button" onClick={() => void handlePowerAction("poweroff")} disabled={pendingPower !== null} aria-label="Tắt máy" title="Tắt máy" className="grid w-9 place-items-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40">
              {pendingPower === "poweroff" ? <LoaderCircle size={14} className="animate-spin" /> : <Power size={14} />}
            </button>
            <button type="button" onClick={() => void handlePowerAction("reboot")} disabled={pendingPower !== null} aria-label="Khởi động lại" title="Khởi động lại" className="grid w-9 place-items-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-300 transition-colors hover:bg-amber-400/20 disabled:opacity-40">
              {pendingPower === "reboot" ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            </button>
            <button type="button" onClick={() => void handlePowerAction("suspend")} disabled={pendingPower !== null} aria-label="Chế độ ngủ" title="Chế độ ngủ" className="grid w-9 place-items-center rounded-lg border border-sky-400/25 bg-sky-400/10 text-sky-300 transition-colors hover:bg-sky-400/20 disabled:opacity-40">
              {pendingPower === "suspend" ? <LoaderCircle size={14} className="animate-spin" /> : <Moon size={14} />}
            </button>
            <button type="button" onClick={() => void handlePowerAction("lock")} disabled={pendingPower !== null} aria-label="Khóa màn hình" title="Khóa màn hình" className="grid w-9 place-items-center rounded-lg border border-violet-400/25 bg-violet-400/10 text-violet-300 transition-colors hover:bg-violet-400/20 disabled:opacity-40">
              {pendingPower === "lock" ? <LoaderCircle size={14} className="animate-spin" /> : <LockKeyhole size={14} />}
            </button>
          </div>
        </div>
        {powerError && <p role="alert" className="text-[9px] text-red-400">{powerError}</p>}

        {/* Performance profile pills */}
        <div
          className="power-profile-switch relative grid grid-cols-3 rounded-lg border border-white/[0.07] bg-black/25 p-1"
          aria-label="Chế độ nguồn"
        >
          <span
            className="power-profile-indicator pointer-events-none absolute bottom-1 top-1 rounded-md border border-primary/35 bg-primary/15 shadow-[0_0_18px_rgba(139,92,246,.16)]"
            style={{ transform: `translateX(${activeProfileIndex * 100}%)` }}
          />
          {POWER_PROFILES.map(({ id, label, icon: ProfileIcon }) => (
            <button
              key={id}
              onClick={() => void handleProfile(id)}
              disabled={pendingProfile !== null || profile === id}
              aria-pressed={profile === id}
              className={`relative z-10 flex min-w-0 items-center justify-center gap-1 rounded-md px-1 py-2 text-[9px] font-semibold transition-[color,transform,opacity] duration-300 ${
                profile === id
                  ? "text-primary"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {pendingProfile === id ? (
                <LoaderCircle size={12} className="animate-spin" />
              ) : (
                <ProfileIcon size={12} className={profile === id ? "power-profile-icon" : ""} />
              )}
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
        {profileError && <p className="text-[9px] text-red-400">{profileError}</p>}

        {/* Connectivity quick actions */}
        <div className="relative grid grid-cols-4 gap-1.5">
          <div className="relative">
            <button type="button" onClick={() => void handleWifiToggle()} disabled={!connectivity || quickActionBusy !== null} aria-label={connectivity?.wifi_enabled ? "Tắt Wi‑Fi" : "Bật Wi‑Fi"} title={connectivity?.wifi_enabled ? "Tắt Wi‑Fi" : "Bật Wi‑Fi"} className={`flex h-9 w-full items-center justify-center rounded-l border border-r-0 transition-colors disabled:opacity-40 ${connectivity?.wifi_enabled ? "border-cyan-accent/30 bg-cyan-accent/10 text-cyan-accent hover:bg-cyan-accent/20" : "border-white/10 bg-black/20 text-slate-500"}`}>
              {quickActionBusy === "wifi" ? <LoaderCircle size={14} className="animate-spin" /> : <Wifi size={14} />}
            </button>
            <button type="button" onClick={() => setWifiOpen((open) => !open)} disabled={!connectivity?.wifi_enabled || quickActionBusy !== null} aria-expanded={wifiOpen} aria-label="Chọn mạng Wi‑Fi" title="Chọn mạng Wi‑Fi" className={`absolute inset-y-0 right-0 grid w-5 place-items-center rounded-r border transition-colors disabled:opacity-40 ${connectivity?.wifi_enabled ? "border-cyan-accent/30 bg-cyan-accent/10 text-cyan-accent hover:bg-cyan-accent/20" : "border-white/10 bg-black/20 text-slate-500"}`}>
              <ChevronDown size={11} />
            </button>
          </div>
          <button type="button" onClick={() => void handleBluetoothToggle()} disabled={quickActionBusy !== null} aria-pressed={bluetoothEnabled} title={bluetoothEnabled ? "Tắt Bluetooth" : "Bật Bluetooth"} className={`grid h-9 place-items-center rounded border transition-colors disabled:opacity-40 ${bluetoothEnabled ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25" : "border-white/10 bg-black/20 text-slate-500 hover:text-slate-300"}`}>
            {quickActionBusy === "bluetooth" ? <LoaderCircle size={14} className="animate-spin" /> : <Bluetooth size={14} />}
          </button>
          <button type="button" onClick={() => void handleAirplaneToggle()} disabled={quickActionBusy !== null} aria-pressed={airplaneMode} title={airplaneMode ? "Tắt chế độ máy bay" : "Bật chế độ máy bay"} className={`grid h-9 place-items-center rounded border transition-colors disabled:opacity-40 ${airplaneMode ? "border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25" : "border-white/10 bg-black/20 text-slate-500 hover:text-slate-300"}`}>
            {quickActionBusy === "airplane" ? <LoaderCircle size={14} className="animate-spin" /> : <Plane size={14} />}
          </button>
          <button type="button" onClick={() => void openSettings()} disabled={quickActionBusy !== null} title="Mở Cài đặt Fedora" className="grid h-9 place-items-center rounded border border-white/10 bg-black/20 text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200 disabled:opacity-40">
            {quickActionBusy === "settings" ? <LoaderCircle size={14} className="animate-spin" /> : <Settings size={14} />}
          </button>

          {wifiOpen && <div className="absolute left-0 top-11 z-20 w-[min(300px,calc(100vw-48px))] rounded-lg border border-white/10 bg-[#11131d] p-2 shadow-xl">
            <div className="mb-1 flex items-center justify-between px-1 text-[9px] uppercase tracking-wider text-slate-500"><span>Mạng Wi‑Fi</span><button type="button" onClick={() => void refreshConnectivity().catch((error) => setQuickActionError(String(error)))} className="text-cyan-accent hover:text-cyan-200">Làm mới</button></div>
            <div className="custom-scrollbar max-h-40 space-y-1 overflow-y-auto">
              {connectivity?.wifi_networks.map((network) => <button type="button" key={network.ssid} onClick={() => { setSelectedWifi(network); setWifiPassword(""); }} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[10px] ${selectedWifi?.ssid === network.ssid ? "bg-primary/15 text-primary" : "text-slate-300 hover:bg-white/5"}`}><span className="truncate">{network.ssid}{network.active ? " · Đã kết nối" : ""}</span><span className="ml-3 shrink-0 text-[9px] text-slate-500">{network.signal}%</span></button>)}
              {connectivity && connectivity.wifi_networks.length === 0 && <p className="px-2 py-3 text-center text-[9px] text-slate-500">Không tìm thấy mạng Wi‑Fi</p>}
            </div>
            {selectedWifi && <div className="mt-2 border-t border-white/10 pt-2"><p className="mb-1 truncate text-[9px] text-slate-400">Kết nối {selectedWifi.ssid}</p><div className="flex gap-1"><input type="password" value={wifiPassword} onChange={(event) => setWifiPassword(event.target.value)} placeholder={selectedWifi.security ? "Mật khẩu (nếu cần)" : "Mạng mở"} className="min-w-0 flex-1 rounded border border-white/10 bg-black/25 px-2 py-1 text-[10px] outline-none focus:border-primary/50" /><button type="button" onClick={() => void handleWifiConnect()} disabled={quickActionBusy === "connect"} className="rounded bg-primary/20 px-2 text-[9px] font-bold text-primary hover:bg-primary/30 disabled:opacity-40">{quickActionBusy === "connect" ? "…" : "Kết nối"}</button></div></div>}
          </div>}
        </div>
        {quickActionError && <p role="alert" className="text-[9px] text-red-400">{quickActionError}</p>}

        {/* Laptop input controls */}
        <div className="border-t border-white/5 pt-2">
          <p className="mb-2 text-[9px] uppercase tracking-wider text-slate-400">Điều khiển thiết bị nhập</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" onClick={() => void handleTouchpadToggle()} disabled={touchpadEnabled == null || hardwareBusy !== null} aria-pressed={touchpadEnabled === false} title={touchpadEnabled ? "Tắt bàn di chuột" : "Bật bàn di chuột (Ctrl+Shift+T)"} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded border px-1 text-[9px] transition-colors disabled:opacity-40 ${touchpadEnabled === false ? "border-amber-400/40 bg-amber-400/15 text-amber-300" : "border-white/10 bg-black/20 text-slate-400 hover:text-slate-200"}`}>
              {hardwareBusy === "touchpad" ? <LoaderCircle size={14} className="animate-spin" /> : <MouseOff size={14} />}
              <span>{touchpadEnabled === false ? "Bật bàn di chuột" : "Tắt bàn di chuột"}</span>
            </button>
            <button type="button" onClick={() => void handleWinFnSwap()} disabled={!msiKeys?.is_supported || hardwareBusy !== null} title="Đổi vị trí phím Win và Fn" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-white/10 bg-black/20 px-1 text-[9px] text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-40">
              {hardwareBusy === "keys" ? <LoaderCircle size={14} className="animate-spin" /> : <Shuffle size={14} />}
              <span>Đổi Win / Fn</span>
            </button>
            <button type="button" onClick={() => void handleWebcamToggle()} disabled={!msiKeys?.is_supported || hardwareBusy !== null} title={msiKeys?.webcam ? "Khóa webcam" : "Mở webcam"} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded border px-1 text-[9px] transition-colors disabled:opacity-40 ${msiKeys?.webcam ? "border-white/10 bg-black/20 text-slate-400 hover:text-slate-200" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}>
              {hardwareBusy === "webcam" ? <LoaderCircle size={14} className="animate-spin" /> : <CameraOff size={14} />}
              <span>{msiKeys?.webcam ? "Khóa webcam" : "Mở webcam"}</span>
            </button>
          </div>
          {hardwareError && <p role="alert" className="mt-1 text-[9px] text-red-400">{hardwareError}</p>}
        </div>

        {/* DND & Keep Awake toggles */}
        <div className="space-y-2">
          <button
            onClick={() => void toggleDnd()}
            className={`flex w-full items-center gap-3 rounded border p-2 text-left transition-colors ${
              controls.is_do_not_disturb_active
                ? "border-pink-accent/50 bg-pink-accent/5 text-pink-accent"
                : "border-white/5 bg-black/20 text-slate-400 hover:border-white/15"
            }`}
          >
            <BellOff size={15} />
            <div>
              <p className="text-[10px] font-bold">Không làm phiền</p>
              <p className="text-[8px] text-on-surface-variant">Ẩn tất cả thông báo hệ thống</p>
            </div>
          </button>
          <button
            onClick={() => void toggleAwake()}
            className={`flex w-full items-center gap-3 rounded border p-2 text-left transition-colors ${
              controls.is_keep_awake_active
                ? "border-cyan-accent/50 bg-cyan-accent/5 text-cyan-accent"
                : "border-white/5 bg-black/20 text-slate-400 hover:border-white/15"
            }`}
          >
            <Coffee size={15} />
            <div>
              <p className="text-[10px] font-bold">Ngăn chế độ ngủ</p>
              <p className="text-[8px] text-on-surface-variant">Giữ màn hình luôn bật</p>
            </div>
          </button>
        </div>

        {/* Shutdown timer — pill buttons 1H/2H/4H/6H */}
        <div className="border-t border-white/5 pt-2">
          <div className="mb-2 flex items-center gap-1.5">
            <Timer size={12} className="text-primary" />
            <span className="text-[9px] uppercase tracking-wider text-slate-400">Tắt máy sau</span>
          </div>
          <div className="flex gap-2">
            <div className="grid flex-1 grid-cols-4 gap-1.5">
              {SHUTDOWN_OPTIONS.map(({ label, minutes }) => (
                <button
                  type="button"
                  key={label}
                  onClick={() =>
                    setSelectedMinutes((prev) => (prev === minutes ? null : minutes))
                  }
                  className={`rounded py-2 text-[10px] font-bold transition-colors ${
                    selectedMinutes === minutes
                      ? "border border-primary/50 bg-primary/20 text-primary"
                      : "border border-white/10 bg-white/5 text-slate-400 hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void handleShutdown()}
              disabled={selectedMinutes == null || pendingTimer}
              aria-label={pendingTimer ? "Đang đặt lịch tắt máy" : "Đặt lịch tắt máy"}
              className="grid min-w-9 place-items-center rounded bg-primary/20 px-2 text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {pendingTimer ? <LoaderCircle size={14} className="animate-spin" /> : <Power size={14} />}
            </button>
          </div>
          {timerError && <p role="alert" className="mt-1 text-[9px] text-red-400">{timerError}</p>}
        </div>
      </div>
    </WidgetFactory>
  );
}
