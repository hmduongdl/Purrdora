import { memo } from "react";

interface TrafficLightsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
}

const TrafficLights = memo(function TrafficLights({ onClose, onMinimize, onToggleMaximize }: TrafficLightsProps) {
  return (
    <div className="flex items-center gap-2 px-3 h-full">
      <button
        onClick={onClose}
        className="group w-3.5 h-3.5 rounded-full bg-[#FF5555] flex items-center justify-center transition-colors hover:bg-[#FF3333]"
        title="Close"
      >
        <svg className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 8 8">
          <path d="M1 1l6 6M7 1L1 7" stroke="#4A0000" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      <button
        onClick={onMinimize}
        className="group w-3.5 h-3.5 rounded-full bg-[#FFD700] flex items-center justify-center transition-colors hover:bg-[#FFC000]"
        title="Minimize"
      >
        <svg className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 8 8">
          <path d="M1.5 4h5" stroke="#5A4A00" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      <button
        onClick={onToggleMaximize}
        className="group w-3.5 h-3.5 rounded-full bg-[#00FF88] flex items-center justify-center transition-colors hover:bg-[#00CC66]"
        title="Maximize"
      >
        <svg className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 8 8">
          <path d="M1.5 1.5h5v5h-5zM2.5 1L1 2.5M5.5 7L7 5.5" stroke="#003300" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
});

export default TrafficLights;
