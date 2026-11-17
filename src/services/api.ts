import { getToken, getRefreshToken, saveSession, getUser } from '../utils/storage';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://laezrjnznyjqfibpczfz.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZFId00wDoEsw0TGluzBvBQ_xARK9g8o';

export type Role = 'owner' | 'manager' | 'consultant';
export type DealStatus = 'active' | 'deposit' | 'sold';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  phone?: string;
  role: Role;
  organizationId: string;
  officeName: string;
}

export interface Consultant {
  id: string;
  fullName: string;
  username: string;
  status: string;
}

export interface PropertyPayload {
  title: string;
  city: string;
  address: string;
  price: number;
  realPrice?: number | null;
  area: number;
  rooms: number;
  floor: number;
  description: string;
  status?: 'draft' | 'published';
  panoramaUri?: string;
  videoUri?: string;
  fileOwnerId: string;
  ownerName?: string;
  ownerPhone?: string;
  exactAddress?: string;
  neighborhood?: string;
  propertyType?: string;
  yearBuilt?: number | null;
  amenities?: string[];
  latitude?: number | null;
  longitude?: number | null;
}

export interface Property extends PropertyPayload {
  id: string;
  owner_id: string;
  organization_id: string;
  file_owner_id: string;
  registered_by: string;
  real_price?: number | null;
  owner_name?: string;
  owner_phone?: string;
  exact_address?: string;
  neighborhood?: string;
  property_type?: string;
  year_built?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  amenities?: string[];
  deal_status: DealStatus;
  sold_by_consultant_id?: string | null;
  deposit_at?: string | null;
  sold_at?: string | null;
  views: number;
  publicTourUrl?: string;
  panorama_path?: string;
  created_at: string;
  createdAt?: string;
  city: string;
  address: string;
  price: number;
  area: number;
  rooms: number;
  floor: number;
  description: string;
  status: 'draft' | 'published';
}

export interface ActivityReport {
  id: string;
  organization_id: string;
  user_id: string;
  activity_date: string;
  listings_posted: number;
  files_found: number;
  customers_found: number;
  sellers_found: number;
  in_person_visits: number;
  phone_consultations: number;
  office_consultations: number;
  follow_ups: number;
  deposits: number;
  sales: number;
  ads_published: number;
  notes: string;
  submitted_at: string;
  full_name?: string;
}

export interface Reminder {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  reminder_type: string;
  customer_name?: string;
  customer_phone?: string;
  notes: string;
  due_at: string;
  completed_at?: string | null;
  notification_id?: string | null;
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  await saveSession(data.access_token, data.refresh_token);
  return data.access_token;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let token = await getToken();
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, { ...options, headers });
  if (response.status === 401 && retry) {
    token = await refreshSession() || undefined;
    if (token) return request<T>(path, options, false);
  }
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try { const parsed = JSON.parse(raw); message = parsed.message || parsed.details || parsed.hint || parsed.error_description || raw; } catch {}
    throw new Error(message || 'خطای ارتباط با سرور (' + response.status + ')');
  }
  if (response.status === 204) return {} as T;
  const raw = await response.text();
  return (raw ? JSON.parse(raw) : {}) as T;
}

async function edge<T>(slug: string, body: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('ابتدا وارد حساب شوید.');
  const response = await fetch(SUPABASE_URL + '/functions/v1/' + slug, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) throw new Error(data.message || data.error || 'درخواست ناموفق بود.');
  return data as T;
}

