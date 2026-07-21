import { lazy, Suspense, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BatteryCharging, CalendarDays, Clock3, GitFork, Globe2, Mail, MonitorCog, Ruler, Wifi } from "lucide-react";
import { useIpcListener, type ActivePage } from "./hooks/useIpcListener";
import MediaPlayerWidget from "./components/MediaPlayerWidget";
import { AudioMixerWidget } from "./components/AudioMixerWidget";
import { ConnectedDevicesWidget } from "./components/ConnectedDevicesWidget";
import { SystemMetricsWidget } from "./components/widgets/SystemMetricsWidget";
import { DisplayLayoutWidget } from "./components/widgets/DisplayLayoutWidget";
import { SessionToolsWidget } from "./components/widgets/SessionToolsWidget";
import { TopProcessesWidget } from "./components/widgets/TopProcessesWidget";
import Layout from "./components/Layout";
import { BottomDock } from "./components/BottomDock";
import { useSystemStore } from "./store/useSystemStore";
import { APP_SOCIAL_LINKS, APP_VERSION, APP_NAME, type SocialLink } from "./config/branding";
import appLogo from "../assets/logo.png";

const GameModePage = lazy(() => import("./components/GameModePage"));
const MsiCenterPage = lazy(() =>
  import("./components/MsiCenterPage").then((module) => ({ default: module.MsiCenterPage })),
);
const DriversPage = lazy(() => import("./components/DriversPage"));

function socialLinkIcon(icon: SocialLink["icon"]) {
  switch (icon) {
    case "github": return <GitFork size={15} />;
    case "facebook": return <span aria-hidden="true">f</span>;
    case "email": return <Mail size={15} />;
    case "website": return <Globe2 size={15} />;
  }
}

function SocialLinksNav() {
  return (
    <nav className="app-brand-socials" aria-label={`${APP_NAME} social links`}>
      {APP_SOCIAL_LINKS.map((link) => (
        <a
          key={link.icon}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={`app-brand-social-button${link.icon === "facebook" ? " app-brand-social-facebook" : ""}`}
          title={link.title}
          aria-label={link.ariaLabel}
        >
          {socialLinkIcon(link.icon)}
        </a>
      ))}
    </nav>
  );
}

function PageLoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0f]">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-accent" /> Loading page…
      </div>
    </div>
  );
}

