import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { config } from './config/env.js';
import { HttpError } from './utils/errors.js';
import { UPLOAD_DIR } from './services/storage.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import uploadRoutes from './routes/uploads.js';
import discoverRoutes from './routes/discover.js';
import likeRoutes from './routes/likes.js';
import friendRoutes from './routes/friends.js';
import chatRoutes from './routes/chats.js';
import meetupRoutes from './routes/meetups.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!config.isProd) app.use(morgan('dev'));

  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/discover', discoverRoutes);
  app.use('/api/likes', likeRoutes);
  app.use('/api/friends', friendRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/meetups', meetupRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);

  // Lokal rasm rejimi va admin panel (statik)
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
  app.use('/admin', express.static(path.resolve(__dirname, '../../admin')));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Topilmadi')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.flatten().fieldErrors });
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fayl hajmi 5 MB dan oshmasligi kerak' });
    }
    if (err?.code === 11000) return res.status(409).json({ error: 'Bunday yozuv allaqachon mavjud' });
    console.error('[xato]', err);
    res.status(500).json({ error: 'Server xatosi' });
  });

  return app;
}
