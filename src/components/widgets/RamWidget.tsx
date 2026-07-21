import { useEffect, useRef, useState, memo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useSystemStore } from "../../store/useSystemStore";
import { WidgetFactory } from "./factory";
import { MetricBar } from "../ui/MetricBar";

interface RamPoint { time: number; usage: number; }

export const RamWidget = memo(function RamWidget() {
  const telemetry = useSystemStore((s) => s.telemetry);
  const ram = telemetry?.ram;
  const [history, setHistory] = useState<RamPoint[]>([]);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!telemetry || telemetry.timestamp_ms === lastTs.current) return;
    lastTs.current = telemetry.timestamp_ms;
    setHistory((prev) => [...prev, { time: telemetry.timestamp_ms, usage: telemetry.ram.usage_percent }].slice(-30));
  }, [telemetry]);

  return <WidgetFactory title="MEMORY / RAM">
    {ram ? <>
      <div className="flex items-start justify-between gap-2"><div><div className="text-[26px] font-medium leading-none text-[#E9D5FF]">{ram.usage_percent.toFixed(0)}<span className="text-base text-[#A855F7]">%</span></div><div className="mt-1 text-[12px] text-[#777797]">{ram.used_gb.toFixed(1)} / {ram.total_gb.toFixed(1)} GB used</div></div><div className="text-right text-[12px] text-[#777797]">Free<br /><span className="font-mono text-[#D9D9EA]">{ram.free_gb.toFixed(1)} GB</span></div></div>
      <div className="mt-2"><MetricBar label="RAM" value={ram.used_gb} max={ram.total_gb} unit=" GB" colorClass="bg-[#EC4899]" /></div>
      <div className="mt-2 rounded-md border border-[#292A3C] bg-[#0E0F16] px-1.5"><ResponsiveContainer width="100%" height={40}><AreaChart data={history.length ? history : [{ time: 0, usage: ram.usage_percent }]} margin={{ top: 3, right: 0, bottom: 2, left: 0 }}><defs><linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EC4899" stopOpacity={0.4} /><stop offset="100%" stopColor="#EC4899" stopOpacity={0.02} /></linearGradient></defs><Area type="monotone" dataKey="usage" stroke="#EC4899" strokeWidth={1.5} fill="url(#ramGrad)" isAnimationActive={false} dot={false} /></AreaChart></ResponsiveContainer></div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px]"><div className="metric-tile"><span>Swap</span><strong>{ram.swap_used_gb.toFixed(1)} GB</strong></div><div className="metric-tile"><span>Capacity</span><strong>{ram.total_gb.toFixed(1)} GB</strong></div></div>
    </> : <div className="skeleton h-24 w-full" />}
  </WidgetFactory>;
});
