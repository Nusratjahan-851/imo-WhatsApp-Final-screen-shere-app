import React from 'react';
import { ChevronRight } from 'lucide-react';

interface TemporaryQrButtonProps {
  label: string;
  onClick: () => void;
}

export const TemporaryQrButton: React.FC<TemporaryQrButtonProps> = ({
  label,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="w-full max-w-[342px] h-[64px] px-5 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.025)] border border-slate-100/60 flex items-center justify-between hover:bg-slate-50/60 active:scale-[0.99] transition-all cursor-pointer group select-none text-left"
    >
      <div className="flex items-center gap-3.5">
        {/* Blue Stopwatch Icon from screenshot */}
        <div className="w-6 h-6 flex items-center justify-center text-[#0284C7] shrink-0">
          <svg
            className="w-5.5 h-5.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Clock body */}
            <circle cx="12" cy="13" r="8" />
            {/* Top stem */}
            <path d="M12 2v3" />
            <path d="M10 2h4" />
            {/* Hand */}
            <path d="M12 13l3-3" />
            {/* Radial ticks on perimeter */}
            <path d="M19 13a7 7 0 0 0-7-7" strokeDasharray="1.5 2.5" />
          </svg>
        </div>

        <span className="text-[15.5px] font-normal text-slate-800 tracking-tight">
          {label}
        </span>
      </div>

      <ChevronRight className="w-5 h-5 text-slate-300 stroke-[2] group-hover:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
};
