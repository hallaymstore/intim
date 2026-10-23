import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Like } from '../models/Social.js';
import { requireAuth } from '../middleware/auth.js';
import { parse } from '../utils/errors.js';
import { toPublic } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(15),
  minAge: z.coerce.number().int().min(18).max(99).optional(),
  maxAge: z.coerce.number().int().min(18).max(99).optional(),
  maxKm: z.coerce.number().int().min(1).max(20000).optional(),
});

router.get('/', async (req, res) => {
  const q = parse(querySchema, req.query);
  const me = await User.findById(req.user.id);

  const minAge = q.minAge ?? me.prefs?.minAge ?? 18;
  const maxAge = q.maxAge ?? me.prefs?.maxAge ?? 60;
  const maxKm = q.maxKm ?? me.prefs?.maxKm ?? 100;

  const [seen, blockedMe] = await Promise.all([
    Like.find({ from: me._id }).distinct('to'),
    User.find({ blocked: me._id }).distinct('_id'),
  ]);
  const exclude = [me._id, ...seen, ...me.blocked, ...blockedMe];

  const today = new Date();
  const olderThan = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  const youngerThan = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate());

  const match = {
    _id: { $nin: exclude },
    role: 'user',
    status: 'active',
    birthDate: { $gt: youngerThan, $lte: olderThan },
    'photos.0': { $exists: true },
    lookingFor: { $in: [me.gender, 'any'] },
  };
  if (me.lookingFor !== 'any') match.gender = me.lookingFor;

  const hide = { passwordHash: 0, refreshTokens: 0, email: 0, blocked: 0, location: 0, prefs: 0 };
  const hasLoc = me.location?.coordinates?.length === 2;

  let docs;
  if (hasLoc) {
    docs = await User.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: me.location.coordinates },
          distanceField: 'dist',
          maxDistance: maxKm * 1000,
          spherical: true,
          query: match,
        },
      },
      { $limit: q.limit },
      { $project: hide },
    ]);
  } else {
    docs = await User.aggregate([{ $match: match }, { $sample: { size: q.limit } }, { $project: hide }]);
  }

  res.json({
    profiles: docs.map((d) => toPublic(d, d.dist)),
    needsLocation: !hasLoc,
  });
});

export default router;
