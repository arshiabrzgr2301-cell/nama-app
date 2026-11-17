import { getToken, getRefreshToken, saveSession, getUser } from '../utils/storage';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://laezrjnznyjqfibpczfz.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZFId00wDoEsw0TGluzBvBQ_xARK9g8o';

export type Role = 'owner' | 'manager' | 'consultant';
export type DealStatus = 'active' | 'deposit' | 'sold';
export interface AppUser { id:string; name:string; username:string; phone?:string; role:Role; organizationId:string; officeName:string; }
export interface Consultant { id:string; fullName:string; username:string; status:string; }
export interface PropertyPayload {
 title:string; city:string; address:string; price:number; realPrice?:number|null; area:number; rooms:number; floor:number;
 description:string; status?:'draft'|'published'; fileOwnerId:string; ownerName?:string; ownerPhone?:string;
 exactAddress?:string; neighborhood?:string; propertyType?:string; yearBuilt?:number|null; amenities?:string[];
 latitude?:number|null; longitude?:number|null;
}
export interface Property {
 id:string; owner_id:string; organization_id:string; file_owner_id:string; registered_by:string; title:string; city:string; address:string;
 price:number; real_price?:number|null; area:number; rooms:number; floor:number; description:string; status:'draft'|'published';
 deal_status:DealStatus; owner_name?:string; owner_phone?:string; exact_address?:string; neighborhood?:string;
 property_type?:string; year_built?:number|null; amenities?:string[]; latitude?:number|null; longitude?:number|null;
 sold_by_consultant_id?:string|null; deposit_at?:string|null; sold_at?:string|null; views:number; panorama_path?:string; created_at:string;
}
export interface ActivityReport {
 id:string; organization_id:string; user_id:string; activity_date:string; listings_posted:number; files_found:number; customers_found:number;
 sellers_found:number; in_person_visits:number; phone_consultations:number; office_consultations:number; follow_ups:number;
 deposits:number; sales:number; ads_published:number; notes:string; submitted_at:string; full_name?:string;
}
export interface Reminder {
 id:string; organization_id:string; user_id:string; title:string; reminder_type:string; customer_name?:string;
 customer_phone?:string; notes:string; due_at:string; completed_at?:string|null; notification_id?:string|null;
}

async function refreshSession():Promise<string|null>{
 const refreshToken=await getRefreshToken();if(!refreshToken)return null;
 const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
  method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})
 });
 if(!r.ok)return null;const d=await r.json();await saveSession(d.access_token,d.refresh_token);return d.access_token;
}
async function request<T>(path:string,options:RequestInit={},retry=true):Promise<T>{
 let token=await getToken();
 const headers:Record<string,string>={apikey:SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',
  ...(token?{Authorization:'Bearer '+token}:{}),...(options.headers as Record<string,string>||{})};
 const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{...options,headers});
 if(r.status===401&&retry){token=await refreshSession()||undefined;if(token)return request<T>(path,options,false);}
 if(!r.ok){const raw=await r.text();let msg=raw;try{const j=JSON.parse(raw);msg=j.message||j.details||j.hint||j.error_description||raw;}catch{}throw new Error(msg||'خطای سرور ('+r.status+')');}
 if(r.status===204)return {} as T;const raw=await r.text();return(raw?JSON.parse(raw):{}) as T;
}
async function edge<T>(slug:string,body:unknown):Promise<T>{
 const token=await getToken();if(!token)throw new Error('ابتدا وارد حساب شوید.');
 const r=await fetch(SUPABASE_URL+'/functions/v1/'+slug,{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const raw=await r.text();let d:any={};try{d=raw?JSON.parse(raw):{};}catch{d={message:raw};}
 if(!r.ok)throw new Error(d.message||d.error||'درخواست ناموفق بود.');return d as T;
}
async function uploadStorageAsset(uri:string,path:string,mimeType:string):Promise<void>{
 const token=await getToken();if(!token)throw new Error('ابتدا وارد حساب شوید.');
 const source=await fetch(uri);const blob=await source.blob();
 const encoded=path.split('/').map(encodeURIComponent).join('/');
 const r=await fetch(SUPABASE_URL+'/storage/v1/object/property-media/'+encoded,{
  method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+token,'Content-Type':mimeType,'x-upsert':'true'},body:blob
 });
 if(!r.ok)throw new Error('آپلود رسانه ناموفق بود: '+await r.text());
}
async function signedStorageAsset(path:string):Promise<string|null>{
 const token=await getToken();if(!token)return null;const encoded=path.split('/').map(encodeURIComponent).join('/');
 const r=await fetch(SUPABASE_URL+'/storage/v1/object/sign/property-media/'+encoded,{
  method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})
 });
 if(!r.ok)return null;const d=await r.json();const signed=d.signedURL||d.signedUrl;
 return signed?(signed.startsWith('http')?signed:SUPABASE_URL+'/storage/v1'+signed):null;
}

