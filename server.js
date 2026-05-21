import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionFile = path.resolve(__dirname, '.zeta-session.json');

const app = express();

const API_BASE = 'https://api.zeta-ai.io';

// ── Quiz Automation (server-side) ──
function quizHeaders(accessToken) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };
}

async function apiGet(path, accessToken) {
  const res = await fetch(`${API_BASE}${path}`, { headers: quizHeaders(accessToken) });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function apiPost(path, accessToken, body = null) {
  const opts = { method: 'POST', headers: quizHeaders(accessToken) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

function isJoined(data) {
  return data?.type === 'Selected' || Boolean(data?.selection);
}

function isClaimed(data) {
  return data?.type === 'Claimed' || data?.claimed === true || data?.rewardClaimed === true;
}

async function runQuizAutomation(accessToken) {
  try {
    let data = await apiGet('/v1/daily-quizzes', accessToken);
    if (!data || !data.id) {
      console.log('[Quiz] No quiz available.');
      return;
    }

    const quizId = data.id;

    if (isClaimed(data)) {
      console.log('[Quiz] Already claimed.');
      return;
    }

    // Step 1: Join if not yet joined
    let justJoined = false;
    if (!isJoined(data)) {
      const plots = data.question?.plots || [];
      if (plots.length === 0) {
        console.log('[Quiz] No plots to select.');
        return;
      }
      const selectedPlot = plots[0];
      console.log(`[Quiz] Joining quiz ${quizId} with plot ${selectedPlot.id} (${selectedPlot.name})`);
      await apiPost(`/v1/daily-quizzes/${quizId}/selection`, accessToken, {
        selection: { type: 'SinglePlotSelection', plotId: selectedPlot.id }
      });
      justJoined = true;

      // Re-fetch to get updated state
      await new Promise(r => setTimeout(r, 500));
      data = await apiGet('/v1/daily-quizzes', accessToken);
    }

    // Step 2: Try to claim reward
    const now = new Date();
    const availableAt = data.availableAt ? new Date(data.availableAt) : null;
    const rewardUntil = data.rewardUntil ? new Date(data.rewardUntil) : null;

    if (availableAt && now < availableAt) {
      console.log(`[Quiz] Joined${justJoined ? ' (new)' : ''}. Reward not yet available until ${availableAt.toLocaleString('ja-JP')}.`);
      return;
    }

    if (rewardUntil && now > rewardUntil) {
      console.log(`[Quiz] Reward window closed (${rewardUntil.toLocaleString('ja-JP')}).`);
      return;
    }

    // Attempt claim
    try {
      console.log(`[Quiz] Claiming reward for quiz ${quizId}...`);
      const result = await apiPost(`/v1/daily-quizzes/${quizId}/claim-reward`, accessToken);
      console.log(`[Quiz] Claimed successfully.`, result?.reward ? JSON.stringify(result.reward) : '');
    } catch (claimError) {
      console.warn(`[Quiz] Claim failed: ${claimError.message}`);
      if (justJoined) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const retryResult = await apiPost(`/v1/daily-quizzes/${quizId}/claim-reward`, accessToken);
          console.log(`[Quiz] Retry claim succeeded.`, retryResult?.reward ? JSON.stringify(retryResult.reward) : '');
        } catch (retryError) {
          console.warn(`[Quiz] Retry claim also failed: ${retryError.message}`);
        }
      }
    }
  } catch (e) {
    console.error(`[Quiz] Automation error:`, e.message);
  }
}

// 1. API Proxy (Must be before express.json() to avoid consuming the request body)
app.use('/api', createProxyMiddleware({
  target: 'https://api.zeta-ai.io',
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  proxyTimeout: 60000,
  timeout: 60000,
  onProxyRes: (proxyRes, req, res) => {
    const ct = proxyRes.headers['content-type'] || '';
    // Handle SSE and streaming
    if (ct.includes('text/event-stream') || req.url?.includes('/stream')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
    }
  }
}));

// 2. JSON Parser (Only for local-auth routes)
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
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
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

            // Run quiz automation after session refresh
            console.log(`[Background] Running quiz automation...`);
            await runQuizAutomation(current.accessToken);
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

// Run quiz on startup as well
async function runQuizOnStartup() {
  try {
    const text = await fs.readFile(sessionFile, "utf8").catch(() => null);
    if (!text) return;
    const current = JSON.parse(text);
    if (!current.accessToken) return;
    console.log('[Startup] Running quiz automation...');
    await runQuizAutomation(current.accessToken);
  } catch (e) {
    console.error('[Startup] Quiz automation error:', e.message);
  }
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

// (Removed from here and moved up)

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
  runQuizOnStartup();
});

