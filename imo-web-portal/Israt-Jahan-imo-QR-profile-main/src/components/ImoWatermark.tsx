import React from 'react';

interface ImoWatermarkProps {
  className?: string;
  opacity?: number;
}

export const ImoWatermark: React.FC<ImoWatermarkProps> = ({
  className = '',
  opacity = 0.4,
}) => {
  return (
    <div
      className={`pointer-events-none select-none absolute -top-1 -right-1 overflow-hidden ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg
        width="160"
        height="140"
        viewBox="0 0 160 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft rounded imo speech bubble with tail pointing bottom-left */}
        <path
          d="M140 10C155 10 165 20 165 38V82C165 100 152 112 134 112H100L78 132C74 135 70 133 70 128V112H58C40 112 28 100 28 82V38C28 20 40 10 58 10H140Z"
          fill="#E5EAEF"
        />
        {/* imo text inside */}
        <text
          x="96"
          y="74"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#D3DDE5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="900"
          fontSize="44"
          letterSpacing="-2px"
        >
          imo
        </text>
      </svg>
    </div>
  );
};
