import { getToken } from '../utils/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export interface PropertyPayload {
  title: string;
  city: string;
  address: string;
  price: number;
  area: number;
  rooms: number;
  floor: number;
  description: string;
  status?: 'draft' | 'published';
  panoramaUri?: string;
  videoUri?: string;
}

export interface Property extends PropertyPayload {
  id: string;
  views: number;
  publicTourUrl?: string;
  hotspots?: Hotspot[];
  createdAt: string;
}

export interface Hotspot {
  id: string;
  yaw: number;
  pitch: number;
  title: string;
  description?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    officeName?: string;
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message || json.detail || text;
    } catch {}
    throw new Error(message || `خطای سرور: ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    name: string;
    email: string;
    password: string;
    officeName: string;
    phone?: string;
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProperties: () => request<Property[]>('/properties'),

  getProperty: (id: string) => request<Property>(`/properties/${id}`),

  createProperty: (data: PropertyPayload) =>
    request<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProperty: (id: string, data: Partial<PropertyPayload>) =>
    request<Property>(`/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  publishProperty: (id: string) =>
    request<Property>(`/properties/${id}/publish`, { method: 'POST' }),

  setDraft: (id: string) =>
    request<Property>(`/properties/${id}/draft`, { method: 'POST' }),

  addHotspot: (propertyId: string, hotspot: Omit<Hotspot, 'id'>) =>
    request<Hotspot>(`/properties/${propertyId}/hotspots`, {
      method: 'POST',
      body: JSON.stringify(hotspot),
    }),

  incrementViews: (id: string) =>
    request<{ views: number }>(`/properties/${id}/views`, { method: 'POST' }),
};
