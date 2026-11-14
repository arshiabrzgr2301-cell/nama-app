import {
  getToken,
  getRefreshToken,
  saveToken,
  saveRefreshToken,
  clearAuth,
} from '../utils/storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://laezrjnznyjqfibpczfz.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZFId00wDoEsw0TGluzBvBQ_xARK9g8o';
const MEDIA_BUCKET = 'property-media';
const PUBLIC_TOUR_ENDPOINT = `${SUPABASE_URL}/functions/v1/public-tour`;

export interface PropertyPayload {
  title: string; city: string; address: string; price: number; area: number;
  rooms: number; floor: number; description: string;
  status?: 'draft' | 'published'; panoramaUri?: string; videoUri?: string;
}
export interface Property extends Omit<PropertyPayload, 'panoramaUri' | 'videoUri'> {
  id: string; views: number; publicTourUrl?: string; panoramaUrl?: string;
  videoUrl?: string; hotspots?: Hotspot[]; createdAt: string;
}
export interface Hotspot {
  id: string; yaw: number; pitch: number; title: string; description?: string;
}
export interface AuthResponse {
  token: string; refreshToken: string;
  user: { id: string; name: string; email: string; officeName?: string };
}
type SupabaseSession = {
  access_token: string; refresh_token: string;
  user: { id: string; email?: string; user_metadata?: Record<string, any> };
};

function authHeaders(token?: string) {
  return {
    apikey: SUPABASE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
async function parseError(res: Response): Promise<Error> {
  const body = await res.text();
  try {
    const data = JSON.parse(body);
    const error: any = new Error(data.msg || data.message || data.error_description || data.error || body || `HTTP ${res.status}`);
    error.code = data.code || data.error_code;
    error.status = res.status;
    return error;
  } catch {
    return new Error(body || `HTTP ${res.status}`);
  }
}
async function refreshSession(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) { await clearAuth(); return null; }
  const session = await res.json() as SupabaseSession;
  await saveToken(session.access_token);
  await saveRefreshToken(session.refresh_token);
  return session.access_token;
}
async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let token = await getToken();
  const headers: Record<string, string> = { ...authHeaders(token || undefined) };
  if (options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.headers) {
    new Headers(options.headers).forEach((value: string, key: string) => { headers[key] = value; });
  }
  let res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  if (res.status === 401 && retry) {
    token = await refreshSession();
    if (token) return request<T>(path, options, false);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return {} as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}
function mapUser(session: SupabaseSession): AuthResponse {
  const metadata = session.user.user_metadata || {};
  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    user: {
      id: session.user.id,
      email: session.user.email || '',
      name: metadata.name || '',
      officeName: metadata.officeName || metadata.office_name || '',
    },
  };
}
async function signIn(path: string, body: object): Promise<AuthResponse> {
  const session = await request<SupabaseSession>(path, { method: 'POST', body: JSON.stringify(body) });
  if (!session.access_token || !session.refresh_token) {
    const error: any = new Error('ثبت‌نام انجام شد؛ برای فعال‌سازی حساب، ایمیل خود را تأیید کنید و سپس وارد شوید.');
    error.code = 'EMAIL_CONFIRMATION_REQUIRED';
    throw error;
  }
  return mapUser(session);
}
async function signedMediaUrl(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const data = await request<{ signedURL?: string; signedUrl?: string }>(
    `/storage/v1/object/sign/${MEDIA_BUCKET}/${path}`,
    { method: 'POST', body: JSON.stringify({ expiresIn: 3600 }) }
  );
  const signed = data.signedURL || data.signedUrl;
  return signed ? (signed.startsWith('http') ? signed : `${SUPABASE_URL}/storage/v1${signed}`) : undefined;
}
function mapProperty(row: any, media: { panoramaUrl?: string; videoUrl?: string } = {}): Property {
  return {
    id: row.id, title: row.title, city: row.city, address: row.address,
    price: Number(row.price || 0), area: Number(row.area || 0), rooms: Number(row.rooms || 0),
    floor: Number(row.floor || 0), description: row.description || '',
    status: row.status, views: Number(row.views || 0), createdAt: row.created_at,
    ...media,
    publicTourUrl: row.status === 'published' && row.panorama_path ? `${PUBLIC_TOUR_ENDPOINT}?id=${row.id}` : undefined,
  };
}
async function uploadLocalFile(uri: string, ownerId: string, propertyId: string, kind: 'panorama' | 'video'): Promise<string> {
  const local = await fetch(uri);
  if (!local.ok) throw new Error('خواندن فایل انتخاب‌شده ناموفق بود.');
  const blob = await local.blob();
  const mime = blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const ext = mime.split('/')[1]?.split(';')[0] || (kind === 'video' ? 'mp4' : 'jpg');
  const path = `${ownerId}/${propertyId}/${kind}.${ext}`;
  const token = await getToken();
  if (!token) throw new Error('برای آپلود باید وارد حساب شوید.');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': mime, 'x-upsert': 'true' },
    body: blob,
  });
  if (!res.ok) throw await parseError(res);
  return path;
}

