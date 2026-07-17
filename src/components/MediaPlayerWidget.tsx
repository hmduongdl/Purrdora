import { memo } from "react";
import { motion } from "framer-motion";
import { useSystemStore } from "../store/useSystemStore";

/* ── Inline SVG icons (Lucide-style, 20x20) ── */

function SkipBackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

function MusicPlaceholder() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[#3A3B4C]"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/* ── Component ── */

const MediaPlayerWidget = memo(function MediaPlayerWidget() {
  const media = useSystemStore((s) => s.media);
  const mediaPlayPause = useSystemStore((s) => s.mediaPlayPause);
  const mediaNext = useSystemStore((s) => s.mediaNext);
  const mediaPrevious = useSystemStore((s) => s.mediaPrevious);

  if (!media) {
    return (
      <motion.section layout className="rounded border border-[#2A2B3C] bg-[#12131C] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888AA] mb-2">
          Now Playing
        </h2>
        <p className="text-xs text-[#555577]">No media player detected...</p>
      </motion.section>
    );
  }

  const isPlaying = media.playback_status === "Playing";
  const hasArt = media.art_url.length > 0;

  return (
    <motion.section layout className="rounded border border-[#2A2B3C] bg-[#12131C] p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888AA] mb-3">
        Now Playing
      </h2>

      {/* ── Album Art + Track Info ── */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-16 h-16 min-w-[4rem] rounded-lg overflow-hidden bg-[#1A1B2C] flex items-center justify-center"
          style={{
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          }}
        >
          {hasArt ? (
            <img
              src={media.art_url}
              alt={media.title || "Album art"}
              className="w-full h-full object-cover"
            />
          ) : (
            <MusicPlaceholder />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#EEE] truncate">
            {media.title || "Unknown Title"}
          </p>
          <p className="text-xs text-[#8888AA] truncate mt-0.5">
            {media.artist || "Unknown Artist"}
          </p>
          {media.album && (
            <p className="text-[10px] text-[#555577] truncate mt-0.5">
              {media.album}
            </p>
          )}
        </div>
      </div>

      {/* ── Status Indicator ── */}
      <div className="flex items-center gap-1.5 mb-3">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
            isPlaying ? "bg-[#00FF88] animate-pulse" : "bg-[#FFD700]"
          }`}
        />
        <span className="text-[10px] text-[#555577] uppercase tracking-wider">
          {isPlaying ? "Playing" : media.playback_status}
        </span>
        <span className="text-[10px] text-[#3A3B4C] ml-auto truncate max-w-[120px]">
          {media.player_name.replace("org.mpris.MediaPlayer2.", "")}
        </span>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={mediaPrevious}
          className="p-2 rounded-full text-[#8888AA] hover:text-[#EEE] hover:bg-[#2A2B3C] transition-colors duration-150 active:scale-90"
          title="Previous"
        >
          <SkipBackIcon />
        </button>

        <button
          onClick={mediaPlayPause}
          className="p-3 rounded-full bg-[#00F0FF] text-[#12131C] hover:bg-[#00D0DD] transition-colors duration-150 active:scale-90"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          onClick={mediaNext}
          className="p-2 rounded-full text-[#8888AA] hover:text-[#EEE] hover:bg-[#2A2B3C] transition-colors duration-150 active:scale-90"
          title="Next"
        >
          <SkipForwardIcon />
        </button>
      </div>
    </motion.section>
  );
});

export default MediaPlayerWidget;
