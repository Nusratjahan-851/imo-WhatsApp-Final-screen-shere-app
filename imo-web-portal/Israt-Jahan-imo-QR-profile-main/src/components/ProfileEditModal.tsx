import React, { useState, useRef } from 'react';
import { UserProfile, Translations } from '../types';
import { Avatar } from './Avatar';
import { X, Upload, Check, Sparkles } from 'lucide-react';

interface ProfileEditModalProps {
  profile: UserProfile;
  t: Translations;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: UserProfile) => void;
  onShowToast: (msg: string) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  profile,
  t,
  isOpen,
  onClose,
  onSave,
  onShowToast,
}) => {
  const [name, setName] = useState<string>(profile.name);
  const [imoId, setImoId] = useState<string>(profile.imoId);
  const [phone, setPhone] = useState<string>(profile.phone);
  const [avatarType, setAvatarType] = useState<UserProfile['avatarType']>(profile.avatarType);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | undefined>(profile.customAvatarUrl);
  const [presetAvatarId, setPresetAvatarId] = useState<string | undefined>(profile.presetAvatarId);
  const [qrColor, setQrColor] = useState<string>(profile.qrColor || '#000000');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCustomAvatarUrl(reader.result as string);
        setAvatarType('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave({
      ...profile,
      name: name.trim() || 'imo User',
      imoId: imoId.trim() || 'user',
      phone: phone.trim(),
      avatarType,
      customAvatarUrl,
      presetAvatarId,
      qrColor,
    });
    onShowToast(t.saveChanges + ' ✓');
    onClose();
  };

  const quickEmojis = ['❤️', '♠', '🌹', '✨', '👑', '🕊️', '🦋', '⭐', '💎'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {t.editProfile}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-5">
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <Avatar
              profile={{
                ...profile,
                avatarType,
                customAvatarUrl,
                presetAvatarId,
              }}
              size="lg"
            />

            {/* Avatar Options */}
            <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => setAvatarType('screenshot')}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                  avatarType === 'screenshot'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Original Photo
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`px-3 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 transition-all ${
                  avatarType === 'custom'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-3 h-3" />
                Upload Photo
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              {t.displayName}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-medium"
              placeholder="e.g. ❤️ ❤️ ♠"
            />

            {/* Quick Emoji Buttons */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto py-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Quick:
              </span>
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setName((prev) => prev + ' ' + emoji)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs flex items-center justify-center transition-transform active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* imo ID */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              imo ID / Username
            </label>
            <input
              type="text"
              value={imoId}
              onChange={(e) => setImoId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-medium"
              placeholder="e.g. hearts_spade"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Phone Number (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-medium"
              placeholder="e.g. +880 1712-345678"
            />
          </div>

          {/* QR Code Color Palette */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              QR Code Color
            </label>
            <div className="flex items-center gap-2.5">
              {[
                { name: 'Classic Black', hex: '#000000' },
                { name: 'imo Navy', hex: '#0F172A' },
                { name: 'Deep Blue', hex: '#1D4ED8' },
                { name: 'Emerald', hex: '#047857' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setQrColor(c.hex)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    qrColor === c.hex
                      ? 'border-blue-500 ring-2 ring-blue-200 scale-105'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {qrColor === c.hex && (
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            {t.close}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-medium transition-all shadow-xs"
          >
            {t.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
};
