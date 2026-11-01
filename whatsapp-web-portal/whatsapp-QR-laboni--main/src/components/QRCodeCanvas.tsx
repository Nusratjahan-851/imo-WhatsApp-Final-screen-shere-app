import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeCanvasProps {
  value: string;
  size?: number;
  className?: string;
  logoUrl?: string;
}

export const QRCodeCanvas: React.FC<QRCodeCanvasProps> = ({
  value,
  size = 280,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate high resolution QR code
    QRCode.toCanvas(
      canvas,
      value,
      {
        width: size,
        margin: 1.5,
        errorCorrectionLevel: 'H', // High error correction to allow center icon
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (err) => {
        if (err) {
          setError(err.message);
          return;
        }

        // Draw WhatsApp center badge
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const center = size / 2;
        const logoSize = Math.floor(size * 0.22);
        const radius = logoSize / 2;

        // White circular background with crisp border
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        // Draw WhatsApp badge icon (SVG path onto canvas)
        ctx.save();
        ctx.translate(center - radius, center - radius);

        // Green circular backdrop
        ctx.beginPath();
        ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
        ctx.fillStyle = '#25D366';
        ctx.fill();

        // WhatsApp telephone handset icon inside
        ctx.fillStyle = '#ffffff';
        // Scaled handset icon
        const s = logoSize / 36;
        ctx.translate(logoSize * 0.22, logoSize * 0.22);
        ctx.scale(s * 0.65, s * 0.65);

        // Chat bubble with phone path
        const p = new Path2D(
          'M26.07 7.93A12.75 12.75 0 0 0 17 4.18C9.9 4.18 4.13 9.95 4.13 17.06c0 2.27.59 4.49 1.72 6.45L4 30l6.68-1.75a12.82 12.82 0 0 0 6.32 1.64h.01c7.09 0 12.87-5.77 12.87-12.88 0-3.44-1.34-6.67-3.81-9.08zm-9.07 19.82h-.01a10.66 10.66 0 0 1-5.44-1.49l-.39-.23-4.05 1.06 1.08-3.95-.25-.4a10.67 10.67 0 0 1-1.64-5.68c0-5.89 4.8-10.69 10.7-10.69 2.85 0 5.54 1.11 7.56 3.13a10.62 10.62 0 0 1 3.13 7.56c0 5.89-4.8 10.69-10.69 10.69zm5.86-8.01c-.32-.16-1.9-.94-2.19-1.05-.3-.11-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.36-.5-2.59-1.6-.96-.85-1.6-1.9-1.79-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.55-.73-.56h-.62c-.21 0-.56.08-.85.4-.3.32-1.13 1.11-1.13 2.7 0 1.6 1.16 3.13 1.32 3.35.16.21 2.29 3.5 5.56 4.91.78.34 1.39.54 1.86.69.78.25 1.49.21 2.06.13.63-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37z'
        );
        ctx.fill(p);

        ctx.restore();
      }
    );
  }, [value, size]);

  if (error) {
    return (
      <div className="w-full aspect-square flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
        QR generation error
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`block mx-auto max-w-full h-auto ${className}`}
      width={size}
      height={size}
      aria-label={`QR Code for ${value}`}
    />
  );
};
