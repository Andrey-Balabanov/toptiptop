const AUTH_COOKIE = 'toptip_session';
const AUTH_INDICATOR_COOKIE = 'toptip_authenticated';

function cookieOptions() {
  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || !!process.env.RENDER,
  };
}

function setAuthCookies(res, token) {
  const options = cookieOptions();
  res.cookie(AUTH_COOKIE, token, { ...options, httpOnly: true });
  res.cookie(AUTH_INDICATOR_COOKIE, '1', { ...options, httpOnly: false });
}

function clearAuthCookies(res) {
  const options = cookieOptions();
  res.clearCookie(AUTH_COOKIE, options);
  res.clearCookie(AUTH_INDICATOR_COOKIE, options);
}

function getAuthToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);

  for (const cookie of (req.headers.cookie || '').split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== AUTH_COOKIE) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = { setAuthCookies, clearAuthCookies, getAuthToken };