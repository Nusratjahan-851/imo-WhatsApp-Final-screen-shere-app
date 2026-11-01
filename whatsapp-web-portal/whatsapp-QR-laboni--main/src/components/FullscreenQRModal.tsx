import React, { useEffect } from 'react';
import { X, Sun, Volume2, Download } from 'lucide-react';
import { ProfileData, AccessibilitySettings } from '../types';
import { soundFx } from '../utils/audio';

interface FullscreenQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileData;
  settings: AccessibilitySettings;
  onSpeak: () => void;
}

export const FullscreenQRModal: React.FC<FullscreenQRModalProps> = ({
  isOpen,
  onClose,
  profile,
  settings,
  onSpeak,
}) => {
  const isBangla = settings.lang === 'bn';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isBangla ? 'পূর্ণ পর্দায় মূল ছবি ও কিউআর কোড' : 'Fullscreen Original QR Image'}
      className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-150 select-none overflow-y-auto"
    >
      {/* Top action row */}
      <div className="w-full max-w-lg flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            {isBangla ? 'মূল ছবি (সর্বোচ্চ জুম)' : 'Original Image (Max Zoom)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundFx.playTap();
              onSpeak();
            }}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-colors"
            title={isBangla ? 'অডিও শুনুন' : 'Listen audio'}
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            aria-label={isBangla ? 'বন্ধ করুন' : 'Close fullscreen'}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Center Original Image Display */}
      <div className="flex flex-col items-center my-auto py-4 max-w-md w-full text-center">
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-white">
          <img
            src={profile.originalImagePath}
            alt={profile.name}
            className="w-full max-h-[70vh] object-contain block mx-auto"
          />
        </div>

        <p className="text-xs sm:text-sm font-semibold text-zinc-300 mt-4">
          {isBangla
            ? 'দৃষ্টিপ্রতিবন্ধী ভাই ও বোনদের দেওয়া আসল ছবি সরাসরি বড় পর্দায় প্রদর্শিত হচ্ছে'
            : 'Exact original image provided by visually impaired community displayed at full resolution'}
        </p>
      </div>

      {/* Bottom Dismiss */}
      <button
        onClick={() => {
          soundFx.playTap();
          onClose();
        }}
        className="w-full max-w-md py-3 rounded-full bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 transition-colors active:scale-98 mb-2"
      >
        {isBangla ? 'পর্দা বন্ধ করুন (Close)' : 'Close Fullscreen'}
      </button>
    </div>
  );
};
