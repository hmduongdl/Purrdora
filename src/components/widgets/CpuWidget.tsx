import { useEffect, useRef, useState, memo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useSystemStore } from "../../store/useSystemStore";
import { WidgetFactory } from "./factory";

const HISTORY_SECONDS = 30;

interface CpuPoint {
  time: number;
  usage: number;
}

export const CpuWidget = memo(function CpuWidget() {
  const telemetry = useSystemStore((s) => s.telemetry);
  const [history, setHistory] = useState<CpuPoint[]>([]);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!telemetry) {
      return;
    }
    const ts = telemetry.timestamp_ms;
    if (ts === lastTs.current) {
      return;
    }
    lastTs.current = ts;

    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time: ts,
          usage: telemetry.cpu.total_usage_percent,
        },
      ];
      if (next.length > HISTORY_SECONDS) {
        return next.slice(next.length - HISTORY_SECONDS);
      }
      return next;
    });
  }, [telemetry]);

  const cores = telemetry?.cpu.cores ?? [];
  const currentUsage = telemetry?.cpu.total_usage_percent ?? 0;

  return (
    <WidgetFactory title={`CPU — ${currentUsage.toFixed(0)}%`}>
      <div className="flex flex-col gap-2 h-full">
        {/* Area chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 2, right: 2, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00F0FF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{
                  background: "#12131C",
                  border: "1px solid #2A2B3C",
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "inherit",
                  color: "#E0E0F0",
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "CPU"]}
                labelFormatter={(label) =>
                  new Date(Number(label)).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                }
              />
              <Area
                type="monotone"
                dataKey="usage"
                stroke="#00F0FF"
                strokeWidth={1.5}
                fill="url(#cpuGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Per-core bars */}
        <div className="flex gap-1 flex-wrap">
          {cores.map((core) => (
            <div key={core.core_id} className="flex flex-col items-center gap-0.5">
              <div className="w-2.5 h-12 bg-[#1A1B26] rounded-sm overflow-hidden relative">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-300"
                  style={{
                    height: `${Math.min(core.usage_percent, 100)}%`,
                    backgroundColor:
                      core.usage_percent > 80
                        ? "#FF5555"
                        : core.usage_percent > 50
                          ? "#FFD700"
                          : "#00F0FF",
                  }}
                />
              </div>
              <span className="text-[8px] text-[#555577] leading-none">
                C{core.core_id}
              </span>
              <span className="text-[8px] text-[#8888AA] leading-none font-mono">
                {core.usage_percent.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </WidgetFactory>
  );
});
