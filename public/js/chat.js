/* Player chat: a global room for everyone plus one room per group the player
 * is in. Polls the open room every few seconds while the window is open.
 * Text is escaped before it reaches innerHTML.
 */

import * as api from './api.js';
import { esc, openModal, loginRequired } from './social.js';

const POLL_MS = 3000;
const MAX_LENGTH = 500;
const PAGE_SIZE = 50;

/** 'YYYY-MM-DD HH:MM:SS' (UTC, from SQLite) → local "HH:MM", with the date if not today. */
function formatTime(createdAt) {
  const d = new Date(String(createdAt).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString()} ${time}`;
}

function messageHtml(m, t) {
  return `<div class="chat-msg${m.mine ? ' mine' : ''}" data-id="${m.id}">
    <div class="chat-meta">
      <button class="chat-name" data-name="${esc(m.username)}" title="${esc(t('chat.mention'))}">${esc(m.username)}</button>
      <span class="chat-time">${esc(formatTime(m.createdAt))}</span>
      ${m.canDelete ? `<button class="chat-del" data-id="${m.id}" title="${esc(t('chat.delete'))}">✕</button>` : ''}
    </div>
    <div class="chat-body">${esc(m.body)}</div>
  </div>`;
}

export function openChatPanel({ t, onLogin }) {
  if (!api.isLoggedIn()) return loginRequired(t, 'chat.title', onLogin);
  const { overlay, modal, close } = openModal(`
    <h2>${esc(t('chat.title'))}</h2>
    <div class="chat-tabs" id="chat-tabs" role="tablist"></div>
    <div class="chat-log" id="chat-log" aria-live="polite"></div>
    <div class="modal-error" id="chat-error"></div>
    <form class="chat-form" id="chat-form">
      <input id="chat-input" maxlength="${MAX_LENGTH}" autocomplete="off" placeholder="${esc(t('chat.placeholder'))}">
      <button class="primary-btn" type="submit">${esc(t('chat.send'))}</button>
    </form>
    <p class="social-note small">${esc(t('chat.rules'))}</p>
    <div class="modal-actions"><button id="chat-close">${esc(t('stats.close'))}</button></div>`, 'chat-modal');

  const tabsEl = modal.querySelector('#chat-tabs');
  const log = modal.querySelector('#chat-log');
  const input = modal.querySelector('#chat-input');
  const errorEl = modal.querySelector('#chat-error');
  let channel = 'global';
  let messages = [];
  let hasOlder = false;
  let timer = null;
  let polling = false;

  const isOpen = () => document.body.contains(overlay);
  const showError = err => { errorEl.textContent = err ? err.message : ''; };
  const lastId = () => (messages.length ? messages[messages.length - 1].id : 0);
  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 60;

  function render({ stickToBottom = false, keepFrom = null } = {}) {
    const wasNearBottom = nearBottom();
    const prevHeight = log.scrollHeight;
    log.innerHTML = (hasOlder ? `<button class="chat-older" id="chat-older">${esc(t('chat.older'))}</button>` : '') +
      (messages.length
        ? messages.map(m => messageHtml(m, t)).join('')
        : `<p class="social-note chat-empty">${esc(t('chat.empty'))}</p>`);
    if (keepFrom != null) log.scrollTop = log.scrollHeight - prevHeight + keepFrom;
    else if (stickToBottom || wasNearBottom) log.scrollTop = log.scrollHeight;
  }

  async function loadChannel(id) {
    channel = id;
    messages = [];
    hasOlder = false;
    showError(null);
    tabsEl.querySelectorAll('.chat-tab').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    log.innerHTML = `<p class="social-note">${esc(t('stats.loading'))}</p>`;
    try {
      const page = await api.fetchChatMessages(id);
      if (channel !== id) return;
      messages = page;
      hasOlder = page.length >= PAGE_SIZE;
      render({ stickToBottom: true });
    } catch (err) { showError(err); }
    input.focus();
  }

  async function poll() {
    if (!isOpen()) { clearInterval(timer); return; }
    if (polling || document.hidden) return;
    polling = true;
    const id = channel;
    try {
      const fresh = await api.fetchChatMessages(id, { after: lastId() });
      if (channel === id && fresh.length) {
        const known = new Set(messages.map(m => m.id));
        messages.push(...fresh.filter(m => !known.has(m.id)));
        render();
      }
    } catch {
      // keep what we have; the next poll retries
    } finally {
      polling = false;
    }
  }

  async function loadOlder() {
    if (!messages.length) return;
    const id = channel;
    try {
      const older = await api.fetchChatMessages(id, { before: messages[0].id });
      if (channel !== id) return;
      hasOlder = older.length >= PAGE_SIZE;
      messages = [...older, ...messages];
      render({ keepFrom: log.scrollTop });
    } catch (err) { showError(err); }
  }

  log.addEventListener('click', async e => {
    const target = e.target.closest('button');
    if (!target) return;
    if (target.id === 'chat-older') return loadOlder();
    if (target.classList.contains('chat-name')) {
      const mention = '@' + target.dataset.name + ' ';
      if (!input.value.includes(mention)) input.value = (input.value ? input.value.trimEnd() + ' ' : '') + mention;
      input.focus();
      return;
    }
    if (target.classList.contains('chat-del')) {
      if (!confirm(t('chat.delete_confirm'))) return;
      const id = Number(target.dataset.id);
      try {
        await api.deleteChatMessage(id);
        messages = messages.filter(m => m.id !== id);
        render();
      } catch (err) { showError(err); }
    }
  });

  modal.querySelector('#chat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    const id = channel;
    showError(null);
    input.disabled = true;
    try {
      const msg = await api.sendChatMessage(id, body);
      input.value = '';
      if (channel === id && !messages.some(m => m.id === msg.id)) {
        // Anything others sent meanwhile comes first, then ours
        await poll();
        if (!messages.some(m => m.id === msg.id)) messages.push(msg);
        render({ stickToBottom: true });
      }
    } catch (err) {
      showError(err);
    } finally {
      input.disabled = false;
      input.focus();
    }
  });

  modal.querySelector('#chat-close').onclick = () => { clearInterval(timer); close(); };

  (async () => {
    let channels = [{ id: 'global', type: 'global' }];
    try { channels = await api.fetchChatChannels(); } catch (err) { showError(err); }
    tabsEl.innerHTML = channels.map(c => `<button class="chat-tab" role="tab" data-id="${esc(c.id)}">${
      c.type === 'global' ? esc(t('chat.global')) : '👥 ' + esc(c.name)}</button>`).join('');
    tabsEl.querySelectorAll('.chat-tab').forEach(b => { b.onclick = () => { if (b.dataset.id !== channel) loadChannel(b.dataset.id); }; });
    await loadChannel('global');
    timer = setInterval(poll, POLL_MS);
  })();
}
