'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Avatar from '@/components/Avatar';

function Person({ user, children }) {
  return (
    <div className="list-item">
      <Avatar user={user} />
      <div className="grow">
        <b>{user.name}, {user.age}</b>
        <div className="last">{[user.city, user.distanceKm ? `${user.distanceKm} km` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

export default function FriendsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/friends').then(setData).catch((e) => setError(e.message)), []);

  useEffect(() => {
    load();
    const s = getSocket();
    s.on('friend:update', load);
    return () => s.off('friend:update', load);
  }, [load]);

  async function respond(id, accept) {
    try {
      await api(`/friends/${id}/respond`, { method: 'POST', body: { accept } });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(userId) {
    if (!confirm('Do\'stlikdan chiqarilsinmi?')) return;
    await api(`/friends/${userId}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    load();
  }

  if (!data) return <p className="muted">{error || 'Yuklanmoqda…'}</p>;

  return (
    <div className="stack" style={{ gap: 28 }}>
      {error && <p className="error">{error}</p>}

      <section>
        <h2>So&apos;rovlar</h2>
        {data.incoming.length === 0 && <p className="muted">Yangi so&apos;rov yo&apos;q.</p>}
        <div className="list">
          {data.incoming.map((r) => (
            <Person key={r.id} user={r.user}>
              <button className="btn sm primary" onClick={() => respond(r.id, true)}>Qabul</button>
              <button className="btn sm ghost" onClick={() => respond(r.id, false)}>Rad</button>
            </Person>
          ))}
        </div>
      </section>

      <section>
        <h2>Do&apos;stlar</h2>
        {data.friends.length === 0 && (
          <p className="muted">Hali do&apos;st yo&apos;q. <Link href="/discover" className="em">Kashf</Link> bo&apos;limida do&apos;stlik so&apos;rovi yuboring.</p>
        )}
        <div className="list">
          {data.friends.map((f) => (
            <Person key={f.id} user={f.user}>
              <Link href={`/chats/${f.user.id}`} className="btn sm">Yozish</Link>
              <button className="btn sm ghost" onClick={() => remove(f.user.id)}>O&apos;chirish</button>
            </Person>
          ))}
        </div>
      </section>

      {data.outgoing.length > 0 && (
        <section>
          <h2>Yuborilgan so&apos;rovlar</h2>
          <div className="list">
            {data.outgoing.map((r) => (
              <Person key={r.id} user={r.user}>
                <span className="chip">javob kutilmoqda</span>
              </Person>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
