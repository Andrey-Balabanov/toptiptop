/* Auth UI: modals, history, leaderboard, profile settings */

import * as api from './api.js';
import * as progress from './progress.js';
import { t, setLanguage, applyLanguageToDOM, getLanguage, getLocaleDict } from './i18n.js';

let onAuthChange = null;

export function setAuthChangeCallback(cb) {
  onAuthChange = cb;
}

/* Render auth bar - progress/achievements are always visible for all users */
export function renderAuthBar() {
  const bar = document.getElementById('auth-bar');
  if (!bar) return;

  if (api.isLoggedIn()) {
    api.fetchMe()
      .then(user => {
        bar.innerHTML = `
          <span class="username">${escapeHtml(user.username)}</span>
          ${user.role === 'admin' ? '<button class="small" id="btn-admin">Админ-панель</button>' : ''}
          <button class="theme-btn" id="btn-theme" title="${t('label.theme')}">🌙/☀️</button>
          <button class="small" id="btn-logout">${t('auth.logout')}</button>
        `;
        applyLanguageToDOM();

        const adminBtn = document.getElementById('btn-admin');
        if (adminBtn) adminBtn.onclick = () => { window.location.href = '/admin.html'; };

        document.getElementById('btn-logout').onclick = () => {
          api.setToken(null);
          if (onAuthChange) onAuthChange();
        };

        // Theme toggle
        document.getElementById('btn-theme').onclick = () => {
          const isLight = document.documentElement.classList.toggle('light-theme');
          try { localStorage.setItem('toptip-theme', isLight ? 'light' : 'dark'); } catch {}
        };

        // Add sidebar buttons for secondary actions
        addSidebarButtons(user);

        // Sync progress from server (merges with any guest progress saved in localStorage)
        progress.initFromServer(user);

        // Notify main.js with server user data
        window.dispatchEvent(new CustomEvent('auth-login', { detail: { user } }));
      })
      .catch(() => {
        api.setToken(null);
        renderGuestBar();
        window.dispatchEvent(new CustomEvent('auth-logout'));
      });
  } else {
    renderGuestBar();
    // Progress/achievements stay visible for guests (loaded from localStorage)
    progress.init();
    window.dispatchEvent(new CustomEvent('auth-logout'));
  }
}

function renderGuestBar() {
  const bar = document.getElementById('auth-bar');
  if (!bar) return;
  bar.innerHTML = `
    <button class="theme-btn" id="btn-theme" title="${t('label.theme')}">🌙/☀️</button>
    <button class="small" id="btn-login">${t('auth.login')}</button>
    <button class="small" id="btn-register">${t('auth.register')}</button>
  `;
  applyLanguageToDOM();

  // Theme toggle
  document.getElementById('btn-theme').onclick = () => {
    const isLight = document.documentElement.classList.toggle('light-theme');
    try { localStorage.setItem('toptip-theme', isLight ? 'light' : 'dark'); } catch {}
  };

  document.getElementById('btn-login').onclick = () => showAuthModal('login');
  document.getElementById('btn-register').onclick = () => showAuthModal('register');

  // Add sidebar buttons for guest (includes Settings)
  addSidebarButtons(null);
}

/**
 * Add secondary action buttons to the controls sidebar area:
 * history, leaderboard, arrows toggle, and settings.
 * History and leaderboard are logged-in only; settings and arrows are for ALL users.
 *
 * @param {object|null} user - User object from server, or null for guests.
 */
