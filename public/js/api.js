/* API client with auth, retry, and offline queue */

const BASE_URL = '/api';

let authToken = null;
try {
  authToken = localStorage.getItem('toptip-token') || null;
} catch {}
if (!authToken) {
  try {
    authToken = sessionStorage.getItem('toptip-token') || null;
  } catch {}
}

export function getToken() {
  return authToken;
}

export function setToken(token) {
  authToken = token;
  if (token) {
    try {
      localStorage.setItem('toptip-token', token);
    } catch {}
    try {
      sessionStorage.setItem('toptip-token', token);
    } catch {}
  } else {
    try {
      localStorage.removeItem('toptip-token');
    } catch {}
    try {
      sessionStorage.removeItem('toptip-token');
    } catch {}
    try {
      document.cookie = 'toptip_authenticated=; Max-Age=0; Path=/; SameSite=Lax';
    } catch {}
  }
}

export function isLoggedIn() {
  if (authToken) return true;
  try {
    return document.cookie.split(';').some(cookie => cookie.trim() === 'toptip_authenticated=1');
  } catch {
    return false;
  }
}

export async function logout() {
  try {
    await fetch(BASE_URL + '/auth/logout', { method: 'POST' });
  } finally {
    setToken(null);
  }
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
        // A 401 from login/registration means wrong credentials, not an expired
        // session: keep whoever is logged in now (a failed attempt used to log them out)
        if (!path.startsWith('/auth/')) setToken(null);
        const data = await res.json().catch(() => ({}));
        const error = new Error(data.error || 'UNAUTHORIZED');
        error.status = res.status;
        throw error;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error = new Error(data.error || `HTTP ${res.status}`);
        error.status = res.status;
        throw error;
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (err.status || path.startsWith('/auth/')) throw err;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 500));
      }
    }
  }
  // All retries exhausted - queue for later sync
  // Only progress-type writes are worth replaying later; live races, groups and chat are not
  const replayable = !path.startsWith('/auth/') && !path.endsWith('/reset-password') &&
    !path.startsWith('/races') && !path.startsWith('/groups') && !path.startsWith('/chat') && method !== 'GET';
  if (replayable) {
    queueForLater({ method, path, body });
  }
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

export function updateProgress(data) {
  return request('PATCH', '/users/me/progress', data);
}

/* Groups (friends / class / team) */
export function fetchGroups() {
  return request('GET', '/groups');
}
export function createGroup(name) {
  return request('POST', '/groups', { name });
}
export function joinGroup(code) {
  return request('POST', '/groups/join', { code });
}
export function fetchGroup(id) {
  return request('GET', '/groups/' + encodeURIComponent(id));
}
export function leaveGroup(id) {
  return request('DELETE', '/groups/' + encodeURIComponent(id) + '/members/me');
}
export function removeGroupMember(id, userId) {
  return request('DELETE', '/groups/' + encodeURIComponent(id) + '/members/' + encodeURIComponent(userId));
}

/* Player chat: channel is 'global' or 'group:<id>' */
export function fetchChatChannels() {
  return request('GET', '/chat/channels');
}
export function fetchChatMessages(channel, { after, before } = {}) {
  const qs = new URLSearchParams();
  if (after != null) qs.set('after', String(after));
  if (before != null) qs.set('before', String(before));
  const query = qs.toString();
  return request('GET', '/chat/' + encodeURIComponent(channel) + '/messages' + (query ? '?' + query : ''));
}
export function sendChatMessage(channel, body) {
  return request('POST', '/chat/' + encodeURIComponent(channel) + '/messages', { body });
}
export function deleteChatMessage(id) {
  return request('DELETE', '/chat/messages/' + encodeURIComponent(id));
}

/* Weekly challenge */
export function fetchWeeklyChallenge(lang) {
  return request('GET', '/users/challenge/weekly?lang=' + encodeURIComponent(lang));
}

/* Live races */
export function createRace(text, lang) {
  return request('POST', '/races', { text, lang });
}
export function fetchRace(code) {
  return request('GET', '/races/' + encodeURIComponent(code));
}
export function joinRace(code) {
  return request('POST', '/races/' + encodeURIComponent(code) + '/join');
}
export function startRace(code) {
  return request('POST', '/races/' + encodeURIComponent(code) + '/start');
}
export function reportRaceProgress(code, pos, errors) {
  return request('POST', '/races/' + encodeURIComponent(code) + '/progress', { pos, errors });
}
export function leaveRace(code) {
  return request('POST', '/races/' + encodeURIComponent(code) + '/leave');
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

/* Admin endpoints */
export function fetchAdminUsers({ search = '', banned = false } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (banned) params.set('banned', '1');
  const query = params.toString();
  return request('GET', '/admin/users' + (query ? '?' + query : ''));
}

export function updateAdminUser(id, changes) {
  return request('PATCH', `/admin/users/${id}`, changes);
}

export function deleteAdminUser(id) {
  return request('DELETE', `/admin/users/${id}`);
}

export function resetAdminPassword(id, password) {
  return request('POST', `/admin/users/${id}/reset-password`, { password });
}
