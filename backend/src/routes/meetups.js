import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Meetup, Place } from '../models/Meetup.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, objectId, parse } from '../utils/errors.js';
import { toPublic } from '../utils/helpers.js';
import { canChat, isBlockedEitherWay } from '../services/chat.js';
import { emitToUser } from '../realtime.js';

const router = Router();

export const placeDto = (p) => ({
  id: String(p._id),
  name: p.name,
  category: p.category,
  city: p.city,
  address: p.address,
  lat: p.location.coordinates[1],
  lng: p.location.coordinates[0],
});

// Ommaviy uchrashuv joylari (hammaga ochiq ro'yxat, faqat admin qo'shadi)
router.get('/places', requireAuth, async (req, res) => {
  const q = parse(
    z.object({ city: z.string().max(60).optional(), category: z.string().max(20).optional() }),
    req.query
  );
  const filter = { active: true };
  if (q.city) filter.city = new RegExp(`^${q.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (q.category) filter.category = q.category;
  const places = await Place.find(filter).limit(200);
  res.json({ places: places.map(placeDto) });
});

const dto = (m, meId, users) => {
  const mine = String(m.proposer) === meId;
  const otherId = String(mine ? m.invitee : m.proposer);
  return {
    id: String(m._id),
    mine,
    other: users.get(otherId) || null,
    place: String(m.place),
    placeName: m.placeName,
    startsAt: m.startsAt,
    note: m.note,
    status: m.status,
  };
};

router.get('/', requireAuth, async (req, res) => {
  const me = req.user.id;
  const rows = await Meetup.find({ $or: [{ proposer: me }, { invitee: me }] })
    .sort({ startsAt: -1 })
    .limit(100);
  const ids = rows.map((m) => (String(m.proposer) === me ? m.invitee : m.proposer));
  const users = new Map((await User.find({ _id: { $in: ids } })).map((u) => [String(u._id), toPublic(u)]));
  res.json({ meetups: rows.map((m) => dto(m, me, users)) });
});

const createSchema = z.object({
  to: objectId,
  placeId: objectId,
  startsAt: z.coerce.date(),
  note: z.string().trim().max(300).default(''),
});

router.post('/', requireAuth, async (req, res) => {
  const data = parse(createSchema, req.body);
  const me = req.user.id;

  if (data.startsAt.getTime() < Date.now() + 30 * 60 * 1000) {
    throw new HttpError(400, 'Uchrashuv vaqti kamida 30 daqiqadan keyin bo\'lishi kerak');
  }
  if (data.startsAt.getTime() > Date.now() + 60 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'Uchrashuv 60 kundan uzoq bo\'lmasligi kerak');
  }
  // Faqat bir-birini tanigan (match yoki do'st) foydalanuvchilar uchrashuv belgilay oladi
  if (!(await canChat(me, data.to)) || (await isBlockedEitherWay(me, data.to))) {
    throw new HttpError(403, 'Avval match bo\'ling yoki do\'st bo\'ling');
  }
  const place = await Place.findOne({ _id: data.placeId, active: true });
  if (!place) throw new HttpError(404, 'Joy topilmadi');

  const open = await Meetup.countDocuments({ proposer: me, status: 'proposed' });
  if (open >= 10) throw new HttpError(429, 'Juda ko\'p javob kutilayotgan taklif bor');

  const m = await Meetup.create({
    proposer: me,
    invitee: data.to,
    place: place._id,
    placeName: place.name,
    startsAt: data.startsAt,
    note: data.note,
  });
  emitToUser(data.to, 'meetup:update', { id: String(m._id), status: 'proposed' });
  res.status(201).json({ id: String(m._id) });
});

router.patch('/:id', requireAuth, async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { action } = parse(z.object({ action: z.enum(['accept', 'decline', 'cancel']) }), req.body);
  const me = req.user.id;
  const m = await Meetup.findById(id);
  if (!m || (String(m.proposer) !== me && String(m.invitee) !== me)) {
    throw new HttpError(404, 'Uchrashuv topilmadi');
  }

  if (action === 'cancel') {
    if (!['proposed', 'accepted'].includes(m.status)) throw new HttpError(400, 'Bekor qilib bo\'lmaydi');
    m.status = 'cancelled';
  } else {
    if (String(m.invitee) !== me || m.status !== 'proposed') {
      throw new HttpError(400, 'Bu amalni bajarib bo\'lmaydi');
    }
    m.status = action === 'accept' ? 'accepted' : 'declined';
  }
  await m.save();
  const other = String(m.proposer) === me ? m.invitee : m.proposer;
  emitToUser(other, 'meetup:update', { id, status: m.status });
  res.json({ status: m.status });
});

export default router;
