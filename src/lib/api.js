// ===== API Client =====
import { ensureAccessToken, getAccessToken, refreshSession } from './auth.js';

const BASE = '/api';

function headers(extra = {}) {
  const h = { Accept: 'application/json', ...extra };
  const token = getAccessToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}, retry = true) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: headers(options.headers || {})
  });

  if (res.status === 401 && retry) {
    await refreshSession();
    return request(path, options, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function get(path) {
  await ensureAccessToken();
  return request(path);
}

async function post(path, body = null) {
  await ensureAccessToken();
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return request(path, opts);
}

async function put(path, body) {
  await ensureAccessToken();
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function del(path, body = null) {
  await ensureAccessToken();
  const opts = { method: 'DELETE', headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return request(path, opts);
}

async function patch(path, body) {
  await ensureAccessToken();
  return request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Home
export function getHomePlots(limit = 16, cursor = '') {
  return get(`/v1/infinite-plots?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}

export function getSpecialCuration() {
  return get('/v1/special-curation');
}

export function getBanners() {
  return get('/v1/banners');
}

export function getPopups() {
  return get('/v1/popups');
}

export function getFeatureFlag(name) {
  return get(`/v1/feature-flags/${encodeURIComponent(name)}`);
}

// Rankings
export function getGenresRanking() {
  return get('/v1/genres/ranking');
}

export function getRanking(type = 'BEST', limit = 20, filterValues = 'all') {
  const apiType = type === 'TREND' ? 'TRENDING' : type;
  return get(`/v1/plots/ranking?limit=${limit}&gender=MALE&type=${apiType}&filterType=GENRE&filterValues=${encodeURIComponent(filterValues)}`);
}

// Plots / rooms
export function getPlot(plotId) {
  return get(`/v1/plots/${plotId}`);
}

export function getPlotImages(plotId) {
  return get(`/v2/plots/${plotId}/images`);
}

export function getCharacterImages(plotId, characterId) {
  return get(`/v2/plots/${plotId}/characters/${characterId}/images`);
}

export function getSimilarPlots(plotId, limit = 12) {
  return get(`/v1/plots/${plotId}/similar-plots?limit=${limit}`);
}

export function getLikedPlots(limit = 30) {
  return get(`/v1/plots/liked?limit=${limit}`);
}

export function getActiveRoomId(plotId) {
  return get(`/v1/rooms/active-room-id?plotId=${encodeURIComponent(plotId)}`);
}

export function createRoom(plotId) {
  return post('/v1/rooms', { plotId });
}

export function getRooms(limit = 30) {
  return get(`/v1/rooms?limit=${limit}&orderBy.property=LAST_MESSAGE_TIME&orderBy.direction=DESC`);
}

export function getRoom(roomId) {
  return get(`/v1/rooms/${roomId}`);
}

export function deleteRoom(roomId) {
  return del(`/v1/rooms/${roomId}`);
}

export function getRoomModelSetting(roomId) {
  return get(`/v1/rooms/${roomId}/model-setting`);
}

export function getRoomCyoaSetting(roomId) {
  return get(`/v1/rooms/${roomId}/settings/cyoa`);
}

export function getIntroBeforeSelection(roomId) {
  return get(`/v1/rooms/${roomId}/intros/before-selection`);
}

export function createIntro(roomId) {
  return post(`/v1/rooms/${roomId}/intros`);
}

export function getSelectedPersona(plotId, roomId) {
  return get(`/v1/plots/${plotId}/rooms/${roomId}/user-personas/selected`);
}

// Messages
export function getMessages(roomId, limit = 30) {
  return get(`/v1/rooms/${roomId}/messages?limit=${limit}`);
}

export function getMessagesByCursor(roomId, cursor, limit = 30) {
  return get(`/v1/rooms/${roomId}/messages?limit=${limit}&cursor=${encodeURIComponent(`${roomId}:${cursor}`)}`);
}

// Send message (SSE stream)
export async function sendMessageStream(roomId, text, onEvent, onDone) {
  await ensureAccessToken();
  const res = await fetch(`${BASE}/v1/rooms/${roomId}/messages/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'TEXT', text })
  });

  if (!res.ok) throw new Error(`Send failed: ${res.status}`);
  await readSSE(res, onEvent, onDone);
}

// Regen (SSE stream)
export async function regenMessageStream(roomId, messageId, onEvent, onDone) {
  await ensureAccessToken();
  const res = await fetch(`${BASE}/v1/rooms/${roomId}/messages/${messageId}/candidates/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) throw new Error(`Regen failed: ${res.status}`);
  await readSSE(res, onEvent, onDone);
}

// Candidates
export function getCandidates(roomId, messageId, limit = 100) {
  return get(`/v1/rooms/${roomId}/messages/${messageId}/candidates?limit=${limit}`);
}

export function selectCandidate(roomId, messageId, candidateId) {
  return put(`/v1/rooms/${roomId}/messages/${messageId}`, { type: 'CANDIDATE', candidateId });
}

// Edit message
export function editMessage(roomId, messageId, candidateId, text) {
  const requestId = crypto.randomUUID();
  return put(`/v1/rooms/${roomId}/messages/${messageId}/candidates/${candidateId}`, { requestId, text });
}

// Delete messages
export function deleteMessages(roomId, messageId) {
  return del(`/v1/rooms/${roomId}/room-messages`, { messagePointer: { messageId, roomId } });
}

// Recommended replies
export function getRecommended(roomId) {
  return get(`/v1/rooms/${roomId}/recommended-messages`);
}

export function refreshRecommended(roomId) {
  return post(`/v1/rooms/${roomId}/recommended-messages/multiple`);
}

export function getRecommendQuota() {
  return get('/v1/recommended-messages/quota');
}

// Account / session-adjacent endpoints observed in the HAR
export function getCoinBalance() {
  return get('/v1/coin/balance');
}

export function getCoinAutoPaymentSettings() {
  return get('/v1/coin/auto-payment/settings');
}

export function getCreatorStats() {
  return get('/v1/creators/me/stats');
}

export function getZetaPassSubscription() {
  return get('/v1/zeta-pass/subscription');
}

export function getZetaPassPromotionEligibility() {
  return get('/v1/zeta-pass/promotion/eligibility');
}

export function getZetaPassProConversionStatus() {
  return get('/v1/zeta-pass/pro-conversion/status');
}

export function getLatestNotificationTime() {
  return get('/v1/notifications/latest-updated-at');
}

export function getAppPushSetting(type = 'CREATOR_NEW_PLOT') {
  return get(`/v1/app-push/settings/${encodeURIComponent(type)}`);
}

export function getStoreProducts(productType) {
  return get(`/v1/open-stores/ZETA_STORE/products?productType=${encodeURIComponent(productType)}`);
}

export async function getSessionOverview() {
  const settled = await Promise.allSettled([
    getCoinBalance(),
    getCreatorStats(),
    getZetaPassSubscription(),
    getZetaPassPromotionEligibility(),
    getLatestNotificationTime(),
    getUserChatProfiles(20)
  ]);
  const [coin, creatorStats, subscription, promotion, notifications, profiles] = settled.map(r => r.status === 'fulfilled' ? r.value : null);
  return { coin, creatorStats, subscription, promotion, notifications, profiles };
}

// User chat profiles / personas
export function getUserChatProfiles(limit = 20, { plotId = '', roomId = '' } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (plotId) params.set('plotId', plotId);
  if (roomId) params.set('roomId', roomId);
  const query = params.toString();
  return get(`/v1/user-chat-profiles${query ? `?${query}` : ''}`);
}

export function createUserChatProfile({ name, description }) {
  return post('/v1/user-chat-profiles', { name, description });
}

export function checkUserChatProfileAbuse({ name, description }) {
  return post('/v1/user-chat-profiles/abusing', { name, description });
}

export function updateUserChatProfile(profileId, { name, description }) {
  return patch(`/v1/user-chat-profiles/${profileId}`, { name, description });
}

export function deleteUserChatProfile(profileId) {
  return del(`/v1/user-chat-profiles/${profileId}`);
}

export function selectUserChatProfile(profileId, { plotId, roomId } = {}) {
  return put(`/v1/user-chat-profiles/${profileId}/selected`, { plotId, roomId });
}

// Quiz
export function getQuiz() {
  return get('/v1/daily-quizzes');
}

export function joinQuiz(quizId, plotId) {
  return post(`/v1/daily-quizzes/${quizId}/selection`, {
    selection: { type: 'SinglePlotSelection', plotId }
  });
}

export function claimQuiz(quizId) {
  return post(`/v1/daily-quizzes/${quizId}/claim-reward`);
}

// SSE Reader
async function readSSE(res, onEvent, onDone) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // Handle both \r\n and \n line endings
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue; // skip empty lines and SSE comments
      if (!trimmed.startsWith('data:')) continue;
      const jsonText = trimmed.slice(5).trim(); // remove 'data:' prefix
      if (!jsonText || jsonText === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonText);
        onEvent(parsed);
      } catch (e) {
        console.warn('[SSE] Failed to parse:', jsonText.slice(0, 200), e.message);
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data:')) {
      const jsonText = trimmed.slice(5).trim();
      if (jsonText && jsonText !== '[DONE]') {
        try {
          onEvent(JSON.parse(jsonText));
        } catch { /* ignore */ }
      }
    }
  }

  if (onDone) onDone();
}
