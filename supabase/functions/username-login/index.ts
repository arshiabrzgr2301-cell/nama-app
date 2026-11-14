import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 8) {
      return reply({ error: "invalid_credentials", message: "نام کاربری یا رمز عبور نادرست است." }, 400);
    }

    const profileRes = await fetch(
      `${url}/rest/v1/profiles?select=user_id,username&username=eq.${encodeURIComponent(username)}&limit=1`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` } },
    );
    if (!profileRes.ok) throw new Error("profile_lookup_failed");
    const profiles = await profileRes.json();
    if (!profiles.length) return reply({ error: "invalid_credentials", message: "نام کاربری یا رمز عبور نادرست است." }, 401);

    return reply({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    });
  } catch (error) {
    console.error("username-login error", error);
    return reply({ error: "server_error", message: "ورود در حال حاضر امکان‌پذیر نیست." }, 500);
  }
});
