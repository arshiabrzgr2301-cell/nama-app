-- Supabase schema for NAMA property tours
-- Applied to project laezrjnznyjqfibpczfz on 2026-11-14.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  city text not null,
  address text not null default '',
  price numeric(16,2) not null default 0,
  area numeric(10,2) not null default 0,
  rooms integer not null default 0,
  floor integer not null default 0,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  panorama_url text,
  video_url text,
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotspots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  yaw double precision not null,
  pitch double precision not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists properties_owner_created_idx on public.properties(owner_id, created_at desc);
create index if not exists properties_status_idx on public.properties(status);
create index if not exists hotspots_property_idx on public.hotspots(property_id);

alter table public.properties enable row level security;
alter table public.hotspots enable row level security;

drop policy if exists "Owners manage their properties" on public.properties;
create policy "Owners manage their properties" on public.properties
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Anyone can view published properties" on public.properties;
create policy "Anyone can view published properties" on public.properties
  for select to anon, authenticated using (status = 'published');

drop policy if exists "Owners manage their hotspots" on public.hotspots;
create policy "Owners manage their hotspots" on public.hotspots
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Anyone can view hotspots for published properties" on public.hotspots;
create policy "Anyone can view hotspots for published properties" on public.hotspots
  for select to anon, authenticated using (
    exists (select 1 from public.properties p where p.id = property_id and p.status = 'published')
  );

create or replace function public.increment_property_views(property_uuid uuid)
returns bigint language plpgsql security definer set search_path = public
as $$
declare new_views bigint;
begin
  update public.properties set views = views + 1
  where id = property_uuid and status = 'published'
  returning views into new_views;
  return coalesce(new_views, 0);
end;
$$;

revoke all on function public.increment_property_views(uuid) from public;
grant execute on function public.increment_property_views(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-media', 'property-media', true, 524288000,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 524288000,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own property media" on storage.objects;
create policy "Users upload own property media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own property media" on storage.objects;
create policy "Users update own property media" on storage.objects
  for update to authenticated using (
    bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own property media" on storage.objects;
create policy "Users delete own property media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Public read property media" on storage.objects;
create policy "Public read property media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'property-media');
