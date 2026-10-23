'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await login(f.get('email'), f.get('password'));
      router.replace('/discover');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={onSubmit}>
        <Link href="/" className="logo">Yaqin<span>.</span></Link>
        <h2>Qaytganingiz bilan</h2>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Parol<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Kirilmoqda…' : 'Kirish'}</button>
        <p className="muted">Akkauntingiz yo&apos;qmi? <Link href="/register" className="em">Ro&apos;yxatdan o&apos;ting</Link></p>
      </form>
    </main>
  );
}
