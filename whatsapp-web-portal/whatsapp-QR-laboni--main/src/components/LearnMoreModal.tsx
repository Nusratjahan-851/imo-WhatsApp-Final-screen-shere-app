import React from 'react';
import { X, Heart, Smartphone, ShieldCheck, CheckCircle2, BookmarkPlus } from 'lucide-react';
import { AccessibilitySettings } from '../types';
import { soundFx } from '../utils/audio';

interface LearnMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AccessibilitySettings;
}

export const LearnMoreModal: React.FC<LearnMoreModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const isBangla = settings.lang === 'bn';

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="learn-more-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[#008069] dark:text-emerald-400">
              <Heart className="w-4 h-4 fill-emerald-500 text-emerald-500" />
            </div>
            <h3 id="learn-more-title" className="text-base font-bold text-gray-900 dark:text-white">
              {isBangla ? 'কিউআর কোড ও উদ্যোগ সম্পর্কে' : 'About This Accessible QR'}
            </h3>
          </div>
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 mt-4 text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
          {/* Mission Note */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200">
            <h4 className="font-bold text-sm mb-1 flex items-center gap-1.5">
              <span>আলহামদুলিল্লাহ — সহজ কিউআর সমাধান</span>
            </h4>
            <p className="text-xs leading-normal">
              {isBangla
                ? 'আমাদের দৃষ্টি প্রতিবন্ধী ভাই ও বোনদের হোয়াটসঅ্যাপে নিজের কিউআর কোড বের করতে অনেকগুলো মেনুতে ঢুকে হয়রানি হতে হয়। এই পেজটি সরাসরি তাদের কিউআর কোড সামনে প্রস্তুত রাখে।'
                : 'Created for visually impaired individuals to access, present, and share their WhatsApp QR code in one simple tap without navigating nested app menus.'}
            </p>
          </div>

          {/* How customers scan */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1.5 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#008069] dark:text-emerald-400" />
              <span>{isBangla ? 'গ্রাহক বা পরিচিতরা কীভাবে স্ক্যান করবেন?' : 'How people scan this code'}</span>
            </h4>
            <ul className="space-y-1.5 pl-6 list-disc text-xs text-gray-600 dark:text-zinc-400">
              <li>
                {isBangla
                  ? 'যেকোনো মোবাইল ফোনের ক্যামেরা বা হোয়াটসঅ্যাপ ক্যামেরা চালু করে কোডটির দিকে ধরলেই চ্যাট শুরু করার অপশন চলে আসবে।'
                  : 'Open any mobile phone camera or WhatsApp camera and point it at the QR code to instantly start chatting.'}
              </li>
              <li>
                {isBangla
                  ? 'একই ফোনে থাকলে "সরাসরি হোয়াটসঅ্যাপে চ্যাট করুন" বাটনে ক্লিক করে সাথে সাথে কথোপকথন শুরু করা যায়।'
                  : 'On the same device, simply tap "Chat on WhatsApp Directly" without needing to scan.'}
              </li>
            </ul>
          </div>

          {/* Add to home screen guide */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1.5 flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-[#008069] dark:text-emerald-400" />
              <span>{isBangla ? 'ফোনের হোম স্ক্রিনে সেভ রাখার নিয়ম' : 'Add to Phone Home Screen'}</span>
            </h4>
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              {isBangla
                ? 'ব্রাউজারের ৩-ডট মেনু থেকে "Add to Home Screen" বা "হোম স্ক্রিনে যোগ করুন" চাপলে ফোনের অ্যাপের মতো একটি আইকন তৈরি হবে। এরপর যেকোনো সময় এক ট্যাপেই কিউআর বের করা যাবে।'
                : 'Tap your browser menu and choose "Add to Home screen" to save this page as a 1-tap accessible app icon on your phone.'}
            </p>
          </div>

          {/* Keyboard shortcuts */}
          <div className="pt-2 border-t border-gray-150 dark:border-zinc-800">
            <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
              {isBangla ? 'সহায়ক কিবোর্ড শর্টকাট' : 'Accessibility Keyboard Shortcuts'}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-gray-150 dark:bg-zinc-800 rounded font-mono text-[10px]">V / Space</kbd>
                <span>{isBangla ? 'ভয়েস শুনুন' : 'Voice Narration'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-gray-150 dark:bg-zinc-800 rounded font-mono text-[10px]">S</kbd>
                <span>{isBangla ? 'কোড শেয়ার' : 'Share code'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-gray-150 dark:bg-zinc-800 rounded font-mono text-[10px]">W</kbd>
                <span>{isBangla ? 'হোয়াটসঅ্যাপ চ্যাট' : 'Direct WhatsApp'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-gray-150 dark:bg-zinc-800 rounded font-mono text-[10px]">F</kbd>
                <span>{isBangla ? 'ফুলস্ক্রিন জুম' : 'Fullscreen'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => {
            soundFx.playTap();
            onClose();
          }}
          className="mt-6 w-full py-2.5 rounded-full bg-[#008069] hover:bg-[#00705c] text-white font-medium text-xs shadow-xs"
        >
          {isBangla ? 'বুঝেছি / ধন্যবাদ' : 'Understood'}
        </button>
      </div>
    </div>
  );
};
