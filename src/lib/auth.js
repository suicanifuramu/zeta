// ===== Auth Module =====
// deviceId / refreshToken are stored in app/.zeta-session.json through the
// Vite local middleware. accessToken remains session-scoped in the browser.

const ACCESS_TOKEN_KEY = 'zeta_access_token';
const REFRESH_TOKEN_KEY = 'zeta_refresh_token';
const DEVICE_ID_KEY = 'zeta_device_id';
const LEGACY_DEVICE_ID = '18fbd089f37a9994';
const LOCAL_AUTH_ENDPOINT = '/local-auth';

let accessToken = null;
let refreshTimer = null;
let localAuthLoaded = false;
let savedDeviceId = '';
let savedRefreshToken = '';

function readJsonToken(input) {
  const text = String(input || '').trim();
  if (!text) return {};

  if (/REFRESH_TOKEN=|TOKEN=|DEVICE_ID=/i.test(text)) {
    const values = {};
    for (const part of text.split(';')) {
      const [rawKey, ...rawValue] = part.trim().split('=');
      const key = rawKey?.trim();
      const value = rawValue.join('=').trim();
      if (key && value) values[key] = decodeURIComponent(value);
    }
    return {
      accessToken: values.TOKEN || values.token || '',
      refreshToken: values.REFRESH_TOKEN || values.refresh_token || '',
      deviceId: values.DEVICE_ID || values.device_id || ''
    };
  }

  try {
    const parsed = JSON.parse(text);
    return {
      accessToken: parsed.accessToken || parsed.access_token || '',
      refreshToken: parsed.refreshToken || parsed.refresh_token || '',
      deviceId: parsed.deviceId || parsed.device_id || ''
    };
  } catch {
    return {};
  }
}

function normalizeBearerToken(token) {
  return String(token || '').trim().replace(/^Bearer\s+/i, '');
}

function makeDeviceId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function saveLocalAuth() {
  // Sync to localStorage
  if (savedDeviceId) localStorage.setItem(DEVICE_ID_KEY, savedDeviceId);
  if (savedRefreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, savedRefreshToken);

  // Sync to server-side storage (Node.js server or Vite middleware)
  await fetch(LOCAL_AUTH_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ deviceId: savedDeviceId, refreshToken: savedRefreshToken, accessToken })
  }).catch(e => {
    console.debug('[Auth] local file save skipped:', e.message);
  });
}

export async function loadLocalAuth() {
  if (localAuthLoaded) return;

  // Initial load from localStorage for immediate availability
  savedDeviceId = localStorage.getItem(DEVICE_ID_KEY) || '';
  savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || '';

  try {
    // Sync with server-side storage (Node.js server or Vite middleware)
    const res = await fetch(LOCAL_AUTH_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      // Server data takes precedence if available
      if (data.deviceId) savedDeviceId = data.deviceId;
      if (data.refreshToken) savedRefreshToken = data.refreshToken;
      
      if (data.accessToken && !accessToken) {
        accessToken = data.accessToken;
        sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      }

      // Sync back to localStorage
      if (savedDeviceId) localStorage.setItem(DEVICE_ID_KEY, savedDeviceId);
      if (savedRefreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, savedRefreshToken);
    }
  } catch (e) {
    console.debug('[Auth] local file load skipped:', e.message);
  }

  if (!savedDeviceId) {
    savedDeviceId = LEGACY_DEVICE_ID || makeDeviceId();
    await saveLocalAuth();
  }

  localAuthLoaded = true;
}

function storeRefreshToken(token) {
  const normalized = normalizeBearerToken(token);
  if (normalized) {
    savedRefreshToken = normalized;
    saveLocalAuth();
  }
}

function storeAccessToken(token) {
  accessToken = normalizeBearerToken(token);
  if (accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    saveLocalAuth();
  }
}

function clearRefreshTimer() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

