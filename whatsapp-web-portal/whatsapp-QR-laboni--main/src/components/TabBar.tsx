import React from 'react';
import { soundFx } from '../utils/audio';

interface TabBarProps {
  activeTab: 'my-code' | 'scan-code';
  onChangeTab: (tab: 'my-code' | 'scan-code') => void;
  lang: 'bn' | 'en';
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onChangeTab, lang }) => {
  const isBangla = lang === 'bn';

  return (
    <nav
      role="tablist"
      aria-label={isBangla ? 'কিউআর কোড ট্যাবসমূহ' : 'QR Code Tabs'}
      className="w-full bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800"
    >
      <div className="max-w-md mx-auto grid grid-cols-2">
        {/* MY CODE TAB */}
        <button
          role="tab"
          id="tab-my-code"
          aria-selected={activeTab === 'my-code'}
          aria-controls="panel-my-code"
          onClick={() => {
            soundFx.playTap();
            onChangeTab('my-code');
          }}
          className={`relative py-3.5 px-4 text-center font-bold tracking-wider text-sm transition-colors focus-visible:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-zinc-800 ${
            activeTab === 'my-code'
              ? 'text-[#008069] dark:text-emerald-400'
              : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <span>{isBangla ? 'আমার কোড' : 'MY CODE'}</span>
          {activeTab === 'my-code' && (
            <span
              className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-[#008069] dark:bg-emerald-400 rounded-t-sm"
              aria-hidden="true"
            />
          )}
        </button>

        {/* SCAN CODE TAB */}
        <a
          href="https://wa.me/settings/linked_devices"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            soundFx.playTap();
          }}
          className="relative py-3.5 px-4 text-center font-bold tracking-wider text-sm transition-colors text-gray-500 hover:text-[#008069] dark:text-zinc-400 dark:hover:text-emerald-400 flex items-center justify-center cursor-pointer"
          aria-label={isBangla ? 'হোয়াটসঅ্যাপ লিংকড ডিভাইস স্ক্যানার খুলুন' : 'Open WhatsApp Scanner'}
        >
          <span>{isBangla ? 'কোড স্ক্যান' : 'SCAN CODE'}</span>
        </a>
      </div>
    </nav>
  );
};
