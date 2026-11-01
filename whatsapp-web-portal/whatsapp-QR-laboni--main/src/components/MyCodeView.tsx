import React, { useState } from 'react';
import { Share2, MessageCircle, Copy, Check, Maximize2, Sparkles, Volume2, Download } from 'lucide-react';
import { ProfileData, AccessibilitySettings } from '../types';
import { QRCodeCanvas } from './QRCodeCanvas';
import { soundFx } from '../utils/audio';

interface MyCodeViewProps {
  profile: ProfileData;
  settings: AccessibilitySettings;
  onOpenShare: () => void;
  onOpenFullscreen: () => void;
  onOpenLearnMore: () => void;
  onSpeak: () => void;
}

export const MyCodeView: React.FC<MyCodeViewProps> = ({
  profile,
  settings,
  onOpenShare,
  onOpenFullscreen,
  onOpenLearnMore,
  onSpeak,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'original' | 'vector'>('original');
  const isBangla = settings.lang === 'bn';

  const handleCopyLink = async () => {
    soundFx.playTap();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(profile.phoneOrLink);
        setCopied(true);
        soundFx.playSuccess();
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handleDirectWhatsApp = () => {
    soundFx.playTap();
    // Direct link to chat with Mst Laboni
    let url = profile.phoneOrLink;
    if (!url.startsWith('http')) {
      const cleanNum = url.replace(/[^0-9]/g, '');
      url = `https://wa.me/${cleanNum}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="tabpanel"
      id="panel-my-code"
      aria-labelledby="tab-my-code"
      className="flex-1 flex flex-col items-center justify-between px-4 pt-8 pb-6 max-w-md mx-auto w-full select-none"
    >
      {/* Top Banner / Mode Switcher for Visually Impaired or helper */}
      <div className="w-full flex items-center justify-between mb-4 px-1 text-xs text-gray-500 dark:text-zinc-400">
        <span className="font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          {isBangla ? 'অফিসিয়াল প্রোফাইল' : 'Verified QR'}
        </span>

        {/* Toggle between original photo and digital vector QR */}
        <div className="flex items-center gap-1 bg-gray-200/70 dark:bg-zinc-800 p-0.5 rounded-lg">
          <button
            onClick={() => {
              soundFx.playTap();
              setViewMode('original');
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              viewMode === 'original'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-zinc-300 hover:text-gray-900'
            }`}
            title={isBangla ? 'আসল ছবি দেখুন' : 'Show original image'}
          >
            {isBangla ? 'মূল ছবি' : 'Original'}
          </button>
          <button
            onClick={() => {
              soundFx.playTap();
              setViewMode('vector');
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              viewMode === 'vector'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-zinc-300 hover:text-gray-900'
            }`}
            title={isBangla ? 'ভেক্টর কিউআর দেখুন' : 'Show HD Vector QR'}
          >
            {isBangla ? 'এইচডি কোড' : 'HD Vector'}
          </button>
        </div>
      </div>

      {/* Main Card with Overlapping Avatar */}
      <div className="w-full max-w-[340px] pt-7 relative my-auto">
        {/* Floating Avatar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
          <div className="w-16 h-16 rounded-full p-[3px] bg-white dark:bg-zinc-900 shadow-md">
            <div className="w-full h-full rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top scale-[1.35] translate-y-[-4%]"
                  onError={(e) => {
                    // Fallback to initial
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-xl font-bold text-emerald-800">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div
          className={`relative bg-white dark:bg-zinc-900 rounded-2xl pt-12 pb-7 px-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-zinc-800 text-center transition-all ${
            settings.theme === 'high-contrast-yellow'
              ? 'bg-black text-yellow-300 border-2 border-yellow-400'
              : ''
          }`}
        >
          {/* User Name */}
          <h2
            className={`text-xl font-semibold tracking-tight text-gray-900 dark:text-white ${
              settings.largeFont ? 'text-2xl' : ''
            }`}
          >
            {profile.name}
          </h2>

          {/* Subtitle */}
          <p
            className={`text-xs text-gray-500 dark:text-zinc-400 mt-1 mb-5 font-normal ${
              settings.largeFont ? 'text-sm' : ''
            }`}
          >
            {profile.subtitle}
          </p>

          {/* QR Code Presentation Container */}
          <div
            onClick={() => {
              soundFx.playTap();
              onOpenFullscreen();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onOpenFullscreen();
              }
            }}
            aria-label={
              isBangla
                ? `${profile.name} এর কিউআর কোড। পুরো স্ক্রিনে দেখতে ক্লিক করুন।`
                : `QR code for ${profile.name}. Click to view fullscreen.`
            }
            className="group relative inline-block p-2 rounded-xl bg-white dark:bg-white cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-emerald-500/40"
          >
            {viewMode === 'original' ? (
              /* Exact crop of the QR code from the user's uploaded image */
              <div className="relative w-[230px] h-[230px] mx-auto overflow-hidden rounded-lg bg-white flex items-center justify-center">
                <img
                  src={profile.originalImagePath}
                  alt={isBangla ? 'হোয়াটসঅ্যাপ কিউআর কোড' : 'WhatsApp QR Code'}
                  referrerPolicy="no-referrer"
                  className="w-[390px] max-w-none h-auto object-cover"
                  style={{
                    // Precision crop to center the QR code from original screenshot
                    transform: 'translateY(-2%) scale(1.18)',
                  }}
                />
              </div>
            ) : (
              /* Vector HD generated QR code with WhatsApp badge */
              <div className="w-[230px] h-[230px] mx-auto flex items-center justify-center bg-white">
                <QRCodeCanvas
                  value={profile.phoneOrLink}
                  size={230}
                  className="rounded-sm"
                />
              </div>
            )}

            {/* Hover Fullscreen indicator badge */}
            <div className="absolute top-3 right-3 bg-black/60 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Click to expand tip */}
          <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500">
            <Maximize2 className="w-3 h-3" />
            <span>{isBangla ? 'বড় করে দেখতে কিউআরে ট্যাপ করুন' : 'Tap QR for full screen'}</span>
          </div>
        </div>
      </div>

      {/* Explanatory text below card (faithful to screenshot) */}
      <div className="text-center mt-5 mb-5 max-w-[320px] px-2">
        <p
          className={`text-[13.5px] leading-relaxed text-gray-600 dark:text-zinc-300 ${
            settings.largeFont ? 'text-[15px]' : ''
          }`}
        >
          {isBangla ? (
            <>
              আপনার গ্রাহকরা আপনার সাথে হোয়াটসঅ্যাপে চ্যাট শুরু করতে এই কোডটি স্ক্যান করতে পারেন।{' '}
              <button
                onClick={() => {
                  soundFx.playTap();
                  onOpenLearnMore();
                }}
                className="font-bold text-[#008069] dark:text-emerald-400 hover:underline cursor-pointer focus-visible:outline-none"
              >
                আরও জানুন
              </button>
            </>
          ) : (
            <>
              Your customers can scan this code to start a WhatsApp chat with you.{' '}
              <button
                onClick={() => {
                  soundFx.playTap();
                  onOpenLearnMore();
                }}
                className="font-bold text-[#008069] dark:text-emerald-400 hover:underline cursor-pointer focus-visible:outline-none"
              >
                Learn more
              </button>
            </>
          )}
        </p>
      </div>

      {/* Primary Action Button: "Share code" (matching screenshot) */}
      <div className="w-full max-w-[320px] flex flex-col gap-2.5">
        <button
          onClick={() => {
            soundFx.playTap();
            onOpenShare();
          }}
          aria-label={isBangla ? 'কিউআর কোড শেয়ার করুন' : 'Share QR code'}
          className="w-full h-12 rounded-full bg-[#008069] hover:bg-[#00705c] active:bg-[#005e4d] text-white font-medium text-[15px] flex items-center justify-center gap-2 shadow-md shadow-[#008069]/20 transition-all active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-[#008069]/40"
        >
          <Share2 className="w-4 h-4 stroke-[2.2]" />
          <span>{isBangla ? 'কোড শেয়ার করুন' : 'Share code'}</span>
        </button>

        {/* Direct Action 2: Chat directly on WhatsApp (Huge help for single-device or visually impaired) */}
        <button
          onClick={handleDirectWhatsApp}
          aria-label={isBangla ? 'সরাসরি হোয়াটসঅ্যাপে কথা বলুন' : 'Open WhatsApp chat directly'}
          className="w-full h-11 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-[#008069] dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2 border border-emerald-200/60 dark:border-emerald-800/50 transition-all active:scale-[0.98]"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{isBangla ? 'সরাসরি হোয়াটসঅ্যাপে চ্যাট করুন' : 'Chat on WhatsApp Directly'}</span>
        </button>

        {/* Quick Accessibility Assistance Bar */}
        <div className="flex items-center justify-center gap-4 pt-1 text-xs text-gray-500 dark:text-zinc-400">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white py-1 px-2 rounded transition-colors"
            title={isBangla ? 'লিংক কপি করুন' : 'Copy link'}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-medium">{isBangla ? 'কপি হয়েছে' : 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{isBangla ? 'লিংক কপি' : 'Copy Link'}</span>
              </>
            )}
          </button>

          <span className="text-gray-300 dark:text-zinc-700">·</span>

          <button
            onClick={() => {
              soundFx.playTap();
              onSpeak();
            }}
            className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white py-1 px-2 rounded transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#008069] dark:text-emerald-400" />
            <span>{isBangla ? 'ভয়েস শুনুন' : 'Voice Guide'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