export function decodeJwt(token) {
  try {
    const payload = normalizeBearerToken(token).split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getTokenExpiry(token) {
  const payload = decodeJwt(token);
  return payload?.exp ? payload.exp * 1000 : 0;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return savedRefreshToken;
}

export function getDeviceId() {
  if (!savedDeviceId) {
    savedDeviceId = LEGACY_DEVICE_ID || makeDeviceId();
    saveLocalAuth();
  }
  return savedDeviceId;
}

export function setDeviceId(deviceId) {
  const normalized = String(deviceId || '').trim();
  if (!normalized) return;
  savedDeviceId = normalized;
  saveLocalAuth();
}

export function updateRefreshToken(token) {
  const parsed = readJsonToken(token);
  storeRefreshToken(parsed.refreshToken || token);
}

export function updateAccessToken(token) {
  const parsed = readJsonToken(token);
  storeAccessToken(parsed.accessToken || token);
  scheduleRefresh();
}

export function importTokens(input) {
  const parsed = readJsonToken(input);
  if (parsed.deviceId) setDeviceId(parsed.deviceId);
  if (parsed.refreshToken) storeRefreshToken(parsed.refreshToken);
  if (parsed.accessToken) storeAccessToken(parsed.accessToken);
  if (!parsed.refreshToken && !parsed.accessToken) {
    const token = normalizeBearerToken(input);
    if (token.split('.').length === 3) storeAccessToken(token);
    else storeRefreshToken(token);
  }
  scheduleRefresh();
}

export function getAuthState() {
  const payload = decodeJwt(accessToken);
  const expiresAt = getTokenExpiry(accessToken);
  return {
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(savedRefreshToken),
    deviceId: getDeviceId(),
    expiresAt,
    expiresInSeconds: expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 0,
    userId: payload?.uid || payload?.sub || '',
    timezone: payload?.tz || '',
    country: payload?.cty || ''
  };
}

export async function refreshSession() {
  await loadLocalAuth();
  const refreshToken = savedRefreshToken;
  if (!refreshToken) throw new Error('Refresh Token is not set');

  const res = await fetch('/api/v1/auth/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), type: 'refresh', refreshToken })
  });

  if (!res.ok) {
    throw new Error(`Session refresh failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.accessToken) throw new Error('accessToken is missing in response');

  storeAccessToken(data.accessToken);
  if (data.refreshToken) storeRefreshToken(data.refreshToken);
  scheduleRefresh();
  window.dispatchEvent(new CustomEvent('zeta-auth-updated', { detail: getAuthState() }));
  return accessToken;
}

export async function ensureAccessToken() {
  if (accessToken && getTokenExpiry(accessToken) > Date.now() + 30000) {
    return accessToken;
  }
  return refreshSession();
}

function scheduleRefresh() {
  clearRefreshTimer();
  if (!accessToken || !savedRefreshToken) return;

  const expiry = getTokenExpiry(accessToken);
  if (!expiry) return;

  const delay = Math.max(expiry - Date.now() - 600000, 10000);
  refreshTimer = setTimeout(async () => {
    try {
      await refreshSession();
      console.log('[Auth] Token auto-refreshed');
    } catch (e) {
      console.error('[Auth] Auto-refresh failed:', e);
      window.dispatchEvent(new CustomEvent('zeta-auth-error', { detail: e.message }));
    }
  }, delay);
}

export async function initAuth() {
  await loadLocalAuth();

  const cachedAccessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (cachedAccessToken && getTokenExpiry(cachedAccessToken) > Date.now() + 30000) {
    accessToken = cachedAccessToken;
    scheduleRefresh();
    return true;
  }

  if (!savedRefreshToken) return false;

  try {
    await refreshSession();
    return true;
  } catch (e) {
    console.error('[Auth] Init failed:', e);
    return false;
  }
}

export async function clearSession() {
  clearRefreshTimer();
  accessToken = null;
  savedRefreshToken = '';
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  // We keep deviceId in localStorage even after logout to maintain device identity
  // localStorage.removeItem(DEVICE_ID_KEY); 
  
  await fetch(LOCAL_AUTH_ENDPOINT, { method: 'DELETE' }).catch(() => {});
  window.dispatchEvent(new CustomEvent('zeta-auth-updated', { detail: getAuthState() }));
}
