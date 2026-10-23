import { Router } from 'express';
import { z } from 'zod';
import { Report } from '../models/Moderation.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, objectId, parse } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

const schema = z.object({
  target: objectId,
  reason: z.enum(['fake', 'harassment', 'spam', 'underage', 'inappropriate_photo', 'scam', 'other']),
  details: z.string().trim().max(1000).default(''),
});

router.post('/', async (req, res) => {
  const data = parse(schema, req.body);
  if (data.target === req.user.id) throw new HttpError(400, 'O\'zingizga shikoyat qilib bo\'lmaydi');
  if (!(await User.exists({ _id: data.target }))) throw new HttpError(404, 'Profil topilmadi');

  // Bir foydalanuvchi bitta odamga ochiq shikoyatni takrorlay olmaydi
  const dup = await Report.exists({ reporter: req.user.id, target: data.target, status: 'open' });
  if (dup) throw new HttpError(409, 'Shikoyatingiz allaqachon ko\'rib chiqilmoqda');

  await Report.create({ ...data, reporter: req.user.id });
  // Shikoyat qilingan odam avtomatik bloklanadi (shikoyat qiluvchi uchun)
  await User.updateOne({ _id: req.user.id }, { $addToSet: { blocked: data.target } });
  res.status(201).json({ ok: true });
});

export default router;
