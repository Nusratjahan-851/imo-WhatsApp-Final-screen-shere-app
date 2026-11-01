import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeViewProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
}

export const QrCodeView: React.FC<QrCodeViewProps> = ({
  value,
  size = 240,
  fgColor = '#000000',
  bgColor = '#ffffff',
  className = '',
}) => {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      errorCorrectionLevel: 'H',
      color: {
        dark: fgColor,
        light: bgColor,
      },
    })
      .then((svg) => {
        if (isMounted) {
          setSvgContent(svg);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size, fgColor, bgColor]);

  return (
    <div
      className={`flex items-center justify-center p-2 bg-white rounded-lg transition-all ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
