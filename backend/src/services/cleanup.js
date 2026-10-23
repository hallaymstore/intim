import { User } from '../models/User.js';
import { Like, Match, Friend, Message } from '../models/Social.js';
import { Meetup } from '../models/Meetup.js';
import { Report } from '../models/Moderation.js';
import { deleteObject } from './storage.js';

// Akkaunt va unga bog'liq barcha ma'lumotlarni o'chirish
export async function purgeUser(userId) {
  const user = await User.findById(userId).select('photos');
  if (!user) return false;

  await Promise.all([
    Like.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
    Match.deleteMany({ users: userId }),
    Friend.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
    Message.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
    Meetup.deleteMany({ $or: [{ proposer: userId }, { invitee: userId }] }),
    Report.deleteMany({ reporter: userId }),
    User.updateMany({ blocked: userId }, { $pull: { blocked: userId } }),
  ]);
  await Promise.all(user.photos.map((p) => deleteObject(p.key)));
  await User.deleteOne({ _id: userId });
  return true;
}
