import { useState } from "react";
import {
  Cpu,
  RefreshCw,
  HardDrive,
  MemoryStick,
  Wifi,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Database
} from "lucide-react";
import { useHardwareHealthStore } from "../../store/useHardwareHealthStore";
import type { FullHardwareDevice } from "../../types/schema";

export function OrphanDeviceList() {
  const {
    fullHardwareDevices,
    physicalDisks,
    smartHealthMap,
    isLoading,
    fetchHardwareHealth,
  } = useHardwareHealthStore();

  const [copiedCmd, setCopiedCmd] = useState(false);

  // Group devices by Category
  const categories = ["Bộ xử lý & Chipset", "Lưu trữ", "Đồ họa", "Mạng & Kết nối", "Nguồn điện & Pin"];

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c, true]))
  );

  const handleCopySmartInstall = () => {
    void navigator.clipboard.writeText("sudo dnf install smartmontools");
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getDevicesForCategory = (catName: string): FullHardwareDevice[] => {
    return fullHardwareDevices.filter((d) => d.category === catName);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Bộ xử lý & Chipset":
        return <Cpu size={14} className="text-[#C4B5FD]" />;
      case "Lưu trữ":
        return <HardDrive size={14} className="text-cyan-400" />;
      case "Đồ họa":
        return <Activity size={14} className="text-pink-400" />;
      case "Mạng & Kết nối":
        return <Wifi size={14} className="text-[#86efac]" />;
      case "Nguồn điện & Pin":
        return <Zap size={14} className="text-amber-400" />;
      default:
        return <MemoryStick size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="adaptive-card glass-panel flex flex-col p-3 gap-2.5 relative overflow-hidden h-full">
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
        <h3 className="header-small-caps flex items-center gap-2 text-[13px] md:text-[14px] text-primary font-bold">
          <Cpu size={15} strokeWidth={2} />
          DANH SÁCH THIẾT BỊ &amp; DRIVER HỆ THỐNG
        </h3>
        <button
          onClick={() => void fetchHardwareHealth()}
          disabled={isLoading}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 disabled:opacity-50"
          title="Làm mới toàn bộ phần cứng"
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Main Content List Container */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-3">
        {isLoading && fullHardwareDevices.length === 0 ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg border border-white/5 bg-[#0E0F16]/45 animate-pulse" />
            ))}
          </div>
        ) : (
          categories.map((category) => {
            const devList = getDevicesForCategory(category);
            const isStorageCategory = category === "Lưu trữ";
            const isCollapsed = collapsedCategories[category];

            if (devList.length === 0 && !isStorageCategory) return null;

            return (
              <div key={category} className="space-y-1.5">
                {/* Category Header Bar */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between text-[12.5px] font-bold text-slate-300 uppercase tracking-wider py-1 px-2 rounded bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    <span>{category}</span>
                    <span className="text-[11.5px] text-slate-400 font-mono font-normal">
                      ({isStorageCategory ? physicalDisks.length || devList.length : devList.length})
                    </span>
                  </span>
                  {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                </button>

                {!isCollapsed && (
                  <div className="space-y-1.5 pl-1">
                    {/* SPECIAL DETAILED PHYSICAL DISK CARDS FOR "LƯU TRỮ" */}
                    {isStorageCategory && physicalDisks.length > 0 ? (
                      <div className="space-y-2.5">
                        {physicalDisks.map((disk) => {
                          const smart = smartHealthMap[disk.dev_path];
                          const remainingHealth = smart?.wear_level_percent != null
                            ? 100 - smart.wear_level_percent
                            : null;

                          return (
                            <div
                              key={disk.name}
                              className="rounded-xl border border-cyan-500/20 bg-[#0E0F16]/80 p-3 space-y-2.5 hover:border-cyan-500/40 transition-all"
                            >
                              {/* Physical Disk Main Header */}
                              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                    <HardDrive size={16} />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-[14px] font-bold text-slate-100 truncate">{disk.model}</h4>
                                    <p className="text-[12px] text-slate-400 font-mono">
                                      {disk.dev_path} · {disk.tran ? disk.tran.toUpperCase() : "STORAGE"} · {disk.is_ssd ? "NVMe/SSD" : "HDD (Quay)"}
                                    </p>
                                  </div>
                                </div>

                                {/* Physical Disk Capacity Display */}
                                <div className="text-right shrink-0">
                                  <div className="text-[14px] font-bold font-mono text-cyan-400">
                                    Dung lượng ổ vật lý: {disk.total_gb >= 1000 ? `${(disk.total_gb / 1000).toFixed(2)} TB` : `${disk.total_gb.toFixed(0)} GB`}
                                  </div>
                                  <div className="text-[11.5px] text-slate-400 font-mono">
                                    ({disk.total_bytes.toLocaleString()} bytes)
                                  </div>
                                </div>
                              </div>

                              {/* SMART Health Section */}
                              <div className="rounded-lg border border-white/5 bg-black/40 p-2.5 text-[12.5px] space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 font-bold text-slate-300">
                                    <ShieldCheck size={13} className="text-emerald-400" />
                                    Sức khỏe ổ đĩa (SMART)
                                  </span>

                                  {/* SMART Status Badge */}
                                  {smart ? (
                                    !smart.installed ? (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                        Chưa cài smartmontools
                                      </span>
                                    ) : !smart.supported ? (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-500/10 border border-slate-500/20 text-slate-400">
                                        Không hỗ trợ SMART
                                      </span>
                                    ) : smart.passed ? (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                        <CheckCircle2 size={10} /> PASSED (Tốt)
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse">
                                        <XCircle size={10} /> FAILED (Cảnh báo)
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[11.5px] text-slate-500 italic animate-pulse">Đang kiểm tra SMART...</span>
                                  )}
                                </div>

                                {/* SMART Metrics Grid */}
                                {smart && smart.supported && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5 font-mono text-[12px]">
                                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                      <span className="block text-[10.5px] text-slate-400 uppercase font-sans">Độ bền còn lại</span>
                                      <span className="font-bold text-emerald-400">
                                        {remainingHealth != null ? `${remainingHealth}%` : "—"}
                                      </span>
                                      {smart.wear_level_percent != null && (
                                        <span className="text-[10.5px] text-slate-400 block font-sans">Hao mòn {smart.wear_level_percent}%</span>
                                      )}
                                    </div>

                                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                      <span className="block text-[10.5px] text-slate-400 uppercase font-sans">Nhiệt độ ổ</span>
                                      <span className="font-bold text-cyan-300">
                                        {smart.temperature_c != null ? `${smart.temperature_c}°C` : "—"}
                                      </span>
                                    </div>

                                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                      <span className="block text-[10.5px] text-slate-400 uppercase font-sans">Thời gian chạy</span>
                                      <span className="font-bold text-slate-200">
                                        {smart.power_on_hours != null ? `${smart.power_on_hours}h (${Math.round(smart.power_on_hours / 24)}d)` : "—"}
                                      </span>
                                    </div>

                                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                      <span className="block text-[10.5px] text-slate-400 uppercase font-sans">Số lần bật mở</span>
                                      <span className="font-bold text-slate-200">
                                        {smart.power_cycles != null ? `${smart.power_cycles} lần` : "—"}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Installation Hint Banner if smartmontools is missing */}
                                {smart && !smart.installed && (
                                  <div className="flex items-center justify-between gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-300">
                                    <span>Gợi ý: Cài đặt <code className="bg-black/40 px-1 py-0.5 rounded font-mono">smartmontools</code> để đọc thông số sức khỏe ổ đĩa.</span>
                                    <button
                                      onClick={handleCopySmartInstall}
                                      className="flex items-center gap-1 rounded bg-amber-500/20 hover:bg-amber-500/30 px-2 py-1 text-[11.5px] font-bold text-amber-200 transition-all shrink-0"
                                    >
                                      {copiedCmd ? <Check size={10} /> : <Copy size={10} />}
                                      {copiedCmd ? "Đã copy" : "Copy lệnh"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Partition Breakdown List */}
                              {disk.partitions.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-white/5">
                                  <div className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <Database size={11} className="text-slate-400" />
                                    Phân vùng đĩa ({disk.partitions.length} partitions)
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {disk.partitions.map((part) => (
                                      <div
                                        key={part.name}
                                        className="h-[36px] rounded-lg border border-white/5 bg-black/20 px-2 py-1 flex items-center justify-between gap-2 text-[12px] font-mono"
                                      >
                                        <div className="min-w-0 truncate">
                                          <span className="font-bold text-slate-300">{part.name}</span>
                                          {part.mountpoint && (
                                            <span className="text-cyan-400 font-sans ml-1 text-[11.5px]">[{part.mountpoint}]</span>
                                          )}
                                        </div>
                                        <div className="shrink-0 text-slate-400 text-[11.5px]">
                                          {part.fstype && <span className="mr-1 text-slate-500">{part.fstype}</span>}
                                          <span className="font-bold text-slate-300">{part.size_gb.toFixed(1)} GB</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* REGULAR DENSE HARDWARE ROWS FOR OTHER CATEGORIES */
                      devList.map((dev) => (
                        <div
                          key={dev.id}
                          className="h-[42px] rounded-lg border border-white/5 bg-[#0E0F16]/60 px-2.5 py-1.5 flex items-center justify-between gap-2.5 hover:border-primary/30 transition-all"
                        >
                          {/* Left: Device Name + Vendor */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="shrink-0 rounded-md bg-white/5 p-1 border border-white/5">
                              {getCategoryIcon(dev.category)}
                            </div>
                            <div className="min-w-0 flex-1 truncate">
                              <span className="text-[13.5px] font-bold text-slate-200 truncate" title={dev.name}>
                                {dev.name}
                              </span>
                              <span className="text-[12px] text-slate-400 ml-1.5 font-normal">
                                · {dev.vendor}
                              </span>
                            </div>
                          </div>

                          {/* Middle: Driver & Version / PCI ID */}
                          <div className="hidden sm:flex items-center gap-1.5 text-[12.5px] font-mono text-slate-400 shrink-0">
                            <span className="bg-black/30 px-1.5 py-0.5 rounded border border-white/5 text-slate-300">
                              {dev.driver}
                            </span>
                            <span className="text-slate-400">{dev.version}</span>
                            {dev.pci_id && (
                              <span className="text-slate-500 text-[11.5px]">[{dev.pci_id}]</span>
                            )}
                          </div>

                          {/* Right: Status badge */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                                dev.status === "missing"
                                  ? "text-pink-400 bg-pink-500/10 border border-pink-500/20"
                                  : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                              }`}
                            >
                              {dev.status_text}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
