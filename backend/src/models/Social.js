import mongoose from 'mongoose';

const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model, required: true });

const likeSchema = new Schema(
  {
    from: ref('User'),
    to: ref('User'),
    action: { type: String, enum: ['like', 'pass'], required: true },
  },
  { timestamps: true }
);
likeSchema.index({ from: 1, to: 1 }, { unique: true });
likeSchema.index({ to: 1, action: 1 });

const matchSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    users: { type: [Schema.Types.ObjectId], ref: 'User', required: true },
  },
  { timestamps: true }
);
matchSchema.index({ users: 1 });
matchSchema.index({ createdAt: -1 });

const friendSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    from: ref('User'),
    to: ref('User'),
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);
friendSchema.index({ to: 1, status: 1 });
friendSchema.index({ from: 1, status: 1 });

const messageSchema = new Schema(
  {
    key: { type: String, required: true },
    from: ref('User'),
    to: ref('User'),
    text: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date },
  },
  { timestamps: true }
);
messageSchema.index({ key: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

export const Like = mongoose.model('Like', likeSchema);
export const Match = mongoose.model('Match', matchSchema);
export const Friend = mongoose.model('Friend', friendSchema);
export const Message = mongoose.model('Message', messageSchema);
