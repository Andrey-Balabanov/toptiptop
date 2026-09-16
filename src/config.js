const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Generate a random JWT secret if none is set
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set. Generated a random one for this session.');
  console.warn('   Tokens will be invalidated on restart. Set JWT_SECRET in .env for persistence.');
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './data/toptiptop.db'),
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  devAutoVerify: process.env.DEV_AUTO_VERIFY === 'true',
  mail: {
    host: process.env.MAIL_HOST || '',
    port: parseInt(process.env.MAIL_PORT, 10) || 587,
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || 'noreply@toptiptop.app',
  },
  admin: {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    username: (process.env.ADMIN_USERNAME || 'admin').trim(),
    password: process.env.ADMIN_PASSWORD || '',
  },
};
