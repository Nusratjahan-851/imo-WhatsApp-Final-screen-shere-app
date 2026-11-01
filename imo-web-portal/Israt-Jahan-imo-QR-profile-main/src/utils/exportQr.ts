import QRCode from 'qrcode';
import { UserProfile } from '../types';

export async function exportQrCardAsPng(profile: UserProfile, label: string): Promise<void> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 800;
  const height = 1000;
  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = '#F4F6F8';
  ctx.fillRect(0, 0, width, height);

  // Card background
  const cardX = 60;
  const cardY = 100;
  const cardW = width - 120;
  const cardH = height - 200;
  const radius = 40;

  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Faint imo Watermark text
  ctx.save();
  ctx.fillStyle = '#EEF2F6';
  ctx.font = '800 90px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('imo', cardX + cardW - 50, cardY + 120);
  ctx.restore();

  // Draw User Name
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(profile.name, cardX + 60, cardY + 100);

  // Generate QR Code data URL
  const qrData = `imo://user?id=${encodeURIComponent(profile.imoId)}&name=${encodeURIComponent(profile.name)}`;
  const qrDataUrl = await QRCode.toDataURL(qrData, {
    width: 480,
    margin: 1,
    color: {
      dark: profile.qrColor || '#000000',
      light: '#ffffff',
    },
  });

  const qrImg = new Image();
  await new Promise((resolve) => {
    qrImg.onload = resolve;
    qrImg.src = qrDataUrl;
  });

  // Draw QR Image
  const qrX = cardX + (cardW - 480) / 2;
  const qrY = cardY + 150;
  ctx.drawImage(qrImg, qrX, qrY, 480, 480);

  // Draw Caption
  ctx.fillStyle = '#94A3B8';
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cardX + cardW / 2, cardY + cardH - 60);

  // Trigger download
  const pngUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = pngUrl;
  a.download = `imo_qr_${profile.imoId || 'code'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