export const api = {
  login: (email: string, password: string) =>
    signIn('/auth/v1/token?grant_type=password', { email, password }),
  resendSignupConfirmation: async (email: string): Promise<void> => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'signup', email: email.trim() }),
    });
    if (!res.ok) throw await parseError(res);
  },
  register: (data: { name: string; email: string; password: string; officeName: string; phone?: string }) =>
    signIn('/auth/v1/signup', {
      email: data.email, password: data.password,
      data: { name: data.name, officeName: data.officeName, phone: data.phone || '' },
    }),
  getProperties: async (): Promise<Property[]> => {
    const rows = await request<any[]>('/rest/v1/properties?select=*&order=created_at.desc');
    return Promise.all(rows.map(async row => mapProperty(row, {
      panoramaUrl: await signedMediaUrl(row.panorama_path),
      videoUrl: await signedMediaUrl(row.video_path),
    })));
  },
  getProperty: async (id: string): Promise<Property> => {
    const rows = await request<any[]>(`/rest/v1/properties?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!rows.length) throw new Error('ملک پیدا نشد یا به آن دسترسی ندارید.');
    const row = rows[0];
    const [panoramaUrl, videoUrl, hotspots] = await Promise.all([
      signedMediaUrl(row.panorama_path), signedMediaUrl(row.video_path),
      request<any[]>(`/rest/v1/hotspots?select=*&property_id=eq.${row.id}&order=created_at.asc`),
    ]);
    return { ...mapProperty(row, { panoramaUrl, videoUrl }), hotspots: hotspots.map(h => ({
      id: h.id, yaw: h.yaw, pitch: h.pitch, title: h.title, description: h.description || undefined,
    })) };
  },
  createProperty: async (data: PropertyPayload): Promise<Property> => {
    if (data.status === 'published' && !data.panoramaUri) {
      throw new Error('برای انتشار ملک، تصویر پانورامای ۳۶۰ را انتخاب کنید.');
    }
    const user = await request<{ id: string }>('/auth/v1/user');
    const id = (await request<any[]>('/rest/v1/properties?select=id', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        owner_id: user.id, title: data.title, city: data.city, address: data.address,
        price: data.price, area: data.area, rooms: data.rooms, floor: data.floor,
        description: data.description, status: 'draft',
      }),
    }))[0]?.id;
    if (!id) throw new Error('ساخت ملک در پایگاه داده ناموفق بود.');
    const paths: { panorama_path?: string; video_path?: string } = {};
    if (data.panoramaUri) paths.panorama_path = await uploadLocalFile(data.panoramaUri, user.id, id, 'panorama');
    if (data.videoUri) paths.video_path = await uploadLocalFile(data.videoUri, user.id, id, 'video');
    if (Object.keys(paths).length) {
      await request(`/rest/v1/properties?id=eq.${id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(paths),
      });
    }
    if (data.status === 'published') {
      await request(`/rest/v1/properties?id=eq.${id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'published' }),
      });
    }
    return api.getProperty(id);
  },
  updateProperty: async (id: string, data: Partial<PropertyPayload>): Promise<Property> => {
    const patch: Record<string, any> = {};
    for (const key of ['title','city','address','price','area','rooms','floor','description','status'] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }
    await request(`/rest/v1/properties?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
    });
    return api.getProperty(id);
  },
  publishProperty: async (id: string) => {
    const property = await api.getProperty(id);
    if (!property.panoramaUrl) throw new Error('برای انتشار تور، ابتدا تصویر پانورامای ۳۶۰ را آپلود کنید.');
    return api.updateProperty(id, { status: 'published' });
  },
  setDraft: async (id: string) => api.updateProperty(id, { status: 'draft' }),
  addHotspot: async (propertyId: string, hotspot: Omit<Hotspot, 'id'>): Promise<Hotspot> => {
    const user = await request<{ id: string }>('/auth/v1/user');
    const rows = await request<any[]>('/rest/v1/hotspots?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ property_id: propertyId, owner_id: user.id, ...hotspot }),
    });
    const h = rows[0];
    return { id: h.id, yaw: h.yaw, pitch: h.pitch, title: h.title, description: h.description || undefined };
  },
  incrementViews: async (id: string) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ views: 0 }),
    });
    if (!res.ok) throw await parseError(res);
    return { success: true };
  },
};
