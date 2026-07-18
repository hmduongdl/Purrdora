import { memo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useSystemStore } from "../../store/useSystemStore";
import { StatusPill, WidgetFactory } from "./factory";

const HISTORY_SECONDS = 60;

function formatRate(bytesPerSecond: number) {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

export const NetworkWidget = memo(function NetworkWidget() {
  const telemetry = useSystemStore((state) => state.telemetry);
  const networkHistory = useSystemStore((state) => state.networkHistory);
  const network = telemetry?.network;

  const interfaces = network?.interfaces.filter((networkInterface) => networkInterface.name !== "lo") ?? [];
  const download = interfaces.reduce((total, networkInterface) => total + networkInterface.rx_bytes_per_sec, 0);
  const upload = interfaces.reduce((total, networkInterface) => total + networkInterface.tx_bytes_per_sec, 0);
  const latency = network?.latency_ms ?? null;
  const graphData = networkHistory
    .filter((point) => point.latency_ms != null)
    .slice(-HISTORY_SECONDS);

  return (
    <WidgetFactory title="NETWORK / LATENCY">
      {!network ? <div className="skeleton h-28 w-full" /> : <>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#777797] truncate">
            {interfaces.length ? interfaces.map((networkInterface) => networkInterface.name).join(" · ") : "No active interface"}
          </span>
          <StatusPill tone={latency == null ? "muted" : "green"}>{latency == null ? "Offline" : "Connected"}</StatusPill>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="metric-tile">
            <span>↓ Download</span>
            <strong className="text-[#67E8F9]">{formatRate(download)}</strong>
          </div>
          <div className="metric-tile">
            <span>↑ Upload</span>
            <strong className="text-[#F9A8D4]">{formatRate(upload)}</strong>
          </div>
        </div>

        <div className="mt-2 rounded-md border border-[#292A3C] bg-[#0E0F16] px-1.5 py-1">
          <div className="flex items-center justify-between px-0.5 text-[10px]">
            <span className="uppercase tracking-wide text-[#777797]">Latency · 60s</span>
            <strong className="font-mono font-medium text-[#E9D5FF]">{latency == null ? "—" : `${latency.toFixed(0)} ms`}</strong>
          </div>
          {graphData.length ? <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={graphData} margin={{ top: 3, right: 0, bottom: 2, left: 0 }}>
              <defs>
                <linearGradient id="networkLatencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="latency_ms" stroke="#A855F7" strokeWidth={1.5} fill="url(#networkLatencyGradient)" isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer> : <div className="skeleton mt-1 h-10 w-full" />}
        </div>
      </>}
    </WidgetFactory>
  );
});
