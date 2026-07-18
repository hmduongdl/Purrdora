import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Music2, SlidersHorizontal, Volume2, type LucideIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TrafficLights from "./TrafficLights";
import { closeWindow, minimizeWindow, toggleMaximize } from "../hooks/useWindowControls";
import { useSystemStore, type DashboardView } from "../store/useSystemStore";

interface LayoutProps {
  children: ReactNode;
}

const VIEWS: { id: DashboardView; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "media", label: "Media", icon: Music2 },
  { id: "optimizer", label: "Optimizer", icon: SlidersHorizontal },
];

const Layout = memo(function Layout({ children }: LayoutProps) {
  const activeView = useSystemStore((state) => state.activeView);
  const setActiveView = useSystemStore((state) => state.setActiveView);
  const startWindowDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button === 0) {
      getCurrentWindow().startDragging().catch(console.error);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* ── Window Header (28px) ── */}
      <header className="flex items-center h-[28px] min-h-[28px] bg-[#12131C] border-b border-[#2A2B3C] select-none">
        <TrafficLights
          onClose={closeWindow}
          onMinimize={minimizeWindow}
          onToggleMaximize={toggleMaximize}
        />
        <div
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
          className="flex-1 h-full cursor-grab active:cursor-grabbing"
        />
      </header>

      {/* ── Content Area ── */}
      <main className="flex-1 min-h-0 overflow-hidden p-2">
        <motion.div layout className="h-full grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),26rem))] auto-rows-min justify-center gap-2 overflow-y-auto content-start">
          {children}
        </motion.div>
      </main>

      <footer className="flex h-12 shrink-0 items-center justify-center border-t border-[#2A2B3C] bg-[#0E0F16]/95 px-2 backdrop-blur">
        <nav aria-label="Dashboard views" className="flex items-center gap-1 rounded-lg border border-[#292A3C] bg-[#12131C] p-1">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = id === activeView;
            return <button key={id} type="button" aria-label={label} aria-pressed={active} onClick={() => setActiveView(id)} className={`group relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${active ? "bg-[#8B5CF6]/20 text-[#DDD6FE] shadow-[0_0_10px_rgba(139,92,246,0.16)]" : "text-[#777797] hover:bg-[#222336] hover:text-[#D9D9EA]"}`}>
              <Icon size={16} strokeWidth={1.8} />
              <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#3A3B4C] bg-[#12131C] px-2 py-1 text-[10px] text-[#D9D9EA] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>
            </button>;
          })}
        </nav>
      </footer>
    </div>
  );
});

export default Layout;
