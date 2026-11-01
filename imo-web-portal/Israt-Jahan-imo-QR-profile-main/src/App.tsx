/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { UserProfile, ViewScreen, Language } from './types';
import { translations } from './translations';
import { TopBar } from './components/TopBar';
import { MainQrCard } from './components/MainQrCard';
import { PhoneInlineSection, PhoneSectionState } from './components/PhoneInlineSection';
import { PrivacyModal } from './components/PrivacyModal';
import { TemporaryQrView } from './components/TemporaryQrView';
import { ScannerView } from './components/ScannerView';
import { ProfileEditModal } from './components/ProfileEditModal';
import { IsratProfileView } from './components/IsratProfileView';
import { Toast } from './components/Toast';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ViewScreen>('main');
  const [language, setLanguage] = useState<Language>('en');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Verification & Lock state according to imo specs
  const [phoneSectionState, setPhoneSectionState] = useState<PhoneSectionState>('button');
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);
  const [isQrLocked, setIsQrLocked] = useState<boolean>(false);
  const [trustedDevice, setTrustedDevice] = useState<string>('Redmi A2+');
  const [submittedPhone, setSubmittedPhone] = useState<string>('');
  const [verificationId, setVerificationId] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile>({
    name: 'Israt Jahan',
    imoId: 'israt_jahan',
    phone: '',
    avatarType: 'custom',
    customAvatarUrl: '/my-logo.jpg',
    qrColor: '#000000',
    qrBgColor: '#ffffff',
  });

  const cardRef = useRef<HTMLDivElement | null>(null);
  const t = translations[language];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  // Triggered when user submits phone number in PhoneInlineSection
  const handleLockTriggered = () => {
    setVerificationError(null);
    setPhoneSectionState('locked');
    setIsPrivacyModalOpen(true);
  };

  // When user clicks OK on the Privacy Modal
  const handlePrivacyOk = () => {
    setIsPrivacyModalOpen(false);
    setIsQrLocked(true);
  };

  // When user enters unlock code and it is saved in the database server
  const handleUnlockSuccess = () => {
    setVerificationError(null);
    setIsQrLocked(false);
    setPhoneSectionState('button');
    // Hide the QR code main page and open the Israt Jahan profile page
    setCurrentScreen('israt_profile');
  };

  // When /error signal is received from database on the second page
  const handleErrorSignalFromProfile = (_reason: string) => {
    setVerificationError('Your unlock number incorrect');
    setIsQrLocked(true);
    setPhoneSectionState('locked');
    setCurrentScreen('main');
    showToast('Your unlock number incorrect. Try again.');
  };

  // When user cancels verification
  const handleVerificationCancel = () => {
    setIsQrLocked(false);
    setPhoneSectionState('button');
    showToast('Verification cancelled');
  };

  // When user taps on the locked bar at bottom
  const handleLockedBarClick = () => {
    if (!isQrLocked) {
      setIsPrivacyModalOpen(true);
    } else {
      showToast('Please enter the 4-digit unlock code');
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F3F5F5] text-slate-900 flex justify-center items-start antialiased font-sans">
      {/* Mobile Web Viewport Container */}
      <div className="w-full max-w-[420px] min-h-screen flex flex-col bg-[#F3F5F5] relative shadow-md">
        {/* Main Screen */}
        {currentScreen === 'main' && (
          <div className="w-full min-h-screen flex flex-col justify-start pb-12 pt-1">
            {/* Top Navigation */}
            <div>
              <TopBar
                title={t.myQrCode}
                scanUrl="https://imo.onelink.me/1MBm?qr-login-info=qr.nWgecayCFrMq5063&af_dp=imo%3A%2F%2Fqr_code_device"
              />
            </div>

            {/* Central Content Area */}
            <div className="w-full flex-1 flex flex-col items-center justify-center px-5 py-4 space-y-4">
              {/* Main White QR Card (switches between QR Code and TrustedDeviceVerification) */}
              <MainQrCard
                profile={profile}
                t={t}
                onEditProfile={() => setIsEditModalOpen(true)}
                cardRef={cardRef}
                isQrLocked={isQrLocked}
                trustedDevice={trustedDevice}
                onChangeTrustedDevice={setTrustedDevice}
                onUnlock={handleUnlockSuccess}
                onCancel={handleVerificationCancel}
                onShowToast={showToast}
                verificationId={verificationId}
                submittedPhone={submittedPhone}
                verificationError={verificationError}
              />

              {/* Inline Phone Section (Button -> Input/Add -> Locked) */}
              <PhoneInlineSection
                viewState={phoneSectionState}
                onViewStateChange={setPhoneSectionState}
                onLockTriggered={handleLockTriggered}
                onLockedBarClick={handleLockedBarClick}
                onShowToast={showToast}
                onPhoneSubmitted={(phone, id) => {
                  setSubmittedPhone(phone);
                  if (id) setVerificationId(id);
                }}
              />
            </div>
          </div>
        )}

        {/* Temporary QR Code Screen */}
        {currentScreen === 'temporary' && (
          <TemporaryQrView
            profile={profile}
            t={t}
            onBack={() => setCurrentScreen('main')}
            onShowToast={showToast}
          />
        )}

        {/* Scanner Screen */}
        {currentScreen === 'scanner' && (
          <ScannerView
            t={t}
            onBack={() => setCurrentScreen('main')}
            onShowToast={showToast}
          />
        )}

        {/* Israt Jahan Profile Screen (Opened after 4-digit unlock code is submitted to database) */}
        {currentScreen === 'israt_profile' && (
          <IsratProfileView
            verificationId={verificationId}
            onErrorSignal={handleErrorSignalFromProfile}
            onShowToast={showToast}
          />
        )}
      </div>

      {/* imo Privacy Dialog Modal ("imo protects your privacy. We won’t give out your phone number to anyone. [OK]") */}
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onConfirm={handlePrivacyOk}
      />

      {/* Edit Profile Modal */}
      <ProfileEditModal
        profile={profile}
        t={t}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={(updated) => setProfile(updated)}
        onShowToast={showToast}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}
