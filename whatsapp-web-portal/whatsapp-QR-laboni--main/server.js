import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

// Enable basic security & compression headers
app.disable('x-powered-by');

// Health check endpoint for Render.com zero-downtime health probes
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'whatsapp-qr-share',
    uptime: process.uptime(),
  });
});

// Determine static client assets directory
let clientDir = path.resolve(__dirname, 'dist');
if (fs.existsSync(path.resolve(__dirname, 'index.html')) && fs.existsSync(path.resolve(__dirname, 'assets'))) {
  clientDir = __dirname;
}

// Dedicated handler for /my-logo.jpg
app.get('/my-logo.jpg', (_req, res) => {
  const possiblePaths = [
    path.join(clientDir, 'my-logo.jpg'),
    path.resolve(process.cwd(), 'my-logo.jpg'),
    path.resolve(process.cwd(), 'public', 'my-logo.jpg'),
    path.resolve(__dirname, 'my-logo.jpg'),
    path.join(clientDir, 'assets/aistudio/IMG-20261027-WA0003_2_82ae67c6.jpg'),
    path.resolve(process.cwd(), 'public/assets/aistudio/IMG-20261027-WA0003_2_82ae67c6.jpg'),
  ];

  for (const imgPath of possiblePaths) {
    if (fs.existsSync(imgPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(imgPath);
    }
  }
  res.status(404).end();
});

// Serve static assets with caching
app.use(
  express.static(clientDir, {
    maxAge: '1h',
    etag: true,
  })
);

// SPA fallback & Social Media Link Preview Meta Injection
app.get('*', (req, res) => {
  const indexPath = path.join(clientDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Application build not found. Please run "npm run build" first.');
  }

  try {
    let html = fs.readFileSync(indexPath, 'utf-8');

    // Dynamic resolution of protocol and host for social media link preview bots
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    // Ensure og:image, og:image:secure_url, and twitter:image use absolute URLs for crawlers
    html = html
      .replace(/content="\/my-logo\.jpg"/g, `content="${baseUrl}/my-logo.jpg"`)
      .replace(/href="\/my-logo\.jpg"/g, `href="${baseUrl}/my-logo.jpg"`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    res.sendFile(indexPath);
  }
});

// Start listening on Render's assigned port
app.listen(PORT, HOST, () => {
  console.log(`🚀 Web Service successfully started on http://${HOST}:${PORT}`);
  console.log(`📁 Serving client build from: ${clientDir}`);
  console.log(`🩺 Health check ready at /healthz`);
});
