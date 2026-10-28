import * as api from './api.js';
import { t, setLanguage, applyLanguageToDOM, getLanguage } from './i18n.js';

const $ = id => document.getElementById(id);
let currentUser = null;
let searchTimer = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
}

function setStatus(message, kind = '') {
  const status = $('status');
  status.textContent = message;
  status.className = 'status' + (kind ? ' ' + kind : '');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(getLanguage() === 'ru' ? 'ru-RU' : 'en-GB');
}

function userRow(user) {
  const isSelf = currentUser && user.id === currentUser.id;
    const stateLabel = t(user.isBanned ? 'admin.state_banned' : 'admin.state_active');
  const toggleLabel = t(user.isBanned ? 'admin.unban' : 'admin.ban');
  return `
    <tr>
      <td data-label="${escapeHtml(t('admin.col_user'))}">
        <strong>${escapeHtml(user.username)}</strong>
        <span class="subline">${escapeHtml(user.email || t('admin.no_email'))}</span>
        <span class="subline">${escapeHtml(t('admin.registered').replace('{date}', formatDate(user.createdAt)))}</span>
      </td>
      <td data-label="${escapeHtml(t('admin.col_role'))}">
        <select class="role-select" data-action="role" data-id="${user.id}" ${isSelf ? 'disabled' : ''}>
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>${escapeHtml(t('admin.role_user'))}</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>${escapeHtml(t('admin.role_admin'))}</option>
        </select>
      </td>
      <td data-label="${escapeHtml(t('admin.col_stats'))}" class="stats-cell">
        <span>${user.totalXp || 0} XP</span>
        <span>${user.bestWpm || 0} WPM</span>
        <span>${escapeHtml(t('admin.sessions').replace('{n}', user.sessionCount || 0))}</span>
      </td>
      <td data-label="${escapeHtml(t('admin.col_state'))}"><span class="state ${user.isBanned ? 'danger' : 'ok'}">${stateLabel}</span></td>
      <td data-label="${escapeHtml(t('admin.col_actions'))}" class="row-actions">
        <button class="action-button" data-action="ban" data-id="${user.id}" ${isSelf ? 'disabled' : ''}>${escapeHtml(toggleLabel)}</button>
        <button class="action-button" data-action="password" data-id="${user.id}">${escapeHtml(t('admin.password'))}</button>
        <button class="action-button danger-button" data-action="delete" data-id="${user.id}" ${isSelf ? 'disabled' : ''}>${escapeHtml(t('admin.delete'))}</button>
      </td>
    </tr>
  `;
}

async function loadUsers() {
  setStatus(t('admin.loading'));
  try {
    const result = await api.fetchAdminUsers({
      search: $('search-input').value.trim(),
      banned: $('banned-only').checked,
    });
    $('users-body').innerHTML = result.users.map(userRow).join('');
    $('empty-state').hidden = result.users.length !== 0;
    setStatus(t('admin.count').replace('{n}', result.count));
  } catch (error) {
    setStatus(error.message || t('admin.load_error'), 'error');
  }
}

async function updateUser(id, changes) {
  try {
    await api.updateAdminUser(id, changes);
    await loadUsers();
  } catch (error) {
    setStatus(error.message || t('admin.update_error'), 'error');
  }
}

async function handleAction(event) {
  const target = event.target;
  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !id) return;

  if (action === 'role') {
    if (event.type === 'change') {
      await updateUser(id, { role: target.value });
    }
    return;
  }

  if (action === 'ban') {
    const row = target.closest('tr');
    const isBanned = row.querySelector('.state').classList.contains('danger');
    if (confirm(t(isBanned ? 'admin.confirm_unban' : 'admin.confirm_ban'))) {
      await updateUser(id, { isBanned: !isBanned });
    }
    return;
  }

  if (action === 'password') {
    const password = prompt(t('admin.new_password'));
    if (password !== null) {
      try {
        await api.resetAdminPassword(id, password);
        setStatus(t('admin.password_updated'), 'success');
      } catch (error) {
        setStatus(error.message || t('admin.password_error'), 'error');
      }
    }
    return;
  }

  if (action === 'delete' && confirm(t('admin.confirm_delete'))) {
    try {
      await api.deleteAdminUser(id);
      await loadUsers();
    } catch (error) {
      setStatus(error.message || t('admin.delete_error'), 'error');
    }
  }
}

async function init() {
  // Same language as the trainer (saved choice); switched to the account's language below
  applyLanguageToDOM();
  $('logout-button').onclick = async () => {
    await api.logout();
    window.location.href = '/';
  };
  $('refresh-button').onclick = loadUsers;
  $('users-body').addEventListener('click', handleAction);
  $('users-body').addEventListener('change', handleAction);
  $('banned-only').addEventListener('change', loadUsers);
  $('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadUsers, 250);
  });

  if (!api.isLoggedIn()) {
    setStatus(t('admin.login_required_hint'), 'error');
    $('admin-identity').textContent = t('admin.login_required');
    return;
  }

  try {
    currentUser = await api.fetchMe();
    if (currentUser.language && currentUser.language !== getLanguage()) {
      setLanguage(currentUser.language);
      applyLanguageToDOM();
    }
    if (currentUser.role !== 'admin') {
      throw new Error(t('admin.admins_only'));
    }
    $('admin-identity').textContent = `${currentUser.username} · ${currentUser.email || ''}`;
    await loadUsers();
  } catch (error) {
    const message = error.message || t('admin.no_access');
    setStatus(message, 'error');
    $('admin-identity').textContent = t('admin.check_failed');
    $('users-body').innerHTML = `
      <tr>
        <td colspan="5" class="access-error">
          <strong>${escapeHtml(message)}</strong>
          <span>${escapeHtml(t('admin.check_env'))}</span>
        </td>
      </tr>
    `;
    $('empty-state').hidden = true;
  }
}

init();
