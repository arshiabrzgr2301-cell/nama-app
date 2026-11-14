import { getToken } from '../utils/storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://laezrjnznyjqfibpczfz.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZFId00wDoEsw0TGluzBvBQ_xARK9g8o';

export interface VideoProcessingJob {
  id: string;
  property_id: string;
  processing_mode: 'spatial' | 'stereo' | 'both';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  spatial_asset_path?: string | null;
  stereo_video_path?: string | null;
  error_message?: string | null;
  created_at: string;
}

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  if (!token) throw new Error('برای ثبت یا مشاهده پردازش باید وارد حساب شوید.');
  const headers = new Headers(init.headers);
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Authorization', 'Bearer ' + token);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(SUPABASE_URL + path, { ...init, headers });
  const body = await response.text();
  if (!response.ok) {
    let message = body || 'خطا در ارتباط با سرور';
    try { const parsed = JSON.parse(body); message = parsed.message || parsed.msg || parsed.error || message; } catch {}
    throw new Error(message);
  }
  return body ? JSON.parse(body) : [];
}

export const api = {
  getVideoProcessingJobs: (propertyId: string): Promise<VideoProcessingJob[]> =>
    authorizedFetch('/rest/v1/video_processing_jobs?select=*&property_id=eq.' + encodeURIComponent(propertyId) + '&order=created_at.desc&limit=20'),
  enqueueVideoProcessing: async (propertyId: string, mode: VideoProcessingJob['processing_mode']): Promise<VideoProcessingJob> => {
    const [user, properties] = await Promise.all([
      authorizedFetch('/auth/v1/user'),
      authorizedFetch('/rest/v1/properties?select=id,owner_id,organization_id,video_path&id=eq.' + encodeURIComponent(propertyId) + '&limit=1'),
    ]);
    const property = properties[0];
    if (!property?.video_path) throw new Error('ابتدا ویدیوی اسکن خانه را در زمان افزودن ملک آپلود کنید.');
    const rows = await authorizedFetch('/rest/v1/video_processing_jobs?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        property_id: propertyId,
        organization_id: property.organization_id,
        created_by: user.id,
        input_video_path: property.video_path,
        processing_mode: mode,
      }),
    });
    if (!rows[0]) throw new Error('درخواست پردازش در صف ثبت نشد.');
    return rows[0];
  },
};
