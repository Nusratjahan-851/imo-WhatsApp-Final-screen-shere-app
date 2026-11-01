import React from 'react';
import {
  X,
  Volume2,
  Edit3,
  RotateCcw,
  SunMoon,
  Type,
  Bell,
  BellOff,
  HelpCircle,
  Smartphone,
  Globe,
} from 'lucide-react';
import { AccessibilitySettings } from '../types';
import { soundFx } from '../utils/audio';

interface OptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AccessibilitySettings;
  onUpdateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  onOpenCustomize: () => void;
  onResetDefault: () => void;
  onOpenLearnMore: () => void;
  onSpeak: () => void;
}

export const OptionsMenu: React.FC<OptionsMenuProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenCustomize,
  onResetDefault,
  onOpenLearnMore,
  onSpeak,
}) => {
  const isBangla = settings.lang === 'bn';

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isBangla ? 'মেনু ও সেটিংস' : 'Options & Settings'}
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-xs p-3 animate-in fade-in duration-100"
    >
      <div className="w-full max-w-xs mt-12 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-150 dark:border-zinc-800 p-3 select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-100 dark:border-zinc-800">
          <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-wider">
            {isBangla ? 'অপশন ও সেটিংস' : 'Menu & Options'}
          </span>
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            aria-label={isBangla ? 'বন্ধ করুন' : 'Close'}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu items */}
        <div className="flex flex-col gap-1 text-xs">
          {/* Voice Narration */}
          <button
            onClick={() => {
              soundFx.playTap();
              onSpeak();
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-[#008069] transition-colors text-left"
          >
            <Volume2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{isBangla ? 'ভয়েস বর্ণনা শুনুন' : 'Play Voice Narration'}</span>
          </button>

          {/* Customize Profile */}
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
              onOpenCustomize();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <Edit3 className="w-4 h-4 text-gray-500" />
            <span>{isBangla ? 'প্রোফাইল পরিবর্তন করুন' : 'Customize Profile & QR'}</span>
          </button>

          {/* Reset to Original Default */}
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
              onResetDefault();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
            <span>{isBangla ? 'আসলটিতে রিসেট করুন (mst laboni)' : 'Reset to Mst Laboni'}</span>
          </button>

          <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />

          {/* High Contrast Mode Toggle */}
          <button
            onClick={() => {
              soundFx.playTap();
              const nextTheme =
                settings.theme === 'standard'
                  ? 'high-contrast-yellow'
                  : settings.theme === 'high-contrast-yellow'
                  ? 'high-contrast-dark'
                  : 'standard';
              onUpdateSettings({ theme: nextTheme });
            }}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <span className="flex items-center gap-2.5">
              <SunMoon className="w-4 h-4 text-amber-500" />
              <span>{isBangla ? 'উচ্চ বৈসাদৃশ্য থিম' : 'High Contrast Theme'}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">
              {settings.theme === 'standard' ? 'Normal' : settings.theme === 'high-contrast-yellow' ? 'Yellow' : 'Dark'}
            </span>
          </button>

          {/* Large Font Size Toggle */}
          <button
            onClick={() => {
              soundFx.playTap();
              onUpdateSettings({ largeFont: !settings.largeFont });
            }}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <span className="flex items-center gap-2.5">
              <Type className="w-4 h-4 text-indigo-500" />
              <span>{isBangla ? 'বড় ফন্ট মোড' : 'Large Font Mode'}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">
              {settings.largeFont ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Sound Effects Toggle */}
          <button
            onClick={() => {
              soundFx.playTap();
              onUpdateSettings({ soundEnabled: !settings.soundEnabled });
            }}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <span className="flex items-center gap-2.5">
              {settings.soundEnabled ? <Bell className="w-4 h-4 text-emerald-500" /> : <BellOff className="w-4 h-4 text-gray-400" />}
              <span>{isBangla ? 'শব্দ সংকেত (Audio Beeper)' : 'Sound Feedback'}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">
              {settings.soundEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />

          {/* Learn More & Help */}
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
              onOpenLearnMore();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <HelpCircle className="w-4 h-4 text-[#008069]" />
            <span>{isBangla ? 'ব্যবহার নির্দেশিকা ও শর্টকাট' : 'How to Use & Shortcuts'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
