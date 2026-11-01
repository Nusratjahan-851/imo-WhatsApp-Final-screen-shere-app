import React, { useState } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { X, Share2, Copy, Download, MessageCircle, Check, Image as ImageIcon } from 'lucide-react';
import { ProfileData, AccessibilitySettings } from '../types';
import { soundFx } from '../utils/audio';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileData;
  settings: AccessibilitySettings;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  profile,
  settings,
}) => {
  const [copied, setCopied] = useState(false);
  const isBangla = settings.lang === 'bn';

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    soundFx.playTap();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.name} - WhatsApp QR Code`,
          text: isBangla
            ? `আমার সাথে হোয়াটসঅ্যাপে সরাসরি যোগাযোগ করতে এই লিংকে ক্লিক করুন বা কিউআর কোডটি স্ক্যান করুন: ${profile.name}`
            : `Scan my WhatsApp QR code or click to chat with ${profile.name}:`,
          url: profile.phoneOrLink,
        });
        soundFx.playSuccess();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      } catch {
        // User cancelled or unsupported
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = async () => {
    soundFx.playTap();
    try {
      await navigator.clipboard.writeText(profile.phoneOrLink);
      setCopied(true);
      soundFx.playSuccess();
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleDownloadOriginalImage = () => {
    soundFx.playTap();
    const link = document.createElement('a');
    link.href = profile.originalImagePath;
    link.download = 'mst_laboni_whatsapp_qr_original.jpg';
    link.target = '_blank';
    link.click();
    soundFx.playSuccess();
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  const handleDownloadQR = async () => {
    soundFx.playTap();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 700;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 700);

      ctx.fillStyle = '#008069';
      ctx.fillRect(0, 0, 600, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(profile.name, 300, 60);

      ctx.fillStyle = '#667781';
      ctx.font = '20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(profile.subtitle, 300, 150);

      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, profile.phoneOrLink, {
        width: 380,
        margin: 2,
        errorCorrectionLevel: 'H',
      });

      ctx.drawImage(qrCanvas, 110, 180, 380, 380);

      ctx.fillStyle = '#4B5563';
      ctx.font = '18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Scan this code to start a WhatsApp chat', 300, 620);

      const link = document.createElement('a');
      link.download = `${profile.name.replace(/\s+/g, '_')}_whatsapp_qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      soundFx.playSuccess();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[#008069] dark:text-emerald-400">
              <Share2 className="w-4 h-4" />
            </div>
            <h3 id="share-modal-title" className="text-base font-bold text-gray-900 dark:text-white">
              {isBangla ? 'কোড ও ছবি শেয়ার করার উপায়' : 'Share QR Code & Image'}
            </h3>
          </div>
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            aria-label={isBangla ? 'বন্ধ করুন' : 'Close'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action list */}
        <div className="flex flex-col gap-2.5 mt-4">
          {/* Option 1: Native Share */}
          <button
            onClick={handleNativeShare}
            className="w-full py-3 px-4 rounded-xl bg-[#008069] hover:bg-[#00705c] active:bg-[#005e4d] text-white font-medium text-sm flex items-center justify-between shadow-xs transition-all active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5">
              <Share2 className="w-4 h-4" />
              <span>{isBangla ? 'যেকোনো অ্যাপে সরাসরি শেয়ার করুন' : 'Share to apps / contacts'}</span>
            </span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">1-Tap</span>
          </button>

          {/* Option 2: Download the exact original image */}
          <button
            onClick={handleDownloadOriginalImage}
            className="w-full py-3 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-[#008069] dark:text-emerald-300 font-semibold text-sm flex items-center gap-2.5 border border-emerald-200 dark:border-emerald-800 transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>{isBangla ? 'মূল ছবিটি ডাউনলোড করুন (Original)' : 'Download Original Image'}</span>
          </button>

          {/* Option 3: Copy WhatsApp link */}
          <button
            onClick={handleCopy}
            className="w-full py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-800 dark:text-zinc-200 font-medium text-sm flex items-center justify-between border border-gray-200 dark:border-zinc-700 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
              <span>{copied ? (isBangla ? 'কপি সম্পন্ন হয়েছে!' : 'Link copied!') : (isBangla ? 'হোয়াটসঅ্যাপ লিংক কপি করুন' : 'Copy WhatsApp link')}</span>
            </span>
          </button>

          {/* Option 4: Direct WhatsApp Chat */}
          <a
            href={profile.phoneOrLink.startsWith('http') ? profile.phoneOrLink : `https://wa.me/${profile.phoneOrLink.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundFx.playSuccess()}
            className="w-full py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 text-[#008069] dark:text-emerald-300 font-medium text-sm flex items-center gap-2.5 border border-gray-200 dark:border-zinc-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{isBangla ? 'সরাসরি হোয়াটসঅ্যাপে চ্যাট শুরু করুন' : 'Open WhatsApp Chat Now'}</span>
          </a>
        </div>

        {/* Footer info */}
        <p className="mt-4 text-[11px] text-gray-400 dark:text-zinc-500 text-center">
          {isBangla
            ? 'দৃষ্টিপ্রতিবন্ধী ভাই ও বোনদের দেওয়া মূল ছবি সম্পূর্ণ সংরক্ষিত।'
            : 'Original photo provided by visually impaired community is fully preserved.'}
        </p>
      </div>
    </div>
  );
};
