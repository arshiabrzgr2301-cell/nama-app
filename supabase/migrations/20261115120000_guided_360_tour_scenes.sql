-- Guided multi-room 360 tour foundation for NAMA.
-- Each room/position is a separate equirectangular panorama ("scene").
-- Directed links let viewers move between scenes without free-roam 6DoF.

create table if not exists public.property_tour_scenes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  panorama_path text not null,
  sort_order integer not null default 0,
  is_entry boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, id)
);

create table if not exists public.property_tour_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_scene_id uuid not null references public.property_tour_scenes(id) on delete cascade,
  to_scene_id uuid not null references public.property_tour_scenes(id) on delete cascade,
  yaw double precision not null,
  pitch double precision not null default 0,
  label text not null default 'ورود به بخش بعدی',
  created_at timestamptz not null default now(),
  constraint property_tour_links_no_self check (from_scene_id <> to_scene_id)
);

create index if not exists property_tour_scenes_property_order_idx
  on public.property_tour_scenes(property_id, sort_order, created_at);
create index if not exists property_tour_links_from_scene_idx
  on public.property_tour_links(from_scene_id);

alter table public.property_tour_scenes enable row level security;
alter table public.property_tour_links enable row level security;

drop policy if exists "Owners manage property tour scenes" on public.property_tour_scenes;
create policy "Owners manage property tour scenes"
on public.property_tour_scenes for all to authenticated
using (
  owner_id = auth.uid()
  and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
)
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);

drop policy if exists "Public can read scenes for published properties" on public.property_tour_scenes;
create policy "Public can read scenes for published properties"
on public.property_tour_scenes for select to anon, authenticated
using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'published')
);

drop policy if exists "Owners manage property tour links" on public.property_tour_links;
create policy "Owners manage property tour links"
on public.property_tour_links for all to authenticated
using (
  owner_id = auth.uid()
  and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.properties p
    join public.property_tour_scenes s on s.property_id = p.id
    where p.id = property_id and p.owner_id = auth.uid()
      and s.id in (from_scene_id, to_scene_id)
  )
);

drop policy if exists "Public can read links for published properties" on public.property_tour_links;
create policy "Public can read links for published properties"
on public.property_tour_links for select to anon, authenticated
using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'published')
);

drop policy if exists "Owners upload tour scene panoramas" on storage.objects;
create policy "Owners upload tour scene panoramas"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[3] = 'scenes'
);

drop policy if exists "Owners update tour scene panoramas" on storage.objects;
create policy "Owners update tour scene panoramas"
on storage.objects for update to authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[3] = 'scenes'
)
with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[3] = 'scenes'
);

drop policy if exists "Public read published tour scene panoramas" on storage.objects;
create policy "Public read published tour scene panoramas"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[3] = 'scenes'
  and exists (
    select 1 from public.property_tour_scenes s
    join public.properties p on p.id = s.property_id
    where s.panorama_path = name and p.status = 'published'
  )
);
