import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { signAccess } from '../middleware/auth.js';
import { HttpError, parse } from '../utils/errors.js';
import { calcAge, toSelf } from '../utils/helpers.js';

const router = Router();

const COOKIE = 'rt';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/api/auth',
  maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
};

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function issueTokens(user, res) {
  const refresh = jwt.sign({ sub: String(user._id), jti: crypto.randomUUID() }, config.jwt.refreshSecret, {
    expiresIn: `${config.jwt.refreshTtlDays}d`,
  });
  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { $each: [sha(refresh)], $slice: -5 } }, lastActiveAt: new Date() }
  );
  res.cookie(COOKIE, refresh, cookieOpts);
  return signAccess(user);
}

const registerSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8, 'Parol kamida 8 belgi').max(100),
  name: z.string().trim().min(2).max(40),
  birthDate: z.coerce.date(),
  gender: z.enum(['male', 'female']),
  lookingFor: z.enum(['male', 'female', 'any']).default('any'),
  city: z.string().trim().max(60).default(''),
});

router.post('/register', async (req, res) => {
  const data = parse(registerSchema, req.body);
  const age = calcAge(data.birthDate);
  if (age < 18) throw new HttpError(400, 'Saytdan faqat 18 yoshdan oshganlar foydalana oladi');
  if (age > 99) throw new HttpError(400, 'Tug\'ilgan sana noto\'g\'ri');

  if (await User.exists({ email: data.email.toLowerCase() })) {
    throw new HttpError(409, 'Bu email allaqachon ro\'yxatdan o\'tgan');
  }
  const { password, ...rest } = data;
  const user = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 12) });
  const accessToken = await issueTokens(user, res);
  res.status(201).json({ accessToken, user: toSelf(user) });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Email yoki parol noto\'g\'ri');
  if (user.status === 'blocked') throw new HttpError(403, 'Akkauntingiz bloklangan');
  const accessToken = await issueTokens(user, res);
  res.json({ accessToken, user: toSelf(user) });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Sessiya topilmadi');

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.refreshSecret);
  } catch {
    res.clearCookie(COOKIE, { path: cookieOpts.path });
    throw new HttpError(401, 'Sessiya muddati tugagan');
  }

  const hash = sha(token);
  // Eski token bir martalik: ishlatilgach o'chiriladi (rotation)
  const user = await User.findOneAndUpdate(
    { _id: payload.sub, refreshTokens: hash },
    { $pull: { refreshTokens: hash } },
    { new: true }
  );
  if (!user) {
    // Allaqachon ishlatilgan token qayta keldi, ehtimol o'g'irlangan: barcha sessiyalarni yopamiz
    await User.updateOne({ _id: payload.sub }, { $set: { refreshTokens: [] } });
    res.clearCookie(COOKIE, { path: cookieOpts.path });
    throw new HttpError(401, 'Sessiya yaroqsiz');
  }
  if (user.status === 'blocked') throw new HttpError(403, 'Akkauntingiz bloklangan');

  const accessToken = await issueTokens(user, res);
  res.json({ accessToken });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.refreshSecret);
      await User.updateOne({ _id: payload.sub }, { $pull: { refreshTokens: sha(token) } });
    } catch {
      /* ahamiyatsiz */
    }
  }
  res.clearCookie(COOKIE, { path: cookieOpts.path });
  res.json({ ok: true });
});

export default router;
