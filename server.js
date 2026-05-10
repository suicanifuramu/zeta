import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionFile = path.resolve(__dirname, '.zeta-session.json');

const app = express();
app.use(express.json());

// Background Refresh logic
let backgroundRefreshTimer = null;
function startBackgroundRefresh() {
  if (backgroundRefreshTimer) return;
  backgroundRefreshTimer = setInterval(async () => {
    try {
      const text = await fs.readFile(sessionFile, "utf8").catch(() => null);
      if (!text) return;
      
      const current = JSON.parse(text);
      const { deviceId, refreshToken, accessToken } = current;
      if (!deviceId || !refreshToken || !accessToken) return;
      
      // Decode JWT to check expiry
      const parts = String(accessToken).split('.');
      if (parts.length !== 3) return;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      const expiry = payload.exp ? payload.exp * 1000 : 0;
      
      // Refresh if expiring within 10 minutes
      if (expiry - Date.now() < 600000) {
        console.log(`[Background] Token expiring soon. Auto-refreshing for device ${deviceId}...`);
        const response = await fetch("https://api.zeta-ai.io/v1/auth/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ deviceId, type: "refresh", refreshToken })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.accessToken) {
            current.accessToken = data.accessToken;
            if (data.refreshToken) current.refreshToken = data.refreshToken;
            await fs.writeFile(sessionFile, `${JSON.stringify(current, null, 2)}\n`, "utf8");
            console.log(`[Background] Refresh successful.`);
          }
        } else {
          console.error(`[Background] Refresh failed: ${response.status}`);
        }
      }
    } catch (e) {
      console.error(`[Background] Error:`, e);
    }
  }, 60000);
}

// Routes for local-auth
app.get('/local-auth', async (req, res) => {
  try {
    const text = await fs.readFile(sessionFile, "utf8").catch(() => "{}");
    res.json(JSON.parse(text || "{}"));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/local-auth', async (req, res) => {
  try {
    const text = await fs.readFile(sessionFile, "utf8").catch(() => "{}");
    const current = JSON.parse(text || "{}");
    const incoming = req.body || {};
    const next = {
      deviceId: incoming.deviceId ?? current.deviceId ?? "",
      refreshToken: incoming.refreshToken ?? current.refreshToken ?? "",
      accessToken: incoming.accessToken ?? current.accessToken ?? "",
    };
    await fs.writeFile(sessionFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/local-auth', async (req, res) => {
  try {
    await fs.rm(sessionFile, { force: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Proxy /api to zeta-ai.io
app.use('/api', createProxyMiddleware({
  target: 'https://api.zeta-ai.io',
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  onProxyRes: (proxyRes, req, res) => {
    const ct = proxyRes.headers['content-type'] || '';
    // Handle SSE and streaming
    if (ct.includes('text/event-stream') || req.url?.includes('/stream')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
    }
  }
}));

// Serve static files from dist
app.use(express.static(path.resolve(__dirname, 'dist')));

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on http://0.0.0.0:${PORT}`);
  startBackgroundRefresh();
});
