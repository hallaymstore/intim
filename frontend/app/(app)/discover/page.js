'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import ReportButton from '@/components/ReportButton';

export default function DiscoverPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [note, setNote] = useState('');
  const [filters, setFilters] = useState({
    minAge: user?.prefs?.minAge ?? 18,
    maxAge: user?.prefs?.maxAge ?? 60,
    maxKm: user?.prefs?.maxKm ?? 100,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '15', ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)])) });
      const data = await api('/discover?' + qs);
      setQueue(data.profiles);
      setNeedsLocation(data.needsLocation);
      setPhotoIdx(0);
    } catch (e) {
      setNote(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const current = queue[0];

  function next() {
    setPhotoIdx(0);
    setQueue((q) => q.slice(1));
  }

  async function act(action) {
    if (!current || busy) return;
    setBusy(true);
    setNote('');
    try {
      await api('/likes', { method: 'POST', body: { to: current.id, action } });
      next();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function friend() {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await api('/friends/request', { method: 'POST', body: { to: current.id } });
      setNote(r.status === 'accepted' ? `${current.name} bilan do'st bo'ldingiz!` : `${current.name} ga do'stlik so'rovi yuborildi`);
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: Number(e.target.value) || 0 }));

  return (
    <>
      <div className="app-head">
        <h2 style={{ margin: 0 }}>Kashf</h2>
      </div>

      <div className="filters">
        <label>Yosh (dan)<input type="number" min={18} max={99} value={filters.minAge} onChange={setF('minAge')} /></label>
        <label>Yosh (gacha)<input type="number" min={18} max={99} value={filters.maxAge} onChange={setF('maxAge')} /></label>
        <label>Masofa (km)<input type="number" min={1} max={20000} value={filters.maxKm} onChange={setF('maxKm')} /></label>
      </div>

      {needsLocation && (
        <div className="notice" style={{ marginBottom: 16 }}>
          Atrofingizdagi odamlarni ko&apos;rish uchun <Link href="/profile" className="em">profilda hududingizni belgilang</Link>.
          Aniq manzil saqlanmaydi.
        </div>
      )}
      {note && <p className="notice" role="status">{note}</p>}

      {loading && <div className="empty muted">Qidirilmoqda…</div>}

      {!loading && !current && (
        <div className="empty card">
          <div className="big">Hozircha shu</div>
          <p className="muted">Mos profillar tugadi. Filtrlarni kengaytiring yoki birozdan keyin qaytib keling.</p>
          <button className="btn" onClick={load}>Yangilash</button>
        </div>
      )}

      {!loading && current && (
        <div className="deck">
          <article className="profile-card">
            <div className="photo-box">
              {current.photos[photoIdx] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.photos[photoIdx].url} alt={current.name} />
              ) : (
                <div className="initial">{current.name.slice(0, 1)}</div>
              )}
              {current.photos.length > 1 && (
                <div className="dots">
                  {current.photos.map((p, i) => <i key={p.id} className={i === photoIdx ? 'on' : ''} />)}
                </div>
              )}
              <button className="tap l" aria-label="Oldingi rasm" onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))} />
              <button className="tap r" aria-label="Keyingi rasm" onClick={() => setPhotoIdx((i) => Math.min(current.photos.length - 1, i + 1))} />
              <div className="shade" />
              <div className="caption">
                <h2>{current.name}, {current.age} {current.verified && <span className="chip ok">✓</span>}</h2>
                <span className="muted">
                  {[current.city, current.distanceKm ? `${current.distanceKm} km uzoqlikda` : null].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>
            <div className="profile-body">
              {current.bio && <p style={{ margin: 0 }}>{current.bio}</p>}
              {current.interests.length > 0 && (
                <div className="row">{current.interests.map((i) => <span key={i} className="chip">{i}</span>)}</div>
              )}
              <div className="row spread">
                <button className="btn sm" onClick={friend} disabled={busy}>+ Do&apos;st bo&apos;lish</button>
                <ReportButton targetId={current.id} onDone={next} />
              </div>
            </div>
            <div className="actions">
              <button className="round" aria-label="O'tkazib yuborish" onClick={() => act('pass')} disabled={busy}>✕</button>
              <button className="round like" aria-label="Yoqdi" onClick={() => act('like')} disabled={busy}>♥</button>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
