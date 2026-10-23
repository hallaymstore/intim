# Yaqin: tanishuv sayti

18+ foydalanuvchilar uchun tanishuv platformasi: profil va rasmlar, like/match, do'stlik, real-vaqt chat,
xaritada ommaviy joyda uchrashuv belgilash va to'liq admin panel.

```
backend/    Node.js + Express 5 + MongoDB (Mongoose) + Socket.IO
frontend/   Next.js 15 (App Router), qorong'i-pushti dizayn, Leaflet xarita
admin/      Statik admin panel (backend `/admin` manzilida beradi), Chart.js grafiklar
```

## Tez ishga tushirish

Kerak: Node.js 20+ va MongoDB (eng oson yo'li `docker compose up -d`).

```bash
docker compose up -d                    # MongoDB

cd backend
cp .env.example .env                    # ADMIN_EMAIL / ADMIN_PASSWORD ni o'zgartiring
npm install
npm run seed                            # admin va namuna joylar
npm run dev                             # http://localhost:4000

cd ../frontend
cp .env.example .env.local
npm install
npm run dev                             # http://localhost:3000
```

Admin panel: <http://localhost:4000/admin> (seed'da kiritgan email/parol bilan kiring).
`npm run seed:demo` rasmsiz demo foydalanuvchilar qo'shadi (parol `Demo12345!`). Discover ro'yxatida
faqat rasmi bor profillar chiqadi, shuning uchun test uchun ikkita haqiqiy akkaunt yarating va rasm yuklang.

## Imkoniyatlar

**Foydalanuvchi:** ro'yxatdan o'tish (18+ tekshiruvi serverda), profil, 6 tagacha rasm, qiziqishlar,
yosh/masofa filtrlari, like/pass, o'zaro like = match, do'stlik so'rovlari, Socket.IO chat (yozmoqda
ko'rsatkichi, o'qilmagan xabarlar), bloklash, shikoyat, akkauntni o'chirish.

**Manzil va uchrashuv (maxfiylik bilan):**
- Uy manzili saqlanmaydi. Foydalanuvchi xaritadan hududini bosadi, koordinata **~1 km ga yumaloqlanadi**,
  boshqalarga faqat "3 km uzoqda" ko'rinadi (xohlasa o'chirib qo'yadi).
- Uchrashuv joyi erkin manzil emas, balki **admin tasdiqlagan ommaviy joylar** (kafe, park, savdo markazi)
  ro'yxatidan xaritada tanlanadi. Taklif faqat match yoki do'st bo'lganlar o'rtasida, ikki tomon tasdiqlaydi.

**Admin panel:** statistika (ro'yxatdan o'tish, match, xabar grafiklari, jins va shahar bo'yicha), foydalanuvchilarni
qidirish/bloklash/tasdiqlash/o'chirish, shikoyatlar, rasm moderatsiyasi, uchrashuv joylari CRUD, audit log.

## Rasmlar: Cloudflare R2

Brauzer rasmni **to'g'ridan-to'g'ri R2 ga** presigned URL orqali yuklaydi, MongoDB'da faqat havola saqlanadi.
`backend/.env` da `R2_*` o'zgaruvchilarini to'ldiring (bo'sh bo'lsa, rasm `backend/uploads/` ga saqlanadi,
bu faqat ishlab chiqish uchun).

1. Cloudflare → R2 → bucket yarating va hisob uchun API token (Object Read & Write) oling.
2. Bucketga ommaviy kirish: custom domen ulang (tavsiya) va `R2_PUBLIC_URL` ga yozing.
3. Bucket CORS (brauzer PUT qila olishi uchun):
   ```json
   [{ "AllowedOrigins": ["https://sizning-domeningiz.uz"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```

Node.js + MongoDB serveri Cloudflare Workers'da emas, oddiy VPS'da ishlaydi (Socket.IO va Mongoose uchun).

## Joylashtirish bo'yicha eslatmalar

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` ni 32+ belgili tasodifiy qiling (production'da bo'lmasa server ishga tushmaydi).
- HTTPS ortida `COOKIE_SECURE=true`, `CLIENT_ORIGIN` ni haqiqiy domenga o'rnating; Nginx orqali `/api`, `/socket.io` va `/admin`
  ni backendga, qolganini frontendga yo'naltiring.
- Shaxsiy ma'lumotlar uchun O'zbekiston qonunchiligi (ma'lumotlarni mamlakat ichidagi serverda saqlash va hokazo)
  talablarini ishga tushirishdan oldin yurist bilan tekshiring. MongoDB'ni mahalliy VPS'da yuritish shu sababdan tavsiya etiladi.
- OpenStreetMap'ning bepul tile serveri jiddiy trafik uchun mo'ljallanmagan; production'da o'z tile provayderingizni ulang.
- Hozircha email/telefon tasdiqlash yo'q: admin "tasdiqlangan" belgisini qo'lda beradi. Soxta akkauntlarga qarshi
  SMS (masalan, Eskiz) yoki email tasdiqlashni qo'shish keyingi qadam.

## Xavfsizlik (amalga oshirilgan)

bcrypt (12), qisqa muddatli access token + aylanuvchi (rotation) httpOnly refresh cookie, zod validatsiya, rate limit
(login/register uchun qattiqroq), helmet + CSP, bloklangan akkauntlar zudlik bilan chiqarib yuboriladi, rasm kalitlari
foydalanuvchi papkasiga bog'langan va R2'da hajm/tur tekshiriladi, API javoblarida email va aniq koordinata yo'q,
admin amallari audit logga yoziladi.
