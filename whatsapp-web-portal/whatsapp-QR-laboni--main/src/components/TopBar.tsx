import React, { useState } from 'react';
import { ArrowLeft, MoreVertical, Volume2, VolumeX, Eye, Globe, Sparkles } from 'lucide-react';
import { AccessibilitySettings } from '../types';
import { soundFx } from '../utils/audio';

interface TopBarProps {
  settings: AccessibilitySettings;
  onUpdateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  onOpenMenu: () => void;
  onSpeak: () => void;
  isSpeaking: boolean;
  onBack?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  settings,
  onUpdateSettings,
  onOpenMenu,
  onSpeak,
  isSpeaking,
  onBack,
}) => {
  const isBangla = settings.lang === 'bn';

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 w-full bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <div className="max-w-md mx-auto flex items-center justify-between h-14 px-3 sm:px-4">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              soundFx.playTap();
              if (onBack) onBack();
            }}
            aria-label={isBangla ? 'পেছনে যান বা হোম ভিউ' : 'Go back to home'}
            className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-100 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
          </button>
          <h1
            tabIndex={0}
            className="text-[19px] font-semibold text-gray-900 dark:text-white tracking-tight truncate select-none"
          >
            {isBangla ? 'শর্ট লিংক কিউআর' : 'Short link QR'}
          </h1>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Quick Audio Narration for Visually Impaired */}
          <button
            onClick={() => {
              soundFx.playTap();
              onSpeak();
            }}
            aria-label={
              isSpeaking
                ? (isBangla ? 'অডিও বর্ণনা থামান' : 'Stop voice narration')
                : (isBangla ? 'অডিও বর্ণনা শুনুন' : 'Listen to voice narration')
            }
            title={isBangla ? 'অডিও শুনুন' : 'Listen voice guidance'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              isSpeaking
                ? 'bg-emerald-600 text-white animate-pulse shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline font-semibold">{isBangla ? 'থামান' : 'Stop'}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="font-semibold">{isBangla ? 'শুনুন' : 'Listen'}</span>
              </>
            )}
          </button>

          {/* Language Switch */}
          <button
            onClick={() => {
              soundFx.playTap();
              const nextLang = isBangla ? 'en' : 'bn';
              onUpdateSettings({ lang: nextLang });
            }}
            aria-label={isBangla ? 'Switch to English' : 'বাংলা ভাষায় দেখুন'}
            title={isBangla ? 'Switch to English' : 'বাংলা'}
            className="h-9 px-2 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-gray-500" />
            <span>{isBangla ? 'EN' : 'বাং'}</span>
          </button>

          {/* Three dots menu */}
          <button
            onClick={() => {
              soundFx.playTap();
              onOpenMenu();
            }}
            aria-label={isBangla ? 'আরও অপশন ও সেটিংস' : 'More options and settings'}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-100 transition-colors active:scale-95"
          >
            <MoreVertical className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </header>
  );
};
