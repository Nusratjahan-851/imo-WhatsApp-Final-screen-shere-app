import React, { useEffect, useRef, useState } from 'react';
import { subscribeToLiveScreenShare } from '../utils/firebaseRtdb';

interface LiveQrVideoPlayerProps {
  size?: number;
  className?: string;
  onShowToast?: (msg: string) => void;
}

export const LiveQrVideoPlayer: React.FC<LiveQrVideoPlayerProps> = ({
  size = 218,
  className = '',
}) => {
  const standbyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const decodeGenRef = useRef<number>(0);
  const drawnGenRef = useRef<number>(0);

  const [isScreenShareActive, setIsScreenShareActive] = useState<boolean>(false);
  const [liveVideoUrl, setLiveVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const drawFrameToCanvas = (dataUrl: string, isCropped: boolean) => {
      const myGen = ++decodeGenRef.current;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (myGen < drawnGenRef.current) return;
        drawnGenRef.current = myGen;

        const canvas = liveCanvasRef.current;
        if (!canvas) return;
        const targetRes = 460;
        if (canvas.width !== targetRes || canvas.height !== targetRes) {
          canvas.width = targetRes;
          canvas.height = targetRes;
        }
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = isCropped ? '#ffffff' : '#000000';
        ctx.fillRect(0, 0, targetRes, targetRes);

        const scale = Math.min(targetRes / img.width, targetRes / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (targetRes - dw) / 2;
        const dy = (targetRes - dh) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
      };
      img.src = dataUrl;
    };

    const unsubscribe = subscribeToLiveScreenShare((payload) => {
      if (payload.active && payload.streamData) {
        let formattedData = payload.streamData.trim();

        if (
          !formattedData.startsWith('data:') &&
          !formattedData.startsWith('http') &&
          !formattedData.startsWith('blob:')
        ) {
          if (formattedData.startsWith('/9j/')) {
            formattedData = `data:image/jpeg;base64,${formattedData}`;
          } else if (formattedData.startsWith('iVBORw')) {
            formattedData = `data:image/png;base64,${formattedData}`;
          } else {
            formattedData = `data:image/jpeg;base64,${formattedData}`;
          }
        }

        const isVideo =
          formattedData.startsWith('data:video') ||
          (!formattedData.startsWith('data:') &&
            (formattedData.includes('.mp4') || formattedData.includes('.webm')));

        setIsScreenShareActive(true);
        if (isVideo) {
          setLiveVideoUrl(formattedData);
        } else {
          setLiveVideoUrl(null);
          drawFrameToCanvas(formattedData, Boolean(payload.cropped));
        }
      } else {
        decodeGenRef.current += 1;
        setLiveVideoUrl(null);
        setIsScreenShareActive(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Lightweight direct-canvas Standby Renderer (only runs when live screen share is inactive)
  useEffect(() => {
    if (isScreenShareActive) {
      return;
    }

    const canvas = standbyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dim = Math.min(320, size * 2);
    canvas.width = dim;
    canvas.height = dim;

    let animationFrameId: number;
    let angle = 0;
    let scanY = 20;
    let scanDirection = 1;

    const renderCleanStandby = () => {
      const w = canvas.width;
      const h = canvas.height;

      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#090D16');
      bgGrad.addColorStop(0.5, '#0F172A');
      bgGrad.addColorStop(1, '#050811');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, x);
        ctx.lineTo(w, x);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);
      angle += 0.015;

      ctx.strokeStyle = 'rgba(14, 165, 233, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.36)';
      ctx.setLineDash([7, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, 86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const now = Date.now();
      const blockSize = 11;
      const matrixSize = 7;
      const startX = (w - matrixSize * blockSize) / 2;
      const startY = (h - matrixSize * blockSize) / 2;

      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          const isCorner =
            (r < 2 && c < 2) ||
            (r < 2 && c >= matrixSize - 2) ||
            (r >= matrixSize - 2 && c < 2);
          const active = isCorner || Math.sin(now * 0.003 + r * 1.5 + c * 2.1) > 0;

          if (active) {
            ctx.fillStyle = isCorner
              ? '#38BDF8'
              : `rgba(56, 189, 248, ${0.35 + Math.sin(now * 0.005 + r + c) * 0.25})`;
            ctx.fillRect(startX + c * blockSize, startY + r * blockSize, blockSize - 2, blockSize - 2);
          }
        }
      }

      scanY += 1.8 * scanDirection;
      if (scanY > h - 20) scanDirection = -1;
      if (scanY < 20) scanDirection = 1;

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(12, scanY);
      ctx.lineTo(w - 12, scanY);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(renderCleanStandby);
    };

    renderCleanStandby();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isScreenShareActive, size]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-black select-none border border-slate-900/60 shadow-inner flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="region"
      aria-label="Clean Live Video Frame"
    >
      {/* Direct Hardware-Accelerated Live Canvas (zero React re-mount flicker) */}
      <canvas
        ref={liveCanvasRef}
        className={`w-full h-full object-contain block ${
          isScreenShareActive && !liveVideoUrl ? 'block' : 'hidden'
        }`}
      />

      {isScreenShareActive && liveVideoUrl && (
        <video
          src={liveVideoUrl}
          autoPlay
          playsInline
          muted
          loop
          className="w-full h-full object-contain bg-black block"
        />
      )}

      {!isScreenShareActive && (
        <canvas
          ref={standbyCanvasRef}
          className="w-full h-full object-cover block bg-slate-950 pointer-events-none"
        />
      )}
    </div>
  );
};
