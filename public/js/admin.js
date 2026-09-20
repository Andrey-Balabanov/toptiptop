import * as api from './api.js';

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}

function userRow(user) {
  const isSelf = currentUser && user.id === currentUser.id;
  const roleLabel = user.role === 'admin' ? 'Администратор' : 'Пользователь';
  const stateLabel = user.isBanned ? 'Заблокирован' : 'Активен';
  const toggleLabel = user.isBanned ? 'Разблокировать' : 'Заблокировать';
  return `
    <tr>
      <td data-label="Пользователь">
        <strong>${escapeHtml(user.username)}</strong>
        <span class="subline">${escapeHtml(user.email || 'email не указан')}</span>
        <span class="subline">Регистрация: ${escapeHtml(formatDate(user.createdAt))}</span>
      </td>
      <td data-label="Роль">
        <select class="role-select" data-action="role" data-id="${user.id}" ${isSelf ? 'disabled' : ''}>
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
        </select>
      </td>
      <td data-label="Статистика" class="stats-cell">
        <span>${user.totalXp || 0} XP</span>
        <span>${user.bestWpm || 0} WPM</span>
        <span>${user.sessionCount || 0} сессий</span>
      </td>
      <td data-label="Состояние"><span class="state ${user.isBanned ? 'danger' : 'ok'}">${stateLabel}</span></td>
      <td data-label="Действия" class="row-actions">
        <button class="action-button" data-action="ban" data-id="${user.id}" ${isSelf ? 'disabled' : ''}>${toggleLabel}</button>
        <button class="action-button" data-action="password" data-id="${user.id}">Пароль</button>
        <button class="action-button danger-button" data-action="delete" data-id="${user.id}" ${isSelf ? 'disabled' : ''}>Удалить</button>
      </td>
    </tr>
  `;
}

async function loadUsers() {
  setStatus('Загрузка...');
  try {
    const result = await api.fetchAdminUsers({
      search: $('search-input').value.trim(),
      banned: $('banned-only').checked,
    });
    $('users-body').innerHTML = result.users.map(userRow).join('');
    $('empty-state').hidden = result.users.length !== 0;
    setStatus(`${result.count} пользователей`);
  } catch (error) {
    setStatus(error.message || 'Не удалось загрузить пользователей', 'error');
  }
}

async function updateUser(id, changes) {
  try {
    await api.updateAdminUser(id, changes);
    await loadUsers();
  } catch (error) {
    setStatus(error.message || 'Не удалось обновить пользователя', 'error');
  }
}

async function handleAction(event) {
  const target = event.target;
  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !id) return;

  if (action === 'role') {
    await updateUser(id, { role: target.value });
    return;
  }

  if (action === 'ban') {
    const row = target.closest('tr');
    const isBanned = row.querySelector('.state').classList.contains('danger');
    if (confirm(isBanned ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?')) {
      await updateUser(id, { isBanned: !isBanned });
    }
    return;
  }

  if (action === 'password') {
    const password = prompt('Новый пароль, минимум 6 символов:');
    if (password !== null) {
      try {
        await api.resetAdminPassword(id, password);
        setStatus('Пароль обновлён', 'success');
      } catch (error) {
        setStatus(error.message || 'Не удалось изменить пароль', 'error');
      }
    }
    return;
  }

  if (action === 'delete' && confirm('Удалить пользователя и его сессии?')) {
    try {
      await api.deleteAdminUser(id);
      await loadUsers();
    } catch (error) {
      setStatus(error.message || 'Не удалось удалить пользователя', 'error');
    }
  }
}

async function init() {
  $('logout-button').onclick = () => {
    api.setToken(null);
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
    window.location.href = '/';
    return;
  }

  try {
    currentUser = await api.fetchMe();
    if (currentUser.role !== 'admin') {
      throw new Error('Доступ только для администраторов');
    }
    $('admin-identity').textContent = `${currentUser.username} · ${currentUser.email || ''}`;
    await loadUsers();
  } catch (error) {
    setStatus(error.message || 'Нет доступа к админ-панели', 'error');
    setTimeout(() => { window.location.href = '/'; }, 1200);
  }
}

init();
