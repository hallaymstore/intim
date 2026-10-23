import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Match, Message } from '../models/Social.js';
import { Meetup, Place } from '../models/Meetup.js';
import { AuditLog, Report } from '../models/Moderation.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError, objectId, parse } from '../utils/errors.js';
import { calcAge, escapeRegex } from '../utils/helpers.js';
import { deleteObject } from '../services/storage.js';
import { purgeUser } from '../services/cleanup.js';
import { placeDto } from './meetups.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const audit = (req, action, target = '', meta) =>
  AuditLog.create({ admin: req.user.id, action, target: String(target), meta }).catch(() => {});

const TZ = 'Asia/Tashkent';
const perDay = (Model, field = 'createdAt', days = 30, extra = {}) =>
  Model.aggregate([
    { $match: { [field]: { $gte: new Date(Date.now() - days * 864e5) }, ...extra } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: TZ } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

// ---------- Statistika ----------
router.get('/stats', async (_req, res) => {
  const day = new Date(Date.now() - 864e5);
  const week = new Date(Date.now() - 7 * 864e5);
  const real = { role: 'user' };

  const [
    totalUsers, newToday, active24h, active7d, blockedUsers, verifiedUsers,
    totalMatches, totalMessages, messages24h, openReports, upcomingMeetups, photos,
    signups, matches, messages, gender, cities,
  ] = await Promise.all([
    User.countDocuments(real),
    User.countDocuments({ ...real, createdAt: { $gte: day } }),
    User.countDocuments({ ...real, lastActiveAt: { $gte: day } }),
    User.countDocuments({ ...real, lastActiveAt: { $gte: week } }),
    User.countDocuments({ ...real, status: 'blocked' }),
    User.countDocuments({ ...real, verified: true }),
    Match.estimatedDocumentCount(),
    Message.estimatedDocumentCount(),
    Message.countDocuments({ createdAt: { $gte: day } }),
    Report.countDocuments({ status: 'open' }),
    Meetup.countDocuments({ status: 'accepted', startsAt: { $gte: new Date() } }),
    User.aggregate([{ $match: real }, { $project: { n: { $size: '$photos' } } }, { $group: { _id: null, n: { $sum: '$n' } } }]),
    perDay(User, 'createdAt', 30, real),
    perDay(Match),
    perDay(Message),
    User.aggregate([{ $match: real }, { $group: { _id: '$gender', count: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { ...real, city: { $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  res.json({
    totals: {
      totalUsers, newToday, active24h, active7d, blockedUsers, verifiedUsers,
      totalMatches, totalMessages, messages24h, openReports, upcomingMeetups,
      totalPhotos: photos[0]?.n || 0,
    },
    series: { signups, matches, messages },
    gender: gender.map((g) => ({ label: g._id, count: g.count })),
    cities: cities.map((c) => ({ label: c._id, count: c.count })),
  });
});

// ---------- Foydalanuvchilar ----------
const usersQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'blocked']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

router.get('/users', async (req, res) => {
  const { q, status, page, limit } = parse(usersQuery, req.query);
  const filter = { role: 'user' };
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: rx }, { name: rx }, { city: rx }];
  }
  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({
    total,
    page,
    users: rows.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      age: calcAge(u.birthDate),
      gender: u.gender,
      city: u.city,
      photos: u.photos.length,
      status: u.status,
      verified: u.verified,
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
    })),
  });
});

const patchUser = z.object({ status: z.enum(['active', 'blocked']).optional(), verified: z.boolean().optional() });

router.patch('/users/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const data = parse(patchUser, req.body);
  const user = await User.findOneAndUpdate({ _id: id, role: 'user' }, { $set: data }, { new: true });
  if (!user) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  if (data.status === 'blocked') await User.updateOne({ _id: id }, { $set: { refreshTokens: [] } });
  await audit(req, 'user.update', id, data);
  res.json({ ok: true });
});

router.delete('/users/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const user = await User.findOne({ _id: id, role: 'user' }).select('email');
  if (!user) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  await purgeUser(id);
  await audit(req, 'user.delete', id, { email: user.email });
  res.json({ ok: true });
});

// ---------- Rasm moderatsiyasi ----------
router.get('/photos', async (req, res) => {
  const { page } = parse(z.object({ page: z.coerce.number().int().min(1).default(1) }), req.query);
  const rows = await User.aggregate([
    { $match: { role: 'user', 'photos.0': { $exists: true } } },
    { $unwind: '$photos' },
    { $sort: { 'photos.createdAt': -1 } },
    { $skip: (page - 1) * 36 },
    { $limit: 36 },
    { $project: { name: 1, status: 1, photo: '$photos' } },
  ]);
  res.json({
    photos: rows.map((r) => ({
      userId: String(r._id),
      userName: r.name,
      userStatus: r.status,
      photoId: String(r.photo._id),
      url: r.photo.url,
      createdAt: r.photo.createdAt,
    })),
  });
});

router.delete('/users/:id/photos/:photoId', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const photoId = parse(objectId, req.params.photoId);
  const user = await User.findById(id);
  const photo = user?.photos.id(photoId);
  if (!photo) throw new HttpError(404, 'Rasm topilmadi');
  const { key } = photo;
  photo.deleteOne();
  await user.save();
  await deleteObject(key);
  await audit(req, 'photo.delete', id, { photoId });
  res.json({ ok: true });
});

