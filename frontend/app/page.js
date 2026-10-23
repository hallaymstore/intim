'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  ['Tanishing', 'Yoshi, shahri va qiziqishlari mos odamlarni toping. Profil rasmlari va qisqa tavsif bilan o\'zingizni ko\'rsating.'],
  ['Match va do\'stlik', 'Ikki tomon ham yoqtirsa, suhbat ochiladi. Yoki oddiygina do\'stlik so\'rovi yuboring.'],
  ['Xavfsiz uchrashuv', 'Uchrashuv faqat ommaviy joylarda: kafe, park, savdo markazi. Joyni xaritadan tanlaysiz.'],
  ['Maxfiylik', 'Uy manzilingiz hech kimga ko\'rinmaydi. Faqat taxminiy masofa ("3 km uzoqda") ko\'rsatiladi.'],
];

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/discover');
  }, [loading, user, router]);

  return (
    <main className="landing">
      <header className="topbar">
        <div className="logo">Yaqin<span>.</span></div>
        <div className="row">
          <Link href="/login" className="btn ghost">Kirish</Link>
          <Link href="/register" className="btn primary">Ro&apos;yxatdan o&apos;tish</Link>
        </div>
      </header>

      <section className="hero">
        <span className="chip gold">Faqat 18 yoshdan oshganlar uchun</span>
        <h1>
          Yaqin odamni <span className="em">toping</span>, ehtiyotkorlik bilan <span className="em">uchrashing</span>.
        </h1>
        <p>Sokin, chiroyli va xavfsiz tanishuv joyi. Haqiqiy profillar, o&apos;zaro yoqtirish va ommaviy joylarda uchrashuv.</p>
        <div className="row">
          <Link href="/register" className="btn primary">Boshlash</Link>
          <Link href="/login" className="btn">Akkauntim bor</Link>
        </div>
      </section>

      <section className="features">
        {FEATURES.map(([title, text], i) => (
          <article key={title} className="card feature">
            <div className="no">0{i + 1}</div>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </article>
        ))}
      </section>

      <p className="footnote">
        Yaqin faqat o&apos;zaro rozilik asosidagi tanishuv uchun. Ochiq-oshkora kontent, pullik xizmatlar va
        voyaga yetmaganlar taqiqlanadi; shikoyat qilingan profillar ko&apos;rib chiqiladi.
      </p>
    </main>
  );
}
