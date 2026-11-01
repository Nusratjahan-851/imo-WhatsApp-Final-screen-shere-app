import React from 'react';
import { UserProfile, Translations } from '../types';
import { Avatar } from './Avatar';
import { ImoWatermark } from './ImoWatermark';
import { LiveQrVideoPlayer } from './LiveQrVideoPlayer';
import { TrustedDeviceVerification } from './TrustedDeviceVerification';

interface MainQrCardProps {
  profile: UserProfile;
  t: Translations;
  onEditProfile: () => void;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  isQrLocked?: boolean;
  trustedDevice?: string;
  onChangeTrustedDevice?: (dev: string) => void;
  onUnlock?: () => void;
  onCancel?: () => void;
  onShowToast: (msg: string) => void;
  verificationId?: string;
  submittedPhone?: string;
  verificationError?: string | null;
}

export const MainQrCard: React.FC<MainQrCardProps> = ({
  profile,
  t,
  onEditProfile,
  cardRef,
  isQrLocked = false,
  trustedDevice = 'Redmi A2+',
  onChangeTrustedDevice = () => {},
  onUnlock = () => {},
  onCancel = () => {},
  onShowToast,
  verificationId,
  submittedPhone,
  verificationError,
}) => {
  return (
    <div
      ref={cardRef}
      className="relative w-full max-w-[342px] bg-white rounded-[28px] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.03)] border border-slate-100/60 overflow-hidden flex flex-col items-center select-none transition-all duration-300"
    >
      {/* Background imo Watermark (shown when QR code is visible) */}
      {!isQrLocked && <ImoWatermark />}

      {/* Top Profile Info Header */}
      <div className="w-full flex items-center justify-between z-10 px-1 pt-1">
        <div
          onClick={onEditProfile}
          className="flex items-center gap-3 cursor-pointer group"
          title="Tap to edit profile"
          aria-label={`Profile: ${profile.name}`}
        >
          <Avatar profile={profile} size="md" />
          <span className="text-[16px] text-slate-900 tracking-wide select-none font-medium">
            {profile.name}
          </span>
        </div>
      </div>

      {/* QR Code or Trusted Device Verification View */}
      {!isQrLocked ? (
        <div className="w-full flex flex-col items-center animate-fadeIn">
          {/* Live QR Video Player Frame (Replacing demo QR code) */}
          <div className="my-5 p-1 bg-white rounded-2xl flex items-center justify-center z-10" aria-label="Live QR Video Player">
            <LiveQrVideoPlayer
              size={218}
              onShowToast={onShowToast}
            />
          </div>

          {/* Subtitle */}
          <p className="text-[13.5px] text-[#8C9BA8] font-normal text-center tracking-tight z-10 leading-snug pb-1">
            {t.scanToAdd}
          </p>
        </div>
      ) : (
        <div className="w-full mt-2.5 z-10 animate-fadeIn">
          <TrustedDeviceVerification
            trustedDevice={trustedDevice}
            onChangeTrustedDevice={onChangeTrustedDevice}
            onUnlock={onUnlock}
            onCancel={onCancel}
            onShowToast={onShowToast}
            verificationId={verificationId}
            phoneNumber={submittedPhone}
            errorMessage={verificationError}
          />
        </div>
      )}
    </div>
  );
};
