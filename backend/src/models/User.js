import mongoose from 'mongoose';

const { Schema } = mongoose;

const photoSchema = new Schema({
  key: { type: String, required: true },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    refreshTokens: { type: [String], default: [], select: false },

    name: { type: String, required: true, trim: true, maxlength: 40 },
    birthDate: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    lookingFor: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
    bio: { type: String, default: '', maxlength: 500 },
    interests: { type: [String], default: [] },
    photos: { type: [photoSchema], default: [] },

    city: { type: String, default: '', trim: true, maxlength: 60 },
    district: { type: String, default: '', trim: true, maxlength: 60 },
    // Taxminiy joylashuv (~1 km ga yumaloqlangan). Aniq uy manzili saqlanmaydi.
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
    showDistance: { type: Boolean, default: true },
    prefs: {
      minAge: { type: Number, default: 18, min: 18 },
      maxAge: { type: Number, default: 60, max: 99 },
      maxKm: { type: Number, default: 100, min: 1, max: 20000 },
    },

    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    verified: { type: Boolean, default: false },
    blocked: { type: [Schema.Types.ObjectId], default: [] },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ status: 1, gender: 1, birthDate: 1 });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model('User', userSchema);
