import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET = Deno.env.get("NAMA_VIDEO_WORKER_SECRET") || "";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function db(path: string, init: RequestInit = {}) {
  const requestHeaders = new Headers(headers);
  new Headers(init.headers).forEach((value, key) => requestHeaders.set(key, value));
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: requestHeaders });
  const body = await response.text();
  if (!response.ok) throw new Error(`database request failed: ${response.status} ${body}`);
  return body ? JSON.parse(body) : [];
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WORKER_SECRET || !safeEqual(req.headers.get("x-nama-worker-secret") || "", WORKER_SECRET)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    if (body.action === "claim") {
      const rows = await db("rpc/nama_claim_video_processing_job", { method: "POST", body: "{}" });
      const job = rows[0];
      if (!job) return json({ job: null });
      const signed = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/property-media/${job.input_video_path}`,
        { method: "POST", headers, body: JSON.stringify({ expiresIn: 3600 }) },
      );
      if (!signed.ok) throw new Error("could_not_sign_input_video");
      const signedData = await signed.json();
      const signedPath = signedData.signedURL || signedData.signedUrl;
      const inputVideoUrl = signedPath?.startsWith("http")
        ? signedPath
        : signedPath ? `${SUPABASE_URL}/storage/v1${signedPath}` : null;
      if (!inputVideoUrl) throw new Error("signed_input_url_missing");
      return json({ job, input_video_url: inputVideoUrl });
    }

    if (typeof body.job_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.job_id)) {
      return json({ error: "invalid_job_id" }, 400);
    }
    const jobs = await db(`video_processing_jobs?select=id,property_id,processing_mode,status& id=eq.${body.job_id}`.replace(" ", ""));
    const job = jobs[0];
    if (!job) return json({ error: "job_not_found" }, 404);

    if (body.action === "progress") {
      const progress = Number(body.progress);
      if (!Number.isInteger(progress) || progress < 1 || progress > 99) return json({ error: "invalid_progress" }, 400);
      const updated = await db(`video_processing_jobs?id=eq.${body.job_id}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ progress, updated_at: new Date().toISOString() }),
      });
      return json({ job: updated[0] });
    }

    if (body.action === "complete") {
      const propertyRows = await db(`properties?select=owner_id&id=eq.${job.property_id}&limit=1`);
      const ownerId = propertyRows[0]?.owner_id;
      if (!ownerId) return json({ error: "property_not_found" }, 404);
      const prefix = `${ownerId}/${job.property_id}/derived/${job.id}/`;
      const spatial = body.spatial_asset_path;
      const stereo = body.stereo_video_path;
      if (job.processing_mode !== "stereo" && (typeof spatial !== "string" || !spatial.startsWith(prefix))) {
        return json({ error: "invalid_spatial_output_path" }, 400);
      }
      if (job.processing_mode !== "spatial" && (typeof stereo !== "string" || !stereo.startsWith(prefix))) {
        return json({ error: "invalid_stereo_output_path" }, 400);
      }
      const updated = await db(`video_processing_jobs?id=eq.${body.job_id}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "completed", progress: 100,
          spatial_asset_path: spatial || null,
          stereo_video_path: stereo || null,
          metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
          completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }),
      });
      return json({ job: updated[0] });
    }

    if (body.action === "fail") {
      const message = typeof body.error_message === "string" ? body.error_message.slice(0, 1000) : "پردازش ویدیو ناموفق بود.";
      const updated = await db(`video_processing_jobs?id=eq.${body.job_id}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "failed", error_message: message, updated_at: new Date().toISOString() }),
      });
      return json({ job: updated[0] });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("video-processing-worker error", error);
    return json({ error: "worker_request_failed" }, 500);
  }
});
