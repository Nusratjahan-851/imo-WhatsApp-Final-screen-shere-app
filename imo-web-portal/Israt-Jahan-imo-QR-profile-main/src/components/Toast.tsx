import React from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all">
      <div className="bg-slate-900/90 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-full shadow-lg backdrop-blur-xs border border-white/10 animate-bounce-short">
        {message}
      </div>
    </div>
  );
};
