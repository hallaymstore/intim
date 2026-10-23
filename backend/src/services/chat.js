import { Friend, Match, Message } from '../models/Social.js';
import { User } from '../models/User.js';
import { HttpError, objectId } from '../utils/errors.js';
import { pairKey } from '../utils/helpers.js';
import { emitToUser } from '../realtime.js';

// Faqat o'zaro match yoki qabul qilingan do'stlik bo'lsa yozishish mumkin
export async function canChat(a, b) {
  const key = pairKey(a, b);
  const [m, f] = await Promise.all([
    Match.exists({ key }),
    Friend.exists({ key, status: 'accepted' }),
  ]);
  return Boolean(m || f);
}

export async function isBlockedEitherWay(a, b) {
  const n = await User.countDocuments({
    $or: [
      { _id: a, blocked: b },
      { _id: b, blocked: a },
    ],
  });
  return n > 0;
}

export function serializeMessage(m) {
  return {
    id: String(m._id),
    from: String(m.from),
    to: String(m.to),
    text: m.text,
    createdAt: m.createdAt,
    readAt: m.readAt || null,
  };
}

export async function sendMessage(from, to, text) {
  if (!objectId.safeParse(to).success) throw new HttpError(400, 'Qabul qiluvchi noto\'g\'ri');
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean || clean.length > 2000) throw new HttpError(400, 'Xabar 1–2000 belgi bo\'lishi kerak');
  if (String(from) === String(to)) throw new HttpError(400, 'O\'zingizga yozib bo\'lmaydi');

  const [allowed, blocked] = await Promise.all([canChat(from, to), isBlockedEitherWay(from, to)]);
  if (!allowed || blocked) throw new HttpError(403, 'Bu foydalanuvchi bilan yozishib bo\'lmaydi');

  const doc = await Message.create({ key: pairKey(from, to), from, to, text: clean });
  const msg = serializeMessage(doc);
  emitToUser(to, 'message:new', msg);
  emitToUser(from, 'message:new', msg);
  return msg;
}
