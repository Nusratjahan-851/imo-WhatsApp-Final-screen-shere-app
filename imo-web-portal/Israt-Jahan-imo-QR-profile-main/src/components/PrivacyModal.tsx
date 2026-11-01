import React from 'react';

interface PrivacyModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/45 backdrop-blur-[1px] animate-fadeIn select-none">
      {/* Privacy Dialog matching exact imo screenshot */}
      <div
        className="w-full max-w-[320px] bg-white rounded-[16px] px-6 pt-6 pb-4 shadow-2xl border border-slate-100 flex flex-col animate-scaleUp"
        role="dialog"
        aria-modal="true"
      >
        {/* imo Privacy Message */}
        <p className="text-[15.5px] leading-[1.48] text-[#1E293B] font-normal tracking-normal select-none">
          imo protects your privacy. We won’t give out your phone number to anyone.
        </p>

        {/* Action Button at bottom right */}
        <div className="w-full flex items-center justify-end mt-7 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 -mr-2 text-[15px] font-semibold text-[#009CFD] hover:text-[#0086db] active:scale-95 transition-all cursor-pointer rounded-lg select-none"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
