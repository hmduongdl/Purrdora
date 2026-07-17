import { memo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useSystemStore } from "../../store/useSystemStore";
import { WidgetFactory } from "./factory";

const COLORS = {
  used: "#00F0FF",
  free: "#2A2B3C",
  swap: "#FF00AA",
};

export const RamWidget = memo(function RamWidget() {
  const telemetry = useSystemStore((s) => s.telemetry);
  const ram = telemetry?.ram;

  if (!ram) {
    return (
      <WidgetFactory title="RAM">
        <p className="text-[10px] text-[#555577]">Waiting for data...</p>
      </WidgetFactory>
    );
  }

  const used = ram.used_gb;
  const free = ram.free_gb;
  const swapUsed = ram.swap_used_gb;

  const data = [
    { name: "Used", value: used, color: COLORS.used },
    { name: "Free", value: free, color: COLORS.free },
    { name: "Swap", value: swapUsed, color: COLORS.swap },
  ].filter((d) => d.value > 0);

  return (
    <WidgetFactory title={`RAM — ${ram.usage_percent.toFixed(0)}%`}>
      <div className="flex items-center h-full gap-3">
        {/* Donut */}
        <div className="w-[110px] h-[110px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={48}
                paddingAngle={2}
                dataKey="value"
                stroke="transparent"
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.used }} />
            <span className="text-[#8888AA]">Used</span>
            <span className="font-mono text-[#E0E0F0] ml-auto">{used.toFixed(1)} GB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.free }} />
            <span className="text-[#8888AA]">Free</span>
            <span className="font-mono text-[#E0E0F0] ml-auto">{free.toFixed(1)} GB</span>
          </div>
          {swapUsed > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.swap }} />
              <span className="text-[#8888AA]">Swap</span>
              <span className="font-mono text-[#E0E0F0] ml-auto">
                {swapUsed.toFixed(1)} / {ram.swap_total_gb.toFixed(1)} GB
              </span>
            </div>
          )}
          <div className="border-t border-[#2A2B3C] mt-0.5 pt-0.5">
            <span className="text-[#555577]">Total: </span>
            <span className="font-mono text-[#E0E0F0]">{ram.total_gb.toFixed(1)} GB</span>
          </div>
        </div>
      </div>
    </WidgetFactory>
  );
});
