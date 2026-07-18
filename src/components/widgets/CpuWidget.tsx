import { useEffect, useRef, useState, memo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useSystemStore } from "../../store/useSystemStore";
import { StatusPill, WidgetFactory } from "./factory";
import { MetricBar } from "../ui/MetricBar";

const HISTORY_SECONDS = 30;
interface CpuPoint { time: number; usage: number; }

export const CpuWidget = memo(function CpuWidget() {
  const telemetry = useSystemStore((s) => s.telemetry);
  const [history, setHistory] = useState<CpuPoint[]>([]);
  const lastTs = useRef(0);
  useEffect(() => {
    if (!telemetry || telemetry.timestamp_ms === lastTs.current) return;
    lastTs.current = telemetry.timestamp_ms;
    setHistory((prev) => [...prev, { time: telemetry.timestamp_ms, usage: telemetry.cpu.total_usage_percent }].slice(-HISTORY_SECONDS));
  }, [telemetry]);

  const cores = telemetry?.cpu.cores ?? [];
  const usage = telemetry?.cpu.total_usage_percent ?? 0;
  const frequencies = cores.filter((core) => core.frequency_mhz > 0);
  const avgFrequency = frequencies.length ? frequencies.reduce((sum, core) => sum + core.frequency_mhz, 0) / frequencies.length : 0;
  const temperatures = cores.flatMap((core) => core.temperature_celsius == null ? [] : [core.temperature_celsius]);
  const temperature = temperatures.length ? Math.max(...temperatures) : null;

  return <WidgetFactory title="CPU / PROCESSOR">
    <div className="flex items-start justify-between gap-2">
      <div><div className="text-[24px] font-medium leading-none text-[#E9D5FF]">{usage.toFixed(0)}<span className="text-sm text-[#A855F7]">%</span></div><div className="mt-1 text-[10px] text-[#777797]">current load</div></div>
      <StatusPill tone={usage > 80 ? "amber" : "green"}>{usage > 80 ? "High" : "Normal"}</StatusPill>
    </div>
    <div className="mt-2"><MetricBar label="CPU" value={usage} max={100} unit="%" colorClass="bg-[#A855F7]" /></div>
    <div className="mt-2 rounded-md border border-[#292A3C] bg-[#0E0F16] px-1.5"><ResponsiveContainer width="100%" height={40}><AreaChart data={history.length ? history : [{ time: 0, usage }]} margin={{ top: 3, right: 0, bottom: 2, left: 0 }}>
      <defs><linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A855F7" stopOpacity={0.4} /><stop offset="100%" stopColor="#A855F7" stopOpacity={0.02} /></linearGradient></defs>
      <Area type="monotone" dataKey="usage" stroke="#A855F7" strokeWidth={1.5} fill="url(#cpuGrad)" isAnimationActive={false} dot={false} />
    </AreaChart></ResponsiveContainer></div>
    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]"><div className="metric-tile"><span>Clock</span><strong>{avgFrequency ? `${(avgFrequency / 1000).toFixed(2)} GHz` : "—"}</strong></div><div className="metric-tile"><span>Temp</span><strong>{temperature == null ? "—" : `${temperature.toFixed(0)}°C`}</strong></div><div className="metric-tile"><span>Cores</span><strong>{cores.length || "—"}</strong></div></div>
  </WidgetFactory>;
});
