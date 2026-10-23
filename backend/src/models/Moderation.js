import mongoose from 'mongoose';

const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: ['fake', 'harassment', 'spam', 'underage', 'inappropriate_photo', 'scam', 'other'],
      required: true,
    },
    details: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolution: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ target: 1 });

const auditSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    target: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.index({ createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
export const AuditLog = mongoose.model('AuditLog', auditSchema);
