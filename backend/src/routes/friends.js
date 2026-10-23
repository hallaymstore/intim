import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Friend } from '../models/Social.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, objectId, parse } from '../utils/errors.js';
import { pairKey, toPublic } from '../utils/helpers.js';
import { emitToUser } from '../realtime.js';
import { isBlockedEitherWay } from '../services/chat.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const me = req.user.id;
  const rows = await Friend.find({
    status: { $in: ['pending', 'accepted'] },
    $or: [{ from: me }, { to: me }],
  }).sort({ updatedAt: -1 });

  const ids = rows.map((r) => (String(r.from) === me ? r.to : r.from));
  const users = await User.find({ _id: { $in: ids }, status: 'active' });
  const byId = new Map(users.map((u) => [String(u._id), toPublic(u)]));

  const out = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const other = String(r.from) === me ? String(r.to) : String(r.from);
    const user = byId.get(other);
    if (!user) continue;
    if (r.status === 'accepted') out.friends.push({ id: String(r._id), user });
    else if (String(r.to) === me) out.incoming.push({ id: String(r._id), user });
    else out.outgoing.push({ id: String(r._id), user });
  }
  res.json(out);
});

router.post('/request', async (req, res) => {
  const { to } = parse(z.object({ to: objectId }), req.body);
  const me = req.user.id;
  if (to === me) throw new HttpError(400, 'O\'zingizga so\'rov yubora olmaysiz');

  const target = await User.findOne({ _id: to, status: 'active', role: 'user' });
  if (!target || (await isBlockedEitherWay(me, to))) throw new HttpError(404, 'Profil topilmadi');

  const key = pairKey(me, to);
  const existing = await Friend.findOne({ key });
  if (existing) {
    if (existing.status === 'accepted') throw new HttpError(409, 'Allaqachon do\'stsiz');
    if (existing.status === 'pending' && String(existing.to) === me) {
      // Ikkala tomon ham so'rov yuborgan: avtomatik qabul
      existing.status = 'accepted';
      await existing.save();
      emitToUser(to, 'friend:update', { status: 'accepted' });
      return res.json({ status: 'accepted' });
    }
    if (existing.status === 'pending') throw new HttpError(409, 'So\'rov allaqachon yuborilgan');
    // Rad etilgan bo'lsa qayta yuborishga ruxsat bermaymiz (ta'qibdan himoya)
    throw new HttpError(409, 'Bu foydalanuvchiga so\'rov yuborib bo\'lmaydi');
  }
  await Friend.create({ key, from: me, to, status: 'pending' });
  emitToUser(to, 'friend:update', { status: 'pending' });
  res.status(201).json({ status: 'pending' });
});

router.post('/:id/respond', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { accept } = parse(z.object({ accept: z.boolean() }), req.body);
  const row = await Friend.findOne({ _id: id, to: req.user.id, status: 'pending' });
  if (!row) throw new HttpError(404, 'So\'rov topilmadi');
  row.status = accept ? 'accepted' : 'declined';
  await row.save();
  emitToUser(row.from, 'friend:update', { status: row.status });
  res.json({ status: row.status });
});

router.delete('/:userId', async (req, res) => {
  const userId = parse(objectId, req.params.userId);
  await Friend.deleteOne({ key: pairKey(req.user.id, userId), status: 'accepted' });
  res.json({ ok: true });
});

export default router;