// ---------- Shikoyatlar ----------
router.get('/reports', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['open', 'resolved', 'dismissed']).default('open') }), req.query);
  const rows = await Report.find({ status }).sort({ createdAt: -1 }).limit(100)
    .populate('reporter', 'name email').populate('target', 'name email status');
  res.json({
    reports: rows.map((r) => ({
      id: String(r._id),
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      reporter: r.reporter ? { id: String(r.reporter._id), name: r.reporter.name, email: r.reporter.email } : null,
      target: r.target
        ? { id: String(r.target._id), name: r.target.name, email: r.target.email, status: r.target.status }
        : null,
    })),
  });
});

const resolveSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolution: z.string().trim().max(500).default(''),
  blockTarget: z.boolean().default(false),
});

router.patch('/reports/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const data = parse(resolveSchema, req.body);
  const report = await Report.findByIdAndUpdate(
    id,
    { status: data.status, resolution: data.resolution, handledBy: req.user.id },
    { new: true }
  );
  if (!report) throw new HttpError(404, 'Shikoyat topilmadi');
  if (data.blockTarget) {
    await User.updateOne({ _id: report.target, role: 'user' }, { $set: { status: 'blocked', refreshTokens: [] } });
  }
  await audit(req, 'report.' + data.status, id, { blockTarget: data.blockTarget });
  res.json({ ok: true });
});

// ---------- Uchrashuv joylari ----------
const placeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(['cafe', 'restaurant', 'park', 'mall', 'museum', 'other']),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().max(200).default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  active: z.boolean().default(true),
});

const toDoc = ({ lat, lng, ...rest }) => ({ ...rest, location: { type: 'Point', coordinates: [lng, lat] } });

router.get('/places', async (_req, res) => {
  const places = await Place.find().sort({ city: 1, name: 1 }).limit(500);
  res.json({ places: places.map((p) => ({ ...placeDto(p), active: p.active })) });
});

router.post('/places', async (req, res) => {
  const data = parse(placeSchema, req.body);
  const p = await Place.create(toDoc(data));
  await audit(req, 'place.create', p._id, { name: p.name });
  res.status(201).json({ id: String(p._id) });
});

router.patch('/places/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  const data = parse(placeSchema.partial(), req.body);
  const set = { ...data };
  if (data.lat !== undefined && data.lng !== undefined) {
    delete set.lat;
    delete set.lng;
    set.location = { type: 'Point', coordinates: [data.lng, data.lat] };
  } else {
    delete set.lat;
    delete set.lng;
  }
  const p = await Place.findByIdAndUpdate(id, { $set: set }, { new: true });
  if (!p) throw new HttpError(404, 'Joy topilmadi');
  await audit(req, 'place.update', id, data);
  res.json({ ok: true });
});

router.delete('/places/:id', async (req, res) => {
  const id = parse(objectId, req.params.id);
  await Place.deleteOne({ _id: id });
  await audit(req, 'place.delete', id);
  res.json({ ok: true });
});

// ---------- Audit log ----------
router.get('/audit', async (_req, res) => {
  const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('admin', 'email');
  res.json({
    logs: rows.map((l) => ({
      id: String(l._id),
      admin: l.admin?.email || '—',
      action: l.action,
      target: l.target,
      meta: l.meta,
      createdAt: l.createdAt,
    })),
  });
});

export default router;
