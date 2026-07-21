import { useState, useRef, useEffect } from "react";
import { Gamepad2, Activity, Cpu, History, HelpCircle } from "lucide-react";
import { useSystemStore } from "../store/useSystemStore";
import { GameStatusWidget } from "./widgets/GameStatusWidget";
import { RunningGameWidget } from "./widgets/RunningGameWidget";
import { WidgetFactory } from "./widgets/factory";
import { invoke } from "@tauri-apps/api/core";
import type { GameSession } from "../types/schema";

export default function GameModePage({ fullscreen = false }: { fullscreen?: boolean }) {
  const mainRef = useRef<HTMLElement>(null);

  const active = useSystemStore((s) => s.controls.is_gamemode_active);
  const toggle = useSystemStore((s) => s.toggleGamemode);

  // MangoHud states
  const [isMangoInstalled, setIsMangoInstalled] = useState<boolean>(false);
  const [isMangoConfigured, setIsMangoConfigured] = useState<boolean>(false);
  const [loadingMango, setLoadingMango] = useState<boolean>(true);
  const [mangoError, setMangoError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [dismissedOnboarding, setDismissedOnboarding] = useState<boolean>(() => {
    return localStorage.getItem("purrdora_mangohud_onboarding_dismissed") === "true";
  });

  const checkMangoStatus = async () => {
    try {
      const installed = await invoke<boolean>("is_mangohud_installed");
      setIsMangoInstalled(installed);
      if (installed) {
        const configured = await invoke<boolean>("is_mangohud_configured");
        setIsMangoConfigured(configured);
      }
    } catch (err) {
      console.error("Failed to check MangoHud status:", err);
    } finally {
      setLoadingMango(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await invoke<GameSession[]>("list_recent_game_sessions");
      setSessions(data);
    } catch (err) {
      console.error("Failed to fetch game sessions:", err);
    }
  };

  useEffect(() => {
    checkMangoStatus();
    fetchSessions();
  }, []);

  const handleConfigureMango = async () => {
    setMangoError(null);
    try {
      await invoke<string>("configure_mangohud");
      setIsMangoConfigured(true);
      fetchSessions();
    } catch (error) {
      setMangoError(`Lỗi cấu hình MangoHud: ${String(error)}`);
    }
  };

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className={`app-page-frame flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0a0a0f] text-[#e4e1e9]${fullscreen ? " game-page-fullscreen" : ""}`}>
      <main
        ref={mainRef}
        className={`game-page-main custom-scrollbar min-h-0 flex-1 overflow-y-auto${fullscreen ? " game-page-main-fullscreen" : ""}`}
        style={fullscreen ? undefined : { padding: "clamp(8px, 1.2vw, 24px)" }}
      >
        <div className="dashboard-columns w-full">
          {/* ── Cột 1: Điều khiển Game Mode ── */}
          <div className="dashboard-column">
            <WidgetFactory title="MODE CONTROL" icon={<Gamepad2 size={15} />} accentColor="text-emerald-400">
              <div className="flex flex-col gap-3 py-1">
                <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
                  Kích hoạt Chế độ Trò chơi để tối ưu bộ điều phối CPU, cấu hình năng lượng GPU và khởi động dịch vụ GameMode nhằm đạt hiệu năng tối đa.
                </p>

                {/* Big interactive switch button */}
                <button
                  onClick={() => void toggle()}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all duration-300 ${
                    active
                      ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)] text-emerald-400 hover:border-emerald-400/60"
                      : "border-white/10 bg-black/20 text-slate-400 hover:border-white/20 hover:bg-black/30"
                  }`}
                >
                  {active && (
                    <div className="absolute inset-0 -z-10 rounded-2xl bg-emerald-400/5 blur-xl animate-pulse" />
                  )}

                  <Gamepad2
                    size={34}
                    className={`transition-transform duration-500 group-hover:scale-110 ${
                      active ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-slate-600"
                    }`}
                  />
                  
                  <span className="mt-2 text-[14.5px] font-bold uppercase tracking-wider">
                    {active ? "Chế độ Trò chơi: Đang bật" : "Chế độ Trò chơi: Đang tắt"}
                  </span>
                  
                  <span className="mt-0.5 text-[12px] text-on-surface-variant font-mono">
                    {active ? "Nhấn để tắt chế độ hiệu năng" : "Nhấn để tối ưu hiệu năng trò chơi"}
                  </span>
                </button>

                {/* Performance stats summary */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex items-center gap-2 rounded border border-white/5 bg-black/20 p-2">
                    <Cpu size={14} className="text-cyan-accent" />
                    <div>
                      <p className="text-[11.5px] uppercase text-on-surface-variant font-bold">CPU Governor</p>
                      <p className="font-mono text-[12.5px] font-bold text-slate-200">
                        {active ? "performance" : "schedutil"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded border border-white/5 bg-black/20 p-2">
                    <Activity size={14} className="text-pink-accent" />
                    <div>
                      <p className="text-[11.5px] uppercase text-on-surface-variant font-bold">Scheduler</p>
                      <p className="font-mono text-[12.5px] font-bold text-slate-200">
                        {active ? "GameMode" : "Default"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* MangoHud integration card */}
                <div className="border-t border-white/5 pt-3 mt-2">
                  <div className="flex items-center justify-between text-[11.5px] font-bold text-slate-300 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle size={13} className="text-cyan-accent" />
                      Theo dõi hiệu năng (MangoHud)
                    </span>
                  </div>

                  {/* Onboarding block */}
                  {!dismissedOnboarding && (
                    <div className="relative mb-2.5 rounded-lg border border-cyan-accent/20 bg-cyan-accent/5 p-2.5 text-[12.5px] text-on-surface-variant leading-relaxed">
                      <button 
                        onClick={() => {
                          localStorage.setItem("purrdora_mangohud_onboarding_dismissed", "true");
                          setDismissedOnboarding(true);
                        }}
                        className="absolute right-2 top-2 text-cyan-accent hover:text-white transition-colors font-bold"
                      >
                        ✕
                      </button>
                      <p className="font-bold text-cyan-accent mb-0.5">💡 HƯỚNG DẪN THEO DÕI FPS</p>
                      <p className="pr-3">
                        Để hiển thị chỉ số FPS trong trò chơi, vui lòng cài đặt MangoHud và bổ sung tham số sau vào mục Tùy chọn Khởi chạy (Launch Options) trên Steam (hoặc thiết lập tương tự trên Lutris/Heroic):
                      </p>
                      <code className="mt-1 block bg-black/40 px-1.5 py-0.5 rounded text-cyan-accent font-mono text-[12px]">
                        MANGOHUD=1 %command%
                      </code>
                    </div>
                  )}

                  {/* MangoHud Installation Status check */}
                  {loadingMango ? (
                    <p className="text-[12px] text-slate-400 italic">Đang kiểm tra MangoHud...</p>
                  ) : !isMangoInstalled ? (
                    <div className="rounded-lg border border-pink-accent/20 bg-pink-accent/5 p-2.5 text-[12.5px] text-on-surface-variant">
                      <p className="font-bold text-pink-accent mb-0.5">⚠️ CHƯA CÀI ĐẶT MANGOHUD</p>
                      <p>Vui lòng cài đặt MangoHud để theo dõi chỉ số FPS trong trò chơi:</p>
                      <code className="mt-1 block bg-black/40 px-1.5 py-0.5 rounded text-pink-accent font-mono text-[12px]">
                        sudo dnf install mangohud
                      </code>
                    </div>
                  ) : !isMangoConfigured ? (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5 text-[12.5px] text-on-surface-variant">
                      <p className="font-bold text-yellow-400 mb-0.5">⚙️ CHƯA THIẾT LẬP GHI NHẬT KÝ</p>
                      <p className="mb-1.5">Purrdora cần thiết lập thư mục nhật ký để thu thập chỉ số FPS trong trò chơi.</p>
                      <button
                        onClick={handleConfigureMango}
                        className="px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-400 text-[11.5px] font-bold rounded transition-colors uppercase tracking-wider"
                      >
                        Thiết lập thư mục nhật ký
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-2.5 text-[12.5px] flex items-center justify-between">
                      <div>
                        <p className="font-bold text-emerald-400">✅ MANGOHUD SẴN SÀNG</p>
                        <p className="text-[11.5px] text-slate-400">Đã kích hoạt ghi nhật ký tự động</p>
                      </div>
                      <div className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  )}
                  {mangoError && <p className="rounded border border-red-500/15 bg-red-500/5 px-2 py-1.5 text-[12px] text-red-400">{mangoError}</p>}
                </div>
              </div>
            </WidgetFactory>

          </div>

          {/* ── Cột 2: Trạng thái Game & Lịch sử phiên chơi ── */}
          <div className="dashboard-column">
            <GameStatusWidget />

            {/* Session History Widget */}
            <WidgetFactory title="SESSION HISTORY" icon={<History size={15} />} accentColor="text-pink-accent">
              <div className="game-session-history flex flex-col gap-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1 py-1">
                {sessions.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic py-2">Chưa ghi nhận phiên chơi nào.</p>
                ) : (
                  sessions.slice(0, 6).map((session, index) => (
                    <div key={index} className="flex justify-between items-center rounded border border-white/5 bg-black/20 p-2 text-[13px] hover:border-white/10 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold truncate text-slate-200 text-[11.5px]" title={session.filename}>
                          {session.filename.split('_')[0] || "Game"}
                        </p>
                        <p className="text-[11.5px] text-slate-400 font-mono mt-0.5">{formatTime(session.start_time_ms)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-cyan-accent font-bold text-[14px]">
                          {session.average_fps != null ? `${session.average_fps.toFixed(0)}` : "—"}
                        </span>
                        <span className="text-[11.5px] text-slate-400 ml-0.5 font-bold">FPS</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </WidgetFactory>
          </div>

          {/* ── Cột 3: Trò chơi đang chạy ── */}
          <div className="dashboard-column">
            <RunningGameWidget />
          </div>
        </div>
      </main>
    </div>
  );
}
