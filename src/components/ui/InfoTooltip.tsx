import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const TOOLTIP_WIDTH = 256;
const VIEWPORT_GUTTER = 8;

export function InfoTooltip({ id, label, children, accentClass = "hover:text-cyan-accent focus-visible:text-cyan-accent" }: {
  id: string;
  label: string;
  children: ReactNode;
  accentClass?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: VIEWPORT_GUTTER, bottom: VIEWPORT_GUTTER });

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_GUTTER, rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2),
    );
    setPosition({ left, bottom: window.innerHeight - rect.top + VIEWPORT_GUTTER });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => { updatePosition(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => { updatePosition(); setOpen(true); }}
        onBlur={() => setOpen(false)}
        className={`rounded-full text-slate-500 outline-none transition-colors ${accentClass}`}
      >
        <Info size={13} />
      </button>
      {open && createPortal(
        <span id={id} role="tooltip" className="pointer-events-none fixed z-[1000] w-64 rounded-md border border-cyan-accent/25 bg-[#11131c] p-2 text-left text-[9px] normal-case leading-relaxed text-slate-300 shadow-xl" style={position}>
          {children}
        </span>,
        document.body,
      )}
    </>
  );
}
