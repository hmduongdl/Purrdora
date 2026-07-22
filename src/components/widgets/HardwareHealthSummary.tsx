import { useHardwareHealthStore } from "../../store/useHardwareHealthStore";

export function HardwareHealthSummary() {
  const { missingFirmware, firmwareStatus } = useHardwareHealthStore();

  const updatableCount = firmwareStatus?.update_count ?? 0;
  const hasAnyIssue = missingFirmware.length > 0 || updatableCount > 0;

  const statusConfig = {
    attention: {
      color: "bg-amber-500",
      text: "Cần chú ý: Có bản cập nhật firmware hoặc lỗi tải firmware",
      lightGlow: "shadow-[0_0_10px_rgba(245,158,11,0.4)]",
      textColor: "text-amber-400",
      borderLeft: "border-l-amber-500"
    },
    optimal: {
      color: "bg-emerald-500",
      text: "Hệ thống hoạt động tốt: Tất cả firmware đã được cập nhật",
      lightGlow: "shadow-[0_0_10px_rgba(16,185,129,0.4)]",
      textColor: "text-emerald-400",
      borderLeft: "border-l-emerald-500"
    }
  };

  const current = hasAnyIssue ? statusConfig.attention : statusConfig.optimal;

  return (
    <div className={`flex flex-col gap-2 p-3.5 rounded-xl border border-white/5 border-l-2 ${current.borderLeft} bg-[#0E0F16]/60 w-full transition-all duration-300`}>
      {/* Upper line: Status light and descriptive text */}
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${current.color} ${current.lightGlow} shrink-0 animate-pulse`} />
        <span className={`text-[12px] font-bold uppercase tracking-wider ${current.textColor} leading-none`}>
          {current.text}
        </span>
      </div>

      {/* Visual health bar indicator */}
      <div className="relative h-1 w-full rounded-full bg-black/40 overflow-hidden border border-white/5">
        <div
          className={`h-full ${current.color} rounded-full transition-all duration-500`}
          style={{
            width: hasAnyIssue ? "65%" : "100%"
          }}
        />
      </div>

      {/* Firmware summary counters */}
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
        <span>Cập nhật firmware: {updatableCount}</span>
        <span>Lỗi tải firmware: {missingFirmware.length}</span>
      </div>
    </div>
  );
}
