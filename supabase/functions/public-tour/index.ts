import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

const textResponse = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return textResponse("روش درخواست مجاز نیست.", 405);

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return textResponse("شناسه تور معتبر نیست.", 400);
  }

  try {
    // All private data is read with the service role only after validating
    // the property's organization and its current subscription.
    const propertyResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,title,city,address,description,panorama_path,status,organization_id&id=eq.${id}&status=eq.published&limit=1`,
      { headers: adminHeaders },
    );
    if (!propertyResponse.ok) return textResponse("خطا در دریافت تور.", 502);

    const properties = await propertyResponse.json();
    if (!properties.length || !properties[0].panorama_path || !properties[0].organization_id) {
      return textResponse("این تور منتشر نشده یا تصویر پانوراما ندارد.", 404);
    }
    const property = properties[0];

    const [orgRes, subscriptionRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/organizations?select=status&id=eq.${property.organization_id}&limit=1`, { headers: adminHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/organization_subscriptions?select=status,starts_at,expires_at&organization_id=eq.${property.organization_id}&limit=1`, { headers: adminHeaders }),
    ]);
    if (!orgRes.ok || !subscriptionRes.ok) return textResponse("خطا در بررسی اشتراک.", 502);

    const orgRows = await orgRes.json();
    const subscriptionRows = await subscriptionRes.json();
    const subscription = subscriptionRows[0];
    const now = Date.now();
    const active =
      orgRows[0]?.status === "active" &&
      subscription?.status === "active" &&
      subscription?.starts_at &&
      new Date(subscription.starts_at).getTime() <= now &&
      subscription?.expires_at &&
      new Date(subscription.expires_at).getTime() > now;

    if (!active) return textResponse("اشتراک این دفتر فعال نیست.", 403);

    const [hotspotResponse, signedResponse] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/hotspots?select=id,yaw,pitch,title,description&property_id=eq.${id}&order=created_at.asc`,
        { headers: adminHeaders },
      ),
      fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/property-media/${property.panorama_path}`,
        {
          method: "POST",
          headers: { ...adminHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: 300 }),
        },
      ),
    ]);

    if (!hotspotResponse.ok || !signedResponse.ok) {
      return textResponse("ساخت لینک امن تور ناموفق بود.", 502);
    }

    const hotspots = await hotspotResponse.json();
    const signed = await signedResponse.json();
    const signedPath = signed.signedURL || signed.signedUrl;
    if (!signedPath) return textResponse("لینک امن تصویر ساخته نشد.", 502);
    const imageUrl = signedPath.startsWith("http")
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
<meta name="referrer" content="no-referrer">
<title>${title} | تور ۳۶۰</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"><\\/script>
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
<\\/script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("public-tour error", error);
    return textResponse("در حال حاضر امکان نمایش تور وجود ندارد.", 500);
  }
});