function addSidebarButtons(user) {
  const controls = document.getElementById('controls');
  if (!controls) return;

  // Remove old sidebar buttons if any
  const existingGroup = document.getElementById('sidebar-btn-group');
  if (existingGroup) existingGroup.remove();

  const group = document.createElement('div');
  group.id = 'sidebar-btn-group';
  group.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;';

  // Arrow toggle — use full translated label (e.g. "↕ Arrows" / "↕ Стрелки")
  const arrowBtn = document.createElement('button');
  arrowBtn.className = 'small';
  arrowBtn.textContent = t('btn.arrows');
  const showArrows = localStorage.getItem('toptip-show-arrows') !== 'false';
  if (showArrows) arrowBtn.classList.add('active');
  arrowBtn.onclick = () => {
    const current = localStorage.getItem('toptip-show-arrows') !== 'false';
    const next = !current;
    localStorage.setItem('toptip-show-arrows', next ? 'true' : 'false');
    arrowBtn.classList.toggle('active', next);
    window.dispatchEvent(new CustomEvent('arrows-toggled', { detail: { show: next } }));
  };
  group.appendChild(arrowBtn);

  // History button (logged-in only) — text from i18n already includes 📊
  if (api.isLoggedIn()) {
    const histBtn = document.createElement('button');
    histBtn.className = 'small';
    histBtn.textContent = t('btn.history');
    histBtn.onclick = () => toggleHistory();
    group.appendChild(histBtn);

    // Leaderboard button — text from i18n already includes 🏆
    const lbBtn = document.createElement('button');
    lbBtn.className = 'small';
    lbBtn.textContent = t('btn.leaderboard');
    lbBtn.onclick = () => toggleLeaderboard();
    group.appendChild(lbBtn);
  }

  // Settings button — shown for ALL users (guests get guest settings modal)
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'small';
  settingsBtn.textContent = t('btn.settings');
  settingsBtn.onclick = () => {
    if (api.isLoggedIn() && user) {
      api.fetchMe().then(u => showProfileSettings(u)).catch(() => {});
    } else {
      showGuestSettings();
    }
  };
  group.appendChild(settingsBtn);

  controls.appendChild(group);
}

/**
 * Guest settings modal — allows language, text profile, and keyboard layout
 * to be configured without requiring login. Settings are persisted to localStorage.
 */
