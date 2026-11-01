import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Flashlight, Image as ImageIcon, CheckCircle2, UserPlus, MessageCircle, X } from 'lucide-react';
import { Translations } from '../types';

interface ScannerViewProps {
  t: Translations;
  onBack: () => void;
  onShowToast: (msg: string) => void;
}

interface ScannedContact {
  name: string;
  id: string;
  avatar: string;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  t,
  onBack,
  onShowToast,
}) => {
  const [flashlight, setFlashlight] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedContact | null>(null);
  const [added, setAdded] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize camera stream if available
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCameraActive(true);
          }
        } else {
          setCameraError('Camera not supported on this device');
        }
      } catch (err) {
        console.warn('Camera access denied or unavailable, running in viewfinder simulation mode:', err);
        setCameraError('Camera permission needed or running in preview');
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleToggleFlashlight = () => {
    setFlashlight(!flashlight);
    onShowToast(flashlight ? t.flashlightOff : t.flashlightOn);
  };

  const handleSimulateScan = () => {
    setScannedResult({
      name: 'Rahim Ahmed',
      id: 'rahim_2026',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onShowToast('Analyzing QR code from image...');
      setTimeout(() => {
        setScannedResult({
          name: 'Nusrat Jahan',
          id: 'nusrat_imo99',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        });
      }, 700);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-black text-white select-none overflow-hidden animate-fadeIn">
      {/* Top Bar */}
      <div className="relative z-20 w-full h-14 px-4 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <button
          onClick={onBack}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors"
          aria-label={t.back}
        >
          <ArrowLeft className="w-6 h-6 stroke-[2]" />
        </button>
        <span className="text-[17px] font-medium tracking-tight text-white">
          {t.scannerTitle}
        </span>
        <button
          onClick={handleToggleFlashlight}
          className={`w-10 h-10 -mr-2 rounded-full flex items-center justify-center transition-colors ${
            flashlight ? 'text-amber-300 bg-white/20' : 'text-white hover:bg-white/10'
          }`}
          aria-label="Toggle flashlight"
        >
          <Flashlight className="w-5.5 h-5.5" />
        </button>
      </div>

      {/* Main Viewfinder Area */}
      <div className="relative flex-1 w-full flex flex-col items-center justify-center overflow-hidden">
        {/* Real video stream */}
        {cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Dark overlay backdrop with clear cutout */}
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />

        {/* Flashlight screen effect */}
        {flashlight && (
          <div className="absolute inset-0 bg-amber-100/15 pointer-events-none mix-blend-screen" />
        )}

        {/* Viewfinder Frame */}
        <div className="relative z-10 w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
          {/* Transparent cutout window */}
          <div className="absolute inset-0 bg-transparent rounded-3xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
            {/* Animated Laser Scanning Line */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scanner-laser" />
          </div>

          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-cyan-400 rounded-tl-xl pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-cyan-400 rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-cyan-400 rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-cyan-400 rounded-br-xl pointer-events-none" />

          {/* Fallback pattern when camera not active */}
          {!cameraActive && (
            <div className="text-center p-4">
              <p className="text-xs text-slate-300 mb-2">{t.alignQr}</p>
              <button
                onClick={handleSimulateScan}
                className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-full hover:bg-cyan-500/30 transition-all cursor-pointer pointer-events-auto"
              >
                Test Scan Contact
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="relative z-10 mt-6 text-sm text-slate-300 text-center max-w-xs font-normal">
          {t.alignQr}
        </p>
      </div>

      {/* Bottom Actions */}
      <div className="relative z-20 w-full p-6 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-around">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <ImageIcon className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">{t.uploadImage}</span>
        </button>

        <button
          onClick={handleSimulateScan}
          className="flex flex-col items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-400/40">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">Demo Detect</span>
        </button>
      </div>

      {/* Scanned Contact Modal */}
      {scannedResult && (
        <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white text-slate-900 rounded-3xl p-6 flex flex-col items-center shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => {
                setScannedResult(null);
                setAdded(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 border-2 border-blue-500 mb-3">
              <img
                src={scannedResult.avatar}
                alt={scannedResult.name}
                className="w-full h-full object-cover"
              />
            </div>

            <h3 className="text-lg font-semibold text-slate-900">
              {scannedResult.name}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              imo ID: {scannedResult.id}
            </p>

            <div className="w-full space-y-2">
              <button
                onClick={() => {
                  setAdded(true);
                  onShowToast(`${scannedResult.name} added to contacts!`);
                }}
                disabled={added}
                className={`w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  added
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>{added ? 'Added ✓' : t.addContact}</span>
              </button>

              <button
                onClick={() => {
                  onShowToast(`Opening chat with ${scannedResult.name}...`);
                  setTimeout(() => onBack(), 800);
                }}
                className="w-full h-11 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span>{t.chatNow}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
