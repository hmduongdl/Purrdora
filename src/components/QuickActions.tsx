import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSystemStore } from "../store/useSystemStore";

/* ── SVG Icons ── */

function GamepadIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#00F0FF" : "#8888AA"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.46 11.07 2 14.52 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.5-1.5h7L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.48-.46-4.93-.702-7.41A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

function DropCacheIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8888AA"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="m9 9 1.5-1.5L12 9l1.5-1.5L15 9" />
      <path d="m9 13 1.5 1.5L12 13l1.5 1.5L15 13" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <motion.svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00F0FF"
      strokeWidth="2"
      strokeLinecap="round"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </motion.svg>
  );
}

/* ── Toast ── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      onAnimationComplete={() => {
        setTimeout(onDone, 1500);
      }}
      className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full
                 bg-[#00F0FF]/15 border border-[#00F0FF]/30 text-[#00F0FF] text-xs font-mono
                 backdrop-blur-md shadow-lg shadow-[#00F0FF]/10"
    >
      {message}
    </motion.div>
  );
}

/* ── Action Button ── */

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  activeLabel?: string;
  loading?: boolean;
  onClick: () => void;
}

function ActionButton({
  icon,
  label,
  active,
  activeLabel,
  loading,
  onClick,
}: ActionButtonProps) {
  const isOn = active === true;
  const displayLabel = isOn && activeLabel ? activeLabel : label;

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl
                  border transition-colors duration-200 select-none cursor-default
                  ${
                    isOn
                      ? "bg-[#00F0FF]/10 border-[#00F0FF]/30 shadow-[0_0_12px_rgba(0,240,255,0.08)]"
                      : "bg-[#1A1B26] border-[#2A2B3C] hover:bg-[#222336] hover:border-[#3A3B4C]"
                  }`}
    >
      {/* Active indicator dot */}
      {isOn && (
        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#00F0FF] shadow-[0_0_4px_#00F0FF]" />
      )}

      {loading ? <SpinnerIcon /> : icon}

      <span
        className={`text-[10px] font-mono uppercase tracking-wider ${
          isOn ? "text-[#00F0FF]" : "text-[#666688]"
        }`}
      >
        {displayLabel}
      </span>
    </motion.button>
  );
}

/* ── QuickActions Grid ── */

const QuickActions = memo(function QuickActions() {
  const isGamemodeActive = useSystemStore((s) => s.isGamemodeActive);
  const toggleGamemode = useSystemStore((s) => s.toggleGamemode);
  const clearRamCache = useSystemStore((s) => s.clearRamCache);

  const [loading, setLoading] = useState<"gamemode" | "dropcache" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleGamemode = useCallback(async () => {
    setLoading("gamemode");
    try {
      const result = await toggleGamemode();
      setToast(result);
    } catch {
      setToast("GameMode failed");
    } finally {
      setLoading(null);
    }
  }, [toggleGamemode]);

  const handleDropCache = useCallback(async () => {
    setLoading("dropcache");
    try {
      const result = await clearRamCache();
      setToast(result);
    } catch {
      setToast("Drop cache failed");
    } finally {
      setLoading(null);
    }
  }, [clearRamCache]);

  return (
    <motion.section layout className="rounded-xl border border-[#2A2B3C] bg-[#12131C] p-3 relative">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888AA] mb-3">
        Quick Actions
      </h2>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          icon={<GamepadIcon active={isGamemodeActive} />}
          label="GameMode"
          activeLabel="ON"
          active={isGamemodeActive}
          loading={loading === "gamemode"}
          onClick={handleGamemode}
        />

        <ActionButton
          icon={<DropCacheIcon />}
          label="Drop Cache"
          loading={loading === "dropcache"}
          onClick={handleDropCache}
        />
      </div>
    </motion.section>
  );
});

export default QuickActions;