export const api = {
 login:async(username:string,password:string)=>{
  const r=await fetch(SUPABASE_URL+'/functions/v1/username-login',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({username:username.trim().toLowerCase(),password})});
  const d=await r.json();if(!r.ok)throw new Error(d.message||'نام کاربری یا رمز عبور صحیح نیست.');
  return{token:d.access_token as string,refreshToken:d.refresh_token as string,userId:d.user?.id as string};
 },
 getMe:async(userId:string):Promise<AppUser>=>{
  const p=await request<any[]>('profiles?select=user_id,username,full_name,phone&user_id=eq.'+encodeURIComponent(userId)+'&limit=1');
  const m=await request<any[]>('organization_memberships?select=organization_id,role,status,organizations(name)&user_id=eq.'+encodeURIComponent(userId)+'&status=eq.active&limit=1');
  if(!p.length||!m.length)throw new Error('حساب شما به دفتر فعالی متصل نیست.');
  const org=Array.isArray(m[0].organizations)?m[0].organizations[0]:m[0].organizations;
  return{id:userId,name:p[0].full_name||p[0].username,username:p[0].username,phone:p[0].phone||undefined,role:m[0].role,organizationId:m[0].organization_id,officeName:org?.name||'دفتر املاک'};
 },
 getProperties:()=>request<Property[]>('properties?select=*&order=created_at.desc'),
 getProperty:async(id:string)=>{const rows=await request<Property[]>('properties?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1');if(!rows.length)throw new Error('فایل ملک پیدا نشد.');return rows[0];},
 createProperty:async(data:PropertyPayload)=>{
  const u=await getUser<AppUser>();if(!u||!['owner','manager'].includes(u.role))throw new Error('فقط مدیریت دفتر می‌تواند فایل ثبت کند.');
  const body:any={title:data.title,city:data.city,address:data.address,price:data.price,real_price:data.realPrice??null,area:data.area,rooms:data.rooms,floor:data.floor,description:data.description,status:data.status||'draft',owner_id:u.id,registered_by:u.id,organization_id:u.organizationId,file_owner_id:data.fileOwnerId||u.id,owner_name:data.ownerName||null,owner_phone:data.ownerPhone||null,exact_address:data.exactAddress||null,neighborhood:data.neighborhood||null,property_type:data.propertyType||null,year_built:data.yearBuilt||null,amenities:data.amenities||[],latitude:data.latitude??null,longitude:data.longitude??null};
  const rows=await request<Property[]>('properties?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});return rows[0];
 },
 updateProperty:(id:string,data:Record<string,unknown>)=>request<Property[]>('properties?id=eq.'+encodeURIComponent(id)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)}).then(rows=>rows[0]),
 deleteProperty:(id:string)=>request<void>('properties?id=eq.'+encodeURIComponent(id),{method:'DELETE'}),
 publishProperty:(id:string)=>api.updateProperty(id,{status:'published'}),
 setDraft:(id:string)=>api.updateProperty(id,{status:'draft'}),
 setDealStatus:(id:string,status:DealStatus,soldByConsultantId?:string)=>api.updateProperty(id,{deal_status:status,sold_by_consultant_id:status==='sold'?soldByConsultantId:null}),
 getConsultants:async():Promise<Consultant[]>=>{
  const u=await getUser<AppUser>();if(!u)return[];const members=await request<any[]>('organization_memberships?select=user_id,status&organization_id=eq.'+encodeURIComponent(u.organizationId)+'&role=eq.consultant');
  if(!members.length)return[];const ids=members.map(x=>x.user_id).join(',');const profiles=await request<any[]>('profiles?select=user_id,username,full_name&user_id=in.('+ids+')');
  return members.map(m=>{const p=profiles.find(x=>x.user_id===m.user_id);return{id:m.user_id,fullName:p?.full_name||p?.username||'مشاور',username:p?.username||'',status:m.status};});
 },
 updateConsultantStatus:async(userId:string,status:'active'|'inactive')=>{
  const u=await getUser<AppUser>();if(!u)throw new Error('نشست معتبر نیست.');
  const rows=await request<any[]>('organization_memberships?user_id=eq.'+encodeURIComponent(userId)+'&organization_id=eq.'+encodeURIComponent(u.organizationId)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status})});return rows[0];
 },
 createConsultant:(username:string,fullName:string)=>edge<any>('create-consultant',{username,fullName}),
 getActivityReports:async(date:string):Promise<ActivityReport[]>=>{
  const rows=await request<ActivityReport[]>('daily_activity_reports?select=*&activity_date=eq.'+encodeURIComponent(date)+'&order=submitted_at.desc');
  if(!rows.length)return[];const ids=Array.from(new Set(rows.map(x=>x.user_id)));const profiles=await request<any[]>('profiles?select=user_id,full_name,username&user_id=in.('+ids.join(',')+')');
  return rows.map(row=>({...row,full_name:profiles.find(p=>p.user_id===row.user_id)?.full_name||'مشاور'}));
 },
 submitActivityReport:async(report:Record<string,unknown>)=>{
  const u=await getUser<AppUser>();if(!u)throw new Error('نشست کاربری معتبر نیست.');
  const existing=await request<any[]>('daily_activity_reports?select=id&user_id=eq.'+encodeURIComponent(u.id)+'&activity_date=eq.'+encodeURIComponent(String(report.activity_date))+'&limit=1');
  if(existing.length)throw new Error('گزارش امروز قبلاً ثبت شده است. برای اصلاح با مدیریت دفتر هماهنگ کنید.');
  const rows=await request<any[]>('daily_activity_reports?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...report,user_id:u.id,organization_id:u.organizationId})});return rows[0];
 },
 getReminders:()=>request<Reminder[]>('consultant_reminders?select=*&order=due_at.asc'),
 createReminder:async(reminder:Omit<Reminder,'id'|'organization_id'|'user_id'>)=>{
  const u=await getUser<AppUser>();if(!u)throw new Error('نشست کاربری معتبر نیست.');
  const rows=await request<Reminder[]>('consultant_reminders?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...reminder,user_id:u.id,organization_id:u.organizationId})});return rows[0];
 },
 updateReminder:(id:string,data:Partial<Reminder>)=>request<Reminder[]>('consultant_reminders?id=eq.'+encodeURIComponent(id)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)}).then(rows=>rows[0]),
 deleteReminder:(id:string)=>request<void>('consultant_reminders?id=eq.'+encodeURIComponent(id),{method:'DELETE'}),
 getPropertyPhotos:async(propertyId:string)=>{
  const rows=await request<any[]>('property_photos?select=*&property_id=eq.'+encodeURIComponent(propertyId)+'&order=sort_order.asc');
  return Promise.all(rows.map(async row=>({...row,url:await signedStorageAsset(row.storage_path)})));
 },
 uploadPropertyPhotos:async(propertyId:string,assets:any[])=>{
  const u=await getUser<AppUser>();if(!u||!['owner','manager'].includes(u.role))throw new Error('فقط مدیریت دفتر می‌تواند تصویر بارگذاری کند.');
  for(let i=0;i<assets.length;i++){const a=assets[i];const ext=(a.fileName||a.uri||'photo.jpg').split('.').pop()?.split('?')[0]||'jpg';const path=u.id+'/'+propertyId+'/photos/'+Date.now()+'_'+i+'.'+ext;
   await uploadStorageAsset(a.uri,path,a.mimeType||'image/jpeg');
   await request<any[]>('property_photos',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({property_id:propertyId,organization_id:u.organizationId,owner_id:u.id,storage_path:path,sort_order:i})});
  }
 },
 uploadTourScenes:async(propertyId:string,assets:any[])=>{
  const u=await getUser<AppUser>();if(!u||!['owner','manager'].includes(u.role))throw new Error('فقط مدیریت دفتر می‌تواند تور ۳۶۰ بسازد.');
  for(let i=0;i<assets.length;i++){const a=assets[i];const created=await request<any[]>('property_tour_scenes?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({property_id:propertyId,owner_id:u.id,title:'بخش '+(i+1),description:'',panorama_path:'pending',sort_order:i,is_entry:i===0})});
   const scene=created[0];const ext=(a.fileName||a.uri||'panorama.jpg').split('.').pop()?.split('?')[0]||'jpg';const path=u.id+'/'+propertyId+'/scenes/'+scene.id+'.'+ext;
   try{await uploadStorageAsset(a.uri,path,a.mimeType||'image/jpeg');await request<any[]>('property_tour_scenes?id=eq.'+encodeURIComponent(scene.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({panorama_path:path})});}
   catch(error){await request<void>('property_tour_scenes?id=eq.'+encodeURIComponent(scene.id),{method:'DELETE'});throw error;}
  }
 },
 addHotspot:async(propertyId:string,hotspot:{yaw:number;pitch:number;title:string;description?:string})=>{
  const u=await getUser<AppUser>();if(!u)throw new Error('ابتدا وارد حساب شوید.');
  const rows=await request<any[]>('hotspots?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...hotspot,property_id:propertyId,owner_id:u.id})});return rows[0];
 },
 getTourUrl:(id:string)=>SUPABASE_URL+'/functions/v1/public-tour?id='+encodeURIComponent(id),
 getTourHeaders:async()=>{const token=await getToken();return{apikey:SUPABASE_ANON_KEY,Authorization:token?'Bearer '+token:''};}
};
