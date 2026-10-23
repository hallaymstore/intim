'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, uploadPhoto } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const GeoMap = dynamic(() => import('@/components/GeoMap'), {
  ssr: false,
  loading: () => <div className="map" />,
});

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [welcome, setWelcome] = useState(false);
  const [form, setForm] = useState(() => ({
    name: user.name,
    bio: user.bio,
    interests: user.interests.join(', '),
    lookingFor: user.lookingFor,
    city: user.city,
    district: user.district,
    showDistance: user.showDistance,
    minAge: user.prefs.minAge,
    maxAge: user.prefs.maxAge,
    maxKm: user.prefs.maxKm,
  }));
  const [pick, setPick] = useState(user.location);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState([]);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get('welcome') === '1');
    api('/users/blocked/list').then((d) => setBlocked(d.users)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const flash = (t) => {
    setMsg(t);
    setError('');
    setTimeout(() => setMsg(''), 3000);
  };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/users/me', {
        method: 'PATCH',
        body: {
          name: form.name,
          bio: form.bio,
          interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10),
          lookingFor: form.lookingFor,
          city: form.city,
          district: form.district,
          showDistance: form.showDistance,
          prefs: { minAge: Number(form.minAge), maxAge: Number(form.maxAge), maxKm: Number(form.maxKm) },
        },
      });
      setUser(data.user);
      flash('Saqlandi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('Rasm hajmi 5 MB dan oshmasligi kerak');
    setBusy(true);
    setError('');
    try {
      const data = await uploadPhoto(file);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(id) {
    try {
      setUser((await api(`/users/me/photos/${id}`, { method: 'DELETE' })).user);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveLocation() {
    if (!pick) return;
    try {
      const data = await api('/users/me/location', { method: 'PUT', body: pick });
      setUser(data.user);
      setPick(data.user.location);
      flash('Hudud saqlandi (taxminan 1 km aniqlikda)');
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearLocation() {
    const data = await api('/users/me/location', { method: 'DELETE' });
    setUser(data.user);
    setPick(null);
    flash('Joylashuv o\'chirildi');
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError('Brauzer joylashuvni qo\'llamaydi');
    navigator.geolocation.getCurrentPosition(
      (p) => setPick({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError('Joylashuvga ruxsat berilmadi. Xaritadan o\'zingiz tanlang.'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  async function unblock(id) {
    await api(`/users/${id}/block`, { method: 'DELETE' });
    setBlocked((b) => b.filter((u) => u.id !== id));
  }

  async function deleteAccount() {
    const password = prompt('Akkauntni butunlay o\'chirish uchun parolingizni kiriting:');
    if (!password) return;
    try {
      await api('/users/me', { method: 'DELETE', body: { password } });
      await logout();
      router.replace('/');
    } catch (err) {
      setError(err.message);
    }
  }

  const slots = [...user.photos, ...Array(Math.max(0, 6 - user.photos.length)).fill(null)];

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="app-head">
        <h2 style={{ margin: 0 }}>Profil</h2>
        <button className="btn ghost sm" onClick={async () => { await logout(); router.replace('/'); }}>Chiqish</button>
      </div>

      {welcome && (
        <div className="notice">
          Xush kelibsiz! Boshqalar sizni ko&apos;rishi uchun kamida bitta rasm qo&apos;shing va hududingizni belgilang.
        </div>
      )}
      {msg && <p className="notice" role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card stack">
        <h3>Rasmlar ({user.photos.length}/6)</h3>
        <div className="photo-grid">
          {slots.map((p, i) =>
            p ? (
              <div className="thumb" key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Rasm ${i + 1}`} />
                <button className="x" onClick={() => removePhoto(p.id)} aria-label="Rasmni o'chirish">✕</button>
              </div>
            ) : i === user.photos.length ? (
              <label className="thumb add" key={`add-${i}`}>
                +
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={busy} />
              </label>
            ) : (
              <div className="thumb" key={`empty-${i}`} />
            )
          )}
        </div>
        <p className="muted" style={{ margin: 0 }}>JPG, PNG yoki WebP, 5 MB gacha. Faqat o&apos;z rasmingizni yuklang; nomaqbul rasmlar o&apos;chiriladi.</p>
      </section>

      <form className="card stack" onSubmit={save}>
        <h3>Ma&apos;lumotlar</h3>
        <div className="field-row">
          <label>Ism<input value={form.name} onChange={set('name')} required minLength={2} maxLength={40} /></label>
          <label>Qidiryapman
            <select value={form.lookingFor} onChange={set('lookingFor')}>
              <option value="female">Ayol</option>
              <option value="male">Erkak</option>
              <option value="any">Farqi yo&apos;q</option>
            </select>
          </label>
        </div>
        <label>O&apos;zim haqimda<textarea value={form.bio} onChange={set('bio')} maxLength={500} /></label>
        <label>Qiziqishlar (vergul bilan, 10 tagacha)<input value={form.interests} onChange={set('interests')} placeholder="kitob, sayohat, musiqa" /></label>
        <div className="field-row">
          <label>Shahar<input value={form.city} onChange={set('city')} maxLength={60} /></label>
          <label>Tuman / mahalla<input value={form.district} onChange={set('district')} maxLength={60} /></label>
        </div>
        <h3 style={{ marginTop: 8 }}>Qidiruv sozlamalari</h3>
        <div className="field-row">
          <label>Yosh (dan)<input type="number" min={18} max={99} value={form.minAge} onChange={set('minAge')} /></label>
          <label>Yosh (gacha)<input type="number" min={18} max={99} value={form.maxAge} onChange={set('maxAge')} /></label>
          <label>Masofa (km)<input type="number" min={1} max={20000} value={form.maxKm} onChange={set('maxKm')} /></label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.showDistance} onChange={set('showDistance')} />
          <span>Boshqalarga taxminiy masofani ko&apos;rsatish</span>
        </label>
        <button className="btn primary" disabled={busy}>Saqlash</button>
      </form>

      <section className="card stack">
        <h3>Hududim</h3>
        <p className="muted" style={{ margin: 0 }}>
          Xaritadan yashash hududingizni bosing. <b>Aniq uy manzilingiz saqlanmaydi va hech kimga ko&apos;rsatilmaydi</b>:
          joylashuv ~1 km ga yumaloqlanadi, boshqalar faqat taxminiy masofani ko&apos;radi.
        </p>
        <GeoMap pick={pick} onPick={setPick} center={pick ? [pick.lat, pick.lng] : [41.3111, 69.2797]} zoom={pick ? 13 : 6} />
        <div className="row">
          <button className="btn" type="button" onClick={useMyLocation}>Mening joylashuvim</button>
          <button className="btn primary" type="button" onClick={saveLocation} disabled={!pick}>Hududni saqlash</button>
          {user.location && <button className="btn ghost" type="button" onClick={clearLocation}>O&apos;chirish</button>}
        </div>
      </section>

      {blocked.length > 0 && (
        <section className="card stack">
          <h3>Bloklanganlar</h3>
          {blocked.map((b) => (
            <div key={b.id} className="row spread">
              <span>{b.name}</span>
              <button className="btn sm" onClick={() => unblock(b.id)}>Blokdan chiqarish</button>
            </div>
          ))}
        </section>
      )}

      <section className="card stack">
        <h3>Xavfli hudud</h3>
        <p className="muted" style={{ margin: 0 }}>Akkaunt, rasmlar, suhbatlar va uchrashuvlar butunlay o&apos;chiriladi.</p>
        <div><button className="btn danger" onClick={deleteAccount}>Akkauntni o&apos;chirish</button></div>
      </section>
    </div>
  );
}
