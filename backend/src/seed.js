import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { connectDb } from './config/db.js';
import { User } from './models/User.js';
import { Place } from './models/Meetup.js';

const demo = process.argv.includes('--demo');

await connectDb();

// 1) Admin
if (config.admin.email && config.admin.password) {
  const email = config.admin.email.toLowerCase();
  const exists = await User.exists({ email });
  if (exists) {
    console.log(`[seed] admin allaqachon bor: ${email}`);
  } else {
    await User.create({
      email,
      passwordHash: await bcrypt.hash(config.admin.password, 12),
      name: 'Admin',
      birthDate: new Date('1990-01-01'),
      gender: 'male',
      role: 'admin',
      verified: true,
    });
    console.log(`[seed] admin yaratildi: ${email}`);
  }
} else {
  console.log('[seed] ADMIN_EMAIL / ADMIN_PASSWORD berilmagan, admin yaratilmadi');
}

// 2) Namuna ommaviy joylar (admin paneldan tahrirlang yoki o'zingiznikini qo'shing)
if ((await Place.countDocuments()) === 0) {
  await Place.insertMany([
    { name: 'Amir Temur xiyoboni', category: 'park', city: 'Toshkent', address: 'Amir Temur shoh ko\'chasi', lng: 69.2797, lat: 41.3111 },
    { name: 'Registon maydoni', category: 'museum', city: 'Samarqand', address: 'Registon', lng: 66.9759, lat: 39.6548 },
  ].map(({ lat, lng, ...p }) => ({ ...p, location: { type: 'Point', coordinates: [lng, lat] } })));
  console.log('[seed] namuna joylar qo\'shildi (o\'zgartirishingiz mumkin)');
}

// 3) Demo foydalanuvchilar (faqat --demo bilan, rasmsiz)
if (demo) {
  const male = ['Aziz', 'Jasur', 'Bekzod', 'Sardor', 'Otabek', 'Dilshod', 'Rustam', 'Anvar', 'Timur', 'Sherzod'];
  const female = ['Madina', 'Nodira', 'Dilnoza', 'Malika', 'Zilola', 'Sevara', 'Nigora', 'Shahlo', 'Kamola', 'Aziza'];
  const cities = [
    ['Toshkent', 41.31, 69.28],
    ['Samarqand', 39.65, 66.97],
    ['Qarshi', 38.86, 65.79],
  ];
  const interests = ['kitob', 'sayohat', 'musiqa', 'sport', 'kino', 'ovqat pishirish', 'fotografiya', 'texnologiya'];
  const hash = await bcrypt.hash('Demo12345!', 10);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const docs = [];
  for (const [i, name] of [...male, ...female].entries()) {
    const [city, lat, lng] = pick(cities);
    const isMale = i < male.length;
    docs.push({
      email: `demo${i + 1}@example.com`,
      passwordHash: hash,
      name,
      birthDate: new Date(1992 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27)),
      gender: isMale ? 'male' : 'female',
      lookingFor: isMale ? 'female' : 'male',
      bio: 'Demo profil. Yangi odamlar bilan tanishishni yaxshi ko\'raman.',
      interests: [pick(interests), pick(interests)],
      city,
      location: { type: 'Point', coordinates: [lng + (Math.random() - 0.5) * 0.2, lat + (Math.random() - 0.5) * 0.2].map((n) => Math.round(n * 100) / 100) },
    });
  }
  let created = 0;
  for (const d of docs) {
    if (!(await User.exists({ email: d.email }))) {
      await User.create(d);
      created++;
    }
  }
  console.log(`[seed] ${created} ta demo foydalanuvchi qo'shildi (parol: Demo12345!)`);
  console.log('[seed] Eslatma: demo profillarda rasm yo\'q, shuning uchun discover ro\'yxatida chiqmaydi.');
}

await mongoose.disconnect();
