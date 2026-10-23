import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/errors.js';

export function signAccess(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  });
}

export function verifyAccess(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Kirish talab qilinadi');

  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    throw new HttpError(401, 'Token yaroqsiz yoki muddati tugagan');
  }

  // Bloklangan foydalanuvchi darhol chiqib ketadi
  const user = await User.findById(payload.sub).select('role status lastActiveAt');
  if (!user) throw new HttpError(401, 'Foydalanuvchi topilmadi');
  if (user.status === 'blocked') throw new HttpError(403, 'Akkauntingiz bloklangan');

  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > 5 * 60 * 1000) {
    User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
  }

  req.user = { id: String(user._id), role: user.role };
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Faqat admin uchun');
  next();
}
