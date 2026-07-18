import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSystemStore } from "../store/useSystemStore";

function SkipBackIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></svg>; }
function PlayIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>; }
function PauseIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>; }
function SkipForwardIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>; }

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function MediaSkeleton() {
  return <motion.section layout className="mac-glass h-full p-2"><h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#A855F7]">Now Playing</h2><div className="flex items-center gap-2.5"><div className="skeleton h-11 w-11 shrink-0 rounded-md" /><div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-3 w-3/4" /><div className="skeleton h-2 w-1/2" /></div></div><div className="mt-3"><div className="skeleton h-1.5 w-full" /><div className="mt-1 flex justify-between"><div className="skeleton h-2 w-8" /><div className="skeleton h-2 w-8" /></div></div><div className="mt-3 flex justify-center gap-3"><div className="skeleton h-8 w-8 rounded-full" /><div className="skeleton h-9 w-9 rounded-full" /><div className="skeleton h-8 w-8 rounded-full" /></div></motion.section>;
}

const MediaPlayerWidget = memo(function MediaPlayerWidget() {
  const media = useSystemStore((s) => s.media);
  const mediaPlayPause = useSystemStore((s) => s.mediaPlayPause);
  const mediaNext = useSystemStore((s) => s.mediaNext);
  const mediaPrevious = useSystemStore((s) => s.mediaPrevious);
  const seekMedia = useSystemStore((s) => s.seekMedia);
  const [position, setPosition] = useState(0);

  useEffect(() => { setPosition(media?.position_seconds ?? 0); }, [media?.position_seconds, media?.title]);
  useEffect(() => {
    if (!media || media.playback_status !== "Playing" || media.length_seconds <= 0) return;
    const timer = window.setInterval(() => setPosition((current) => Math.min(current + 1, media.length_seconds)), 1000);
    return () => window.clearInterval(timer);
  }, [media?.playback_status, media?.length_seconds]);

  if (!media) return <MediaSkeleton />;
  const isPlaying = media.playback_status === "Playing";
  const canSeek = media.length_seconds > 0;
  const safePosition = Math.min(position, media.length_seconds || position);

  return <motion.section layout className="mac-glass h-full p-2">
    <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#A855F7]">Now Playing</h2>
    <div className="flex items-center gap-2.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#1A1B2C]">{media.art_url ? <img src={media.art_url} alt={media.title || "Album art"} className="h-full w-full object-cover" /> : <span className="text-lg text-[#555577]">♫</span>}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-[#EEE]">{media.title || "Unknown Title"}</p><p className="mt-0.5 truncate text-[10px] text-[#8888AA]">{media.artist || "Unknown Artist"}</p><p className="mt-0.5 truncate text-[9px] text-[#555577]">{media.album || media.player_name.replace("org.mpris.MediaPlayer2.", "")}</p></div>
    </div>
    <div className="mt-3"><input type="range" min={0} max={media.length_seconds || 1} step={1} value={safePosition} disabled={!canSeek} onChange={(event) => setPosition(Number(event.currentTarget.value))} onPointerUp={(event) => { void seekMedia(Number(event.currentTarget.value)); }} onKeyUp={(event) => { void seekMedia(Number(event.currentTarget.value)); }} className="media-progress w-full disabled:cursor-default" aria-label="Song progress" /><div className="mt-1 flex justify-between font-mono text-[9px] text-[#666688]"><span>{formatTime(safePosition)}</span><span>{canSeek ? formatTime(media.length_seconds) : "LIVE"}</span></div></div>
    <div className="mt-2 flex items-center justify-center gap-3"><button onClick={mediaPrevious} className="rounded-full p-2 text-[#8888AA] transition hover:bg-[#2A2B3C] hover:text-[#EEE] active:scale-90" title="Previous"><SkipBackIcon /></button><button onClick={mediaPlayPause} className="rounded-full bg-[#8B5CF6] p-2.5 text-[#0E0F16] transition hover:bg-[#A855F7] active:scale-90" title={isPlaying ? "Pause" : "Play"}>{isPlaying ? <PauseIcon /> : <PlayIcon />}</button><button onClick={mediaNext} className="rounded-full p-2 text-[#8888AA] transition hover:bg-[#2A2B3C] hover:text-[#EEE] active:scale-90" title="Next"><SkipForwardIcon /></button></div>
  </motion.section>;
});

export default MediaPlayerWidget;
