import { motion } from "framer-motion";
import { useIpcListener } from "./hooks/useIpcListener";
import { useDebounce } from "./hooks/useDebounce";
import { useSystemStore } from "./store/useSystemStore";
import { VolumeSlider } from "./components/VolumeSlider";
import MediaPlayerWidget from "./components/MediaPlayerWidget";
import QuickActions from "./components/QuickActions";
import ShutdownTimer from "./components/ShutdownTimer";
import Layout from "./components/Layout";
import { CpuWidget } from "./components/widgets/CpuWidget";
import { RamWidget } from "./components/widgets/RamWidget";
import { GpuWidget } from "./components/widgets/GpuWidget";
import { NetworkWidget } from "./components/widgets/NetworkWidget";
import { PerformanceHistoryWidget } from "./components/widgets/PerformanceHistoryWidget";
import { SessionCard } from "./components/widgets/SessionCard";
import { StatusPill } from "./components/widgets/factory";
import { MetricBar } from "./components/ui/MetricBar";

function App() {
  useIpcListener();

  const audio = useSystemStore((s) => s.audio);
  const activeView = useSystemStore((s) => s.activeView);
  const setVolume = useSystemStore((s) => s.setVolume);
  const toggleMute = useSystemStore((s) => s.toggleMute);

  const debouncedSetVolume = useDebounce(setVolume, 50);

  return (
    <Layout>
      {activeView === "dashboard" && <>
        <div className="col-span-full"><SessionCard /></div>
        <CpuWidget />
        <RamWidget />
        <GpuWidget />
        <NetworkWidget />
        <div className="col-span-full"><PerformanceHistoryWidget /></div>
      </>}

      {activeView === "audio" && <motion.section layout className="mac-glass col-span-full h-full p-2">
        <div className="flex items-center justify-between mb-2"><h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#A855F7]">Audio / MIXER</h2>{audio?.default_sink ? <StatusPill tone={audio.default_sink.is_muted ? "amber" : "green"}>{audio.default_sink.is_muted ? "Muted" : "Output live"}</StatusPill> : <div className="skeleton h-5 w-16 rounded-full" />}</div>
        {audio?.default_sink ? (
          <div className="flex items-center gap-3">
            <VolumeSlider
              value={audio.default_sink.volume_percent}
              deviceId={audio.default_sink.id}
              isMuted={audio.default_sink.is_muted}
              onVolumeChange={debouncedSetVolume}
              onMuteToggle={toggleMute}
            />
            <div className="min-w-0 flex-1 text-xs text-[#AAAACC]"><MetricBar label="Vol" value={audio.default_sink.is_muted ? 0 : audio.default_sink.volume_percent} max={100} unit="%" colorClass="bg-[#8B5CF6]" />
              <p className="text-[#555577] mt-1 max-w-[180px] truncate">
                {audio.default_sink.description}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3"><div className="flex w-6 shrink-0 flex-col items-center gap-2"><div className="skeleton h-4 w-4 rounded-full" /><div className="skeleton h-5 w-6 rounded-full" /><div className="skeleton h-[88px] w-6 rounded-full" /></div><div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-2 w-2/3" /></div></div>
        )}
      </motion.section>}

      {activeView === "media" && <div className="col-span-full"><MediaPlayerWidget /></div>}

      {activeView === "optimizer" && <>
        <div className="col-span-full"><ShutdownTimer /></div>
        <div className="col-span-full"><QuickActions /></div>
      </>}
    </Layout>
  );
}

export default App;
