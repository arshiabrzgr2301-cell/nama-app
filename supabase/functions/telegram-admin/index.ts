import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const allowed = new Set((Deno.env.get("TELEGRAM_ADMIN_IDS") || "").split(",").map(x => x.trim()).filter(Boolean));
const tg = (method: string) => `https://api.telegram.org/bot${botToken}/${method}`;
const dbHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

const mainMenu = {
  inline_keyboard: [
    [{ text: "🏢 سازمان‌ها", callback_data: "/orgs" }, { text: "➕ سازمان جدید", callback_data: "/neworg" }],
    [{ text: "👤 افزودن مشاور", callback_data: "/adduser" }, { text: "🔄 تمدید اشتراک", callback_data: "/renew" }],
    [{ text: "⛔ مدیریت دسترسی", callback_data: "/suspend" }, { text: "🔑 بازیابی رمز", callback_data: "/resetpass" }],
    [{ text: "📚 راهنما و دستورات", callback_data: "/help" }],
  ],
};

async function send(chatId: number, text: string, withMenu = true) {
  const response = await fetch(tg("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(withMenu ? { reply_markup: mainMenu } : {}),
      disable_web_page_preview: true,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || "ارسال پیام تلگرام ناموفق بود.");
}
async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders, ...(init.headers || {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(body || `Database error ${res.status}`);
  return body ? JSON.parse(body) : [];
}
function makePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@";
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
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
  return { userId: user.id, username: clean, password };
}

async function handle(chatId: number, text: string) {
  const [commandRaw, ...args] = text.trim().split(/\s+/);
  const command = (commandRaw || "").split("@")[0].toLowerCase();
  if (command === "/start" || command === "/menu") {
    return send(chatId, [
      "🏙 NAMA | پنل مدیریت",
      "",
      "از منوی زیر عملیات موردنظر را انتخاب کنید.",
      "اشتراک هر سازمان مستقل است و تعداد مشاوران نامحدود است.",
    ].join("\n"));
  }
  if (command === "/help") {
    return send(chatId, [
      "📚 راهنمای مدیریت NAMA",
      "",
      "ساخت سازمان: /neworg نام_سازمان نام_کاربری_مدیر نام_کامل_مدیر",
      "افزودن مشاور: /adduser شناسه_سازمان نام_کاربری نام_کامل_مشاور",
      "تمدید اشتراک: /renew شناسه_سازمان تعداد_روز",
      "تعلیق مشاور: /suspend نام_کاربری",
      "فعال‌سازی مشاور: /activate نام_کاربری",
      "بازیابی رمز: /resetpass نام_کاربری",
      "تعلیق سازمان: /suspendorg شناسه_سازمان",
      "فعال‌سازی سازمان: /activateorg شناسه_سازمان",
      "فهرست سازمان‌ها: /orgs",
      "",
      "ظرفیت مشاوران هر سازمان نامحدود است. برای بازگشت /menu را بزنید.",
    ].join("\n"));
  }
  if (command === "/neworg" && args.length === 0) return send(chatId, "➕ ساخت سازمان\nفرمت: /neworg نام_سازمان نام_کاربری_مدیر نام_کامل_مدیر");
  if (command === "/adduser" && args.length === 0) return send(chatId, "👤 افزودن مشاور\nفرمت: /adduser شناسه_سازمان نام_کاربری نام_کامل_مشاور\nشناسه سازمان را از بخش «سازمان‌ها» بردارید.");
  if (command === "/renew" && args.length === 0) return send(chatId, "🔄 تمدید اشتراک\nفرمت: /renew شناسه_سازمان تعداد_روز");
  if (command === "/suspend" && args.length === 0) return send(chatId, "⛔ تعلیق مشاور\nفرمت: /suspend نام_کاربری");
  if (command === "/resetpass" && args.length === 0) return send(chatId, "🔑 بازیابی رمز\nفرمت: /resetpass نام_کاربری");
  if (command === "/neworg") {
    if (args.length < 3) return send(chatId, "فرمت: /neworg نام_سازمان نام_کاربری_مدیر نام_کامل_مدیر");
    const adminUsername = args[1];
    const adminName = args.slice(2).join(" ");
    const orgs = await db("organizations", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name: args[0].replace(/_/g, " "), status: "active" }),
    });
    const org = orgs[0];
    try {
      const credentials = await createUser(org.id, adminUsername, adminName, "owner");
      await db("organizations?id=eq." + encodeURIComponent(org.id), {
        method: "PATCH", body: JSON.stringify({ created_by: credentials.userId }),
      });
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
  if (command === "/resetpass") {
    const username = (args[0] || "").toLowerCase();
    const profiles = await db("profiles?select=user_id&username=eq." + encodeURIComponent(username));
    if (!profiles.length) return send(chatId, "کاربر پیدا نشد.");
    const password = makePassword();
    const update = await fetch(`${url}/auth/v1/admin/users/${profiles[0].user_id}`, {
      method: "PUT", headers: dbHeaders, body: JSON.stringify({ password }),
    });
    if (!update.ok) throw new Error("تغییر رمز عبور انجام نشد.");
    return send(chatId, `رمز جدید کاربر ${username}:\n${password}\nاین رمز را فقط خصوصی به خود کاربر بدهید.`);
  }
  if (command === "/suspendorg" || command === "/activateorg") {
    if (!args[0]) return send(chatId, "فرمت: /suspendorg شناسه_سازمان");
    await db("organizations?id=eq." + encodeURIComponent(args[0]), {
      method: "PATCH", body: JSON.stringify({ status: command === "/suspendorg" ? "suspended" : "active" }),
    });
    if (command === "/suspendorg") {
      await db("organization_subscriptions?organization_id=eq." + encodeURIComponent(args[0]), {
        method: "PATCH", body: JSON.stringify({ status: "suspended" }),
      });
    }
    if (command === "/activateorg") {
      await db("organization_subscriptions?organization_id=eq." + encodeURIComponent(args[0]), {
        method: "PATCH", body: JSON.stringify({ status: "active" }),
      });
    }
    return send(chatId, command === "/suspendorg" ? "کل سازمان و دسترسی اعضا تعلیق شد." : "سازمان فعال شد. اگر تاریخ اشتراک نگذشته باشد، دسترسی اعضا برمی‌گردد؛ در غیر این صورت تمدید لازم است.");
  }
  if (command === "/orgs") {
    const orgs = await db("organizations?select=id,name,status,organization_subscriptions(status,expires_at)&order=created_at.desc");
    if (!orgs.length) return send(chatId, "🏢 هنوز سازمانی ثبت نشده است.");

    const ids = orgs.map((o: any) => o.id).filter(Boolean);
    const memberships = ids.length
      ? await db("organization_memberships?select=organization_id,status&organization_id=in.(" + ids.map(encodeURIComponent).join(",") + ")")
      : [];
    const activeCounts = new Map<string, number>();
    const totalCounts = new Map<string, number>();
    for (const member of memberships) {
      totalCounts.set(member.organization_id, (totalCounts.get(member.organization_id) || 0) + 1);
      if (member.status === "active") activeCounts.set(member.organization_id, (activeCounts.get(member.organization_id) || 0) + 1);
    }

    const now = Date.now();
    const dateFormat = new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric",
    });
    const numberFormat = new Intl.NumberFormat("fa-IR");
    const lines = orgs.map((o: any, index: number) => {
      const raw = o.organization_subscriptions;
      const sub = Array.isArray(raw) ? raw[0] : raw;
      const expiry = sub?.expires_at ? new Date(sub.expires_at) : null;
      const remaining = expiry ? Math.ceil((expiry.getTime() - now) / 86400000) : null;
      const subscriptionStatus = !sub
        ? "❌ بدون اشتراک"
        : remaining !== null && remaining <= 0
          ? "🔴 منقضی‌شده"
          : sub.status === "active"
            ? "🟢 فعال"
            : sub.status === "pending"
              ? "🟡 در انتظار فعال‌سازی"
              : sub.status === "suspended"
                ? "⛔ تعلیق‌شده"
                : sub.status || "نامشخص";
      const remainingText = remaining === null
        ? "ثبت نشده"
        : remaining <= 0
          ? "پایان‌یافته"
          : `${numberFormat.format(remaining)} روز`;
      const orgStatus = o.status === "active" ? "فعال" : o.status === "suspended" ? "تعلیق‌شده" : o.status || "نامشخص";
      return [
        `${index + 1}) 🏢 ${o.name || "سازمان بدون نام"}`,
        `وضعیت سازمان: ${orgStatus}`,
        `اشتراک: ${subscriptionStatus}`,
        `تاریخ انقضا: ${expiry && !Number.isNaN(expiry.getTime()) ? dateFormat.format(expiry) : "ثبت نشده"}`,
        `باقی‌مانده: ${remainingText}`,
        `مشاوران: ${numberFormat.format(activeCounts.get(o.id) || 0)} فعال از ${numberFormat.format(totalCounts.get(o.id) || 0)} نفر`,
      ].join("\n");
    });
    return send(chatId, "📋 فهرست سازمان‌ها\n\n" + lines.join("\n\n") + "\n\n👥 ظرفیت مشاوران در هر سازمان: نامحدود");
  }
  return send(chatId, "دستور شناخته نشد. /help را بزنید.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (!expected || req.headers.get("x-telegram-bot-api-secret-token") !== expected) return new Response("forbidden", { status: 403 });
  try {
    const update = await req.json();
    const message = update.message || update.callback_query?.message;
    const chatId = message?.chat?.id;
    const fromId = String(update.message?.from?.id || update.callback_query?.from?.id || "");
    if (!chatId || !allowed.has(fromId) || message?.chat?.type !== "private") return new Response("ok");
    if (update.callback_query?.id) {
      await fetch(tg("answerCallbackQuery"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
      await handle(chatId, String(update.callback_query.data || "/menu"));
    } else {
      await handle(chatId, String(update.message?.text || "/menu"));
    }
  } catch (e) {
    console.error("telegram-admin error", e);
    try {
      const update = await req.clone().json();
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) await send(chatId, "⚠️ عملیات انجام نشد. اطلاعات ورودی را بررسی کنید و دوباره تلاش کنید.\\n" + String((e as Error)?.message || "خطای نامشخص").slice(0, 240));
    } catch { /* keep webhook response stable */ }
  }
  return new Response("ok");
});
