'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { REASONS } from '@/lib/format';

// Shikoyat qilish: yuborilgach foydalanuvchi avtomatik bloklanadi
export default function ReportButton({ targetId, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('fake');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/reports', { method: 'POST', body: { target: targetId, reason, details } });
      setOpen(false);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn ghost sm danger" onClick={() => setOpen(true)}>
        Shikoyat
      </button>
    );
  }
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <form className="card stack" style={{ width: '100%', maxWidth: 420, textAlign: 'left' }} onSubmit={submit}>
        <h3>Shikoyat qilish</h3>
        <p className="muted">Shikoyatdan so&apos;ng bu foydalanuvchi siz uchun bloklanadi, moderatorlar esa ko&apos;rib chiqadi.</p>
        <label>Sabab
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {Object.entries(REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Izoh (ixtiyoriy)
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn danger" disabled={busy}>Yuborish</button>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Bekor qilish</button>
        </div>
      </form>
    </div>
  );
}
