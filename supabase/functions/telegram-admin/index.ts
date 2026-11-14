import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const allowed = new Set((Deno.env.get("TELEGRAM_ADMIN_IDS") || "").split(",").map(x => x.trim()).filter(Boolean));
const tg = (method: string) => `https://api.telegram.org/bot${botToken}/${method}`;
const dbHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

async function send(chatId: number, text: string) {
  await fetch(tg("sendMessage"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
}
async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders, ...(init.headers || {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(body || `Database error ${res.status}`);
  return body ? JSON.parse(body) : [];
}
function makePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, b => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@"[b % 62]).join("");
}
async function createUser(orgId: string, username: string, fullName: string, role: "owner" | "consultant") {
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(clean)) throw new Error("نام کاربری باید ۳ تا ۳۲ کاراکتر انگلیسی باشد (حروف، عدد، نقطه، خط تیره).");
  const password = makePassword();
  const email = `${clean}@users.nama.invalid`;
  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST", headers: dbHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: fullName, nama_managed: true } }),
  });
  const user = await created.json();
  if (!created.ok) throw new Error(user.msg || user.message || user.error_description || "ساخت حساب ناموفق بود.");
  try {
    await db("profiles", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: user.id, username: clean, full_name: fullName }) });
    await db("organization_memberships", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: orgId, user_id: user.id, role, status: "active" }) });
  } catch (e) {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: dbHeaders });
    throw e;
  }
  return { username: clean, password };
}

async function handle(chatId: number, text: string) {
  const [commandRaw, ...args] = text.trim().split(/\s+/);
  const command = (commandRaw || "").split("@")[0].toLowerCase();
  if (command === "/start" || command === "/help") {
    return send(chatId, [
      "ربات مدیریت NAMA",
      "/neworg نام_سازمان نام_کاربری_مدیر نام_کامل_مدیر",
      "/adduser شناسه_سازمان نام_کاربری نام_کامل_مشاور",
      "/renew شناسه_سازمان تعداد_روز",
      "/suspend شناسه_کاربری",
      "/activate شناسه_کاربری",
      "/orgs",
      "تعداد مشاوران هر سازمان نامحدود است.",
    ].join("\n"));
  }
  if (command === "/neworg") {
    if (args.length < 3) return send(chatId, "فرمت: /neworg نام_سازمان نام_کاربری_مدیر نام_کامل_مدیر");
    const adminUsername = args[1];
    const adminName = args.slice(2).join(" ");
    const orgs = await db("organizations", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name: args[0], status: "active" }),
    });
    const org = orgs[0];
    try {
      const credentials = await createUser(org.id, adminUsername, adminName, "owner");
      await db("organization_memberships?user_id=eq." + encodeURIComponent((await db("profiles?select=user_id&username=eq." + encodeURIComponent(adminUsername.toLowerCase())))[0].user_id), {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: org.id }),
      }).catch(() => undefined);
      await db("organization_subscriptions", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ organization_id: org.id, status: "pending" }),
      });
      return send(chatId, `سازمان ساخته شد.\nنام: ${org.name}\nشناسه: ${org.id}\nمدیر: ${credentials.username}\nرمز موقت: ${credentials.password}\nبرای فعال‌سازی اشتراک: /renew ${org.id} 30`);
    } catch (e) {
      await db("organizations?id=eq." + org.id, { method: "DELETE" }).catch(() => undefined);
      throw e;
    }
  }
  if (command === "/adduser") {
    if (args.length < 3) return send(chatId, "فرمت: /adduser شناسه_سازمان نام_کاربری نام_کامل_مشاور");
    const result = await createUser(args[0], args[1], args.slice(2).join(" "), "consultant");
    const profiles = await db("profiles?select=user_id&username=eq." + encodeURIComponent(result.username));
    await db("organization_memberships", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ organization_id: args[0], user_id: profiles[0].user_id, role: "consultant", status: "active" }),
    });
    return send(chatId, `حساب مشاور ساخته شد.\nنام کاربری: ${result.username}\nرمز موقت: ${result.password}\nسازمان: ${args[0]}`);
  }
  if (command === "/renew") {
    const days = Number(args[1]);
    if (!args[0] || !Number.isInteger(days) || days < 1 || days > 3650) return send(chatId, "فرمت: /renew شناسه_سازمان تعداد_روز (۱ تا ۳۶۵۰)");
    const current = await db("organization_subscriptions?select=expires_at&organization_id=eq." + encodeURIComponent(args[0]));
    const now = Date.now();
    const currentExpiry = current[0]?.expires_at ? new Date(current[0].expires_at).getTime() : 0;
    const start = Math.max(now, currentExpiry);
    const expires = new Date(start + days * 86400000).toISOString();
    await db("organization_subscriptions?on_conflict=organization_id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ organization_id: args[0], status: "active", starts_at: new Date(now).toISOString(), expires_at: expires, renewed_at: new Date(now).toISOString() }),
    });
    await db("organizations?id=eq." + encodeURIComponent(args[0]), { method: "PATCH", body: JSON.stringify({ status: "active" }) });
    return send(chatId, `اشتراک تمدید شد.\nتا تاریخ: ${new Date(expires).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}\nظرفیت مشاور: نامحدود`);
  }
  if (command === "/suspend" || command === "/activate") {
    const username = (args[0] || "").toLowerCase();
    const profiles = await db("profiles?select=user_id&username=eq." + encodeURIComponent(username));
    if (!profiles.length) return send(chatId, "کاربر پیدا نشد.");
    await db("organization_memberships?user_id=eq." + encodeURIComponent(profiles[0].user_id), {
      method: "PATCH", body: JSON.stringify({ status: command === "/suspend" ? "suspended" : "active" }),
    });
    return send(chatId, command === "/suspend" ? "دسترسی کاربر تعلیق شد." : "دسترسی کاربر فعال شد.");
  }
  if (command === "/orgs") {
    const orgs = await db("organizations?select=id,name,status,organization_subscriptions(status,expires_at)&order=created_at.desc");
    const lines = orgs.map((o: any) => `${o.name} | ${o.status} | ${o.id} | ${o.organization_subscriptions?.[0]?.status || "بدون اشتراک"} | ${o.organization_subscriptions?.[0]?.expires_at || "-"}`);
    return send(chatId, lines.length ? lines.join("\n\n") : "سازمانی ثبت نشده است.");
  }
  return send(chatId, "دستور شناخته نشد. /help را بزنید.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (expected && req.headers.get("x-telegram-bot-api-secret-token") !== expected) return new Response("forbidden", { status: 403 });
  try {
    const update = await req.json();
    const message = update.message;
    const chatId = message?.chat?.id;
    const fromId = String(message?.from?.id || "");
    if (!chatId || !allowed.has(fromId) || message?.chat?.type !== "private") return new Response("ok");
    await handle(chatId, String(message.text || ""));
  } catch (e) {
    console.error("telegram-admin error", e);
  }
  return new Response("ok");
});
