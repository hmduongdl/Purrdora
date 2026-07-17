import { memo } from "react";
import { motion } from "framer-motion";
import { useSystemStore } from "../../store/useSystemStore";

export const GpuWidget = memo(function GpuWidget() {
  const gpus = useSystemStore((s) => s.telemetry?.gpus);

  if (!gpus || gpus.length === 0) return null;

  return (
    <motion.section layout className="rounded border border-[#2A2B3C] bg-[#12131C] p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888AA] mb-2">
        GPU
      </h2>
      {gpus.map((gpu) => (
        <div key={gpu.name} className="text-xs text-[#AAAACC]">
          <span>{gpu.name}: </span>
          <span className="font-mono text-[#00F0FF]">
            {gpu.usage_percent.toFixed(1)}% | {gpu.memory_used_mb} / {gpu.memory_total_mb} MB
          </span>
        </div>
      ))}
    </motion.section>
  );
});
