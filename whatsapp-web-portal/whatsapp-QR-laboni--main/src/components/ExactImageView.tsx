import React, { useState } from 'react';
import {
  Share2,
  MessageCircle,
  Copy,
  Check,
  Maximize2,
  Volume2,
  VolumeX,
  Camera,
} from 'lucide-react';
import { ProfileData, AccessibilitySettings } from '../types';
import { soundFx } from '../utils/audio';

interface ExactImageViewProps {
  imageSrc: string;
  profile: ProfileData;
  settings: AccessibilitySettings;
  onOpenShare: () => void;
  onOpenFullscreen: () => void;
  onOpenLearnMore: () => void;
  onSwitchToScan: () => void;
  onOpenMenu: () => void;
  onSpeak: () => void;
  isSpeaking: boolean;
}

export const ExactImageView: React.FC<ExactImageViewProps> = ({
  imageSrc,
  profile,
  settings,
  onOpenShare,
  onOpenFullscreen,
  onOpenLearnMore,
  onSwitchToScan,
  onOpenMenu,
  onSpeak,
  isSpeaking,
}) => {
  const [copied, setCopied] = useState(false);
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
    } catch {}
  };

  const handleDirectWhatsApp = () => {
    soundFx.playTap();
    let url = profile.phoneOrLink;
    if (!url.startsWith('http')) {
      const cleanNum = url.replace(/[^0-9]/g, '');
      url = `https://wa.me/${cleanNum}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full flex flex-col items-center select-none pb-6">
      {/* Top Accessibility Bar for Visually Impaired Brothers & Sisters */}
      <div className="w-full max-w-[420px] px-3 py-2 bg-[#008069] text-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          <span className="text-xs font-semibold tracking-tight">
            {isBangla ? 'মূল ছবি ভিউ (অ্যাক্সেসিবল)' : 'Original Image View'}
          </span>
        </div>

        {/* Audio narration button */}
        <button
          onClick={() => {
            soundFx.playTap();
            onSpeak();
          }}
          aria-label={isBangla ? 'অডিও বর্ণনা শুনুন' : 'Listen voice description'}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            isSpeaking
              ? 'bg-white text-emerald-900 animate-bounce'
              : 'bg-[#005e4d] hover:bg-[#004f40] text-white border border-emerald-400/40'
          }`}
        >
          {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{isSpeaking ? (isBangla ? 'থামান' : 'Stop') : (isBangla ? '🔊 অডিও শুনুন' : '🔊 Listen')}</span>
        </button>
      </div>

      {/* The EXACT Image Container with Active Interactive Hotspots */}
      <div className="relative w-full max-w-[420px] bg-white shadow-xl overflow-hidden">
        {/* THE EXACT USER-UPLOADED IMAGE */}
        <img
          src={imageSrc}
          alt={
            isBangla
              ? 'মোসাম্মৎ লাবনী এর হোয়াটসঅ্যাপ শর্ট লিংক কিউআর কোড এর মূল ছবি'
              : 'Original WhatsApp Short link QR code image for mst laboni'
          }
          className="w-full h-auto block select-none pointer-events-none"
        />

        {/* --- INTERACTIVE ACCESSIBLE HOTSPOTS DIRECTLY ON THE IMAGE --- */}

        {/* 1. Back button hotspot (Top Left) */}
        <button
          onClick={() => {
            soundFx.playTap();
            if (isSpeaking) {
              onSpeak();
            }
          }}
          aria-label={isBangla ? 'পেছনে যান বা অডিও শুনুন' : 'Go back / Audio announcement'}
          className="absolute top-0 left-0 w-[16%] h-[5%] opacity-0 hover:opacity-20 active:opacity-40 bg-black transition-opacity focus-visible:opacity-30 focus-visible:ring-2 focus-visible:ring-emerald-500"
          title={isBangla ? 'পেছনে' : 'Back'}
        />

        {/* 2. Menu hotspot (Top Right 3 dots) */}
        <button
          onClick={() => {
            soundFx.playTap();
            onOpenMenu();
          }}
          aria-label={isBangla ? 'অপশন ও সেটিংস মেনু' : 'Options & Settings menu'}
          className="absolute top-0 right-0 w-[16%] h-[5%] opacity-0 hover:opacity-20 active:opacity-40 bg-black transition-opacity focus-visible:opacity-30 focus-visible:ring-2 focus-visible:ring-emerald-500"
          title={isBangla ? 'মেনু' : 'Menu'}
        />

        {/* 3. "MY CODE" Tab Hotspot (Active) */}
        <button
          onClick={() => {
            soundFx.playTap();
            soundFx.playSuccess();
          }}
          aria-label={isBangla ? 'আমার কোড ট্যাব (বর্তমানে নির্বাচিত)' : 'My Code tab (active)'}
          className="absolute top-[5%] left-0 w-[50%] h-[5%] opacity-0 hover:opacity-10 active:opacity-20 bg-emerald-500 transition-opacity"
          title={isBangla ? 'আমার কোড' : 'My Code'}
        />

        {/* 4. "SCAN CODE" Tab Hotspot (Switches to camera scanner) */}
        <button
          onClick={() => {
            soundFx.playTap();
            onSwitchToScan();
          }}
          aria-label={isBangla ? 'কোড স্ক্যান ট্যাব (ক্যামেরা চালু করতে চাপুন)' : 'Scan Code tab (Open camera)'}
          className="absolute top-[5%] right-0 w-[50%] h-[5%] opacity-0 hover:opacity-10 active:opacity-30 bg-emerald-600 transition-opacity flex items-center justify-center group"
          title={isBangla ? 'ক্যামেরা স্ক্যানার চালু করুন' : 'Open camera scanner'}
        >
          <span className="opacity-0 group-hover:opacity-100 bg-black/75 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
            {isBangla ? 'ক্যামেরা খুলুন' : 'Open Camera'}
          </span>
        </button>

        {/* 5. QR Code Tap Area (Expands to Fullscreen) */}
        <button
          onClick={() => {
            soundFx.playTap();
            onOpenFullscreen();
          }}
          aria-label={
            isBangla
              ? 'মোসাম্মৎ লাবনী এর কিউআর কোড। পুরো স্ক্রিনে বড় করে দেখতে এখানে চাপুন।'
              : 'QR Code for mst laboni. Click to view in fullscreen high contrast mode.'
          }
          className="absolute top-[46%] left-[28%] w-[44%] h-[26%] opacity-0 hover:opacity-15 active:opacity-25 bg-[#008069] transition-opacity cursor-pointer group rounded-lg"
          title={isBangla ? 'বড় করে দেখতে ট্যাপ করুন' : 'Tap to enlarge QR'}
        >
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
            {isBangla ? '🔍 বড় করে দেখুন' : '🔍 Tap to enlarge'}
          </span>
        </button>

        {/* 6. "Learn more" Hotspot inside the text */}
        <button
          onClick={() => {
            soundFx.playTap();
            onOpenLearnMore();
          }}
          aria-label={isBangla ? 'আরও জানুন ও ব্যবহারের নির্দেশিকা' : 'Learn more about this QR code'}
          className="absolute top-[80%] left-[40%] w-[20%] h-[4%] opacity-0 hover:opacity-20 active:opacity-30 bg-emerald-600 transition-opacity rounded cursor-pointer"
          title={isBangla ? 'আরও জানুন' : 'Learn more'}
        />

        {/* 7. "Share code" Button Hotspot (Directly over the green pill button) */}
        <button
          onClick={() => {
            soundFx.playTap();
            onOpenShare();
          }}
          aria-label={isBangla ? 'কোড শেয়ার করুন (Share code)' : 'Share code'}
          className="absolute top-[87.5%] left-[33%] w-[34%] h-[6.5%] rounded-full opacity-0 hover:opacity-20 active:opacity-40 bg-white transition-opacity cursor-pointer focus-visible:opacity-30 focus-visible:ring-4 focus-visible:ring-white"
          title={isBangla ? 'কোড শেয়ার করুন' : 'Share code'}
        />
      </div>

      {/* High-Accessibility Action Buttons below the Image */}
      <div className="w-full max-w-[420px] px-4 pt-4 flex flex-col gap-2.5">
        {/* Action 1: Big Accessible "Share Code" button */}
        <button
          onClick={() => {
            soundFx.playTap();
            onOpenShare();
          }}
          className="w-full h-12 rounded-full bg-[#008069] hover:bg-[#00705c] active:bg-[#005e4d] text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#008069]/20 transition-all active:scale-[0.98]"
        >
          <Share2 className="w-4 h-4 stroke-[2.5]" />
          <span>{isBangla ? 'ছবি বা কোড শেয়ার করুন' : 'Share Code'}</span>
        </button>

        {/* Action 2: Direct 1-tap WhatsApp Chat (No camera required!) */}
        <button
          onClick={handleDirectWhatsApp}
          className="w-full h-11 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#00604e] font-bold text-xs flex items-center justify-center gap-2 border border-emerald-300 transition-all active:scale-[0.98]"
        >
          <MessageCircle className="w-4 h-4 fill-emerald-600 text-emerald-600" />
          <span>{isBangla ? 'সরাসরি হোয়াটসঅ্যাপে কথা বলুন (চ্যাট খুলুন)' : 'Chat on WhatsApp Directly'}</span>
        </button>

        {/* Action 3: Accessibility tools row */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
          <button
            onClick={handleCopyLink}
            className="py-2.5 px-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="truncate">{copied ? (isBangla ? 'কপি হয়েছে' : 'Copied') : (isBangla ? 'লিংক কপি' : 'Copy')}</span>
          </button>

          <button
            onClick={() => {
              soundFx.playTap();
              onOpenFullscreen();
            }}
            className="py-2.5 px-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
            <span className="truncate">{isBangla ? 'বড় কিউআর' : 'Fullscreen'}</span>
          </button>

          <button
            onClick={() => {
              soundFx.playTap();
              onSwitchToScan();
            }}
            className="py-2.5 px-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span className="truncate">{isBangla ? 'স্ক্যানার' : 'Scanner'}</span>
          </button>
        </div>

        {/* Helper Note for Visually Impaired */}
        <p className="text-[12px] text-gray-600 dark:text-zinc-400 text-center leading-normal pt-1 px-2">
          {isBangla
            ? 'আমাদের দৃষ্টি প্রতিবন্ধী ভাই ও বোনদের দেওয়া আসল ছবি ব্যবহার করা হয়েছে। ছবিতে ট্যাপ করে অথবা নিচের বাটন দিয়ে সরাসরি শেয়ার ও যোগাযোগ করা যাবে।'
            : 'Original photo provided by visually impaired brothers & sisters is directly displayed with full accessibility.'}
        </p>
      </div>
    </div>
  );
};
