'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { STATUS, fmtDateTime, minDateTimeLocal } from '@/lib/format';
import Avatar from '@/components/Avatar';

const GeoMap = dynamic(() => import('@/components/GeoMap'), {
  ssr: false,
  loading: () => <div className="map" />,
});

const CATS = { cafe: 'Kafe', restaurant: 'Restoran', park: 'Park', mall: 'Savdo markazi', museum: 'Muzey', other: 'Boshqa' };

export default function MeetupsPage() {
  const { user } = useAuth();
  const [meetups, setMeetups] = useState([]);
  const [partners, setPartners] = useState([]);
  const [places, setPlaces] = useState([]);
  const [city, setCity] = useState('');
  const [to, setTo] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMeetups = useCallback(() => api('/meetups').then((d) => setMeetups(d.meetups)).catch(() => {}), []);

  useEffect(() => {
    loadMeetups();
    api('/chats').then((d) => {
      setPartners(d.chats.map((c) => c.user));
      const want = new URLSearchParams(window.location.search).get('to');
      if (want && d.chats.some((c) => c.user.id === want)) setTo(want);
    });
    api('/meetups/places').then((d) => {
      setPlaces(d.places);
      const cities = [...new Set(d.places.map((p) => p.city))];
      const mine = cities.find((c) => c.toLowerCase() === (user.city || '').toLowerCase());
      setCity(mine || cities[0] || '');
    });
    const s = getSocket();
    s.on('meetup:update', loadMeetups);
    return () => s.off('meetup:update', loadMeetups);
  }, [loadMeetups, user.city]);

  const cities = useMemo(() => [...new Set(places.map((p) => p.city))], [places]);
  const cityPlaces = useMemo(() => places.filter((p) => p.city === city), [places, city]);
  const place = places.find((p) => p.id === placeId);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api('/meetups', { method: 'POST', body: { to, placeId, startsAt: new Date(startsAt).toISOString(), note } });
      setOk('Taklif yuborildi. Javobni kuting.');
      setNote('');
      setPlaceId('');
      setStartsAt('');
      loadMeetups();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(id, action) {
    try {
      await api(`/meetups/${id}`, { method: 'PATCH', body: { action } });
      loadMeetups();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h2 style={{ margin: 0 }}>Uchrashuvlar</h2>

      <div className="card safety">
        <h3>Xavfsiz uchrashuv qoidalari</h3>
        <ul>
          <li>Faqat ommaviy, gavjum joylarda uchrashing. Shuning uchun joylar ro&apos;yxati cheklangan.</li>
          <li>Qayerga va kim bilan borayotganingizni yaqin odamingizga ayting.</li>
          <li>Uyingiz manzilini va moliyaviy ma&apos;lumotlarni hech kimga bermang.</li>
          <li>O&apos;zingiz yetib boring va qaytib keling; his-tuyg&apos;ularingizga ishoning.</li>
        </ul>
      </div>

      <form className="card stack" onSubmit={create}>
        <h3>Yangi taklif</h3>
        {partners.length === 0 ? (
          <p className="muted">Uchrashuv taklif qilish uchun avval match bo&apos;ling yoki do&apos;st orttiring.</p>
        ) : places.length === 0 ? (
          <p className="muted">Hozircha ommaviy joylar qo&apos;shilmagan. Admin joylar ro&apos;yxatini to&apos;ldirishi kerak.</p>
        ) : (
          <>
            <div className="field-row">
              <label>Kim bilan
                <select value={to} onChange={(e) => setTo(e.target.value)} required>
                  <option value="" disabled>Tanlang</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label>Shahar
                <select value={city} onChange={(e) => { setCity(e.target.value); setPlaceId(''); }}>
                  {cities.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Vaqt
                <input type="datetime-local" value={startsAt} min={minDateTimeLocal()} onChange={(e) => setStartsAt(e.target.value)} required />
              </label>
            </div>

            <GeoMap places={cityPlaces} selectedId={placeId} onSelect={setPlaceId} />
            <label>Joy
              <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} required>
                <option value="" disabled>Xaritadan yoki shu yerdan tanlang</option>
                {cityPlaces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {CATS[p.category] || p.category}</option>
                ))}
              </select>
            </label>
            {place?.address && <p className="muted" style={{ margin: 0 }}>Manzil: {place.address}</p>}
            <label>Izoh (ixtiyoriy)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Masalan: kirish eshigi oldida" /></label>
            {error && <p className="error" role="alert">{error}</p>}
            {ok && <p className="notice" role="status">{ok}</p>}
            <button className="btn primary" disabled={busy || !to || !placeId || !startsAt}>Taklif yuborish</button>
          </>
        )}
      </form>

      <section>
        <h2>Mening uchrashuvlarim</h2>
        {meetups.length === 0 && <p className="muted">Hali uchrashuv yo&apos;q.</p>}
        <div className="list">
          {meetups.map((m) => (
            <div key={m.id} className="list-item">
              {m.other && <Avatar user={m.other} />}
              <div className="grow">
                <b>{m.other?.name || 'Foydalanuvchi'}</b>{' '}
                <span className="muted">({m.mine ? 'siz taklif qildingiz' : 'sizni taklif qildi'})</span>
                <div>{m.placeName}, {fmtDateTime(m.startsAt)}</div>
                {m.note && <div className="last">{m.note}</div>}
              </div>
              <div className="row">
                <span className={`chip ${m.status === 'accepted' ? 'ok' : m.status === 'proposed' ? 'gold' : 'bad'}`}>{STATUS[m.status]}</span>
                {!m.mine && m.status === 'proposed' && (
                  <>
                    <button className="btn sm primary" onClick={() => act(m.id, 'accept')}>Qabul</button>
                    <button className="btn sm ghost" onClick={() => act(m.id, 'decline')}>Rad</button>
                  </>
                )}
                {['proposed', 'accepted'].includes(m.status) && (
                  <button className="btn sm ghost" onClick={() => act(m.id, 'cancel')}>Bekor qilish</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
