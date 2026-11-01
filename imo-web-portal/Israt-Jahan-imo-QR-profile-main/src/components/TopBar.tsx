import React from 'react';

interface TopBarProps {
  title: string;
  onBack?: () => void;
  onScanClick?: () => void;
  scanUrl?: string;
  showScanButton?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onScanClick,
  scanUrl = 'https://imo.onelink.me/1MBm?qr-login-info=qr.nWgecayCFrMq5063&af_dp=imo%3A%2F%2Fqr_code_device',
  showScanButton = true,
}) => {
  return (
    <header className="w-full h-14 px-5 flex items-center justify-between z-20 shrink-0 select-none">
      <div className="flex items-center">
        <h1 className="text-[19px] font-medium tracking-tight text-slate-900">
          {title}
        </h1>
      </div>

      {showScanButton && (
        <a
          href={scanUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (onScanClick) {
              onScanClick();
            }
          }}
          className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-slate-900 active:bg-slate-200/50 transition-colors cursor-pointer"
          title="Scan QR Code"
          aria-label="Scan QR Code"
        >
          {/* Custom viewfinder icon matching imo */}
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Top-left corner */}
            <path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4H8.5" />
            {/* Top-right corner */}
            <path d="M15.5 4H18.5A1.5 1.5 0 0 1 20 5.5V8.5" />
            {/* Bottom-left corner */}
            <path d="M4 15.5V18.5A1.5 1.5 0 0 0 5.5 20H8.5" />
            {/* Bottom-right corner */}
            <path d="M15.5 20H18.5A1.5 1.5 0 0 0 20 18.5V15.5" />
            {/* Center horizontal scan line */}
            <line x1="6.5" y1="12" x2="17.5" y2="12" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        </a>
      )}
    </header>
  );
};
