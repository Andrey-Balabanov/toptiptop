/* Social features: groups (friends / class / team with a private leaderboard,
 * teacher view for the owner) and live races (lobby + in-race progress bars).
 * All network calls go through api.js; text is escaped before it reaches innerHTML.
 */

import * as api from './api.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function openModal(html, extraClass = '') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal social-modal ${extraClass}">${html}</div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { overlay, modal: overlay.firstElementChild, close };
}

function loginRequired(t, titleKey, onLogin) {
  const { modal, close } = openModal(`
    <h2>${esc(t(titleKey))}</h2>
    <p class="social-note">${esc(t('social.login_needed'))}</p>
    <div class="modal-actions">
      <button id="soc-close">${esc(t('stats.close'))}</button>
      <button class="primary-btn" id="soc-login">${esc(t('auth.login'))}</button>
    </div>`);
  modal.querySelector('#soc-close').onclick = close;
  modal.querySelector('#soc-login').onclick = () => { close(); onLogin(); };
}

/* ============ GROUPS ============ */

export function openGroupsPanel({ t, onLogin }) {
  if (!api.isLoggedIn()) return loginRequired(t, 'groups.title', onLogin);
  const { modal, close } = openModal(`<div id="grp-body"></div>`, 'groups-modal');
  const body = modal.querySelector('#grp-body');

  const showError = err => {
    const el = modal.querySelector('.modal-error');
    if (el) el.textContent = err.message;
  };

  async function renderList() {
    body.innerHTML = `
      <h2>${esc(t('groups.title'))}</h2>
      <p class="social-note">${esc(t('groups.intro'))}</p>
      <div class="modal-error"></div>
      <div class="grp-list" id="grp-list">${esc(t('stats.loading'))}</div>
      <div class="grp-forms">
        <div class="grp-form">
          <input id="grp-name" maxlength="40" placeholder="${esc(t('groups.name_placeholder'))}">
          <button class="primary-btn" id="grp-create">${esc(t('groups.create'))}</button>
        </div>
        <div class="grp-form">
          <input id="grp-code" maxlength="6" placeholder="${esc(t('groups.code_placeholder'))}" autocapitalize="characters">
          <button id="grp-join">${esc(t('groups.join'))}</button>
        </div>
      </div>
      <div class="modal-actions"><button id="grp-close">${esc(t('stats.close'))}</button></div>`;
    body.querySelector('#grp-close').onclick = close;
    body.querySelector('#grp-create').onclick = async () => {
      try {
        const g = await api.createGroup(body.querySelector('#grp-name').value.trim());
        renderGroup(g.id);
      } catch (err) { showError(err); }
    };
    body.querySelector('#grp-join').onclick = async () => {
      try {
        const g = await api.joinGroup(body.querySelector('#grp-code').value.trim());
        renderGroup(g.id);
      } catch (err) { showError(err); }
    };
    try {
      const groups = await api.fetchGroups();
      const list = body.querySelector('#grp-list');
      if (!list) return;
      list.innerHTML = groups.length
        ? groups.map(g => `<button class="grp-item" data-id="${g.id}">
            <b>${esc(g.name)}</b><span>${esc(t('groups.members').replace('{n}', g.memberCount))}${g.isOwner ? ' · ' + esc(t('groups.you_own')) : ''}</span>
          </button>`).join('')
        : `<p class="social-note">${esc(t('groups.none'))}</p>`;
      list.querySelectorAll('.grp-item').forEach(b => { b.onclick = () => renderGroup(Number(b.dataset.id)); });
    } catch (err) { showError(err); }
  }

  async function renderGroup(id) {
    body.innerHTML = `<p class="social-note">${esc(t('stats.loading'))}</p>`;
    let g;
    try { g = await api.fetchGroup(id); } catch (err) { body.innerHTML = `<div class="modal-error">${esc(err.message)}</div>`; return; }
    const teacherCols = g.isOwner;
    const lastActive = d => (d ? new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString() : '—');
    body.innerHTML = `
      <h2>${esc(g.name)}</h2>
      <p class="social-note">${esc(t('groups.invite'))} <b class="grp-code">${esc(g.code)}</b>
        <button class="small" id="grp-copy">${esc(t('groups.copy'))}</button></p>
      <div class="modal-error"></div>
      <div class="grp-table-wrap"><table class="grp-table">
        <thead><tr>
          <th>#</th><th>${esc(t('groups.col_name'))}</th><th>${esc(t('groups.col_best'))}</th>
          <th>${esc(t('groups.col_week'))}</th><th>${esc(t('groups.col_xp'))}</th>
          ${teacherCols ? `<th>${esc(t('groups.col_acc'))}</th><th>${esc(t('groups.col_active'))}</th><th></th>` : ''}
        </tr></thead>
        <tbody>${g.members.map(m => `<tr>
          <td>${m.rank}</td>
          <td>${esc(m.username)}${m.isOwner ? ' 👑' : ''}</td>
          <td>${Math.round(m.bestWpm)}</td>
          <td>${m.weekSessions} · ${Math.round(m.weekBestWpm)}</td>
          <td>${m.totalXp}</td>
          ${teacherCols ? `<td>${m.recentAccuracy != null ? m.recentAccuracy + '%' : '—'}</td><td>${lastActive(m.lastActive)}</td>
            <td>${m.isOwner ? '' : `<button class="small grp-remove" data-user="${m.id}" title="${esc(t('groups.remove'))}">✕</button>`}</td>` : ''}
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="social-note small">${esc(t('groups.week_hint'))}</p>
      <div class="modal-actions">
        <button id="grp-leave" class="danger-btn">${esc(t(g.isOwner ? 'groups.delete' : 'groups.leave'))}</button>
        <button id="grp-back">${esc(t('onb.back'))}</button>
      </div>`;
    body.querySelector('#grp-back').onclick = renderList;
    body.querySelector('#grp-copy').onclick = () => {
      navigator.clipboard?.writeText(g.code).catch(() => {});
      body.querySelector('#grp-copy').textContent = t('groups.copied');
    };
    body.querySelector('#grp-leave').onclick = async () => {
      if (!confirm(t(g.isOwner ? 'groups.delete_confirm' : 'groups.leave_confirm'))) return;
      try { await api.leaveGroup(g.id); renderList(); } catch (err) { showError(err); }
    };
    body.querySelectorAll('.grp-remove').forEach(b => {
      b.onclick = async () => {
        try { await api.removeGroupMember(g.id, Number(b.dataset.user)); renderGroup(g.id); } catch (err) { showError(err); }
      };
    });
  }

  renderList();
}

/* ============ RACES ============ */

/**
 * A joined race: polls the room, reports our position, renders progress bars
 * into `#race-bar`, and tells the caller when the race starts and ends.
 */
export class RaceSession {
  constructor(room, { t, onUpdate }) {
    this.t = t;
    this.code = room.code;
    this.text = room.text;
    this.lang = room.lang;
    this.onUpdate = onUpdate;
    this.room = room;
    this.offset = room.serverNow - Date.now(); // server clock − local clock
    this.lastSent = 0;
    this.pending = null;
    this.stopped = false;
    this.timer = setInterval(() => this.poll(), 1000);
    this.render();
  }

  /** Local timestamp at which typing may begin (null before the host starts). */
  startAtLocal() {
    return this.room.startAt ? this.room.startAt - this.offset : null;
  }

  started() {
    const s = this.startAtLocal();
    return s != null && Date.now() >= s;
  }

  async poll() {
    if (this.stopped) return;
    try {
      this.apply(await api.fetchRace(this.code));
    } catch {
      // keep the last state; the next poll retries
    }
  }

  /** Report our position, at most ~2× a second. */
  report(pos, errors) {
    if (this.stopped || !this.started()) return;
    const finished = pos >= this.text.length;
    const now = Date.now();
    if (!finished && now - this.lastSent < 500) {
      clearTimeout(this.pending);
      this.pending = setTimeout(() => this.report(pos, errors), 500);
      return;
    }
    this.lastSent = now;
    api.reportRaceProgress(this.code, pos, errors).then(room => this.apply(room)).catch(() => {});
  }

  apply(room) {
    if (this.stopped) return;
    this.room = room;
    this.offset = room.serverNow - Date.now();
    this.render();
    this.onUpdate?.(room);
  }

  render() {
    const el = document.getElementById('race-bar');
    if (!el) return;
    el.classList.remove('hidden');
    const t = this.t;
    const startIn = this.room.startAt ? Math.ceil((this.startAtLocal() - Date.now()) / 1000) : null;
    let status;
    if (this.room.status === 'waiting') status = t('race.waiting_host');
    else if (startIn > 0) status = t('race.starts_in').replace('{n}', startIn);
    else if (this.room.status === 'finished') status = t('race.finished');
    else status = t('race.go');
    el.innerHTML = `<div class="race-status">🏁 ${esc(t('race.room'))} <b>${esc(this.code)}</b> · ${esc(status)}</div>` +
      this.room.players.map(p => `
        <div class="race-row">
          <span class="race-name">${p.place ? ['🥇', '🥈', '🥉'][p.place - 1] || '#' + p.place : ''} ${esc(p.username)}</span>
          <span class="race-track"><span class="race-fill" style="width:${Math.round(p.progress * 100)}%"></span></span>
          <span class="race-wpm">${p.wpm || 0} WPM</span>
        </div>`).join('');
  }

  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    clearTimeout(this.pending);
    const el = document.getElementById('race-bar');
    if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
    api.leaveRace(this.code).catch(() => {});
  }
}

/**
 * Race lobby: create a room (with a freshly generated text) or join by code,
 * see who's in, and (host) start. `onEnter(room)` is called once the race
 * begins its countdown, so the caller can switch to typing.
 */
export function openRaceLobby({ t, onLogin, makeText, lang, onEnter, meId }) {
  if (!api.isLoggedIn()) return loginRequired(t, 'race.title', onLogin);
  const { modal, close } = openModal(`<div id="race-body"></div>`, 'race-modal');
  const body = modal.querySelector('#race-body');
  let pollTimer = null;
  let entered = false;
  const stopPolling = () => clearInterval(pollTimer);
  const closeLobby = (leaveCode) => {
    stopPolling();
    if (leaveCode && !entered) api.leaveRace(leaveCode).catch(() => {});
    close();
  };

  function renderStart() {
    body.innerHTML = `
      <h2>${esc(t('race.title'))}</h2>
      <p class="social-note">${esc(t('race.intro'))}</p>
      <div class="modal-error"></div>
      <div class="grp-forms">
        <div class="grp-form"><button class="primary-btn" id="race-create">${esc(t('race.create'))}</button></div>
        <div class="grp-form">
          <input id="race-code" maxlength="6" placeholder="${esc(t('race.code_placeholder'))}" autocapitalize="characters">
          <button id="race-join">${esc(t('race.join'))}</button>
        </div>
      </div>
      <div class="modal-actions"><button id="race-close">${esc(t('stats.close'))}</button></div>`;
    body.querySelector('#race-close').onclick = () => closeLobby(null);
    body.querySelector('#race-create').onclick = async () => {
      try { renderRoom(await api.createRace(makeText(), lang)); } catch (err) { body.querySelector('.modal-error').textContent = err.message; }
    };
    body.querySelector('#race-join').onclick = async () => {
      try { renderRoom(await api.joinRace(body.querySelector('#race-code').value.trim())); } catch (err) { body.querySelector('.modal-error').textContent = err.message; }
    };
  }

  function renderRoom(room) {
    if (room.status !== 'waiting' && !entered) {
      entered = true;
      stopPolling();
      close();
      onEnter(room);
      return;
    }
    const isHost = room.hostId === meId;
    body.innerHTML = `
      <h2>${esc(t('race.title'))}</h2>
      <p class="social-note">${esc(t('race.share_code'))}</p>
      <div class="race-code">${esc(room.code)}</div>
      <div class="race-players">${room.players.map(p => `<span>👤 ${esc(p.username)}${p.id === room.hostId ? ' 👑' : ''}</span>`).join('')}</div>
      <p class="social-note">${esc(t(isHost ? 'race.host_hint' : 'race.wait_hint'))}</p>
      <div class="modal-error"></div>
      <div class="modal-actions">
        <button id="race-leave">${esc(t('race.leave'))}</button>
        ${isHost ? `<button class="primary-btn" id="race-start">${esc(t('race.start'))}</button>` : ''}
      </div>`;
    body.querySelector('#race-leave').onclick = () => closeLobby(room.code);
    const startBtn = body.querySelector('#race-start');
    if (startBtn) {
      startBtn.onclick = async () => {
        try { renderRoom(await api.startRace(room.code)); } catch (err) { body.querySelector('.modal-error').textContent = err.message; }
      };
    }
    stopPolling();
    pollTimer = setInterval(async () => {
      try { renderRoom(await api.fetchRace(room.code)); } catch { /* retry next tick */ }
    }, 1000);
  }

  renderStart();
}