function FullscreenAppHeader({
  identity,
  localIp,
  date,
  time,
  latency,
  battery,
}: {
  identity: { hostname: string; os_name: string };
  localIp: string;
  date: string;
  time: string;
  latency: string;
  battery: ReturnType<typeof useSystemStore.getState>["battery"];
}) {
  return (
    <header className="app-brand fullscreen-app-header" aria-label="Purrdora application information">
      <div className="app-brand-identity">
        <img src={appLogo} alt={`${APP_NAME} logo`} className="app-brand-logo" />
        <div className="min-w-0"><h1 className="app-brand-name">{APP_NAME}</h1><p className="app-brand-version">Version {APP_VERSION}</p></div>
      </div>
      <div className="app-brand-status" aria-label="System information">
        <span title={`${identity.hostname} · ${identity.os_name}`}><MonitorCog size={14} /> <b>{identity.hostname}</b><small>{identity.os_name}</small></span>
        <span title="Kích thước hiển thị"><Ruler size={13} /> {window.innerWidth}×{window.innerHeight}</span>
        <span><CalendarDays size={13} /> {date}</span>
        <span><Clock3 size={13} /> {time} <small>GMT+7</small></span>
        <span><Wifi size={13} /> {localIp} · {latency} ms</span>
        {battery?.present && <span><BatteryCharging size={13} /> {battery.percent}%</span>}
      </div>
      <SocialLinksNav />
    </header>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<ActivePage>("dashboard");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [systemIdentity, setSystemIdentity] = useState({ hostname: "—", os_name: "—" });
  const [localIp, setLocalIp] = useState("—");
  const latency = useSystemStore((state) => state.telemetry?.network.latency_ms?.toFixed(0) ?? "—");
  const battery = useSystemStore((state) => state.battery);
  useIpcListener(activeTab);
  const [helperStatus, setHelperStatus] = useState<any>(null);
  const [showHelperModal, setShowHelperModal] = useState(false);
  const [alwaysAuthenticate, setAlwaysAuthenticate] = useState(() =>
    localStorage.getItem("purrdora_always_authenticate") === "true"
  );

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlistenResize: (() => void) | undefined;
    const syncFullscreenState = () => {
      void appWindow.isFullscreen().then(setIsFullscreen).catch(() => undefined);
    };

    syncFullscreenState();
    void appWindow.onResized(syncFullscreenState).then((unlisten) => {
      unlistenResize = unlisten;
    });

    const handleFullscreenKeys = async (event: KeyboardEvent) => {
      if (event.key !== "F11" && event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      if (event.key === "F11") {
        const nextFullscreen = !(await appWindow.isFullscreen());
        await appWindow.setFullscreen(nextFullscreen);
        setIsFullscreen(nextFullscreen);
      } else if (await appWindow.isFullscreen()) {
        await appWindow.setFullscreen(false);
        setIsFullscreen(false);
      }
    };
    globalThis.addEventListener("keydown", handleFullscreenKeys, { capture: true });
    return () => {
      globalThis.removeEventListener("keydown", handleFullscreenKeys);
      unlistenResize?.();
    };
  }, []);

  useEffect(() => {
    void invoke<{ hostname: string; os_name: string }>("get_system_identity")
      .then(setSystemIdentity)
      .catch(() => undefined);
    void invoke<string | null>("get_local_ip")
      .then((ip) => setLocalIp(ip ?? "—"))
      .catch(() => undefined);
    const timer = globalThis.setInterval(() => setNow(new Date()), 1_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  const fullscreenDate = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(now);
  const fullscreenTime = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(now);

  const handleAuthenticationPreference = (enabled: boolean) => {
    setAlwaysAuthenticate(enabled);
    localStorage.setItem("purrdora_always_authenticate", String(enabled));
  };

  useEffect(() => {
    const isDismissed = localStorage.getItem("purrdora_helper_dialog_dismissed") === "true";
    if (isDismissed) return;

    invoke<any>("check_helper_installation")
      .then((status) => {
        if (!status.is_correct) {
          setHelperStatus(status);
          setShowHelperModal(true);
        }
      })
      .catch((err) => console.error("Failed to check helper installation:", err));
  }, []);

  const handleDismissHelperModal = () => {
    localStorage.setItem("purrdora_helper_dialog_dismissed", "true");
    setShowHelperModal(false);
  };

  return (
    <div className="app-shell">
      {activeTab === "dashboard" ? (
        <Layout fullscreen={isFullscreen}>
        <div className="dashboard-left-area">
        {/* ── Column 1: Media ── */}
        <div className="dashboard-column">
          {!isFullscreen && (
          <section className="app-brand" aria-label={`${APP_NAME} application information`}>
            <div className="app-brand-identity">
              <img src={appLogo} alt={`${APP_NAME} logo`} className="app-brand-logo" />
              <div className="min-w-0">
                <h1 className="app-brand-name">{APP_NAME}</h1>
                <p className="app-brand-version">Version {APP_VERSION}</p>
              </div>
            </div>
            <div className="app-brand-status" aria-label="System information">
              <span title={`${systemIdentity.hostname} · ${systemIdentity.os_name}`}><MonitorCog size={14} /> <b>{systemIdentity.hostname}</b><small>{systemIdentity.os_name}</small></span>
              <span title="Kích thước hiển thị"><Ruler size={13} /> {window.innerWidth}×{window.innerHeight}</span>
              <span><CalendarDays size={13} /> {fullscreenDate}</span>
              <span><Clock3 size={13} /> {fullscreenTime} <small>GMT+7</small></span>
              <span><Wifi size={13} /> {localIp} · {latency} ms</span>
              {battery?.present && <span><BatteryCharging size={13} /> {battery.percent}%</span>}
            </div>
            <SocialLinksNav />
          </section>
          )}
          <MediaPlayerWidget />
          <AudioMixerWidget />
          <ConnectedDevicesWidget />
        </div>

        {/* ── Column 2: Performance Stats ── */}
        <div className="dashboard-column">
          <DisplayLayoutWidget />
          <SystemMetricsWidget />
        </div>
        </div>

        {/* ── Column 3: Controls & Processes ── */}
        <div className="dashboard-column dashboard-right-column">
          <SessionToolsWidget />
          <TopProcessesWidget />
        </div>
        </Layout>
      ) : activeTab === "game" ? (
        <Suspense fallback={<PageLoadingFallback />}><GameModePage fullscreen={isFullscreen} /></Suspense>
      ) : activeTab === "drivers" ? (
        <Suspense fallback={<PageLoadingFallback />}><DriversPage fullscreen={isFullscreen} /></Suspense>
      ) : activeTab === "settings" ? (
        <Suspense fallback={<PageLoadingFallback />}>
          <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0f]">
            <p className="text-sm text-slate-500">Settings page — coming soon</p>
          </div>
        </Suspense>
      ) : (
        <Suspense fallback={<PageLoadingFallback />}><MsiCenterPage fullscreen={isFullscreen} /></Suspense>
      )}

      {isFullscreen && <FullscreenAppHeader
        identity={systemIdentity}
        localIp={localIp}
        date={fullscreenDate}
        time={fullscreenTime}
        latency={latency}
        battery={battery}
      />}

      <BottomDock
        activePage={activeTab}
        onNavigate={setActiveTab}
        compact={isFullscreen}
      />

      {showHelperModal && helperStatus && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="glass-panel w-full max-w-[500px] border border-white/10 bg-slate-900 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-sm font-bold text-pink-accent flex items-center gap-2 mb-3">
              ⚠️ YÊU CẦU CÀI ĐẶT THÀNH PHẦN HỖ TRỢ HỆ THỐNG
            </h2>
            <div className="space-y-3 text-xs text-on-surface-variant leading-relaxed mb-4">
              <p>
                Ứng dụng phát hiện gói thành phần hỗ trợ đặc quyền hệ thống (<code className="bg-white/5 px-1 py-0.5 rounded text-cyan-accent font-mono text-[10px]">purrdora-helper</code> và cấu hình Polkit) chưa được thiết lập đầy đủ.
              </p>
              <p>
                Để các tính năng kiểm soát phần cứng (tốc độ quạt, hiệu năng, giới hạn sạc pin) hoạt động ổn định mà <strong>không yêu cầu mật khẩu</strong>, ứng dụng cần được cài đặt từ gói chính thức (<code className="bg-white/5 px-1 py-0.5 rounded text-cyan-accent font-mono text-[10px]">.deb</code> / <code className="bg-white/5 px-1 py-0.5 rounded text-cyan-accent font-mono text-[10px]">.rpm</code>) thay vì khởi chạy trực tiếp từ môi trường phát triển.
              </p>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-xl p-3 mb-5">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Trạng thái cài đặt hệ thống:</p>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Thành phần hỗ trợ:</span>
                  <span className={helperStatus.helper_exists ? "text-emerald-400" : "text-red-400 font-bold"}>
                    {helperStatus.helper_exists ? "Đã cài đặt" : "Chưa phát hiện"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Chính sách Polkit:</span>
                  <span className={helperStatus.policy_exists ? "text-emerald-400" : "text-red-400 font-bold"}>
                    {helperStatus.policy_exists ? "Đã thiết lập" : "Chưa thiết lập"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Quy tắc Polkit:</span>
                  <span className={helperStatus.rules_exists ? "text-emerald-400" : "text-red-400 font-bold"}>
                    {helperStatus.rules_exists ? "Đã thiết lập" : "Chưa thiết lập"}
                  </span>
                </div>
              </div>
            </div>

            <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs">
              <input
                type="checkbox"
                checked={alwaysAuthenticate}
                onChange={(event) => handleAuthenticationPreference(event.target.checked)}
                className="mt-0.5 accent-pink-500"
              />
              <span className="leading-relaxed text-on-surface-variant">
                Luôn yêu cầu xác thực khi thực hiện thao tác đặc quyền
                <span className="mt-1 block text-[10px] text-slate-500">
                  Tùy chọn được lưu trên thiết bị. Bỏ chọn để sử dụng cơ chế xác thực không mật khẩu qua Polkit.
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleDismissHelperModal}
                className="px-4 py-2 bg-pink-accent/20 border border-pink-accent/30 hover:bg-pink-accent/30 text-pink-accent font-bold text-xs rounded-xl transition-all"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