function showGuestSettings() {
  const currentLang = getLanguage();
  const dict = getLocaleDict(currentLang);

  // Load guest preferences from localStorage
  let guestLang = currentLang;
  let guestProfile = 'general';
  let guestKeyboard = 'pc-ansi';
  try {
    guestLang = localStorage.getItem('toptip-lang') || currentLang;
    guestProfile = localStorage.getItem('toptip-guest-profile') || 'general';
    guestKeyboard = localStorage.getItem('toptip-keyboard-layout') || 'pc-ansi';
  } catch {}

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 450px;">
      <h2>${t('settings.title')}</h2>
      <div id="profile-error" class="modal-error"></div>

      <label>${t('settings.language')}</label>
      <select id="profile-language" style="width:100%;padding:10px 14px;margin-bottom:14px;background:var(--panel-2);border:1px solid var(--key-border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;">
        <option value="ru" ${guestLang === 'ru' ? 'selected' : ''}>${t('lang.ru')}</option>
        <option value="en" ${guestLang === 'en' ? 'selected' : ''}>${t('lang.en')}</option>
        <option value="de" ${guestLang === 'de' ? 'selected' : ''}>${t('lang.de')}</option>
        <option value="fr" ${guestLang === 'fr' ? 'selected' : ''}>${t('lang.fr')}</option>
        <option value="es" ${guestLang === 'es' ? 'selected' : ''}>${t('lang.es')}</option>
        <option value="it" ${guestLang === 'it' ? 'selected' : ''}>${t('lang.it')}</option>
        <option value="pt" ${guestLang === 'pt' ? 'selected' : ''}>${t('lang.pt')}</option>
        <option value="pl" ${guestLang === 'pl' ? 'selected' : ''}>${t('lang.pl')}</option>
        <option value="uk" ${guestLang === 'uk' ? 'selected' : ''}>${t('lang.uk')}</option>
      </select>

      <label>${t('settings.profile')}</label>
      <select id="profile-type" style="width:100%;padding:10px 14px;margin-bottom:14px;background:var(--panel-2);border:1px solid var(--key-border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;">
        <option value="general" ${guestProfile === 'general' ? 'selected' : ''}>${t('profile.general')}</option>
        <option value="writer" ${guestProfile === 'writer' ? 'selected' : ''}>${t('profile.writer')}</option>
        <option value="programmer" ${guestProfile === 'programmer' ? 'selected' : ''}>${t('profile.programmer')}</option>
        <option value="accountant" ${guestProfile === 'accountant' ? 'selected' : ''}>${t('profile.accountant')}</option>
        <option value="journalist" ${guestProfile === 'journalist' ? 'selected' : ''}>${t('profile.journalist')}</option>
        <option value="student" ${guestProfile === 'student' ? 'selected' : ''}>${t('profile.student')}</option>
        <option value="doctor" ${guestProfile === 'doctor' ? 'selected' : ''}>${t('profile.doctor')}</option>
        <option value="lawyer" ${guestProfile === 'lawyer' ? 'selected' : ''}>${t('profile.lawyer')}</option>
      </select>

      <label>${t('settings.keyboard')}</label>
      <select id="profile-keyboard" style="width:100%;padding:10px 14px;margin-bottom:14px;background:var(--panel-2);border:1px solid var(--key-border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;">
        <option value="pc-ansi" ${guestKeyboard === 'pc-ansi' ? 'selected' : ''}>PC Windows (ANSI)</option>
        <option value="pc-iso" ${guestKeyboard === 'pc-iso' ? 'selected' : ''}>PC Windows (ISO)</option>
        <option value="mac-ansi" ${guestKeyboard === 'mac-ansi' ? 'selected' : ''}>Mac (ANSI)</option>
        <option value="mac-iso" ${guestKeyboard === 'mac-iso' ? 'selected' : ''}>Mac (ISO)</option>
      </select>

      <div class="modal-actions">
        <button class="ghost-btn" id="profile-cancel">${t('settings.close')}</button>
        <button class="primary-btn" id="profile-save">${t('settings.save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('profile-cancel').onclick = close;

  document.getElementById('profile-save').onclick = () => {
    const language = document.getElementById('profile-language').value;
    const profile = document.getElementById('profile-type').value;
    const keyboardLayout = document.getElementById('profile-keyboard').value;

    // Persist guest settings to localStorage
    try {
      localStorage.setItem('toptip-lang', language);
      localStorage.setItem('toptip-guest-profile', profile);
      localStorage.setItem('toptip-keyboard-layout', keyboardLayout);
    } catch {}

    // Apply language immediately
    setLanguage(language);
    applyLanguageToDOM();

    close();

    // Dispatch event for main.js to pick up guest preferences
    window.dispatchEvent(new CustomEvent('profile-changed', {
      detail: { language, profile, keyboardLayout }
    }));
  };
}

/* Keyboard layout definitions */
const KB_LAYOUT_OPTIONS = [
  { id: 'pc-ansi', label: 'PC Windows (ANSI)' },
  { id: 'pc-iso', label: 'PC Windows (ISO)' },
  { id: 'mac-ansi', label: 'Mac (ANSI)' },
  { id: 'mac-iso', label: 'Mac (ISO)' },
];

/* --- Profile settings modal (logged-in users only) --- */
function showProfileSettings(user) {
  const currentLang = getLanguage();
  const dict = getLocaleDict(currentLang);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 450px;">
      <h2>${t('settings.title')}</h2>
      <div id="profile-error" class="modal-error"></div>

      <label>${t('settings.language')}</label>
      <select id="profile-language" style="width:100%;padding:10px 14px;margin-bottom:14px;background:var(--panel-2);border:1px solid var(--key-border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;">
        <option value="ru" ${(user.language || 'ru') === 'ru' ? 'selected' : ''}>${t('lang.ru')}</option>
        <option value="en" ${(user.language || 'en') === 'en' ? 'selected' : ''}>${t('lang.en')}</option>
        <option value="de" ${user.language === 'de' ? 'selected' : ''}>${t('lang.de')}</option>
        <option value="fr" ${user.language === 'fr' ? 'selected' : ''}>${t('lang.fr')}</option>
        <option value="es" ${user.language === 'es' ? 'selected' : ''}>${t('lang.es')}</option>
        <option value="it" ${user.language === 'it' ? 'selected' : ''}>${t('lang.it')}</option>
        <option value="pt" ${user.language === 'pt' ? 'selected' : ''}>${t('lang.pt')}</option>
        <option value="pl" ${user.language === 'pl' ? 'selected' : ''}>${t('lang.pl')}</option>
        <option value="uk" ${user.language === 'uk' ? 'selected' : ''}>${t('lang.uk')}</option>
      </select>

      <label>${t('settings.profile')}</label>
      <select id="profile-type" style="width:100%;padding:10px 14px;margin-bottom:14px;background:var(--panel-2);border:1px solid var(--key-border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;">
        <option value="general" ${(user.profile || 'general') === 'general' ? 'selected' : ''}>${t('profile.general')}</option>
        <option value="writer" ${user.profile === 'writer' ? 'selected' : ''}>${t('profile.writer')}</option>
        <option value="programmer" ${user.profile === 'programmer' ? 'selected' : ''}>${t('profile.programmer')}</option>
        <option value="accountant" ${user.profile === 'accountant' ? 'selected' : ''}>${t('profile.accountant')}</option>
        <option value="journalist" ${user.profile === 'journalist' ? 'selected' : ''}>${t('profile.journalist')}</option>
        <option value="student" ${user.profile === 'student' ? 'selected' : ''}>${t('profile.student')}</option>
        <option value="doctor" ${user.profile === 'doctor' ? 'selected' : ''}>${t('profile.doctor')}</option>
        <option value="lawyer" ${user.profile === 'lawyer' ? 'selected' : ''}>${t('profile.lawyer')}</option>
      </select>

      <label>${t('settings.keyboard')}</label>
      <select id="profile-keyboard" style="width:100%;padding:10px 14px;margin-bottom:14px;background:var(--panel-2);border:1px solid var(--key-border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;">
        ${KB_LAYOUT_OPTIONS.map(opt => `
          <option value="${opt.id}" ${(user.keyboardLayout || 'pc-ansi') === opt.id ? 'selected' : ''}>${opt.label}</option>
        `).join('')}
      </select>

      <div class="modal-actions">
        <button class="ghost-btn" id="profile-cancel">${t('settings.close')}</button>
        <button class="primary-btn" id="profile-save">${t('settings.save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('profile-cancel').onclick = close;

  document.getElementById('profile-save').onclick = async () => {
    const language = document.getElementById('profile-language').value;
    const profile = document.getElementById('profile-type').value;
    const keyboardLayout = document.getElementById('profile-keyboard').value;
    const errEl = document.getElementById('profile-error');
    try {
      await api.updateLanguage(language);
      await api.updateProfile(profile);
      await api.updateKeyboardLayout(keyboardLayout);
      // Apply language immediately via i18n module
      setLanguage(language);
      applyLanguageToDOM();
      close();
      // Dispatch events for main.js
      window.dispatchEvent(new CustomEvent('profile-changed', { detail: { language, profile, keyboardLayout } }));
      renderAuthBar(); // Refresh
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

/* --- Auth modal (email-based login / registration) --- */
function addTabNavigation(inputs, submitCallback) {
  inputs.forEach((input, i) => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitCallback();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        let nextIndex = i + direction;
        if (nextIndex < 0) nextIndex = inputs.length - 1;
        if (nextIndex >= inputs.length) nextIndex = 0;
        const next = inputs[nextIndex];
        if (next) next.focus();
      }
    });
  });
}

export function showAuthModal(mode = 'login') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${mode === 'login' ? t('auth.login_title') : t('auth.register_title')}</h2>
      <div id="auth-error" class="modal-error"></div>
      ${mode === 'register' ? `
        <label>${t('auth.username')}</label>
        <input type="text" id="auth-username" placeholder="3–30" autocomplete="username">
      ` : ''}
      <label>${t('auth.email')}</label>
      <input type="email" id="auth-email" placeholder="your@email.com" autocomplete="email">
      <label>${t('auth.password')}</label>
      <input type="password" id="auth-password" placeholder="мин. 6" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}">
      <div class="modal-actions">
        <button class="ghost-btn" id="auth-cancel">${t('auth.cancel')}</button>
        <button class="primary-btn" id="auth-submit">${mode === 'login' ? t('auth.submit_login') : t('auth.submit_register')}</button>
      </div>
      <div class="modal-switch" id="auth-switch">
        ${mode === 'login' ? t('auth.no_account') : t('auth.has_account')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('auth-cancel').onclick = close;

  const emailInput = document.getElementById('auth-email');
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');
  const submitBtn = document.getElementById('auth-submit');
  const errorEl = document.getElementById('auth-error');

  const doAuth = async () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      errorEl.textContent = t('auth.email_error');
      emailInput.focus();
      return;
    }

    if (mode === 'register') {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (username.length < 3) { errorEl.textContent = t('auth.username_error'); usernameInput.focus(); return; }
      if (password.length < 6) { errorEl.textContent = t('auth.password_error'); passwordInput.focus(); return; }
      try {
        const result = await api.registerUser(username, password, email);
        if (result.needVerification) {
          close();
          showCodeVerification(email, result);
        } else {
          api.setToken(result.token);
          close();
          if (onAuthChange) onAuthChange();
          api.syncQueue();
        }
      } catch (err) {
        errorEl.textContent = err.message;
      }
    } else {
      const password = passwordInput.value;
      if (!password || password.length < 6) {
        errorEl.textContent = t('auth.password_error');
        passwordInput.focus();
        return;
      }
      try {
        const result = await api.loginUser(email, password);
        api.setToken(result.token);
        close();
        if (onAuthChange) onAuthChange();
        api.syncQueue();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    }
  };

  submitBtn.onclick = doAuth;

  const tabbable = mode === 'register'
    ? [usernameInput, emailInput, passwordInput, submitBtn]
    : [emailInput, passwordInput, submitBtn];

  addTabNavigation(tabbable, doAuth);

  if (submitBtn) {
    submitBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        (mode === 'register' ? usernameInput : emailInput).focus();
      }
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        passwordInput.focus();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        doAuth();
      }
    });
  }

  document.getElementById('auth-switch').onclick = () => {
    close();
    showAuthModal(mode === 'login' ? 'register' : 'login');
  };

  if (mode === 'register') {
    if (usernameInput) usernameInput.focus();
  } else {
    emailInput.focus();
  }
}

