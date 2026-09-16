/**
 * @deprecated
 * This file contains an earlier token-based email verification approach
 * using nodemailer. It is NOT used by the current auth flow.
 *
 * The current auth flow (src/services/auth.js) uses:
 *   src/services/mail.js  →  sendVerificationCode(email, code, purpose)
 *
 * The database schema uses 6-digit codes (email_verification_codes table),
 * not token-based links (email_verifications table).
 *
 * Keeping this file for reference only. Will be removed in a future cleanup.
 */

const config = require('../config');

/**
 * Send a verification email.
 * In development mode (no mail config), logs the link and optionally auto-verifies.
 *
 * @deprecated Use sendVerificationCode() from ./mail.js instead.
 */
async function sendVerificationEmail(email, token) {
  const link = `${config.baseUrl}/api/auth/verify?token=${token}`;

  if (!config.mail.host) {
    // Dev mode: log the link
    console.log('═══════════════════════════════════════════');
    console.log('  DEV MODE — Email Verification');
    console.log(`  To: ${email}`);
    console.log(`  Link: ${link}`);
    console.log('═══════════════════════════════════════════');

    if (config.devAutoVerify) {
      console.log('  DEV_AUTO_VERIFY=true — auto-verifying...');
      const { verifyEmail } = require('./auth');
      const tokens = require('../db').getDb()
        .prepare('SELECT token FROM email_verifications WHERE token = ? AND used = 0')
        .get(token);
      if (tokens) {
        await verifyEmail(token);
        console.log('  Auto-verified successfully');
      }
    }
    return;
  }

  // Production mode: send real email
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    console.warn('nodemailer not installed, falling back to dev log');
    console.log(`Verification link for ${email}: ${link}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
  });

  await transporter.sendMail({
    from: config.mail.from,
    to: email,
    subject: 'Подтверждение почты — TopTipTop',
    text: `Для подтверждения email перейдите по ссылке: ${link}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Подтверждение почты</h2>
        <p>Спасибо за регистрацию в <strong>TopTipTop</strong>!</p>
        <p>Для подтверждения email нажмите на кнопку ниже:</p>
        <a href="${link}" style="display: inline-block; background: #7aa2f7; color: #1a1b26; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Подтвердить email
        </a>
        <p style="color: #565f89; font-size: 12px;">Ссылка действительна 24 часа.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail };
