import { memo, useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Laptop, LoaderCircle, Monitor, Settings2 } from "lucide-react";
import type { DisplayInfo, DisplayState } from "../../types/schema";
import { dashboardFetchQueue } from "../../lib/dashboardFetchQueue";
import { WidgetFactory } from "./factory";

const modeLabel: Record<string, string> = {
  single: "Một màn hình",
  extend: "Mở rộng",
  mirror: "Phản chiếu",
};

function DisplayMap({ displays }: { displays: DisplayInfo[] }) {
  if (!displays.length) return <p className="text-[10px] text-on-surface-variant">Không nhận được cấu hình màn hình.</p>;
  const minX = Math.min(...displays.map((display) => display.x));
  const minY = Math.min(...displays.map((display) => display.y));
  const maxX = Math.max(...displays.map((display) => display.x + display.width));
  const maxY = Math.max(...displays.map((display) => display.y + display.height));
  const viewportWidth = Math.max(maxX - minX, 1);
  const viewportHeight = Math.max(maxY - minY, 1);

  return <div className="display-layout-map" aria-label="Sơ đồ sắp xếp màn hình hiện tại">
    {displays.map((display, index) => (
      <div
        key={display.id}
        className={`display-layout-screen ${display.is_primary ? "display-layout-screen-primary" : ""}`}
        style={{
          left: `${((display.x - minX) / viewportWidth) * 100}%`,
          top: `${((display.y - minY) / viewportHeight) * 100}%`,
          width: `${Math.max((display.width / viewportWidth) * 100, 12)}%`,
          height: `${Math.max((display.height / viewportHeight) * 100, 22)}%`,
        }}
        title={`${display.name} · ${display.width}×${display.height} · ${display.x}, ${display.y}`}
      >
        <span>{index + 1}</span>
      </div>
    ))}
  </div>;
}

export const DisplayLayoutWidget = memo(function DisplayLayoutWidget() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setState(await invoke<DisplayState>("get_display_state"));
      setError(null);
    } catch (reason) {
      setError(String(reason));
    }
  }, []);

  useEffect(() => dashboardFetchQueue.register("display-layout", refresh, { initialDelayMs: 350 }), [refresh]);

  const openSettings = async () => {
    setOpening(true);
    try { await invoke("open_display_settings"); }
    catch (reason) { setError(String(reason)); }
    finally { setOpening(false); }
  };

  const displays = state?.displays ?? [];
  return <WidgetFactory title="DISPLAYS" icon={<Monitor size={14} strokeWidth={2} />} accentColor="text-cyan-accent" className="display-layout-widget">
    <div className="display-layout-content flex flex-col gap-2.5">
      <div className="display-layout-summary flex items-start justify-between gap-2">
        <div>
          <p className="big-number text-xl leading-none text-cyan-accent">{state ? displays.length : "—"}</p>
          <p className="mt-1 text-[9px] uppercase tracking-wider text-on-surface-variant">màn hình đang hoạt động</p>
        </div>
        <div className={`rounded-full border px-2 py-1 text-[9px] font-bold ${state?.laptop_display_active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
          <Laptop size={11} className="mr-1 inline-block align-[-2px]" />
          Laptop {state?.laptop_display_active ? "đang bật" : "đang tắt"}
        </div>
      </div>
      {state && <>
        <DisplayMap displays={displays} />
        <div className="display-layout-meta flex items-center justify-between gap-2 text-[9px] text-on-surface-variant">
          <span>Chế độ: <strong className="text-slate-200">{modeLabel[state.mode] ?? state.mode}</strong></span>
          <span className="font-mono">tọa độ thực</span>
        </div>
        <div className="display-layout-list space-y-1">
          {displays.map((display, index) => <div key={display.id} className="display-layout-row flex items-center justify-between gap-2 rounded-md bg-black/20 px-2 py-1 text-[9px]">
            <span className="min-w-0 truncate text-slate-300">{index + 1}. {display.name}{display.is_primary ? " · chính" : ""}</span>
            <span className="shrink-0 font-mono text-slate-500">{display.width}×{display.height}</span>
          </div>)}
        </div>
      </>}
      {error && <p className="rounded bg-red-400/10 px-2 py-1 text-[9px] text-red-300">{error}</p>}
      <button type="button" onClick={() => void openSettings()} disabled={opening} className="display-layout-settings flex h-8 items-center justify-center gap-1.5 rounded-lg border border-cyan-accent/25 bg-cyan-accent/10 text-[9px] font-bold uppercase tracking-wider text-cyan-accent hover:bg-cyan-accent/15 disabled:opacity-50">
        {opening ? <LoaderCircle size={12} className="animate-spin" /> : <Settings2 size={12} />}
        Cài Đặt Màn Hình
      </button>
    </div>
  </WidgetFactory>;
});
