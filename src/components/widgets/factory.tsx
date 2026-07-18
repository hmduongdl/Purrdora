import { memo, type ReactNode } from "react";

interface WidgetFactoryProps {
  title: string;
  children: ReactNode;
}

export const WidgetFactory = memo(function WidgetFactory({ title, children }: WidgetFactoryProps) {
  return (
    <div className="mac-glass h-full p-2 flex flex-col gap-2 min-h-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[#A855F7]">
        {title}
      </h3>
      <div className="flex-1">{children}</div>
    </div>
  );
});

export function StatusPill({ children, tone = "violet" }: { children: ReactNode; tone?: "violet" | "green" | "amber" | "muted" }) {
  const colors = { violet: "border-[#8B5CF6]/35 bg-[#8B5CF6]/10 text-[#C4B5FD]", green: "border-[#22C55E]/35 bg-[#22C55E]/10 text-[#86EFAC]", amber: "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#FCD34D]", muted: "border-[#3A3B4C] bg-[#1A1B26] text-[#777797]" };
  return <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${colors[tone]}`}>{children}</span>;
}
