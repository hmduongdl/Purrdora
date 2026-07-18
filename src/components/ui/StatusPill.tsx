import { Badge } from "./badge";

interface StatusPillProps {
  label: string;
  active: boolean;
}

export function StatusPill({ label, active }: StatusPillProps) {
  return (
    <Badge
      variant="outline"
      className={active
        ? "border-[#8B5CF6]/45 bg-[#8B5CF6]/15 text-[#DDD6FE] shadow-[0_0_8px_rgba(139,92,246,0.16)]"
        : "border-[#3A3B4C] bg-[#1A1B26] text-[#8888AA]"}
    >
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${active ? "bg-[#A855F7]" : "bg-[#666688]"}`} />
      {label}
    </Badge>
  );
}
