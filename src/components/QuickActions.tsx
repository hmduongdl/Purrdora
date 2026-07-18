import { useState, useCallback, memo, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellOff, Coffee, Gamepad2, LoaderCircle, Trash2 } from "lucide-react";
import { useSystemStore } from "../store/useSystemStore";
import { StatusPill } from "./ui/StatusPill";

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} onAnimationComplete={() => { setTimeout(onDone, 1500); }} className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/15 px-4 py-1.5 font-mono text-xs text-[#DDD6FE] shadow-lg shadow-[#8B5CF6]/10 backdrop-blur-md">{message}</motion.div>;
}

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  loading?: boolean;
  onClick: () => void;
}

function ActionButton({ icon, label, active = false, loading = false, onClick }: ActionButtonProps) {
  return <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }} onClick={onClick} className={`relative flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-lg border p-2 transition-colors ${active ? "border-[#8B5CF6]/45 bg-[#8B5CF6]/12 text-[#DDD6FE]" : "border-[#2A2B3C] bg-[#161722] text-[#9999B5] hover:border-[#8B5CF6]/45 hover:bg-[#222336]"}`}>
    {active && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#A855F7] shadow-[0_0_4px_#A855F7]" />}
    {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><LoaderCircle size={19} /></motion.div> : icon}
    <span className="text-[11px] leading-none">{label}</span>
  </motion.button>;
}

const QuickActions = memo(function QuickActions() {
  const controls = useSystemStore((s) => s.controls);
  const isGamemodeActive = controls.is_gamemode_active;
  const toggleGamemode = useSystemStore((s) => s.toggleGamemode);
  const clearRamCache = useSystemStore((s) => s.clearRamCache);
  const isDoNotDisturbActive = controls.is_do_not_disturb_active;
  const isKeepAwakeActive = controls.is_keep_awake_active;
  const toggleDoNotDisturb = useSystemStore((s) => s.toggleDoNotDisturb);
  const toggleKeepAwake = useSystemStore((s) => s.toggleKeepAwake);
  const activeProfile = useSystemStore((s) => s.settings.active_profile);
  const [loading, setLoading] = useState<"gamemode" | "dropcache" | "dnd" | "awake" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleGamemode = useCallback(async () => {
    setLoading("gamemode");
    try { setToast(await toggleGamemode()); } catch { setToast("GameMode failed"); } finally { setLoading(null); }
  }, [toggleGamemode]);
  const handleDropCache = useCallback(async () => {
    setLoading("dropcache");
    try { setToast(await clearRamCache()); } catch { setToast("Drop cache failed"); } finally { setLoading(null); }
  }, [clearRamCache]);
  const handleDoNotDisturb = useCallback(async () => {
    setLoading("dnd");
    try { setToast(await toggleDoNotDisturb()); } catch { setToast("Do Not Disturb failed"); } finally { setLoading(null); }
  }, [toggleDoNotDisturb]);
  const handleKeepAwake = useCallback(async () => {
    setLoading("awake");
    try { setToast(await toggleKeepAwake()); } catch { setToast("Keep Awake failed"); } finally { setLoading(null); }
  }, [toggleKeepAwake]);

  return <motion.section layout className="relative h-full rounded-xl border border-[#2A2B3C] bg-[#12131C] p-2">
    <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#A855F7]">Quick Actions</h2><div className="flex flex-wrap justify-end gap-1"><StatusPill label={`GameMode ${isGamemodeActive ? "on" : "off"}`} active={isGamemodeActive} /><StatusPill label={`DND ${isDoNotDisturbActive ? "on" : "off"}`} active={isDoNotDisturbActive} /><StatusPill label={`Awake ${isKeepAwakeActive ? "on" : "off"}`} active={isKeepAwakeActive} /><StatusPill label={activeProfile.name} active={activeProfile.name === "performance"} /></div></div>
    <AnimatePresence>{toast && <Toast message={toast} onDone={() => setToast(null)} />}</AnimatePresence>
    <div className="grid grid-cols-4 gap-1.5">
      <ActionButton icon={<Gamepad2 size={19} strokeWidth={1.7} />} label="GameMode" active={isGamemodeActive} loading={loading === "gamemode"} onClick={handleGamemode} />
      <ActionButton icon={<Trash2 size={19} strokeWidth={1.7} />} label="Drop Cache" loading={loading === "dropcache"} onClick={handleDropCache} />
      <ActionButton icon={<BellOff size={19} strokeWidth={1.7} />} label="Do Not Disturb" active={isDoNotDisturbActive} loading={loading === "dnd"} onClick={handleDoNotDisturb} />
      <ActionButton icon={<Coffee size={19} strokeWidth={1.7} />} label="Keep Awake" active={isKeepAwakeActive} loading={loading === "awake"} onClick={handleKeepAwake} />
    </div>
  </motion.section>;
});

export default QuickActions;
