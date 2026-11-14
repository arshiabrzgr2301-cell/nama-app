import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

Deno.serve(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("شناسه تور معتبر نیست.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const propertyResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/properties?select=id,title,city,address,description,panorama_path,status,organization_id&id=eq.${id}&status=eq.published&limit=1`,
    { headers },
  );

  if (!propertyResponse.ok) {
    return new Response("خطا در دریافت تور.", { status: 502 });
  }

  const properties = await propertyResponse.json();
  if (!properties.length || !properties[0].panorama_path) {
    return new Response("این تور منتشر نشده یا تصویر پانوراما ندارد.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const property = properties[0];
  const adminHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const [orgRes, subscriptionRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/organizations?select=status&id=eq.${property.organization_id}&limit=1`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/organization_subscriptions?select=status,starts_at,expires_at&organization_id=eq.${property.organization_id}&limit=1`, { headers: adminHeaders }),
  ]);
  if (!orgRes.ok || !subscriptionRes.ok) return new Response("خطا در بررسی اشتراک.", { status: 502 });
  const orgRows = await orgRes.json();
  const subscriptionRows = await subscriptionRes.json();
  const subscription = subscriptionRows[0];
  const subscriptionActive = orgRows[0]?.status === "active"
    && subscription?.status === "active"
    && subscription?.starts_at && new Date(subscription.starts_at).getTime() <= Date.now()
    && subscription?.expires_at && new Date(subscription.expires_at).getTime() > Date.now();
  if (!subscriptionActive) {
    return new Response("اشتراک این دفتر فعال نیست.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ views: 0 }),
  }).catch(() => undefined);

  const [hotspotResponse, signedResponse] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/hotspots?select=id,yaw,pitch,title,description&property_id=eq.${id}&order=created_at.asc`,
      { headers },
    ),
    fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/property-media/${property.panorama_path}`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 86400 }),
      },
    ),
  ]);

  if (!hotspotResponse.ok || !signedResponse.ok) {
    return new Response("ساخت لینک امن تور ناموفق بود.", { status: 502 });
  }

  const hotspots = await hotspotResponse.json();
  const signed = await signedResponse.json();
  const signedPath = signed.signedURL || signed.signedUrl;
  const imageUrl = signedPath?.startsWith("http")
    ? signedPath
    : `${SUPABASE_URL}/storage/v1${signedPath}`;

  const title = String(property.title || "تور مجازی ملک").replace(/[<>&"]/g, "");
  const city = String(property.city || "").replace(/[<>&"]/g, "");
  const address = String(property.address || "").replace(/[<>&"]/g, "");

  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${title} | تور ۳۶۰</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"><\/script>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;background:#090d16;color:#fff;font-family:system-ui,sans-serif}
header{padding:14px 18px;background:#111827}
h1{font-size:17px;margin:0 0 5px}
p{font-size:12px;color:#cbd5e1;margin:0}
#panorama{height:calc(100% - 66px);width:100%;background:#000}
</style>
</head>
<body>
<header><h1>${title}</h1><p>${city} · ${address}</p></header>
<div id="panorama"></div>
<script>
const image = ${safeJson(imageUrl)};
const hotspots = ${safeJson(hotspots.map((h: any) => ({
  pitch: Number(h.pitch),
  yaw: Number(h.yaw),
  type: "info",
  text: String(h.title || ""),
  ...(h.description ? { description: String(h.description) } : {}),
})))};
pannellum.viewer("panorama", {
  type: "equirectangular",
  panorama: image,
  autoLoad: true,
  showControls: true,
  compass: true,
  hotSpots: hotspots
});
<\/script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
});
