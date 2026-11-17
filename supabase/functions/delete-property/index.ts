import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const raw = await r.text();
  let data: any = [];
  try { data = raw ? JSON.parse(raw) : []; } catch { data = raw; }
  if (!r.ok) throw new Error(data?.message || data?.details || data?.hint || `Database request failed (${r.status})`);
  return data;
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ message: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return response({ message: "ابتدا وارد حساب شوید." }, 401);
    const userResponse = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!userResponse.ok) return response({ message: "نشست کاربری معتبر نیست." }, 401);
    const user = await userResponse.json();
    const body = await req.json();
    const propertyId = String(body.propertyId || "");
    if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return response({ message: "شناسه فایل معتبر نیست." }, 400);

    const memberships = await rest(`organization_memberships?select=organization_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
    const membership = memberships[0];
    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return response({ message: "فقط مدیر دفتر اجازه حذف فایل را دارد." }, 403);
    }
    const properties = await rest(`properties?select=id,organization_id,title,panorama_path,video_path&id=eq.${encodeURIComponent(propertyId)}&organization_id=eq.${encodeURIComponent(membership.organization_id)}&limit=1`);
    if (!properties.length) return response({ message: "فایل پیدا نشد یا متعلق به دفتر شما نیست." }, 404);
    const property = properties[0];

    const [photos, scenes, jobs] = await Promise.all([
      rest(`property_photos?select=storage_path&property_id=eq.${encodeURIComponent(propertyId)}`),
      rest(`property_tour_scenes?select=panorama_path&property_id=eq.${encodeURIComponent(propertyId)}`),
      rest(`video_processing_jobs?select=input_video_path,spatial_asset_path,stereo_video_path&property_id=eq.${encodeURIComponent(propertyId)}`),
    ]);
    const paths = new Set<string>();
    for (const value of [property.panorama_path, property.video_path, ...photos.map((x: any) => x.storage_path), ...scenes.map((x: any) => x.panorama_path), ...jobs.flatMap((x: any) => [x.input_video_path, x.spatial_asset_path, x.stereo_video_path])]) {
      if (typeof value === "string" && value.trim() && !/^https?:\/\//i.test(value)) paths.add(value.replace(/^\/+/, ""));
    }
    if (paths.size) {
      const storage = await fetch(`${URL}/storage/v1/object/property-media`, {
        method: "DELETE",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: Array.from(paths) }),
      });
      if (!storage.ok) {
        const detail = await storage.text();
        console.error("Storage cleanup failed", propertyId, detail);
        return response({ message: "حذف فایل متوقف شد؛ پاک‌سازی تصاویر و رسانه‌ها ناموفق بود. دوباره تلاش کنید." }, 502);
      }
    }
    await rest(`properties?id=eq.${encodeURIComponent(propertyId)}&organization_id=eq.${encodeURIComponent(membership.organization_id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    return response({ success: true, deletedPropertyId: propertyId, deletedMediaCount: paths.size });
  } catch (error) {
    console.error("delete-property failed", error);
    return response({ message: (error as Error).message || "حذف فایل ناموفق بود." }, 500);
  }
});
