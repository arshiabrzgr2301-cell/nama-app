import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminHeaders = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

const safeJson = (value: unknown) => JSON.stringify(value)
  .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
const textResponse = (message: string, status: number) => new Response(message, {
  status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
});

async function signedImage(path: string): Promise<string | null> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/property-media/${path}`, {
    method: "POST", headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const url = data.signedURL || data.signedUrl;
  return url ? (url.startsWith("http") ? url : `${SUPABASE_URL}/storage/v1${url}`) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return textResponse("روش درخواست مجاز نیست.", 405);
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return textResponse("شناسه تور معتبر نیست.", 400);

  try {
    const propertyResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,title,city,address,description,panorama_path,status,organization_id&id=eq.${id}&status=eq.published&limit=1`,
      { headers: adminHeaders },
    );
    if (!propertyResponse.ok) return textResponse("خطا در دریافت تور.", 502);
    const properties = await propertyResponse.json();
    if (!properties.length || !properties[0].organization_id) return textResponse("این تور منتشر نشده است.", 404);
    const property = properties[0];

    const [orgRes, subscriptionRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/organizations?select=status&id=eq.${property.organization_id}&limit=1`, { headers: adminHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/organization_subscriptions?select=status,starts_at,expires_at&organization_id=eq.${property.organization_id}&limit=1`, { headers: adminHeaders }),
    ]);
    if (!orgRes.ok || !subscriptionRes.ok) return textResponse("خطا در بررسی اشتراک.", 502);
    const orgRows = await orgRes.json();
    const subs = await subscriptionRes.json();
    const sub = subs[0], now = Date.now();
    const active = orgRows[0]?.status === "active" && sub?.status === "active" &&
      sub?.starts_at && new Date(sub.starts_at).getTime() <= now &&
      sub?.expires_at && new Date(sub.expires_at).getTime() > now;
    if (!active) return textResponse("اشتراک این دفتر فعال نیست.", 403);

    const [sceneRes, linkRes, hotspotRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/property_tour_scenes?select=id,title,description,panorama_path,sort_order,is_entry&property_id=eq.${id}&order=sort_order.asc,created_at.asc`, { headers: adminHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/property_tour_links?select=id,from_scene_id,to_scene_id,yaw,pitch,label&property_id=eq.${id}`, { headers: adminHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/hotspots?select=id,yaw,pitch,title,description&property_id=eq.${id}&order=created_at.asc`, { headers: adminHeaders }),
    ]);
    if (!sceneRes.ok || !linkRes.ok || !hotspotRes.ok) return textResponse("خطا در دریافت صحنه‌های تور.", 502);
    const rawScenes = await sceneRes.json();
    const links = await linkRes.json();
    const hotspots = await hotspotRes.json();
    const scenes = await Promise.all(rawScenes.map(async (scene: any) => ({
      id: scene.id, title: String(scene.title || "بخش تور"), description: String(scene.description || ""),
      isEntry: !!scene.is_entry, sortOrder: Number(scene.sort_order || 0),
      image: await signedImage(scene.panorama_path),
    })));
    const validScenes = scenes.filter((scene: any) => scene.image);
    if (!validScenes.length && property.panorama_path) {
      const legacy = await signedImage(property.panorama_path);
      if (legacy) validScenes.push({ id: "main", title: "نمای اصلی", description: "", isEntry: true, sortOrder: 0, image: legacy });
    }
    if (!validScenes.length) return textResponse("برای این ملک هنوز تصویر پانورامای معتبری ثبت نشده است.", 404);

    const title = String(property.title || "تور مجازی ملک").replace(/[<>&"]/g, "");
    const city = String(property.city || "").replace(/[<>&"]/g, "");
    const address = String(property.address || "").replace(/[<>&"]/g, "");
    const entry = validScenes.find((s: any) => s.isEntry) || validScenes[0];
    const tourData = validScenes.map((s: any) => ({
      id: s.id, title: s.title, description: s.description, image: s.image,
      hotspots: s.id === "main" ? hotspots.map((h: any) => ({
        pitch: Number(h.pitch), yaw: Number(h.yaw), type: "info", text: String(h.title || ""),
        ...(h.description ? { description: String(h.description) } : {}),
      })) : [],
      links: links.filter((link: any) => link.from_scene_id === s.id && validScenes.some((x: any) => x.id === link.to_scene_id))
        .map((link: any) => ({ pitch: Number(link.pitch), yaw: Number(link.yaw), type: "scene", sceneId: link.to_scene_id, text: String(link.label || "رفتن به بخش بعدی") })),
    }));
    const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="referrer" content="no-referrer"><title>${title} | تور ۳۶۰</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#050b18;color:#f4f8ff;font-family:system-ui,sans-serif}
header{padding:12px 16px;background:#0d1a2d;border-bottom:1px solid #233a58}h1{font-size:16px;margin:0 0 4px}header p{font-size:11px;color:#a7b7cc;margin:0}
#rooms{display:flex;gap:8px;overflow-x:auto;padding:10px;background:#091426}#rooms button{white-space:nowrap;border:1px solid #233a58;border-radius:20px;padding:8px 13px;background:#0d1a2d;color:#cbd5e1}
#rooms button.active{background:#27c8f4;color:#06111d;border-color:#27c8f4;font-weight:700}
#panorama{height:calc(100% - 124px);width:100%;background:#000}#pause{position:fixed;bottom:16px;left:16px;border:1px solid #45617e;border-radius:22px;background:#0d1a2ddd;color:white;padding:9px 14px}
</style></head><body><header><h1>${title}</h1><p>${city} · ${address}</p></header><nav id="rooms"></nav><div id="panorama"></div><button id="pause">توقف حرکت</button>
<script>
const scenes=${safeJson(tourData)};let viewer=null;let paused=false;
function openScene(id){const scene=scenes.find(s=>s.id===id);if(!scene)return;if(viewer){viewer.destroy();viewer=null}
document.querySelectorAll('#rooms button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
const points=[...scene.hotspots,...scene.links.map(link=>({...link,clickHandlerFunc:()=>openScene(link.sceneId)}))];
viewer=pannellum.viewer('panorama',{type:'equirectangular',panorama:scene.image,autoLoad:true,showControls:true,compass:true,hotSpots:points});
}
const nav=document.getElementById('rooms');
scenes.forEach(scene=>{const b=document.createElement('button');b.textContent=scene.title;b.dataset.id=scene.id;b.onclick=()=>openScene(scene.id);nav.appendChild(b)});
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'ادامه نمایش':'توقف حرکت';if(viewer){if(paused)viewer.stopAutoRotate();else viewer.startAutoRotate(-2)}};
openScene(${safeJson(entry.id)});
</script></body></html>`;

    return new Response(html, { status: 200, headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    }});
  } catch (error) {
    console.error("public-tour error", error);
    return textResponse("در حال حاضر امکان نمایش تور وجود ندارد.", 500);
  }
});