export const api = {
  login: async (username: string, password: string) => {
    const response = await fetch(SUPABASE_URL + '/functions/v1/username-login', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'نام کاربری یا رمز عبور صحیح نیست.');
    return { token: data.access_token as string, refreshToken: data.refresh_token as string, userId: data.user?.id as string };
  },

  getMe: async (userId: string): Promise<AppUser> => {
    const profiles = await request<any[]>('profiles?select=user_id,username,full_name,phone&user_id=eq.' + encodeURIComponent(userId) + '&limit=1');
    const memberships = await request<any[]>('organization_memberships?select=organization_id,role,status,organizations(name)&user_id=eq.' + encodeURIComponent(userId) + '&status=eq.active&limit=1');
    if (!profiles.length || !memberships.length) throw new Error('حساب شما به دفتر فعالی متصل نیست.');
    const p = profiles[0], m = memberships[0];
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    return {
      id: userId,
      name: p.full_name || p.username,
      username: p.username,
      phone: p.phone || undefined,
      role: m.role,
      organizationId: m.organization_id,
      officeName: org?.name || 'دفتر املاک',
    };
  },

  getProperties: async (): Promise<Property[]> => request<Property[]>('properties?select=*&order=created_at.desc'),
  getProperty: async (id: string): Promise<Property> => {
    const rows = await request<Property[]>('properties?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1');
    if (!rows.length) throw new Error('فایل ملک پیدا نشد.');
    return rows[0];
  },

  createProperty: async (data: PropertyPayload): Promise<Property> => {
    const user = await getUser<AppUser>();
    if (!user || (user.role !== 'owner' && user.role !== 'manager')) throw new Error('فقط مدیریت دفتر می‌تواند فایل ثبت کند.');
    const body: any = {
      title: data.title, city: data.city, address: data.address, price: data.price,
      real_price: data.realPrice ?? null, area: data.area, rooms: data.rooms, floor: data.floor,
      description: data.description, status: data.status || 'draft',
      owner_id: user.id, registered_by: user.id, organization_id: user.organizationId,
      file_owner_id: data.fileOwnerId || user.id, owner_name: data.ownerName || null,
      owner_phone: data.ownerPhone || null, exact_address: data.exactAddress || null,
      neighborhood: data.neighborhood || null, property_type: data.propertyType || null,
      year_built: data.yearBuilt || null, amenities: data.amenities || [],
      latitude: data.latitude ?? null, longitude: data.longitude ?? null,
    };
    const rows = await request<Property[]>('properties?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body),
    });
    return rows[0];
  },

  updateProperty: (id: string, data: Record<string, unknown>) =>
    request<Property[]>('properties?id=eq.' + encodeURIComponent(id) + '&select=*', {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(data),
    }).then(rows => rows[0]),

  deleteProperty: (id: string) => request<void>('properties?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }),

  publishProperty: (id: string) => api.updateProperty(id, { status: 'published' }),
  setDraft: (id: string) => api.updateProperty(id, { status: 'draft' }),
  setDealStatus: (id: string, dealStatus: DealStatus, soldByConsultantId?: string) =>
    api.updateProperty(id, {
      deal_status: dealStatus,
      sold_by_consultant_id: dealStatus === 'sold' ? soldByConsultantId : null,
    }),

  getConsultants: async (): Promise<Consultant[]> => {
    const user = await getUser<AppUser>();
    if (!user) return [];
    const members = await request<any[]>(
      'organization_memberships?select=user_id,status&organization_id=eq.' + encodeURIComponent(user.organizationId) +
      '&role=eq.consultant&status=eq.active'
    );
    if (!members.length) return [];
    const ids = members.map(x => x.user_id).join(',');
    const profiles = await request<any[]>('profiles?select=user_id,username,full_name&user_id=in.(' + ids + ')');
    return members.map(m => {
      const p = profiles.find(x => x.user_id === m.user_id);
      return { id: m.user_id, fullName: p?.full_name || p?.username || 'مشاور', username: p?.username || '', status: m.status };
    });
  },

  createConsultant: (username: string, fullName: string) =>
    edge<any>('create-consultant', { username, fullName }),

  getActivityReports: async (date: string): Promise<ActivityReport[]> => {
    const rows = await request<ActivityReport[]>(
      'daily_activity_reports?select=*&activity_date=eq.' + encodeURIComponent(date) + '&order=submitted_at.desc'
    );
    if (!rows.length) return [];
    const ids = Array.from(new Set(rows.map(x => x.user_id)));
    const profiles = await request<any[]>('profiles?select=user_id,full_name,username&user_id=in.(' + ids.join(',') + ')');
    return rows.map(row => ({ ...row, full_name: profiles.find(p => p.user_id === row.user_id)?.full_name || 'مشاور' }));
  },

  submitActivityReport: async (report: Record<string, unknown>) => {
    const user = await getUser<AppUser>();
    if (!user) throw new Error('نشست کاربری معتبر نیست.');
    const existing = await request<any[]>(
      'daily_activity_reports?select=id&user_id=eq.' + encodeURIComponent(user.id) +
      '&activity_date=eq.' + encodeURIComponent(String(report.activity_date)) + '&limit=1'
    );
    if (existing.length) throw new Error('گزارش امروز قبلاً ثبت شده است. برای اصلاح با مدیریت دفتر هماهنگ کنید.');
    const rows = await request<any[]>('daily_activity_reports?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...report, user_id: user.id, organization_id: user.organizationId }),
    });
    return rows[0];
  },

  getReminders: () => request<Reminder[]>('consultant_reminders?select=*&order=due_at.asc'),
  createReminder: async (reminder: Omit<Reminder, 'id' | 'organization_id' | 'user_id'>) => {
    const user = await getUser<AppUser>();
    if (!user) throw new Error('نشست کاربری معتبر نیست.');
    const rows = await request<Reminder[]>('consultant_reminders?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...reminder, user_id: user.id, organization_id: user.organizationId }),
    });
    return rows[0];
  },
  updateReminder: (id: string, data: Partial<Reminder>) =>
    request<Reminder[]>('consultant_reminders?id=eq.' + encodeURIComponent(id) + '&select=*', {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(data),
    }).then(rows => rows[0]),
  deleteReminder: (id: string) => request<void>('consultant_reminders?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }),

  addHotspot: (propertyId: string, hotspot: { yaw: number; pitch: number; title: string; description?: string }) =>
    request<any[]>('hotspots?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...hotspot, property_id: propertyId, owner_id: ({} as any).id }),
    }).then(rows => rows[0]),

  getTourUrl: (id: string) => SUPABASE_URL + '/functions/v1/public-tour?id=' + encodeURIComponent(id),
  getTourHeaders: async () => {
    const token = await getToken();
    return { apikey: SUPABASE_ANON_KEY, Authorization: token ? 'Bearer ' + token : '' };
  },
};
