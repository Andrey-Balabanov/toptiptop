/* API client with auth, retry, and offline queue */

const BASE_URL = '/api';

let authToken = null;
try {
  authToken = localStorage.getItem('toptip-token') || null;
} catch {}

export function getToken() {
  return authToken;
}

export function setToken(token) {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem('toptip-token', token);
    } else {
      localStorage.removeItem('toptip-token');
    }
  } catch {}
}

export function isLoggedIn() {
  return !!authToken;
}

async function request(method, path, body = null) {
  const url = BASE_URL + path;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (authToken) {
    options.headers['Authorization'] = 'Bearer ' + authToken;
  }
  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 401) {
        setToken(null);
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'UNAUTHORIZED');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (err.message === 'UNAUTHORIZED') throw err;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 500));
      }
    }
  }
  // All retries exhausted - queue for later sync
  queueForLater({ method, path, body });
  throw lastErr;
}

const QUEUE_KEY = 'toptip-sync-queue';

function queueForLater(data) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    queue.push({ ...data, timestamp: Date.now() });
    // Keep max 50 queued items
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-50)));
  } catch {}
}

export async function syncQueue() {
  if (!authToken) return;
  let queue;
  try {
    queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return; }
  if (queue.length === 0) return;

  const remaining = [];
  for (const item of queue) {
    try {
      await request(item.method, item.path, item.body);
    } catch {
      remaining.push(item);
    }
  }
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {}
}

/* Auth endpoints — only email+password login and username+email+password register */
export function registerUser(username, password, email) {
  return request('POST', '/auth/register', { username, password, email });
}

export function loginUser(email, password) {
  return request('POST', '/auth/login', { email, password });
}

export function verifyEmail(email, code) {
  return request('POST', '/auth/verify-email', { email, code });
}

export function resendCode(email) {
  return request('POST', '/auth/resend-code', { email });
}

/* User endpoints */
export function fetchMe() {
  return request('GET', '/users/me');
}

export function updateLanguage(language) {
  return request('PATCH', '/users/me/language', { language });
}

export function updateProfile(profile) {
  return request('PATCH', '/users/me/profile', { profile });
}

export function updateKeyboardLayout(layout) {
  return request('PATCH', '/users/me/keyboard', { layout });
}

/* Session endpoints */
export function saveSession(data) {
  return request('POST', '/sessions', data);
}

export function saveDraft(data) {
  return request('POST', '/sessions/draft', data);
}

export function fetchSessions(params = {}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.mode) qs.set('mode', params.mode);
  const path = '/sessions?' + qs.toString();
  return request('GET', path);
}

/* Leaderboard */
export function fetchLeaderboard(type = 'wpm', limit = 20) {
  return request('GET', `/users/leaderboard?type=${type}&limit=${limit}`);
}
