import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ADMIN_IDS = new Set((Deno.env.get("TELEGRAM_ADMIN_IDS") ?? "").split(",").map(v => v.trim()).filter(Boolean));
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DB_HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

type Json = Record<string, unknown>;
const menu = {
  inline_keyboard: [
    [{ text: "🏢 دفاتر املاک", callback_data: "/orgs" }, { text: "➕ ایجاد دفتر", callback_data: "/neworg" }],
    [{ text: "🔄 تمدید اشتراک", callback_data: "/renew" }, { text: "⛔ وضعیت دسترسی دفاتر", callback_data: "/officeaccess" }],
    [{ text: "🔑 بازیابی رمز مدیر دفتر", callback_data: "/resetmanager" }],
    [{ text: "📚 راهنما", callback_data: "/help" }],
  ],
};

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function password() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}
function safeText(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}
async function telegram(method: string, payload: Json) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API error: ${method}`);
  return result.result;
}
async function send(chatId: number, text: string, keyboard?: unknown) {
  return telegram("sendMessage", {
    chat_id: chatId, text, disable_web_page_preview: true,
    reply_markup: keyboard ?? menu,
  });
}
async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init, headers: { ...DB_HEADERS, ...(init.headers ?? {}) },
  });
  const raw = await response.text();
  let result: any = [];
  try { result = raw ? JSON.parse(raw) : []; } catch { result = raw; }
  if (!response.ok) {
    const detail = typeof result === "object" ? result.message || result.details || result.hint || result.code : result;
    throw new Error(String(detail || `Database error ${response.status}`));
  }
  return result;
}
async function createManager(orgId: string, username: string, fullName: string) {
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(clean)) throw new Error("نام کاربری مدیر باید ۳ تا ۳۲ نویسه انگلیسی، عدد، نقطه یا خط تیره باشد.");
  if (fullName.trim().length < 2 || fullName.trim().length > 100) throw new Error("نام کامل مدیر معتبر نیست.");
  const tempPassword = password();
  const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST", headers: DB_HEADERS,
    body: JSON.stringify({
      email: `${clean}@users.nama.invalid`, password: tempPassword, email_confirm: true,
      user_metadata: { name: fullName.trim(), nama_managed: true },
    }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok || !created.id) {
    const msg = created.msg || created.message || created.error_description;
    throw new Error(msg || "ساخت حساب مدیر ناموفق بود؛ احتمالاً نام کاربری قبلاً استفاده شده است.");
  }
  try {
    await db("profiles", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: created.id, username: clean, full_name: fullName.trim() }),
    });
    await db("organization_memberships", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ organization_id: orgId, user_id: created.id, role: "owner", status: "active" }),
    });
    await db(`organizations?id=eq.${encodeURIComponent(orgId)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ created_by: created.id }),
    });
  } catch (error) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers: DB_HEADERS }).catch(() => undefined);
    throw error;
  }
  return { id: created.id, username: clean, password: tempPassword };
}
async function createOffice(name: string, username: string, fullName: string, chatId: number) {
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 120) throw new Error("نام دفتر باید بین ۲ تا ۱۲۰ نویسه باشد.");
  const existing = await db(`organizations?select=id&name=eq.${encodeURIComponent(cleanName)}&limit=1`);
  if (existing.length) throw new Error("دفتری با این نام قبلاً ثبت شده است.");
  const offices = await db("organizations", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name: cleanName, status: "active" }),
  });
  const office = offices?.[0];
  if (!office?.id) throw new Error("ساخت دفتر انجام نشد.");
  let managerId: string | null = null;
  try {
    const manager = await createManager(office.id, username, fullName);
    managerId = manager.id;
    await db("organization_subscriptions", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ organization_id: office.id, status: "pending" }),
    });
    await send(chatId,
      `✅ دفتر با موفقیت ایجاد شد.\n\n🏢 دفتر: ${cleanName}\n🆔 شناسه دفتر: ${office.id}\n👤 مدیر دفتر: ${fullName}\n🔐 نام کاربری: ${manager.username}\n🔑 رمز موقت: ${manager.password}\n\nاشتراک هنوز فعال نشده است. برای فعال‌سازی از بخش «تمدید اشتراک» اقدام کن.\n\nاین اطلاعات را فقط به مدیر دفتر تحویل بده.`);
  } catch (error) {
    if (managerId) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${managerId}`, { method: "DELETE", headers: DB_HEADERS }).catch(() => undefined);
    }
    await db(`organizations?id=eq.${encodeURIComponent(office.id)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}
async function officeRows() {
  return db("organizations?select=id,name,status,created_at,organization_subscriptions(status,starts_at,expires_at)&order=created_at.desc&limit=100");
}
function subscriptionInfo(office: any) {
  const raw = office.organization_subscriptions;
  const sub = Array.isArray(raw) ? raw[0] : raw;
  const expiry = sub?.expires_at ? new Date(sub.expires_at) : null;
  const remaining = expiry && !Number.isNaN(expiry.getTime()) ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  let label = "ثبت نشده";
  if (sub) label = remaining !== null && remaining <= 0 ? "منقضی‌شده" : sub.status === "active" ? "فعال" : sub.status === "suspended" ? "تعلیق‌شده" : sub.status === "expired" ? "منقضی‌شده" : "در انتظار فعال‌سازی";
  return { sub, expiry, remaining, label };
}
async function officeDetail(chatId: number, id: string) {
  const rows = await db(`organizations?select=id,name,status,created_at,organization_subscriptions(status,starts_at,expires_at)&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rows.length) return send(chatId, "دفتر موردنظر پیدا نشد.");
  const office = rows[0];
  const [members, subscription] = await Promise.all([
    db(`organization_memberships?select=user_id,role,status&organization_id=eq.${encodeURIComponent(id)}&role=eq.owner&limit=2`),
    Promise.resolve(subscriptionInfo(office)),
  ]);
  const managerIds = members.map((m: any) => m.user_id).filter(Boolean);
  const profiles = managerIds.length
    ? await db(`profiles?select=user_id,username,full_name&user_id=in.(${managerIds.map(encodeURIComponent).join(",")})`)
    : [];
  const manager = profiles[0];
  const date = subscription.expiry
    ? subscription.expiry.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric" })
    : "ثبت نشده";
  const days = subscription.remaining === null ? "نامشخص" : subscription.remaining <= 0 ? "پایان‌یافته" : `${new Intl.NumberFormat("fa-IR").format(subscription.remaining)} روز`;
  const keyboard = { inline_keyboard: [
    [{ text: "🔄 تمدید اشتراک", callback_data: `/renewoffice:${id}` }],
    [{ text: office.status === "active" ? "⛔ تعلیق دفتر" : "▶️ فعال‌سازی دفتر", callback_data: office.status === "active" ? `/confirmstop:${id}` : `/confirmactivate:${id}` }],
    [{ text: "🔑 بازیابی رمز مدیر", callback_data: `/resetoffice:${id}` }],
    [{ text: "⬅️ بازگشت به دفاتر", callback_data: "/orgs" }, { text: "🏠 منوی اصلی", callback_data: "/menu" }],
  ] };
  return send(chatId,
    `🏢 ${office.name}\n\nوضعیت دفتر: ${office.status === "active" ? "فعال" : "تعلیق‌شده"}\nاشتراک: ${subscription.label}\nانقضا: ${date}\nباقی‌مانده: ${days}\nمدیر: ${manager?.full_name || "ثبت نشده"}\nنام کاربری مدیر: ${manager?.username ? "@" + manager.username : "ثبت نشده"}\n\nمدیریت مشاوران و فایل‌های املاک از داخل اپلیکیشن و توسط مدیر همین دفتر انجام می‌شود.`, keyboard);
}
async function renewOffice(chatId: number, id: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("مدت اشتراک نامعتبر است.");
  const offices = await db(`organizations?select=id,name&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!offices.length) throw new Error("دفتر پیدا نشد.");
  const subs = await db(`organization_subscriptions?select=expires_at&organization_id=eq.${encodeURIComponent(id)}&limit=1`);
  const now = Date.now();
  const previousExpiry = subs[0]?.expires_at ? new Date(subs[0].expires_at).getTime() : 0;
  const start = Math.max(now, Number.isFinite(previousExpiry) ? previousExpiry : 0);
  const expires = new Date(start + days * 86400000).toISOString();
  await db("organization_subscriptions?on_conflict=organization_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      organization_id: id, status: "active", starts_at: new Date(now).toISOString(),
      expires_at: expires, renewed_at: new Date(now).toISOString(),
    }),
  });
  await db(`organizations?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
  await send(chatId, `✅ اشتراک «${offices[0].name}» تمدید شد.\nمدت: ${new Intl.NumberFormat("fa-IR").format(days)} روز\nانقضا: ${new Date(expires).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}`);
}
async function resetOfficeManager(chatId: number, orgId: string) {
  const offices = await db(`organizations?select=id,name&id=eq.${encodeURIComponent(orgId)}&limit=1`);
  if (!offices.length) throw new Error("دفتر پیدا نشد.");
  const members = await db(`organization_memberships?select=user_id&organization_id=eq.${encodeURIComponent(orgId)}&role=eq.owner&status=eq.active&limit=1`);
  if (!members.length) throw new Error("مدیر فعالی برای این دفتر ثبت نشده است.");
  const newPassword = password();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${members[0].user_id}`, {
    method: "PUT", headers: DB_HEADERS, body: JSON.stringify({ password: newPassword }),
  });
  if (!response.ok) throw new Error("بازیابی رمز مدیر انجام نشد.");
  const profile = await db(`profiles?select=username,full_name&user_id=eq.${encodeURIComponent(members[0].user_id)}&limit=1`);
  await send(chatId, `🔑 رمز مدیر دفتر «${offices[0].name}» بازنشانی شد.\nنام مدیر: ${profile[0]?.full_name || "—"}\nنام کاربری: ${profile[0]?.username || "—"}\nرمز موقت جدید: ${newPassword}\n\nاین رمز را فقط به مدیر دفتر تحویل بده.`);
}
async function setOfficeStatus(chatId: number, id: string, activate: boolean) {
  const offices = await db(`organizations?select=id,name&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!offices.length) throw new Error("دفتر پیدا نشد.");
  if (!activate) {
    await db(`organization_subscriptions?organization_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) });
    await db(`organizations?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) });
    return send(chatId, `⛔ دسترسی دفتر «${offices[0].name}» و اعضای آن تعلیق شد.`);
  }
  const subs = await db(`organization_subscriptions?select=status,expires_at&organization_id=eq.${encodeURIComponent(id)}&limit=1`);
  const expiry = subs[0]?.expires_at ? new Date(subs[0].expires_at).getTime() : 0;
  const stillValid = subs[0]?.status !== "expired" && expiry > Date.now();
  await db(`organizations?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
  if (subs.length) await db(`organization_subscriptions?organization_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", body: JSON.stringify({ status: stillValid ? "active" : "expired" }),
  });
  return send(chatId, stillValid
    ? `▶️ دفتر «${offices[0].name}» فعال شد و اشتراک آن هنوز معتبر است.`
    : `دفتر «${offices[0].name}» فعال شد، اما اشتراکش معتبر نیست؛ برای بازگشت دسترسی اعضا باید اشتراک تمدید شود.`);
}
async function handle(chatId: number, rawText: string) {
  const text = rawText.trim();
  const [first, ...args] = text.split(/\s+/);
  const command = (first || "").split("@")[0].toLowerCase();
  if (command === "/start" || command === "/menu") {
    return send(chatId, "🏙 NAMA | پنل مدیریت مرکزی\n\nایجاد و مدیریت دفاتر، حساب مدیران و اشتراک‌ها از این بخش انجام می‌شود.\nمدیر هر دفتر، مشاوران و فایل‌های همان دفتر را از داخل اپلیکیشن مدیریت می‌کند.");
  }
  if (command === "/help") {
    return send(chatId,
      "📚 راهنمای پنل مرکزی NAMA\n\n/neworg نام_دفتر نام_کاربری_مدیر نام_کامل_مدیر\n/orgs نمایش دفاتر\n/renew شناسه_دفتر تعداد_روز\n/suspendorg شناسه_دفتر\n/activateorg شناسه_دفتر\n/resetmanager شناسه_دفتر\n\nافزودن، غیرفعال‌سازی و مدیریت مشاوران فقط از داخل اپلیکیشن و توسط مدیر همان دفتر انجام می‌شود.\nدستور قدیمی /adduser دیگر برای ساخت حساب استفاده نمی‌شود.");
  }
  if (command === "/neworg" && args.length === 0) {
    return telegram("sendMessage", {
      chat_id: chatId,
      text: "NAMA_NEW_OFFICE\nبرای ایجاد دفتر، اطلاعات را در یک پیام و با جداکننده | بفرست:\nنام دفتر | نام کاربری مدیر | نام و نام خانوادگی مدیر\n\nمثال:\nاملاک آفتاب | aftab.manager | علی رضایی",
      reply_markup: { force_reply: true, selective: true },
    });
  }
  if (command === "/neworg") {
    if (args.length < 3) throw new Error("فرمت صحیح: /neworg نام_دفتر نام_کاربری_مدیر نام_کامل_مدیر");
    const name = args[0].replace(/_/g, " ");
    const username = args[1];
    const fullName = args.slice(2).join(" ").replace(/_/g, " ");
    return createOffice(name, username, fullName, chatId);
  }
  if (command === "/adduser" || command.startsWith("/orgadd:") || command.startsWith("/membertoggle:")) {
    return send(chatId, "👤 ساخت و مدیریت مشاوران از این پس فقط توسط مدیر همان دفتر و از بخش «مشاوران دفتر» داخل اپلیکیشن NAMA انجام می‌شود. ربات مرکزی دیگر حساب مشاور ایجاد یا مدیریت نمی‌کند.");
  }
  if (command === "/orgs") {
    const offices = await officeRows();
    if (!offices.length) return send(chatId, "هنوز دفتری ثبت نشده است.");
    const buttons = offices.slice(0, 50).map((o: any) => [{
      text: (o.status === "active" ? "🟢 " : "⛔ ") + safeText(o.name, 50),
      callback_data: "/office:" + o.id,
    }]);
    buttons.push([{ text: "➕ ایجاد دفتر جدید", callback_data: "/neworg" }], [{ text: "🏠 منوی اصلی", callback_data: "/menu" }]);
    return send(chatId, "🏢 دفاتر املاک\n\nبرای مشاهده جزئیات هر دفتر، آن را انتخاب کن.", { inline_keyboard: buttons });
  }
  if (command.startsWith("/office:")) return officeDetail(chatId, command.slice(8));
  if (command === "/renew" && args.length === 0) {
    const offices = await officeRows();
    if (!offices.length) return send(chatId, "هنوز دفتری ثبت نشده است.");
    const buttons = offices.slice(0, 50).map((o: any) => [{ text: "🔄 " + safeText(o.name, 50), callback_data: "/renewoffice:" + o.id }]);
    buttons.push([{ text: "⬅️ منوی اصلی", callback_data: "/menu" }]);
    return send(chatId, "دفتر موردنظر برای تمدید اشتراک را انتخاب کن:", { inline_keyboard: buttons });
  }
  if (command.startsWith("/renewoffice:")) {
    const id = command.slice(13);
    return send(chatId, "مدت تمدید را انتخاب کن:", { inline_keyboard: [
      [{ text: "۳۰ روز", callback_data: "/renewdays:" + id + ":30" }, { text: "۹۰ روز", callback_data: "/renewdays:" + id + ":90" }],
      [{ text: "۱۸۰ روز", callback_data: "/renewdays:" + id + ":180" }, { text: "۳۶۵ روز", callback_data: "/renewdays:" + id + ":365" }],
      [{ text: "⬅️ بازگشت", callback_data: "/office:" + id }],
    ] });
  }
  if (command.startsWith("/renewdays:")) {
    const [, id, days] = command.split(":");
    return renewOffice(chatId, id, Number(days));
  }
  if (command === "/renew") {
    if (args.length !== 2) throw new Error("فرمت: /renew شناسه_دفتر تعداد_روز");
    return renewOffice(chatId, args[0], Number(args[1]));
  }
  if (command === "/officeaccess") {
    const offices = await officeRows();
    if (!offices.length) return send(chatId, "هنوز دفتری ثبت نشده است.");
    const buttons = offices.slice(0, 50).map((o: any) => [{ text: (o.status === "active" ? "⛔ تعلیق " : "▶️ فعال‌سازی ") + safeText(o.name, 42), callback_data: o.status === "active" ? "/confirmstop:" + o.id : "/confirmactivate:" + o.id }]);
    buttons.push([{ text: "⬅️ منوی اصلی", callback_data: "/menu" }]);
    return send(chatId, "وضعیت دسترسی دفتر موردنظر را انتخاب کن:", { inline_keyboard: buttons });
  }
  if (command.startsWith("/confirmstop:")) {
    const id = command.slice(13);
    return send(chatId, "با تعلیق دفتر، دسترسی مدیر و تمام مشاوران آن متوقف می‌شود. ادامه می‌دهی؟", { inline_keyboard: [
      [{ text: "بله، تعلیق شود", callback_data: "/suspendorg:" + id }],
      [{ text: "لغو", callback_data: "/office:" + id }],
    ] });
  }
  if (command.startsWith("/confirmactivate:")) {
    const id = command.slice(17);
    return send(chatId, "دفتر فعال شود؟ اگر اشتراک منقضی شده باشد، کاربران تا زمان تمدید اشتراک دسترسی نخواهند داشت.", { inline_keyboard: [
      [{ text: "بله، فعال شود", callback_data: "/activateorg:" + id }],
      [{ text: "لغو", callback_data: "/office:" + id }],
    ] });
  }
  if (command.startsWith("/suspendorg:")) return setOfficeStatus(chatId, command.slice(12), false);
  if (command.startsWith("/activateorg:")) return setOfficeStatus(chatId, command.slice(13), true);
  if (command === "/suspendorg" || command === "/activateorg") {
    if (!args[0]) throw new Error("شناسه دفتر را وارد کن.");
    return setOfficeStatus(chatId, args[0], command === "/activateorg");
  }
  if (command === "/resetmanager" && args.length === 0) {
    const offices = await officeRows();
    const buttons = offices.slice(0, 50).map((o: any) => [{ text: "🔑 " + safeText(o.name, 50), callback_data: "/resetoffice:" + o.id }]);
    buttons.push([{ text: "⬅️ منوی اصلی", callback_data: "/menu" }]);
    return send(chatId, "دفتر موردنظر برای بازیابی رمز مدیر را انتخاب کن:", { inline_keyboard: buttons });
  }
  if (command.startsWith("/resetoffice:")) return resetOfficeManager(chatId, command.slice(13));
  if (command === "/resetmanager") {
    if (!args[0]) throw new Error("شناسه دفتر را وارد کن.");
    return resetOfficeManager(chatId, args[0]);
  }
  if (command === "/resetpass") {
    return send(chatId, "برای امنیت، بازیابی رمز از ربات فقط برای مدیر دفتر و با دستور /resetmanager انجام می‌شود. رمز مشاوران توسط مدیر دفتر مدیریت می‌شود.");
  }
  return send(chatId, "دستور شناخته نشد. برای دیدن راهنما /help را بزن.");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_KEY || !BOT_TOKEN || !WEBHOOK_SECRET || ADMIN_IDS.size === 0) {
    console.error("telegram-admin configuration incomplete");
    return new Response("Bot configuration incomplete", { status: 503 });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  let update: any;
  try {
    update = await req.json();
    const callback = update.callback_query;
    const message = update.message;
    const chat = callback?.message?.chat ?? message?.chat;
    const senderId = String(callback?.from?.id ?? message?.from?.id ?? "");
    if (!chat?.id || chat.type !== "private" || !ADMIN_IDS.has(senderId)) return new Response("ok");
    if (callback?.id) await telegram("answerCallbackQuery", { callback_query_id: callback.id }).catch(() => undefined);

    const replyText = safeText(message?.reply_to_message?.text, 1000);
    if (message?.text && replyText.startsWith("NAMA_NEW_OFFICE")) {
      const parts = String(message.text).split("|").map((v: string) => v.trim());
      if (parts.length < 3) {
        await send(chat.id, "اطلاعات ناقص است. لطفاً دقیقاً با این قالب بفرست:\nنام دفتر | نام کاربری مدیر | نام و نام خانوادگی مدیر");
      } else {
        await createOffice(parts[0], parts[1], parts.slice(2).join(" "), chat.id);
      }
      return new Response("ok");
    }
    const text = callback ? String(callback.data ?? "/menu") : String(message?.text ?? "/menu");
    await handle(chat.id, text);
  } catch (error) {
    console.error("telegram-admin webhook error", error);
    const chatId = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;
    if (chatId) {
      try { await send(chatId, "⚠️ عملیات انجام نشد.\n" + safeText((error as Error)?.message, 240)); } catch { /* Telegram may be unavailable */ }
    }
  }
  return new Response("ok");
});
