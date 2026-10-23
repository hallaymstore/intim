export function calcAge(birthDate, now = new Date()) {
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function pairKey(a, b) {
  return [String(a), String(b)].sort().join('_');
}

// ~1.1 km aniqlik: aniq manzil hech qachon saqlanmaydi va ko'rsatilmaydi
export function roundCoord(n) {
  return Math.round(n * 100) / 100;
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Boshqa foydalanuvchilarga ko'rinadigan profil (email, koordinatalar yo'q)
export function toPublic(u, distanceMeters) {
  const showDist = u.showDistance !== false && typeof distanceMeters === 'number';
  return {
    id: String(u._id),
    name: u.name,
    age: calcAge(u.birthDate),
    gender: u.gender,
    bio: u.bio || '',
    interests: u.interests || [],
    photos: (u.photos || []).map((p) => ({ id: String(p._id), url: p.url })),
    city: u.city || '',
    district: u.district || '',
    verified: !!u.verified,
    distanceKm: showDist ? Math.max(1, Math.round(distanceMeters / 1000)) : null,
  };
}

// O'z profilim (email bor, koordinatalar yumaloqlangan)
export function toSelf(u) {
  const coords = u.location?.coordinates;
  return {
    ...toPublic(u),
    email: u.email,
    role: u.role,
    birthDate: u.birthDate,
    lookingFor: u.lookingFor,
    showDistance: u.showDistance !== false,
    prefs: u.prefs || { minAge: 18, maxAge: 60, maxKm: 100 },
    location: coords && coords.length === 2 ? { lng: coords[0], lat: coords[1] } : null,
  };
}
