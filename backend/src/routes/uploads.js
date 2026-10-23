import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, parse } from '../utils/errors.js';
import {
  ALLOWED_TYPES,
  MAX_BYTES,
  UPLOAD_DIR,
  presignPut,
  publicUrlFor,
  r2Enabled,
} from '../services/storage.js';

const router = Router();
router.use(requireAuth);

const newKey = (userId, ext) => `users/${userId}/${crypto.randomUUID()}.${ext}`;

// 1-qadam: yuklash manzilini olish. R2 yoqilgan bo'lsa, brauzer to'g'ridan-to'g'ri R2 ga PUT qiladi.
router.post('/presign', async (req, res) => {
  const { contentType } = parse(z.object({ contentType: z.string() }), req.body);
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) throw new HttpError(400, 'Faqat JPG, PNG yoki WebP');

  const key = newKey(req.user.id, ext);
  if (r2Enabled) {
    const uploadUrl = await presignPut(key, contentType);
    return res.json({ mode: 'r2', uploadUrl, key, headers: { 'Content-Type': contentType } });
  }
  // Lokal rejim (faqat ishlab chiqish uchun): serverning o'ziga yuklanadi
  res.json({ mode: 'local', uploadUrl: '/api/uploads/local', key });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

router.post('/local', upload.single('file'), async (req, res) => {
  if (r2Enabled) throw new HttpError(400, 'Lokal yuklash o\'chirilgan');
  const { key } = req.body;
  const file = req.file;
  if (!file || !key) throw new HttpError(400, 'Fayl yoki kalit yo\'q');
  const ext = ALLOWED_TYPES[file.mimetype];
  if (!ext || !key.startsWith(`users/${req.user.id}/`) || !key.endsWith(`.${ext}`) || key.includes('..')) {
    throw new HttpError(400, 'Fayl yoki kalit noto\'g\'ri');
  }
  const dest = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, file.buffer);
  res.json({ key, url: publicUrlFor(key) });
});

export default router;
