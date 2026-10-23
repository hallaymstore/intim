import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Friend, Match, Message } from '../models/Social.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, objectId, parse } from '../utils/errors.js';
import { pairKey, toPublic } from '../utils/helpers.js';
import { canChat, isBlockedEitherWay, sendMessage, serializeMessage } from '../services/chat.js';

const router = Router();
router.use(requireAuth);

// Suhbatlar ro'yxati: matchlar + qabul qilingan do'stlar
router.get('/', async (req, res) => {
  const me = req.user.id;
  const meOid = new mongoose.Types.ObjectId(me);

  const [matches, friends] = await Promise.all([
    Match.find({ users: me }),
    Friend.find({ status: 'accepted', $or: [{ from: me }, { to: me }] }),
  ]);

  const kinds = new Map(); // otherId -> { kind, since }
  for (const m of matches) {
    const other = String(m.users.find((u) => String(u) !== me));
    kinds.set(other, { kind: 'match', since: m.createdAt });
  }
  for (const f of friends) {
    const other = String(f.from) === me ? String(f.to) : String(f.from);
    if (!kinds.has(other)) kinds.set(other, { kind: 'friend', since: f.updatedAt });
  }
  const otherIds = [...kinds.keys()];
  if (!otherIds.length) return res.json({ chats: [] });

  const keys = otherIds.map((o) => pairKey(me, o));
  const [users, last, unread, myBlocked] = await Promise.all([
    User.find({ _id: { $in: otherIds }, status: 'active', blocked: { $ne: me } }),
    Message.aggregate([
      { $match: { key: { $in: keys } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$key', doc: { $first: '$$ROOT' } } },
    ]),
    Message.aggregate([
      { $match: { to: meOid, readAt: { $exists: false } } },
      { $group: { _id: '$from', n: { $sum: 1 } } },
    ]),
    User.findById(me).select('blocked'),
  ]);

  const lastByKey = new Map(last.map((l) => [l._id, l.doc]));
  const unreadBy = new Map(unread.map((u) => [String(u._id), u.n]));
  const blockedSet = new Set(myBlocked.blocked.map(String));

  const chats = users
    .filter((u) => !blockedSet.has(String(u._id)))
    .map((u) => {
      const id = String(u._id);
      const lm = lastByKey.get(pairKey(me, id));
      return {
        user: toPublic(u),
        kind: kinds.get(id).kind,
        lastMessage: lm ? serializeMessage(lm) : null,
        unread: unreadBy.get(id) || 0,
        sortAt: lm ? lm.createdAt : kinds.get(id).since,
      };
    })
    .sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));

  res.json({ chats });
});

const listSchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

router.get('/:userId/messages', async (req, res) => {
  const other = parse(objectId, req.params.userId);
  const me = req.user.id;
  const { before, limit } = parse(listSchema, req.query);

  if (!(await canChat(me, other)) || (await isBlockedEitherWay(me, other))) {
    throw new HttpError(403, 'Bu suhbat mavjud emas');
  }
  const otherUser = await User.findOne({ _id: other, status: 'active' });
  if (!otherUser) throw new HttpError(404, 'Profil topilmadi');

  const filter = { key: pairKey(me, other) };
  if (before) filter.createdAt = { $lt: before };
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);

  await Message.updateMany({ key: filter.key, to: me, readAt: { $exists: false } }, { readAt: new Date() });
  res.json({ user: toPublic(otherUser), messages: rows.reverse().map(serializeMessage) });
});

// Socket'ga muqobil (REST orqali yuborish)
router.post('/:userId/messages', async (req, res) => {
  const other = parse(objectId, req.params.userId);
  const { text } = parse(z.object({ text: z.string() }), req.body);
  const message = await sendMessage(req.user.id, other, text);
  res.status(201).json({ message });
});

export default router;
