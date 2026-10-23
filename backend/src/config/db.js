import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('[db] MongoDB ulandi');
}
