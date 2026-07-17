import { motion } from "framer-motion";
import { useIpcListener } from "./hooks/useIpcListener";
import { useDebounce } from "./hooks/useDebounce";
import { useSystemStore } from "./store/useSystemStore";
import { VolumeSlider } from "./components/VolumeSlider";
import MediaPlayerWidget from "./components/MediaPlayerWidget";
import QuickActions from "./components/QuickActions";
import Layout from "./components/Layout";
import { CpuWidget } from "./components/widgets/CpuWidget";
import { RamWidget } from "./components/widgets/RamWidget";
import { GpuWidget } from "./components/widgets/GpuWidget";

function App() {
  useIpcListener();

  const audio = useSystemStore((s) => s.audio);
  const setVolume = useSystemStore((s) => s.setVolume);
  const toggleMute = useSystemStore((s) => s.toggleMute);

  const debouncedSetVolume = useDebounce(setVolume, 50);

  return (
    <Layout>
      {/* ── CPU & RAM Charts ── */}
      <div className="flex gap-2">
        <CpuWidget />
        <RamWidget />
      </div>

      {/* ── GPU Info ── */}
      <GpuWidget />

      {/* ── Audio ── */}
      <motion.section layout className="rounded border border-[#2A2B3C] bg-[#12131C] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888AA] mb-2">
          Audio
        </h2>
        {audio?.default_sink ? (
          <div className="flex items-center gap-4">
            <VolumeSlider
              value={audio.default_sink.volume_percent}
              deviceId={audio.default_sink.id}
              isMuted={audio.default_sink.is_muted}
              onVolumeChange={debouncedSetVolume}
              onMuteToggle={toggleMute}
            />
            <div className="text-xs text-[#AAAACC]">
              <p className="font-mono text-[#00F0FF]">
                {audio.default_sink.volume_percent}%{audio.default_sink.is_muted ? " (muted)" : ""}
              </p>
              <p className="text-[#555577] mt-0.5 max-w-[120px] truncate">
                {audio.default_sink.description}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#555577]">Mixer loading...</p>
        )}
      </motion.section>

      {/* ── Media Player ── */}
      <MediaPlayerWidget />

      {/* ── Quick Actions ── */}
      <QuickActions />
    </Layout>
  );
}

export default App;
