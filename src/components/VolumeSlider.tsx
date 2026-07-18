import { useRef, useCallback, useState, useEffect, memo } from "react";
import { StatusPill } from "./ui/StatusPill";

/* ── Speaker icon SVGs (matching macOS Control Center style) ── */

function SpeakerOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function SpeakerLow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function SpeakerHigh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 010 14.14" />
      <path d="M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

/* ── VolumeSlider ── */

interface VolumeSliderProps {
  value: number; // 0–100
  deviceId: number;
  isMuted: boolean;
  onVolumeChange: (deviceId: number, volume: number) => void; // already debounced
  onMuteToggle: (deviceId: number) => void;
}

export const VolumeSlider = memo(function VolumeSlider({
  value,
  deviceId,
  isMuted,
  onVolumeChange,
  onMuteToggle,
}: VolumeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // sync external value changes when not dragging
  useEffect(() => {
    if (!isDragging) setLocalValue(value);
  }, [value, isDragging]);

  const computeVolume = useCallback((clientY: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (rect.bottom - clientY) / rect.height;
    return Math.round(Math.max(0, Math.min(100, ratio * 100)));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      const vol = computeVolume(e.clientY);
      setLocalValue(vol);
      onVolumeChange(deviceId, vol);
    },
    [deviceId, computeVolume, onVolumeChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const vol = computeVolume(e.clientY);
      setLocalValue(vol);
      onVolumeChange(deviceId, vol);
    },
    [isDragging, deviceId, computeVolume, onVolumeChange],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const displayVolume = isMuted ? 0 : localValue;
  const fillHeight = `${displayVolume}%`;

  const trackBg = "rgba(255, 255, 255, 0.12)";
  const trackFill = isMuted ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.85)";

  return (
    <div className="flex flex-col items-center gap-2 select-none touch-none">
      {/* High volume icon */}
      <button
        type="button"
        onClick={() => onMuteToggle(deviceId)}
        className="text-[#AAAACC] hover:text-white transition-colors cursor-pointer leading-none p-0.5"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <SpeakerOff /> : localValue > 50 ? <SpeakerHigh /> : <SpeakerLow />}
      </button>
      <StatusPill label={isMuted ? "Muted" : "Unmuted"} active={!isMuted} />

      {/* Slider track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative cursor-pointer"
        style={{
          width: 24,
          height: 88,
          borderRadius: 12,
          background: trackBg,
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(localValue)}
        aria-label="Volume"
        tabIndex={0}
      >
        {/* Filled portion */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-75 ease-linear"
          style={{
            height: fillHeight,
            borderRadius: 12,
            background: trackFill,
          }}
        />

        {/* Thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 transition-[bottom] duration-75 ease-linear"
          style={{
            bottom: `calc(${fillHeight} - 8px)`,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: isDragging
              ? "0 0 0 3px rgba(255,255,255,0.2), 0 1px 4px rgba(0,0,0,0.3)"
              : "0 0.5px 2px rgba(0,0,0,0.25)",
            transform: `translateX(-50%) scale(${isDragging ? 1.15 : 1})`,
          }}
        />
      </div>
    </div>
  );
});
