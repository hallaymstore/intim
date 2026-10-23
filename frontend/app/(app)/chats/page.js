'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Avatar from '@/components/Avatar';
import { fmtTime } from '@/lib/format';

export default function ChatsPage() {
  const [chats, setChats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () =>
      api('/chats')
        .then((d) => setChats(d.chats))
        .catch((e) => setError(e.message));
    load();
    const s = getSocket();
    s.on('message:new', load);
    s.on('match:new', load);
    return () => {
      s.off('message:new', load);
      s.off('match:new', load);
    };
  }, []);

  return (
    <>
      <h2>Suhbatlar</h2>
      {error && <p className="error">{error}</p>}
      {chats === null && !error && <p className="muted">Yuklanmoqda…</p>}
      {chats?.length === 0 && (
        <div className="empty card">
          <div className="big">Hali jim</div>
          <p className="muted">Match bo&apos;lgan yoki do&apos;st bo&apos;lgan odamlar bilan shu yerda yozishasiz.</p>
          <Link href="/discover" className="btn primary">Kashf qilish</Link>
        </div>
      )}
      <div className="list">
        {chats?.map((c) => (
          <Link key={c.user.id} href={`/chats/${c.user.id}`} className="list-item">
            <Avatar user={c.user} />
            <div className="grow">
              <div className="row spread">
                <b>{c.user.name}</b>
                <span className="chip">{c.kind === 'match' ? 'match' : 'do\'st'}</span>
              </div>
              <div className="last">
                {c.lastMessage ? c.lastMessage.text : 'Birinchi bo\'lib salom yozing'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {c.unread > 0 && <span className="badge">{c.unread}</span>}
              {c.lastMessage && <div className="muted" style={{ fontSize: '.75rem' }}>{fmtTime(c.lastMessage.createdAt)}</div>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
