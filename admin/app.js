/* Yaqin admin paneli. Barcha matn textContent orqali qo'yiladi (XSS himoyasi). */
(() => {
  const $ = (s) => document.querySelector(s);
  const view = $('#view');
  let token = null;
  let charts = [];

  // ---------- yordamchilar ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const safeUrl = (u) => (/^(https?:)?\/\//.test(u) || u.startsWith('/') ? u : '');
  const fmt = (d) => (d ? new Date(d).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const num = (n) => Number(n || 0).toLocaleString('uz-UZ');

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2500);
  }

  async function api(path, { method = 'GET', body, retry = true } = {}) {
    const res = await fetch('/api' + path, {
      method,
      credentials: 'include',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && retry && (await refresh())) return api(path, { method, body, retry: false });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Xatolik');
    return data;
  }

  async function refresh() {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      token = (await res.json()).accessToken;
      return true;
    } catch {
      return false;
    }
  }

  const guard = (fn) => async (...a) => {
    try { return await fn(...a); } catch (e) { toast(e.message); }
  };

  // ---------- kirish ----------
  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
  }
  function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    go(location.hash.slice(1) || 'dashboard');
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#loginError').textContent = '';
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email: f.get('email'), password: f.get('password') }, retry: false });
      if (data.user.role !== 'admin') {
        await api('/auth/logout', { method: 'POST' });
        throw new Error('Bu akkaunt admin emas');
      }
      token = data.accessToken;
      showApp();
    } catch (err) {
      $('#loginError').textContent = err.message;
    }
  });

  $('#logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    token = null;
    showLogin();
  });

  // ---------- navigatsiya ----------
  const tabs = { dashboard, users, reports, photos, places, audit };
  function go(tab) {
    if (!tabs[tab]) tab = 'dashboard';
    location.hash = tab;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    charts.forEach((c) => c.destroy());
    charts = [];
    view.replaceChildren(h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    guard(tabs[tab])();
  }
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) go(b.dataset.tab);
  });

  // ---------- Statistika ----------
  async function dashboard() {
    const s = await api('/admin/stats');
    const t = s.totals;
    const stat = (label, n, hint) => h('div', { class: 'card stat' }, h('div', { class: 'n' }, num(n)), h('div', { class: 'l' }, label), hint && h('div', { class: 'muted' }, hint));

    const accent = '#ff4d7e', violet = '#a64dff', grid = 'rgba(255,255,255,.07)', tick = '#9a8cab';
    const box = (title, id) => h('div', { class: 'card' }, h('h3', {}, title), h('div', { class: 'chart-box' }, h('canvas', { id })));

    view.replaceChildren(
      h('h2', {}, 'Statistika'),
      h('div', { class: 'grid stats' },
        stat('Foydalanuvchilar', t.totalUsers, `${num(t.verifiedUsers)} ta tasdiqlangan`),
        stat('Bugun yangi', t.newToday),
        stat('Faol (24 soat)', t.active24h, `7 kunda: ${num(t.active7d)}`),
        stat('Matchlar', t.totalMatches),
        stat('Xabarlar', t.totalMessages, `24 soatda: ${num(t.messages24h)}`),
        stat('Ochiq shikoyatlar', t.openReports),
        stat('Kelgusi uchrashuvlar', t.upcomingMeetups),
        stat('Bloklanganlar', t.blockedUsers),
        stat('Rasmlar', t.totalPhotos)
      ),
      h('div', { class: 'grid charts' },
        box('Ro\'yxatdan o\'tish (30 kun)', 'c1'),
        box('Matchlar va xabarlar (30 kun)', 'c2'),
        box('Jins bo\'yicha', 'c3'),
        box('Top shaharlar', 'c4')
      )
    );

    Chart.defaults.color = tick;
    Chart.defaults.borderColor = grid;
    const days = [...new Set([...s.series.signups, ...s.series.matches, ...s.series.messages].map((r) => r._id))].sort();
    const by = (arr) => days.map((d) => arr.find((r) => r._id === d)?.count || 0);
    const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10 } } } };
    const mk = (id, cfg) => charts.push(new Chart(document.getElementById(id), cfg));

    mk('c1', { type: 'line', data: { labels: days, datasets: [{ label: 'Yangi', data: by(s.series.signups), borderColor: accent, backgroundColor: 'rgba(255,77,126,.15)', fill: true, tension: .3 }] }, options: opts });
    mk('c2', { type: 'bar', data: { labels: days, datasets: [{ label: 'Match', data: by(s.series.matches), backgroundColor: accent }, { label: 'Xabar', data: by(s.series.messages), backgroundColor: violet }] }, options: opts });
    const gl = { male: 'Erkak', female: 'Ayol' };
    mk('c3', { type: 'doughnut', data: { labels: s.gender.map((g) => gl[g.label] || g.label), datasets: [{ data: s.gender.map((g) => g.count), backgroundColor: [violet, accent], borderWidth: 0 }] }, options: opts });
    mk('c4', { type: 'bar', data: { labels: s.cities.map((c) => c.label), datasets: [{ label: 'Foydalanuvchi', data: s.cities.map((c) => c.count), backgroundColor: accent }] }, options: { ...opts, indexAxis: 'y' } });

    const badge = $('#reportBadge');
    badge.hidden = !t.openReports;
    badge.textContent = t.openReports;
  }

  // ---------- Foydalanuvchilar ----------
  async function users(state = { q: '', status: '', page: 1 }) {
    const qs = new URLSearchParams({ page: state.page, limit: 25 });
    if (state.q) qs.set('q', state.q);
    if (state.status) qs.set('status', state.status);
    const data = await api('/admin/users?' + qs);

    const reload = () => users(state);
    const act = (label, cls, fn) => h('button', { class: 'btn sm ' + cls, onclick: guard(async () => { await fn(); reload(); }) }, label);

    const search = h('input', { type: 'search', placeholder: 'Email, ism yoki shahar', value: state.q });
    const status = h('select', {}, h('option', { value: '' }, 'Barchasi'), h('option', { value: 'active' }, 'Faol'), h('option', { value: 'blocked' }, 'Bloklangan'));
    status.value = state.status;
    const apply = () => users({ q: search.value.trim(), status: status.value, page: 1 });
    search.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
    status.addEventListener('change', apply);

    const pages = Math.max(1, Math.ceil(data.total / 25));
    view.replaceChildren(
      h('h2', {}, `Foydalanuvchilar (${num(data.total)})`),
      h('div', { class: 'toolbar' }, search, status, h('button', { class: 'btn', onclick: apply }, 'Qidirish')),
      h('div', { class: 'card table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, ['Ism', 'Email', 'Yosh', 'Shahar', 'Rasm', 'Holat', 'Ro\'yxatdan', 'Oxirgi faollik', ''].map((c) => h('th', {}, c)))),
          h('tbody', {}, data.users.map((u) =>
            h('tr', {},
              h('td', {}, u.name, ' ', u.verified && h('span', { class: 'pill ok' }, '✓')),
              h('td', {}, u.email),
              h('td', {}, u.age),
              h('td', {}, u.city || '—'),
              h('td', {}, u.photos),
              h('td', {}, h('span', { class: 'pill ' + (u.status === 'active' ? 'ok' : 'bad') }, u.status === 'active' ? 'Faol' : 'Bloklangan')),
              h('td', {}, fmt(u.createdAt)),
              h('td', {}, fmt(u.lastActiveAt)),
              h('td', { class: 'actions' },
                act(u.verified ? 'Tasdiqni olish' : 'Tasdiqlash', '', () => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { verified: !u.verified } })),
                act(u.status === 'active' ? 'Bloklash' : 'Blokdan chiqarish', u.status === 'active' ? 'danger' : '', () => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { status: u.status === 'active' ? 'blocked' : 'active' } })),
                act('O\'chirish', 'danger', async () => {
                  if (!confirm(`${u.name} (${u.email}) butunlay o'chirilsinmi? Bu qaytarilmaydi.`)) throw new Error('Bekor qilindi');
                  await api(`/admin/users/${u.id}`, { method: 'DELETE' });
                })
              )
            )
          ))
        )
      ),
      h('div', { class: 'toolbar', style: 'margin-top:14px' },
        h('button', { class: 'btn', disabled: state.page <= 1, onclick: () => users({ ...state, page: state.page - 1 }) }, '← Oldingi'),
        h('span', { class: 'muted', style: 'align-self:center' }, `${state.page} / ${pages}`),
        h('button', { class: 'btn', disabled: state.page >= pages, onclick: () => users({ ...state, page: state.page + 1 }) }, 'Keyingi →')
      )
    );
  }

  // ---------- Shikoyatlar ----------
  const reasons = { fake: 'Soxta profil', harassment: 'Bezovtalik', spam: 'Spam', underage: 'Voyaga yetmagan', inappropriate_photo: 'Nomaqbul rasm', scam: 'Firibgarlik', other: 'Boshqa' };

  async function reports(status = 'open') {
    const data = await api('/admin/reports?status=' + status);
    const sel = h('select', {}, h('option', { value: 'open' }, 'Ochiq'), h('option', { value: 'resolved' }, 'Hal qilingan'), h('option', { value: 'dismissed' }, 'Rad etilgan'));
    sel.value = status;
    sel.addEventListener('change', () => reports(sel.value));

    const resolve = (r, st, block) => guard(async () => {
      const note = prompt('Izoh (ixtiyoriy):') ?? '';
      await api(`/admin/reports/${r.id}`, { method: 'PATCH', body: { status: st, resolution: note, blockTarget: block } });
      toast('Saqlandi');
      reports(status);
    });

    view.replaceChildren(
      h('h2', {}, 'Shikoyatlar'),
      h('div', { class: 'toolbar' }, sel),
      data.reports.length === 0 && h('p', { class: 'muted' }, 'Shikoyatlar yo\'q.'),
      data.reports.map((r) =>
        h('div', { class: 'card report' },
          h('div', { class: 'row' },
            h('span', { class: 'pill warn' }, reasons[r.reason] || r.reason),
            h('b', {}, r.target ? `${r.target.name} (${r.target.email})` : 'o\'chirilgan'),
            r.target?.status === 'blocked' && h('span', { class: 'pill bad' }, 'bloklangan'),
            h('span', { class: 'muted' }, fmt(r.createdAt))
          ),
          r.details && h('div', {}, r.details),
          h('div', { class: 'muted' }, 'Shikoyatchi: ', r.reporter ? `${r.reporter.name} (${r.reporter.email})` : '—'),
          r.status === 'open' && h('div', { class: 'row' },
            h('button', { class: 'btn sm danger', onclick: resolve(r, 'resolved', true) }, 'Bloklash va yopish'),
            h('button', { class: 'btn sm', onclick: resolve(r, 'resolved', false) }, 'Hal qilindi'),
            h('button', { class: 'btn sm', onclick: resolve(r, 'dismissed', false) }, 'Rad etish')
          )
        )
      )
    );
  }

  // ---------- Rasmlar ----------
  async function photos(page = 1) {
    const data = await api('/admin/photos?page=' + page);
    view.replaceChildren(
      h('h2', {}, 'Rasm moderatsiyasi'),
      h('p', { class: 'muted' }, 'Eng yangi yuklangan rasmlar. Qoidaga zid rasmni o\'chiring.'),
      h('div', { class: 'grid photos' }, data.photos.map((p) =>
        h('div', { class: 'photo' },
          h('img', { src: safeUrl(p.url), alt: p.userName, loading: 'lazy' }),
          h('div', { class: 'cap' },
            h('span', {}, p.userName),
            h('button', { class: 'btn sm danger', onclick: guard(async () => {
              if (!confirm('Rasm o\'chirilsinmi?')) return;
              await api(`/admin/users/${p.userId}/photos/${p.photoId}`, { method: 'DELETE' });
              photos(page);
            }) }, 'O\'chirish')
          )
        )
      )),
      h('div', { class: 'toolbar', style: 'margin-top:14px' },
        h('button', { class: 'btn', disabled: page <= 1, onclick: () => photos(page - 1) }, '← Oldingi'),
        h('button', { class: 'btn', disabled: data.photos.length < 36, onclick: () => photos(page + 1) }, 'Keyingi →')
      )
    );
  }

  // ---------- Joylar ----------
  const cats = { cafe: 'Kafe', restaurant: 'Restoran', park: 'Park', mall: 'Savdo markazi', museum: 'Muzey', other: 'Boshqa' };

  async function places() {
    const data = await api('/admin/places');
    const f = {
      name: h('input', { placeholder: 'Nomi', required: true }),
      city: h('input', { placeholder: 'Shahar', required: true }),
      address: h('input', { placeholder: 'Manzil' }),
      lat: h('input', { placeholder: 'Kenglik (lat)', type: 'number', step: 'any', required: true }),
      lng: h('input', { placeholder: 'Uzunlik (lng)', type: 'number', step: 'any', required: true }),
      category: h('select', {}, Object.entries(cats).map(([v, l]) => h('option', { value: v }, l))),
    };
    const form = h('form', { class: 'form-grid card', onsubmit: guard(async (e) => {
      e.preventDefault();
      await api('/admin/places', { method: 'POST', body: {
        name: f.name.value, city: f.city.value, address: f.address.value, category: f.category.value,
        lat: parseFloat(f.lat.value), lng: parseFloat(f.lng.value),
      } });
      toast('Joy qo\'shildi');
      places();
    }) },
      f.name, f.city, f.address, f.category, f.lat, f.lng,
      h('button', { class: 'btn primary', type: 'submit' }, 'Qo\'shish')
    );

    view.replaceChildren(
      h('h2', {}, 'Uchrashuv joylari'),
      h('p', { class: 'muted' }, 'Foydalanuvchilar faqat shu ommaviy joylardan birini tanlab uchrashuv belgilaydi (xavfsizlik uchun).'),
      form,
      h('div', { class: 'card table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, ['Nomi', 'Turi', 'Shahar', 'Manzil', 'Koordinata', 'Holat', ''].map((c) => h('th', {}, c)))),
          h('tbody', {}, data.places.map((p) =>
            h('tr', {},
              h('td', {}, p.name), h('td', {}, cats[p.category] || p.category), h('td', {}, p.city), h('td', {}, p.address || '—'),
              h('td', {}, `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`),
              h('td', {}, h('span', { class: 'pill ' + (p.active ? 'ok' : 'bad') }, p.active ? 'Faol' : 'O\'chiq')),
              h('td', { class: 'actions' },
                h('button', { class: 'btn sm', onclick: guard(async () => { await api(`/admin/places/${p.id}`, { method: 'PATCH', body: { active: !p.active } }); places(); }) }, p.active ? 'O\'chirib qo\'yish' : 'Yoqish'),
                h('button', { class: 'btn sm danger', onclick: guard(async () => { if (!confirm('Joy o\'chirilsinmi?')) return; await api(`/admin/places/${p.id}`, { method: 'DELETE' }); places(); }) }, 'O\'chirish')
              )
            )
          ))
        )
      )
    );
  }

  // ---------- Audit ----------
  async function audit() {
    const data = await api('/admin/audit');
    view.replaceChildren(
      h('h2', {}, 'Audit log'),
      h('div', { class: 'card table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, ['Vaqt', 'Admin', 'Amal', 'Obyekt', 'Tafsilot'].map((c) => h('th', {}, c)))),
          h('tbody', {}, data.logs.map((l) =>
            h('tr', {}, h('td', {}, fmt(l.createdAt)), h('td', {}, l.admin), h('td', {}, l.action), h('td', {}, l.target), h('td', {}, l.meta ? JSON.stringify(l.meta) : ''))
          ))
        )
      )
    );
  }

  // ---------- boshlash ----------
  (async () => {
    if (await refresh()) {
      try {
        const me = await api('/users/me');
        if (me.user.role === 'admin') return showApp();
      } catch { /* login ko'rsatiladi */ }
    }
    showLogin();
  })();
})();
