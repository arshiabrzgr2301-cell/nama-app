import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
function temporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return reply({ error: "unauthorized" }, 401);

    const { data: membership, error: membershipError } = await admin
      .from("organization_memberships")
      .select("organization_id,role,status,organizations(status,organization_subscriptions(status,starts_at,expires_at))")
      .eq("user_id", callerData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError || !membership || !["owner", "manager"].includes(membership.role)) {
      return reply({ error: "forbidden", message: "فقط مدیریت دفتر می‌تواند مشاور اضافه کند." }, 403);
    }
    const org: any = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
    const subscription: any = Array.isArray(org?.organization_subscriptions) ? org.organization_subscriptions[0] : org?.organization_subscriptions;
    const active = org?.status === "active" && subscription?.status === "active"
      && new Date(subscription.starts_at).getTime() <= Date.now()
      && new Date(subscription.expires_at).getTime() > Date.now();
    if (!active) return reply({ error: "subscription_inactive" }, 403);

    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    if (!/^[a-z0-9._-]{3,32}$/.test(username) || fullName.length < 2 || fullName.length > 100) {
      return reply({ error: "invalid_input", message: "نام کاربری یا نام کامل معتبر نیست." }, 400);
    }
    const password = temporaryPassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: username + "@users.nama.invalid",
      password,
      email_confirm: true,
      user_metadata: { nama_managed: true },
    });
    if (createError || !created.user) return reply({ error: "account_creation_failed", message: createError?.message || "ساخت حساب ناموفق بود." }, 409);

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: created.user.id, username, full_name: fullName,
    });
    const { error: membershipInsertError } = profileError ? { error: profileError } : await admin.from("organization_memberships").insert({
      organization_id: membership.organization_id, user_id: created.user.id, role: "consultant", status: "active",
    });
    if (profileError || membershipInsertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return reply({ error: "membership_creation_failed", message: "ثبت اطلاعات مشاور انجام نشد." }, 500);
    }
    return reply({
      success: true,
      consultant: { id: created.user.id, username, fullName },
      temporaryPassword: password,
      message: "رمز موقت فقط یک‌بار نمایش داده می‌شود.",
    });
  } catch (error) {
    console.error("create-consultant", error);
    return reply({ error: "server_error", message: "در حال حاضر ساخت حساب مشاور ممکن نیست." }, 500);
  }
});