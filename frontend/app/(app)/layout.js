'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Avatar from '@/components/Avatar';

const NAV = [
  { href: '/discover', ic: '♡', label: 'Kashf' },
  { href: '/chats', ic: '✉', label: 'Suhbat', badge: 'unread' },
  { href: '/friends', ic: '☺', label: 'Do\'stlar', badge: 'pending' },
  { href: '/meetups', ic: '⌖', label: 'Uchrashuv' },
  { href: '/profile', ic: '◉', label: 'Profil' },
];

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [counts, setCounts] = useState({ unread: 0, pending: 0 });
  const [match, setMatch] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const refreshCounts = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([api('/chats'), api('/friends')]);
      setCounts({ unread: c.chats.reduce((s, x) => s + x.unread, 0), pending: f.incoming.length });
    } catch {
      /* e'tiborsiz */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshCounts();
    const s = getSocket();
    const onMatch = (data) => {
      setMatch(data.user);
      refreshCounts();
    };
    s.on('message:new', refreshCounts);
    s.on('friend:update', refreshCounts);
    s.on('match:new', onMatch);
    return () => {
      s.off('message:new', refreshCounts);
      s.off('friend:update', refreshCounts);
      s.off('match:new', onMatch);
    };
  }, [user, refreshCounts]);

  // Sahifa almashganda (masalan, suhbat o'qilgach) hisoblagichlarni yangilash
  useEffect(() => {
    if (user) refreshCounts();
  }, [pathname, user, refreshCounts]);

  if (loading || !user) return <div className="empty muted">Yuklanmoqda…</div>;

  return (
    <>
      <nav className="nav" aria-label="Asosiy menyu">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={pathname.startsWith(n.href) ? 'active' : ''}>
            <span className="ic">{n.ic}</span>
            <span>{n.label}</span>
            {n.badge && counts[n.badge] > 0 && <span className="dot">{counts[n.badge]}</span>}
          </Link>
        ))}
      </nav>
      <main className="app">{children}</main>

      {match && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="box">
            <h2>Match!</h2>
            <Avatar user={match} large />
            <p>
              <b>{match.name}</b> ham sizni yoqtirdi. Endi suhbatlashishingiz mumkin.
            </p>
            <div className="row">
              <button
                className="btn primary"
                onClick={() => {
                  const id = match.id;
                  setMatch(null);
                  router.push(`/chats/${id}`);
                }}
              >
                Yozish
              </button>
              <button className="btn ghost" onClick={() => setMatch(null)}>Keyinroq</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
