import { memo, type ReactNode } from "react";

interface WidgetFactoryProps {
  title: string;
  children: ReactNode;
}

export const WidgetFactory = memo(function WidgetFactory({ title, children }: WidgetFactoryProps) {
  return (
    <div className="mac-glass p-3 flex flex-col gap-2 min-h-[180px]">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#8888AA]">
        {title}
      </h3>
      <div className="flex-1">{children}</div>
    </div>
  );
});
