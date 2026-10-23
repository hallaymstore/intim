import mongoose from 'mongoose';

const { Schema } = mongoose;

// Faqat admin tasdiqlagan OMMAVIY joylar (kafe, park, savdo markazi...) tanlanadi.
const placeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ['cafe', 'restaurant', 'park', 'mall', 'museum', 'other'],
      default: 'cafe',
    },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    address: { type: String, default: '', trim: true, maxlength: 200 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
placeSchema.index({ location: '2dsphere' });
placeSchema.index({ city: 1, active: 1 });

const meetupSchema = new Schema(
  {
    proposer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
    placeName: { type: String, required: true },
    startsAt: { type: Date, required: true },
    note: { type: String, default: '', maxlength: 300 },
    status: {
      type: String,
      enum: ['proposed', 'accepted', 'declined', 'cancelled'],
      default: 'proposed',
    },
  },
  { timestamps: true }
);
meetupSchema.index({ proposer: 1, startsAt: -1 });
meetupSchema.index({ invitee: 1, startsAt: -1 });

export const Place = mongoose.model('Place', placeSchema);
export const Meetup = mongoose.model('Meetup', meetupSchema);
