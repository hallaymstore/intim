export const GENDERS = { male: 'Erkak', female: 'Ayol' };
export const LOOKING = { male: 'Erkak', female: 'Ayol', any: 'Farqi yo\'q' };

export const REASONS = {
  fake: 'Soxta profil',
  harassment: 'Bezovtalik / tahdid',
  spam: 'Spam / reklama',
  underage: 'Voyaga yetmagan',
  inappropriate_photo: 'Nomaqbul rasm',
  scam: 'Firibgarlik',
  other: 'Boshqa',
};

export const STATUS = {
  proposed: 'Javob kutilmoqda',
  accepted: 'Qabul qilingan',
  declined: 'Rad etilgan',
  cancelled: 'Bekor qilingan',
};

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' });

export const fmtTime = (d) => new Date(d).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

// <input type="datetime-local"> uchun minimal qiymat (hozir + 1 soat)
export function minDateTimeLocal() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
