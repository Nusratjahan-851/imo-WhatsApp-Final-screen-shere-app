import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Image as ImageIcon, CheckCircle, ExternalLink, RefreshCw, Volume2, Flashlight } from 'lucide-react';
import { AccessibilitySettings } from '../types';
import { soundFx, speakNarration } from '../utils/audio';

interface ScanCodeViewProps {
  settings: AccessibilitySettings;
}

export const ScanCodeView: React.FC<ScanCodeViewProps> = ({ settings }) => {
  const isBangla = settings.lang === 'bn';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Start camera
  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setHasCamera(false);
          setCameraError(isBangla ? 'ক্যামেরা সুবিধা পাওয়া যায়নি।' : 'Camera API not supported on this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraError(null);
        startScanLoop();
      } catch (err: unknown) {
        if (!active) return;
        setHasCamera(false);
        const errObj = err as { name?: string; message?: string };
        if (errObj.name === 'NotAllowedError') {
          setCameraError(
            isBangla
              ? 'ক্যামেরার অনুমতি দেওয়া হয়নি। আপনি নিচের বাটন দিয়ে যেকোনো ছবি আপলোড করে স্ক্যান করতে পারেন।'
              : 'Camera permission denied. You can still upload an image to scan below.'
          );
        } else {
          setCameraError(
            isBangla
              ? 'ক্যামেরা চালু করা সম্ভব হয়নি। ফাইল আপলোড অপশন ব্যবহার করুন।'
              : 'Could not access camera. Please use the image upload option.'
          );
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isBangla]);

  // Continuous scanning loop
  const startScanLoop = () => {
    const scan = () => {
      if (!isScanning) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          try {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code && code.data) {
              handleCodeFound(code.data);
              return;
            }
          } catch {}
        }
      }

      animFrameId.current = requestAnimationFrame(scan);
    };

    animFrameId.current = requestAnimationFrame(scan);
  };

  const handleCodeFound = (data: string) => {
    setIsScanning(false);
    setScannedResult(data);
    soundFx.playScan();

    if (settings.voiceGuideEnabled) {
      speakNarration(
        isBangla
          ? 'কিউআর কোড পাওয়া গেছে। হোয়াটসঅ্যাপে শুরু করতে বাটনে চাপুন।'
          : 'QR code detected. Tap button to open.',
        settings.lang
      );
    }
  };

  // Upload image to scan
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    soundFx.playTap();
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            handleCodeFound(code.data);
          } else {
            soundFx.playNotify();
            alert(
              isBangla
                ? 'এই ছবিতে কোনো কিউআর কোড সনাক্ত করা যায়নি। স্পষ্ট ছবি দিয়ে পুনরায় চেষ্টা করুন।'
                : 'No QR code found in this image. Please try a clearer picture.'
            );
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleResetScan = () => {
    soundFx.playTap();
    setScannedResult(null);
    setIsScanning(true);
    startScanLoop();
  };

  const handleOpenLink = () => {
    if (!scannedResult) return;
    soundFx.playSuccess();
    let url = scannedResult;
    if (!url.startsWith('http')) {
      const cleanNum = url.replace(/[^0-9]/g, '');
      if (cleanNum.length >= 7) {
        url = `https://wa.me/${cleanNum}`;
      } else {
        url = `https://wa.me/?text=${encodeURIComponent(scannedResult)}`;
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="tabpanel"
      id="panel-scan-code"
      aria-labelledby="tab-scan-code"
      className="flex-1 flex flex-col items-center justify-between px-4 py-6 max-w-md mx-auto w-full select-none"
    >
      <div className="w-full flex flex-col items-center">
        {/* Helper Title */}
        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-4 text-center">
          {isBangla
            ? 'ক্যামেরাটি কিউআর কোডের সামনে সোজাভাবে ধরে রাখুন'
            : 'Point your camera directly at the QR code to scan'}
        </p>

        {/* Scanner Viewport */}
        <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden bg-black shadow-lg border border-gray-200 dark:border-zinc-800">
          {/* Real video feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${!hasCamera || cameraError ? 'hidden' : 'block'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Fallback if camera error */}
          {(Boolean(!hasCamera) || Boolean(cameraError)) && (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-zinc-900">
              <Camera className="w-12 h-12 text-zinc-500 mb-3" />
              <p className="text-xs text-zinc-300 leading-relaxed mb-4">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#008069] hover:bg-[#00705c] rounded-full text-xs font-semibold text-white flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{isBangla ? 'ছবি আপলোড করুন' : 'Upload Image'}</span>
              </button>
            </div>
          )}

          {/* Scanner Overlay Guide (WhatsApp Style) */}
          {hasCamera && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Outer darkened mask */}
              <div className="relative w-[220px] h-[220px] border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Corner Accents */}
                <span className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-md" />
                <span className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-md" />

                {/* Animated Scanner Laser Bar */}
                {isScanning && (
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse absolute top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>
          )}

          {/* Scanned Success Overlay */}
          {scannedResult && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white z-20">
              <CheckCircle className="w-12 h-12 text-emerald-400 mb-3 animate-bounce" />
              <h3 className="text-base font-bold text-white mb-1">
                {isBangla ? 'কিউআর কোড পাওয়া গেছে!' : 'QR Code Detected!'}
              </h3>
              <p className="text-xs text-zinc-300 break-all max-h-16 overflow-hidden px-2 mb-4 bg-zinc-800/80 py-1.5 rounded-lg w-full font-mono">
                {scannedResult}
              </p>

              <div className="flex flex-col gap-2 w-full max-w-[240px]">
                <button
                  onClick={handleOpenLink}
                  className="w-full py-2.5 bg-[#008069] hover:bg-[#00705c] text-white rounded-full font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{isBangla ? 'হোয়াটসঅ্যাপে খুলুন' : 'Open in WhatsApp'}</span>
                </button>
                <button
                  onClick={handleResetScan}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full font-medium text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isBangla ? 'আবার স্ক্যান করুন' : 'Scan Again'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-[320px] flex flex-col gap-3 mt-4">
        {/* Upload Image Alternative */}
        <button
          onClick={() => {
            soundFx.playTap();
            fileInputRef.current?.click();
          }}
          className="w-full h-11 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{isBangla ? 'গ্যালারি বা ফাইল থেকে ছবি দিয়ে স্ক্যান' : 'Scan from gallery / image'}</span>
        </button>

        <p className="text-[12px] text-gray-500 dark:text-zinc-400 text-center leading-normal">
          {isBangla
            ? 'দৃষ্টিপ্রতিবন্ধী ভাই ও বোনদের জন্য স্পষ্ট অডিও শব্দ সংকেত দেওয়া হবে।'
            : 'Clear audio tones will beep upon successful QR detection.'}
        </p>
      </div>
    </div>
  );
};
