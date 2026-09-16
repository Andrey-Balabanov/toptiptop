/**
 * Mail service for sending verification codes.
 * Uses nodemailer with TLS/STARTTLS support and a lazily-created, pooled
 * transporter so SMTP connections are reused instead of a full connection
 * handshake per email.
 * Falls back to console.log in dev mode (no MAIL_HOST configured).
 *
 * Environment variables:
 *   MAIL_HOST     — SMTP server hostname (e.g., smtp.yandex.ru)
 *   MAIL_PORT     — SMTP port (default: 587 for STARTTLS)
 *   MAIL_USER     — SMTP username
 *   MAIL_PASS     — SMTP password or app-specific password
 *   MAIL_FROM     — From address (default: noreply@toptiptop.app)
 */

const config = require('../config');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  // Will be detected and handled at runtime
}

// Singleton transporter. Creating a transporter per message forces a fresh
// SMTP handshake (and TCP/TLS setup) for every email. With `pool: true` the
// connection is kept alive and reused across sends, which matters when a
// batch of registration emails goes out in a short window.
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465, // true for 465, false for others (587 uses STARTTLS)
      auth: {
        user: config.mail.user,
        pass: config.mail.pass,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

/**
 * Send an email via SMTP (nodemailer).
 * In dev mode (no MAIL_HOST), just logs to console.
 *
 * @param {object} options
 * @param {string} options.to       — recipient email
 * @param {string} options.subject  — email subject
 * @param {string} options.text     — plain text body
 * @returns {Promise<{sent: boolean, dev?: boolean, fallback?: boolean}>}
 */
async function sendEmail({ to, subject, text }) {
  // Dev fallback: just log
  if (!config.mail.host) {
    console.log('═══════════════════════════════════════════');
    console.log('  [MAIL DEV] To: ' + to);
    console.log('  [MAIL DEV] Subject: ' + subject);
    console.log('  [MAIL DEV] Body:');
    console.log(text);
    console.log('═══════════════════════════════════════════');
    return { sent: true, dev: true };
  }

  // Check nodemailer is available
  if (!nodemailer) {
    console.warn('[MAIL] nodemailer not installed — falling back to console log');
    console.log('[MAIL FALLBACK] To:', to, 'Subject:', subject, '\n' + text);
    return { sent: true, fallback: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from: config.mail.from,
      to,
      subject,
      text,
    });

    console.log('[MAIL] Sent successfully:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const errorMessage = mapSmtpError(err);
    console.error('[MAIL] SMTP error:', err.message);

    // Fallback to console log so the user at least sees the code in server logs
    console.log('[MAIL FALLBACK] To:', to, 'Subject:', subject, '\n' + text);

    const appError = new Error(errorMessage);
    appError.code = 'MAIL_SMTP_ERROR';
    appError.originalError = err.message;
    throw appError;
  }
}

/**
 * Send verification code email (registration or login).
 *
 * @param {string} email    — recipient email address
 * @param {string} code     — 6-digit verification code
 * @param {string} purpose  — 'register' or 'login'
 * @returns {Promise<{sent: boolean, dev?: boolean, fallback?: boolean}>}
 */
async function sendVerificationCode(email, code, purpose = 'register') {
  const subject = purpose === 'login'
    ? 'TopTipTop — Код для входа'
    : 'TopTipTop — Подтверждение регистрации';

  const text = purpose === 'login'
    ? `Здравствуйте!\n\nВаш код для входа в TopTipTop: ${code}\n\nКод действителен в течение 10 минут.\n\nЕсли вы не запрашивали вход, проигнорируйте это письмо.`
    : `Здравствуйте!\n\nВаш код для подтверждения регистрации в TopTipTop: ${code}\n\nКод действителен в течение 10 минут.\n\nСпасибо за регистрацию!`;

  return sendEmail({ to: email, subject, text });
}

/**
 * Map nodemailer SMTP errors to user-friendly messages.
 */
function mapSmtpError(err) {
  const msg = (err.message || '').toLowerCase();

  if (msg.includes('auth') || msg.includes('login') || msg.includes('credentials')) {
    return 'Ошибка авторизации SMTP. Проверьте MAIL_USER и MAIL_PASS.';
  }
  if (msg.includes('enotfound') || msg.includes('dns') || msg.includes('getaddrinfo')) {
    return 'Не удалось найти почтовый сервер. Проверьте MAIL_HOST.';
  }
  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return 'Не удалось подключиться к почтовому серверу (таймаут).';
  }
  if (msg.includes('econnrefused')) {
    return 'Подключение к почтовому серверу отклонено. Проверьте MAIL_HOST и MAIL_PORT.';
  }
  if (msg.includes('econnreset') || msg.includes('socket')) {
    return 'Соединение с почтовым сервером разорвано.';
  }
  if (msg.includes('tls') || msg.includes('ssl') || msg.includes('starttls')) {
    return 'Ошибка TLS при подключении к почтовому серверу.';
  }
  if (msg.includes('recipient') || msg.includes('rcpt') || msg.includes('mailbox')) {
    return 'Почтовый сервер отклонил получателя. Проверьте email адрес.';
  }

  return 'Не удалось отправить письмо. Попробуйте позже.';
}

module.exports = { sendEmail, sendVerificationCode };
