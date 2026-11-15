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

async function send(chatId: number, text: string, withMenu = true, keyboard?: any) {
  const response = await fetch(tg("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(keyboard ? { reply_markup: keyboard } : withMenu ? { reply_markup: mainMenu } : {}),
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
  if (command.startsWith("/org:")) {
    const orgId = command.slice(5);
    const rows = await db("organizations?select=id,name,status,organization_subscriptions(status,expires_at)&id=eq." + encodeURIComponent(orgId));
    if (!rows.length) return send(chatId, "سازمان پیدا نشد.");
    const o = rows[0];
    const raw = o.organization_subscriptions;
    const sub = Array.isArray(raw) ? raw[0] : raw;
    const expiry = sub?.expires_at ? new Date(sub.expires_at) : null;
    const remaining = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
    const members = await db("organization_memberships?select=status&organization_id=eq." + encodeURIComponent(orgId));
    const active = members.filter((m: any) => m.status === "active").length;
    const fa = new Intl.NumberFormat("fa-IR");
    const date = expiry && !Number.isNaN(expiry.getTime())
      ? expiry.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric" })
      : "ثبت نشده";
    const subText = !sub ? "بدون اشتراک" : remaining !== null && remaining <= 0 ? "منقضی‌شده" : sub.status === "active" ? "فعال" : sub.status === "suspended" ? "تعلیق‌شده" : "در انتظار فعال‌سازی";
    const keyboard = { inline_keyboard: [
      [{text:"👥 مشاوران سازمان",callback_data:"/orgmembers:"+orgId}],
      [{text:"➕ افزودن مشاور",callback_data:"/orgadd:"+orgId},{text:"🔄 تمدید اشتراک",callback_data:"/orgrenew:"+orgId}],
      [{text:"⏸ توقف موقت سازمان",callback_data:"/orgconfirmstop:"+orgId}],
      [{text:"▶️ فعال‌سازی سازمان",callback_data:"/orgactivate:"+orgId}],
      [{text:"⬅️ بازگشت به سازمان‌ها",callback_data:"/orgs"},{text:"🏠 منوی اصلی",callback_data:"/menu"}]
    ]};
    return send(chatId, `🏢 ${o.name}\n\nوضعیت سازمان: ${o.status === "active" ? "فعال" : "تعلیق‌شده"}\nاشتراک: ${subText}\nتاریخ انقضا: ${date}\nباقی‌مانده: ${remaining === null ? "نامشخص" : remaining <= 0 ? "پایان‌یافته" : fa.format(remaining)+" روز"}\nمشاوران فعال: ${fa.format(active)} از ${fa.format(members.length)}\nظرفیت: نامحدود`, false, keyboard);
  }
  if (command.startsWith("/orgmembers:")) {
    const orgId = command.slice(12);
    const rows = await db("organization_memberships?select=user_id,role,status,profiles(username,full_name)&organization_id=eq."+encodeURIComponent(orgId)+"&order=created_at.desc");
    if (!rows.length) return send(chatId,"👥 هنوز مشاوری برای این سازمان ثبت نشده است.",false,{inline_keyboard:[[{text:"➕ افزودن مشاور",callback_data:"/orgadd:"+orgId}],[{text:"⬅️ بازگشت",callback_data:"/org:"+orgId}]]});
    const lines = rows.slice(0,40).map((m:any,i:number)=> {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return `${i+1}. ${p?.full_name || p?.username || "مشاور"} (@${p?.username || "بدون نام کاربری"}) — ${m.status === "active" ? "فعال" : "متوقف"}`;
    });
    const buttons = rows.slice(0,40).map((m:any)=>{
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      if (!p?.username) return null;
      return [{text:(m.status === "active" ? "⏸ " : "▶️ ")+(p.full_name || p.username),callback_data:"/membertoggle:"+orgId+":"+p.username+":"+(m.status === "active" ? "suspend" : "activate")}];
    }).filter(Boolean);
    buttons.push([{text:"➕ افزودن مشاور",callback_data:"/orgadd:"+orgId}]);
    buttons.push([{text:"⬅️ بازگشت به سازمان",callback_data:"/org:"+orgId}]);
    return send(chatId,"👥 فهرست مشاوران\n\n"+lines.join("\n"),false,{inline_keyboard:buttons});
  }
  if (command.startsWith("/orgadd:")) {
    const orgId = command.slice(8);
    return send(chatId,"➕ افزودن مشاور به سازمان\n\nاطلاعات را در یک پیام با این قالب بفرست:\n/adduser "+orgId+" نام_کاربری نام_کامل_مشاور",false);
  }
  if (command.startsWith("/orgrenew:")) {
    const orgId = command.slice(10);
    return send(chatId,"🔄 تمدید اشتراک\n\nمدت تمدید را انتخاب کن:",false,{inline_keyboard:[
      [{text:"۳۰ روز",callback_data:"/reneworg:"+orgId+":30"},{text:"۹۰ روز",callback_data:"/reneworg:"+orgId+":90"}],
      [{text:"۱۸۰ روز",callback_data:"/reneworg:"+orgId+":180"},{text:"۳۶۵ روز",callback_data:"/reneworg:"+orgId+":365"}],
      [{text:"⬅️ بازگشت",callback_data:"/org:"+orgId}]
    ]});
  }
  if (command.startsWith("/reneworg:")) {
    const [,orgId,daysText] = command.split(":");
    return handle(chatId,"/renew "+orgId+" "+daysText);
  }
  if (command.startsWith("/orgconfirmstop:")) {
    const orgId = command.slice(16);
    return send(chatId,"⚠️ با توقف موقت سازمان، دسترسی اعضای آن متوقف می‌شود. مطمئنی؟",false,{inline_keyboard:[
      [{text:"⛔ بله، توقف دسترسی",callback_data:"/suspendorg:"+orgId}],
      [{text:"لغو",callback_data:"/org:"+orgId}]
    ]});
  }
  if (command.startsWith("/suspendorg:")) return handle(chatId,"/suspendorg "+command.slice(12));
  if (command.startsWith("/orgactivate:")) {
    const orgId = command.slice(13);
    return send(chatId,"فعال‌سازی سازمان انجام شود؟",false,{inline_keyboard:[
      [{text:"▶️ بله، فعال‌سازی",callback_data:"/activateorg:"+orgId}],
      [{text:"لغو",callback_data:"/org:"+orgId}]
    ]});
  }
  if (command.startsWith("/activateorg:")) return handle(chatId,"/activateorg "+command.slice(13));
  if (command.startsWith("/membertoggle:")) {
    const [,orgId,username,action] = command.split(":");
    return send(chatId,action === "suspend" ? "دسترسی این مشاور موقتاً متوقف شود؟" : "دسترسی این مشاور دوباره فعال شود؟",false,{inline_keyboard:[
      [{text:"تأیید",callback_data:"/"+action+" "+username}],
      [{text:"لغو",callback_data:"/orgmembers:"+orgId}]
    ]});
  }
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
  if (command === "/adduser" && args.length === 0) {
    const orgs = await db("organizations?select=id,name,status&status=eq.active&order=name.asc");
    const buttons = orgs.map((o:any)=>[{text:"🏢 "+o.name,callback_data:"/orgadd:"+o.id}]);
    buttons.push([{text:"⬅️ منوی اصلی",callback_data:"/menu"}]);
    return send(chatId,"👤 ابتدا سازمان مقصد را انتخاب کن:",false,{inline_keyboard:buttons});
  }
  if (command === "/renew" && args.length === 0) {
    const orgs = await db("organizations?select=id,name&order=name.asc");
    const buttons = orgs.map((o:any)=>[{text:"🏢 "+o.name,callback_data:"/orgrenew:"+o.id}]);
    buttons.push([{text:"⬅️ منوی اصلی",callback_data:"/menu"}]);
    return send(chatId,"🔄 سازمان موردنظر برای تمدید اشتراک را انتخاب کن:",false,{inline_keyboard:buttons});
  }
  if (command === "/suspend" && args.length === 0) {
    const rows = await db("organization_memberships?select=user_id,organization_id,status,profiles(username,full_name),organizations(name)&status=eq.active&order=created_at.desc");
    const buttons = rows.slice(0,40).map((m:any)=>{
      const p=Array.isArray(m.profiles)?m.profiles[0]:m.profiles;
      const o=Array.isArray(m.organizations)?m.organizations[0]:m.organizations;
      return p?.username ? [{text:"⏸ "+(p.full_name||p.username)+" — "+(o?.name||"سازمان"),callback_data:"/membertoggle:"+m.organization_id+":"+p.username+":suspend"}] : null;
    }).filter(Boolean);
    buttons.push([{text:"⬅️ منوی اصلی",callback_data:"/menu"}]);
    return send(chatId,rows.length?"⛔ مشاور موردنظر را برای توقف دسترسی انتخاب کن:":"مشاور فعالی پیدا نشد.",false,{inline_keyboard:buttons});
  }
  if (command === "/resetpass" && args.length === 0) {
    const rows = await db("organization_memberships?select=user_id,organization_id,status,profiles(username,full_name),organizations(name)&status=eq.active&order=created_at.desc");
    const buttons = rows.slice(0,40).map((m:any)=>{
      const p=Array.isArray(m.profiles)?m.profiles[0]:m.profiles;
      const o=Array.isArray(m.organizations)?m.organizations[0]:m.organizations;
      return p?.username ? [{text:"🔑 "+(p.full_name||p.username)+" — "+(o?.name||"سازمان"),callback_data:"/resetuser:"+p.username}] : null;
    }).filter(Boolean);
    buttons.push([{text:"⬅️ منوی اصلی",callback_data:"/menu"}]);
    return send(chatId,rows.length?"🔑 مشاور را برای بازیابی رمز انتخاب کن:":"مشاوری برای نمایش وجود ندارد.",false,{inline_keyboard:buttons});
  }
  if (command.startsWith("/resetuser:")) return handle(chatId,"/resetpass "+command.slice(11));
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
    if (!orgs.length) return send(chatId,"🏢 هنوز سازمانی ثبت نشده است.");
    const buttons = orgs.slice(0,40).map((o:any)=>[{text:"🏢 "+o.name,callback_data:"/org:"+o.id}]);
    buttons.push([{text:"➕ ساخت سازمان جدید",callback_data:"/neworg"}],[{text:"🏠 منوی اصلی",callback_data:"/menu"}]);
    return send(chatId,"🏢 سازمان‌ها\n\nبرای مشاهده جزئیات و مدیریت هر سازمان، نام آن را انتخاب کن.",false,{inline_keyboard:buttons});
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
