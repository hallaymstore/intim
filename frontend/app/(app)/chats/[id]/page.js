'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { fmtTime } from '@/lib/format';
import Avatar from '@/components/Avatar';
import ReportButton from '@/components/ReportButton';

export default function ChatPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    api(`/chats/${id}/messages`)
      .then((d) => {
        setOther(d.user);
        setMessages(d.messages);
      })
      .catch((e) => setError(e.message));

    const s = getSocket();
    const onMsg = (m) => {
      if (m.from === id || m.to === id) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.from === id) api(`/chats/${id}/messages?limit=1`).catch(() => {}); // o'qilgan deb belgilash
      }
    };
    const onTyping = ({ from }) => {
      if (from !== id) return;
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 2000);
    };
    s.on('message:new', onMsg);
    s.on('typing', onTyping);
    return () => {
      s.off('message:new', onMsg);
      s.off('typing', onTyping);
      clearTimeout(typingTimer.current);
    };
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setError('');
    getSocket().emit('message:send', { to: id, text: t }, (res) => {
      if (!res?.ok) setError(res?.error || 'Yuborib bo\'lmadi');
    });
    setText('');
  }

  function onChange(e) {
    setText(e.target.value);
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      getSocket().emit('typing', { to: id });
    }
  }

  async function block() {
    if (!confirm(`${other?.name} bloklansinmi? Suhbat yopiladi.`)) return;
    await api(`/users/${id}/block`, { method: 'POST' });
    router.replace('/chats');
  }

  if (error && !other) {
    return (
      <div className="empty card">
        <p className="error">{error}</p>
        <Link href="/chats" className="btn">Suhbatlarga qaytish</Link>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <Link href="/chats" className="btn ghost sm" aria-label="Orqaga">←</Link>
        {other && <Avatar user={other} />}
        <div className="grow" style={{ flex: 1 }}>
          <b>{other?.name}</b>
          <div className="typing">{typing ? 'yozmoqda…' : ' '}</div>
        </div>
        <Link href={`/meetups?to=${id}`} className="btn sm primary">Uchrashuv taklif qilish</Link>
        <button className="btn sm ghost" onClick={block}>Bloklash</button>
        <ReportButton targetId={id} onDone={() => router.replace('/chats')} />
      </div>

      <div className="msgs" aria-live="polite">
        {messages.length === 0 && <p className="muted" style={{ margin: 'auto' }}>Suhbatni boshlang. Shaxsiy ma&apos;lumot (manzil, karta) so&apos;ralsa, ehtiyot bo&apos;ling.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`msg${m.from === user.id ? ' mine' : ''}`}>
            {m.text}
            <small>{fmtTime(m.createdAt)}</small>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div>
        {error && <p className="error">{error}</p>}
        <form className="composer" onSubmit={send}>
          <input value={text} onChange={onChange} placeholder="Xabar yozing…" maxLength={2000} autoComplete="off" />
          <button className="btn primary" disabled={!text.trim()}>Yuborish</button>
        </form>
      </div>
    </div>
  );
}
