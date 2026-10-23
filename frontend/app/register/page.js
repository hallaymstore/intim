'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// 18 yoshdan kichiklarni formada ham to'sib qo'yamiz (asosiy tekshiruv serverda)
function maxBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      await register({
        email: f.email,
        password: f.password,
        name: f.name,
        birthDate: f.birthDate,
        gender: f.gender,
        lookingFor: f.lookingFor,
        city: f.city,
      });
      router.replace('/profile?welcome=1');
    } catch (err) {
      const first = err.details && Object.values(err.details).flat()[0];
      setError(first ? `${err.message}: ${first}` : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={onSubmit}>
        <Link href="/" className="logo">Yaqin<span>.</span></Link>
        <h2>Akkaunt yaratish</h2>
        <label>Ism<input name="name" required minLength={2} maxLength={40} autoComplete="given-name" /></label>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Parol (kamida 8 belgi)<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <div className="field-row">
          <label>Tug&apos;ilgan sana<input name="birthDate" type="date" required max={maxBirthDate()} /></label>
          <label>Shahar<input name="city" maxLength={60} placeholder="Masalan, Qarshi" /></label>
        </div>
        <div className="field-row">
          <label>Men
            <select name="gender" required defaultValue="">
              <option value="" disabled>Tanlang</option>
              <option value="male">Erkakman</option>
              <option value="female">Ayolman</option>
            </select>
          </label>
          <label>Qidiryapman
            <select name="lookingFor" defaultValue="any">
              <option value="female">Ayol</option>
              <option value="male">Erkak</option>
              <option value="any">Farqi yo&apos;q</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" required />
          <span>Men 18 yoshdan oshganman va foydalanish qoidalariga roziman: soxta ma&apos;lumot, ochiq-oshkora kontent va pullik xizmatlar taqiqlanadi.</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Yaratilmoqda…' : 'Ro\'yxatdan o\'tish'}</button>
        <p className="muted">Akkauntingiz bormi? <Link href="/login" className="em">Kirish</Link></p>
      </form>
    </main>
  );
}
