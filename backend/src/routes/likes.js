import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Like, Match } from '../models/Social.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, objectId, parse } from '../utils/errors.js';
import { pairKey, toPublic } from '../utils/helpers.js';
import { emitToUser } from '../realtime.js';

const router = Router();
router.use(requireAuth);

const schema = z.object({ to: objectId, action: z.enum(['like', 'pass']) });

router.post('/', async (req, res) => {
  const { to, action } = parse(schema, req.body);
  const me = req.user.id;
  if (to === me) throw new HttpError(400, 'O\'zingizga like bosib bo\'lmaydi');

  const target = await User.findOne({ _id: to, status: 'active', blocked: { $ne: me } });
  if (!target) throw new HttpError(404, 'Profil topilmadi');

  await Like.updateOne({ from: me, to }, { $set: { action } }, { upsert: true });

  let matched = false;
  if (action === 'like') {
    const back = await Like.exists({ from: to, to: me, action: 'like' });
    if (back) {
      matched = true;
      const key = pairKey(me, to);
      const r = await Match.updateOne({ key }, { $setOnInsert: { key, users: [me, to] } }, { upsert: true });
      if (r.upsertedCount) {
        const meDoc = await User.findById(me);
        emitToUser(to, 'match:new', { user: toPublic(meDoc) });
      }
    }
  }
  res.json({ matched, user: matched ? toPublic(target) : undefined });
});

export default router;
