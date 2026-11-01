import React, { useState } from 'react';
import { X, User, Phone, Check, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { ProfileData, DEFAULT_PROFILE, AccessibilitySettings } from '../types';
import { soundFx } from '../utils/audio';

interface CustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileData;
  onSaveProfile: (profile: ProfileData) => void;
  settings: AccessibilitySettings;
}

export const CustomizeModal: React.FC<CustomizeModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  settings,
}) => {
  const isBangla = settings.lang === 'bn';
  const [formData, setFormData] = useState<ProfileData>(profile);

  if (!isOpen) return null;

  const handleReset = () => {
    soundFx.playTap();
    setFormData(DEFAULT_PROFILE);
    onSaveProfile(DEFAULT_PROFILE);
    soundFx.playSuccess();
    onClose();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playSuccess();
    onSaveProfile(formData);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customize-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[#008069] dark:text-emerald-400">
              <User className="w-4 h-4" />
            </div>
            <h3 id="customize-title" className="text-base font-bold text-gray-900 dark:text-white">
              {isBangla ? 'প্রোফাইল তথ্য পরিবর্তন' : 'Customize Profile & QR'}
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

        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-3.5 mt-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              {isBangla ? 'নাম (Name)' : 'Name'}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#008069]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              {isBangla ? 'অ্যাকাউন্টের ধরন / পদবি (Subtitle)' : 'Account Subtitle'}
            </label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#008069]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              {isBangla ? 'হোয়াটসঅ্যাপ নম্বর বা লিংক' : 'WhatsApp Number or Link'}
            </label>
            <input
              type="text"
              value={formData.phoneOrLink}
              onChange={(e) => setFormData({ ...formData, phoneOrLink: e.target.value })}
              placeholder="e.g. +8801700000000 or https://wa.me/qr/..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#008069]"
              required
            />
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
              {isBangla
                ? 'আন্তর্জাতিক ফরম্যাটে নম্বর (যেমন +880...) অথবা হোয়াটসঅ্যাপ শর্ট লিংক দিন।'
                : 'Enter phone number with country code (e.g. +880...) or short link.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBangla ? 'আসলটিতে ফিরুন' : 'Reset Original'}</span>
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#008069] hover:bg-[#00705c] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isBangla ? 'সংরক্ষণ করুন' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