/* Show code verification modal (registration only) */
function showCodeVerification(email, result) {
  const message = result.message || '';
  const code = result.code || null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>✉️ ${t('auth.verify_code')}</h2>
      <p style="color:var(--dim);font-size:13px;margin:0 0 12px;">${escapeHtml(message)}</p>
      <div id="verify-error" class="modal-error"></div>
      <label>${t('auth.verify_code')}</label>
      <input type="text" id="verify-code" placeholder="000000" maxlength="6" style="font-size:24px;letter-spacing:8px;text-align:center;">
      <div class="modal-actions" style="flex-direction:column;gap:8px;">
        <button class="primary-btn" id="verify-submit" style="width:100%;">${t('auth.submit_register')}</button>
        <div style="display:flex;gap:10px;width:100%;">
          <button class="ghost-btn" id="verify-cancel" style="flex:1;">${t('auth.cancel')}</button>
          <button class="ghost-btn" id="verify-resend" style="flex:1;color:var(--accent);border-color:var(--accent);">${t('auth.resend')}</button>
        </div>
      </div>
      <p style="color:var(--dim);font-size:11px;text-align:center;margin:12px 0 0;">
        ${t('auth.check_spam')}
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  // Track the resend countdown timer so it can be cancelled if the modal is
  // closed while the countdown is still running (prevents a leak that would
  // otherwise keep a detached timer + DOM node alive for up to 60s).
  let resendTimer = null;
  const close = () => {
    if (resendTimer) {
      clearInterval(resendTimer);
      resendTimer = null;
    }
    overlay.remove();
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('verify-cancel').onclick = close;

  const codeInput = document.getElementById('verify-code');
  const submitBtn = document.getElementById('verify-submit');
  const resendBtn = document.getElementById('verify-resend');
  const errorEl = document.getElementById('verify-error');

  const doVerify = async () => {
    const code = codeInput.value.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      errorEl.textContent = t('auth.verify_code_error');
      codeInput.focus();
      return;
    }
    try {
      const verifyResult = await api.verifyEmail(email, code);
      api.setToken(verifyResult.token);
      close();
      if (onAuthChange) onAuthChange();
      api.syncQueue();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  };

  const doResend = async () => {
    try {
      resendBtn.disabled = true;
      resendBtn.textContent = '⏳ ' + t('auth.resend') + '...';
      const resendResult = await api.resendCode(email);
      errorEl.textContent = '';
      let countdown = 60;
      resendTimer = setInterval(() => {
        countdown--;
        resendBtn.textContent = '⏳ ' + countdown + 'с';
        if (countdown <= 0) {
          clearInterval(resendTimer);
          resendTimer = null;
          resendBtn.disabled = false;
          resendBtn.textContent = t('auth.resend');
        }
      }, 1000);
    } catch (err) {
      errorEl.textContent = err.message;
      resendBtn.disabled = false;
      resendBtn.textContent = t('auth.resend');
    }
  };

  submitBtn.onclick = doVerify;
  resendBtn.onclick = doResend;

  const tabButtons = [codeInput, submitBtn, resendBtn, document.getElementById('verify-cancel')];
  tabButtons.forEach((el, i, arr) => {
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        let next = (i + dir + arr.length) % arr.length;
        const target = arr[next];
        if (target) target.focus();
      }
      if (e.key === 'Enter' && el !== document.getElementById('verify-cancel')) {
        e.preventDefault();
        if (el === resendBtn) doResend();
        else doVerify();
      }
    });
  });

  codeInput.focus();
}

