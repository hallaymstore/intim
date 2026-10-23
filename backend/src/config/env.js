import 'dotenv/config';

const list = (v) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const DEV_SECRET = 'dev-secret-change-me';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yaqin',
  clientOrigins: list(process.env.CLIENT_ORIGIN || 'http://localhost:3000'),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || DEV_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || DEV_SECRET + '-refresh',
    accessTtl: '30m',
    refreshTtlDays: 30,
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''),
  },
  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
  },
};

config.isProd = config.env === 'production';

if (config.isProd) {
  const weak = [config.jwt.accessSecret, config.jwt.refreshSecret].some(
    (s) => s.startsWith('dev-secret') || s.startsWith('change-me') || s.length < 32
  );
  if (weak) {
    throw new Error('Production uchun JWT_ACCESS_SECRET va JWT_REFRESH_SECRET kamida 32 belgili bo\'lishi kerak');
  }
}
