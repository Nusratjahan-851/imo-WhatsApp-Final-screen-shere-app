import React, { useState, useEffect } from 'react';
import { UserProfile, Translations } from '../types';
import { TopBar } from './TopBar';
import { Avatar } from './Avatar';
import { ImoWatermark } from './ImoWatermark';
import { QrCodeView } from './QrCodeView';
import { RefreshCw, ShieldCheck, Clock, Copy, Check } from 'lucide-react';

interface TemporaryQrViewProps {
  profile: UserProfile;
  t: Translations;
  onBack: () => void;
  onShowToast: (msg: string) => void;
}

export const TemporaryQrView: React.FC<TemporaryQrViewProps> = ({
  profile,
  t,
  onBack,
  onShowToast,
}) => {
  const [durationSecs, setDurationSecs] = useState<number>(300); // 5 minutes default
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [tempToken, setTempToken] = useState<string>(() =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto regenerate on expiry
          setTempToken(Math.random().toString(36).substring(2, 10).toUpperCase());
          return durationSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [durationSecs]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setTempToken(Math.random().toString(36).substring(2, 10).toUpperCase());
      setTimeLeft(durationSecs);
      setIsRefreshing(false);
      onShowToast(t.regenerating || 'New temporary code created');
    }, 400);
  };

  const handleCopyLink = () => {
    const link = `https://imo.im/temp/${profile.imoId}?token=${tempToken}`;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    onShowToast(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const tempQrData = `imo://temp?id=${encodeURIComponent(
    profile.imoId
  )}&token=${tempToken}&exp=${Date.now() + timeLeft * 1000}`;

  return (
    <div className="w-full flex-1 flex flex-col items-center animate-fadeIn">
      <TopBar
        title={t.temporaryTitle}
        onBack={onBack}
        showScanButton={false}
      />

      <div className="w-full flex-1 flex flex-col items-center justify-center px-4 py-2 space-y-4">
        {/* Info callout */}
        <div className="w-full max-w-[340px] bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-900 leading-relaxed font-normal">
            {t.temporaryDesc}
          </p>
        </div>

        {/* Temporary Card */}
        <div className="relative w-full max-w-[340px] bg-white rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col items-center select-none">
          <ImoWatermark opacity={0.6} />

          <div className="w-full flex items-center justify-between mb-4 z-10">
            <div className="flex items-center gap-3">
              <Avatar profile={profile} size="sm" />
              <div>
                <span className="text-base font-medium text-slate-900">
                  {profile.name}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {t.expiresIn}: <span className="tabular-nums font-semibold">{formatTime(timeLeft)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Token Badge */}
            <span className="text-[11px] font-mono font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
              #{tempToken}
            </span>
          </div>

          {/* QR Code */}
          <div className="my-2 p-2 bg-white rounded-2xl flex items-center justify-center z-10 relative">
            <QrCodeView
              value={tempQrData}
              size={210}
              fgColor="#1E293B"
            />
          </div>

          {/* Time progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-3 z-10">
            <div
              className="bg-blue-600 h-full transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(timeLeft / durationSecs) * 100}%` }}
            />
          </div>

          <p className="text-xs text-slate-400 text-center z-10">
            {t.scanToAdd}
          </p>
        </div>

        {/* Controls */}
        <div className="w-full max-w-[340px] flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex-1 h-12 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>{t.regenerate}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="h-12 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            title="Copy temporary link"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-600" />
            )}
            <span className="hidden sm:inline text-xs">{t.copyLink}</span>
          </button>
        </div>

        {/* Duration selector */}
        <div className="w-full max-w-[340px] bg-slate-100/80 p-1 rounded-xl flex items-center justify-between text-xs">
          {[
            { label: '5 min', secs: 300 },
            { label: '15 min', secs: 900 },
            { label: '1 hour', secs: 3600 },
            { label: '24 hours', secs: 86400 },
          ].map((d) => (
            <button
              key={d.secs}
              onClick={() => {
                setDurationSecs(d.secs);
                setTimeLeft(d.secs);
              }}
              className={`flex-1 py-1.5 font-medium rounded-lg transition-all ${
                durationSecs === d.secs
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