/* ============ History panel ============ */
let historyOpen = false;

export function toggleHistory() {
  historyOpen = !historyOpen;
  const panel = document.getElementById('history-panel');
  const leaderboard = document.getElementById('leaderboard-panel');
  if (leaderboard) leaderboard.classList.remove('open');
  if (!panel) return;
  panel.classList.toggle('open', historyOpen);
  if (historyOpen) loadHistory();
}

async function loadHistory() {
  const panel = document.getElementById('history-panel');
  if (!panel) return;
  panel.innerHTML = '<h3>' + t('history.title') + '</h3><div class="history-loading">' + t('history.loading') + '</div>';
  try {
    const sessions = await api.fetchSessions({ limit: 50 });
    if (sessions.length === 0) {
      panel.innerHTML = '<h3>' + t('history.title') + '</h3><div class="history-empty">' + t('history.empty') + '</div>';
      return;
    }
    let html = '<h3>' + t('history.title') + '</h3><table class="history-table">' +
      '<thead><tr><th>' + t('history.date') + '</th><th>' + t('history.mode') + '</th><th>WPM</th><th>%</th><th>' + t('stats.errors') + '</th><th>XP</th><th>' + t('stats.streak') + '</th></tr></thead><tbody>';
    sessions.forEach(s => {
      const date = new Date(s.createdAt).toLocaleString(getLanguage() === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      const draftBadge = s.isDraft ? ' <span class="draft-badge">' + t('history.draft') + '</span>' : '';
      html += '<tr>' +
        '<td>' + date + draftBadge + '</td>' +
        '<td>' + escapeHtml(s.mode) + '</td>' +
        '<td class="wpm-cell">' + s.wpm + '</td>' +
        '<td>' + s.accuracy + '%</td>' +
        '<td>' + s.totalErrors + '</td>' +
        '<td class="xp-cell">+' + s.xpEarned + '</td>' +
        '<td>' + s.streakMax + '</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    panel.innerHTML = html;
  } catch (err) {
    panel.innerHTML = '<h3>' + t('history.title') + '</h3><div class="history-empty">' + t('error.load_sessions') + ': ' + escapeHtml(err.message) + '</div>';
  }
}

/* ============ Leaderboard panel ============ */
let leaderboardOpen = false;

export function toggleLeaderboard() {
  leaderboardOpen = !leaderboardOpen;
  const panel = document.getElementById('leaderboard-panel');
  const history = document.getElementById('history-panel');
  if (history) history.classList.remove('open');
  historyOpen = false;
  if (!panel) return;
  panel.classList.toggle('open', leaderboardOpen);
  if (leaderboardOpen) loadLeaderboard();
}

async function loadLeaderboard() {
  const panel = document.getElementById('leaderboard-panel');
  if (!panel) return;
  panel.innerHTML = '<h3>' + t('leaderboard.title') + '</h3><div class="history-loading">' + t('leaderboard.loading') + '</div>';
  try {
    const data = await api.fetchLeaderboard('wpm', 20);
    if (!data || data.length === 0) {
      panel.innerHTML = '<h3>' + t('leaderboard.title') + '</h3><div class="history-empty">' + t('leaderboard.empty') + '</div>';
      return;
    }
    let html = '<h3>' + t('leaderboard.title') + '</h3><table class="leaderboard-table">' +
      '<thead><tr><th>' + t('leaderboard.rank') + '</th><th>' + t('leaderboard.player') + '</th><th>WPM</th><th>XP</th><th>' + t('leaderboard.sessions') + '</th></tr></thead><tbody>';
    data.forEach(row => {
      const cls = row.rank <= 3 ? 'rank-' + row.rank : '';
      html += '<tr class="' + cls + '">' +
        '<td>' + row.rank + '</td>' +
        '<td>' + escapeHtml(row.username) + '</td>' +
        '<td>' + row.bestWpm + '</td>' +
        '<td>' + row.totalXp + '</td>' +
        '<td>' + row.sessionCount + '</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    panel.innerHTML = html;
  } catch (err) {
    panel.innerHTML = '<h3>' + t('leaderboard.title') + '</h3><div class="history-empty">' + t('error.load_leaderboard') + ': ' + escapeHtml(err.message) + '</div>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
