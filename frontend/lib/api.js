let accessToken = null;

export const getToken = () => accessToken;
export const setToken = (t) => {
  accessToken = t;
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshing = null;

export async function refreshSession() {
  // Bir vaqtda ko'p so'rov 401 olsa, refresh bir marta bajariladi
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (r) => {
      if (!r.ok) return false;
      accessToken = (await r.json()).accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api(path, { method = 'GET', body, retry = true } = {}) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api(path, { method, body, retry: false });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Xatolik yuz berdi', res.status, data.details);
  return data;
}

// Rasm yuklash: presign -> (R2 ga PUT | lokal POST) -> profilga qo'shish
export async function uploadPhoto(file) {
  const presign = await api('/uploads/presign', { method: 'POST', body: { contentType: file.type } });
  if (presign.mode === 'r2') {
    const put = await fetch(presign.uploadUrl, { method: 'PUT', headers: presign.headers, body: file });
    if (!put.ok) throw new ApiError('Rasmni yuklab bo\'lmadi', put.status);
  } else {
    const fd = new FormData();
    fd.append('key', presign.key);
    fd.append('file', file);
    const res = await fetch('/api/uploads/local', {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).error || 'Yuklab bo\'lmadi', res.status);
  }
  return api('/users/me/photos', { method: 'POST', body: { key: presign.key } });
}
