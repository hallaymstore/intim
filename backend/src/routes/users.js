import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, objectId, parse } from '../utils/errors.js';
import { roundCoord, toPublic, toSelf } from '../utils/helpers.js';
import { deleteObject, publicUrlFor, verifyObject, MAX_BYTES } from '../services/storage.js';
import { purgeUser } from '../services/cleanup.js';

const router = Router();
router.use(requireAuth);

const MAX_PHOTOS = 6;

router.get('/me', async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: toSelf(user) });
});

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    bio: z.string().trim().max(500),
    interests: z.array(z.string().trim().min(1).max(30)).max(10),
    lookingFor: z.enum(['male', 'female', 'any']),
    city: z.string().trim().max(60),
    district: z.string().trim().max(60),
    showDistance: z.boolean(),
    prefs: z.object({
      minAge: z.number().int().min(18).max(99),
      maxAge: z.number().int().min(18).max(99),
      maxKm: z.number().int().min(1).max(20000),
    }),
  })
  .partial();

router.patch('/me', async (req, res) => {
  const data = parse(updateSchema, req.body);
  if (data.prefs && data.prefs.minAge > data.prefs.maxAge) {
    throw new HttpError(400, 'Minimal yosh maksimaldan katta bo\'lmasligi kerak');
  }
  const user = await User.findByIdAndUpdate(req.user.id, { $set: data }, { new: true, runValidators: true });
  res.json({ user: toSelf(user) });
});

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Uy atrofini belgilash: koordinata ~1 km ga yumaloqlanib saqlanadi
router.put('/me/location', async (req, res) => {
  const { lat, lng } = parse(locationSchema, req.body);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { location: { type: 'Point', coordinates: [roundCoord(lng), roundCoord(lat)] } } },
    { new: true }
  );
  res.json({ user: toSelf(user) });
});

router.delete('/me/location', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { $unset: { location: 1 } }, { new: true });
  res.json({ user: toSelf(user) });
});

router.post('/me/photos', async (req, res) => {
  const { key } = parse(z.object({ key: z.string().max(200) }), req.body);
  // Faqat o'z papkasidagi fayl
  if (!key.startsWith(`users/${req.user.id}/`) || key.includes('..')) {
    throw new HttpError(400, 'Fayl kaliti noto\'g\'ri');
  }
  const user = await User.findById(req.user.id);
  if (user.photos.length >= MAX_PHOTOS) throw new HttpError(400, `Ko'pi bilan ${MAX_PHOTOS} ta rasm`);
  if (user.photos.some((p) => p.key === key)) throw new HttpError(409, 'Bu rasm allaqachon qo\'shilgan');

  const obj = await verifyObject(key);
  if (!obj) throw new HttpError(400, 'Rasm topilmadi yoki turi noto\'g\'ri');
  if (obj.size > MAX_BYTES) {
    await deleteObject(key);
    throw new HttpError(400, 'Rasm hajmi 5 MB dan oshmasligi kerak');
  }

  user.photos.push({ key, url: publicUrlFor(key) });
  await user.save();
  res.status(201).json({ user: toSelf(user) });
});

router.delete('/me/photos/:photoId', async (req, res) => {
  const photoId = parse(objectId, req.params.photoId);
  const user = await User.findById(req.user.id);
  const photo = user.photos.id(photoId);
  if (!photo) throw new HttpError(404, 'Rasm topilmadi');
  const { key } = photo;
  photo.deleteOne();
  await user.save();
  await deleteObject(key);
  res.json({ user: toSelf(user) });
});

router.delete('/me', async (req, res) => {
  const { password } = parse(z.object({ password: z.string().min(1) }), req.body);
  const user = await User.findById(req.user.id).select('+passwordHash role');
  if (user.role === 'admin') throw new HttpError(400, 'Admin akkauntini bu yerda o\'chirib bo\'lmaydi');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Parol noto\'g\'ri');
  await purgeUser(user._id);
  res.json({ ok: true });
});

router.get('/blocked/list', async (req, res) => {
  const me = await User.findById(req.user.id).select('blocked');
  const users = await User.find({ _id: { $in: me.blocked } });
  res.json({ users: users.map((u) => toPublic(u)) });
});

router.get('/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const target = await User.findOne({ _id: id, status: 'active', role: 'user', blocked: { $ne: req.user.id } });
  const me = await User.findById(req.user.id).select('blocked');
  if (!target || me.blocked.some((b) => String(b) === id)) throw new HttpError(404, 'Profil topilmadi');
  res.json({ user: toPublic(target) });
});

router.post('/:id/block', async (req, res) => {
  const id = parse(objectId, req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'O\'zingizni bloklab bo\'lmaydi');
  await User.updateOne({ _id: req.user.id }, { $addToSet: { blocked: id } });
  res.json({ ok: true });
});

router.delete('/:id/block', async (req, res) => {
  const id = parse(objectId, req.params.id);
  await User.updateOne({ _id: req.user.id }, { $pull: { blocked: id } });
  res.json({ ok: true });
});

export default router;
