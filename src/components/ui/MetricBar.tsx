interface MetricBarProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  colorClass: string;
}

function formatValue(value: number, unit: string) {
  if (unit === "%") return value.toFixed(0);
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function MetricBar({ label, value, max, unit, colorClass }: MetricBarProps) {
  const safeValue = Math.max(0, value);
  const percentage = max > 0 ? Math.min(100, (safeValue / max) * 100) : 0;

  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 text-[10px]">
      <span className="truncate uppercase text-[#777797]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#202131]">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="min-w-[42px] text-right font-mono text-[#D9D9EA]">
        {formatValue(safeValue, unit)}{unit}
      </span>
    </div>
  );
}
