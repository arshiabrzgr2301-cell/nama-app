-- NAMA multi-tenant organizations with unlimited consultants per organization.
-- Apply with: supabase db push (or paste into the Supabase SQL editor).
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  status text not null default 'active' check (status in ('active','suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','expired','suspended')),
  starts_at timestamptz,
  expires_at timestamptz,
  renewed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$')
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'consultant' check (role in ('owner','manager','consultant')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (user_id)
);

create index if not exists organization_memberships_org_idx on public.organization_memberships(organization_id);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id);
create index if not exists organization_subscriptions_expiry_idx on public.organization_subscriptions(expires_at);

create or replace function private.nama_is_active_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.organization_subscriptions s on s.organization_id = o.id
    where m.user_id = auth.uid()
      and m.organization_id = target_org
      and m.status = 'active'
      and o.status = 'active'
      and s.status = 'active'
      and s.starts_at <= now()
      and s.expires_at > now()
  );
$$;

create or replace function private.nama_current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.organization_id
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  join public.organization_subscriptions s on s.organization_id = o.id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
    and s.status = 'active'
    and s.starts_at <= now()
    and s.expires_at > now()
  limit 1;
$$;

alter table public.properties add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
create index if not exists properties_organization_idx on public.properties(organization_id);

create or replace function private.nama_assign_property_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare resolved_org uuid;
begin
  select m.organization_id into resolved_org
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  join public.organization_subscriptions s on s.organization_id = o.id
  where m.user_id = auth.uid()
    and m.status = 'active' and o.status = 'active'
    and s.status = 'active' and s.starts_at <= now() and s.expires_at > now()
  limit 1;
  if resolved_org is null then
    raise exception 'NAMA_ORGANIZATION_SUBSCRIPTION_INACTIVE';
  end if;
  if tg_op = 'INSERT' then
    new.organization_id := resolved_org;
  elsif new.organization_id is distinct from old.organization_id then
    raise exception 'ORGANIZATION_ID_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists nama_property_org_guard on public.properties;
create trigger nama_property_org_guard
before insert or update of organization_id on public.properties
for each row execute function private.nama_assign_property_org();

revoke all on function private.nama_is_active_member(uuid) from public, anon;
revoke all on function private.nama_current_org_id() from public, anon;
revoke all on function private.nama_assign_property_org() from public, anon, authenticated;
grant execute on function private.nama_is_active_member(uuid) to authenticated;
grant execute on function private.nama_current_org_id() to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;

-- Remove the previous owner-only policies: otherwise their permissive OR behavior
-- would let an expired organization continue using its old accounts.
drop policy if exists "Owners manage their properties" on public.properties;
drop policy if exists "Owners manage their hotspots" on public.hotspots;
drop policy if exists "Owners manage property media" on storage.objects;

drop policy if exists "nama_org_read_members" on public.organizations;
create policy "nama_org_read_members" on public.organizations
for select to authenticated using (private.nama_is_active_member(id));

drop policy if exists "nama_subscription_read_members" on public.organization_subscriptions;
create policy "nama_subscription_read_members" on public.organization_subscriptions
for select to authenticated using (private.nama_is_active_member(organization_id));

drop policy if exists "nama_profile_read_self_or_org" on public.profiles;
create policy "nama_profile_read_self_or_org" on public.profiles
for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1 from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = profiles.user_id and theirs.status = 'active'
  )
);

drop policy if exists "nama_profile_update_self" on public.profiles;
create policy "nama_profile_update_self" on public.profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "nama_membership_read_org" on public.organization_memberships;
create policy "nama_membership_read_org" on public.organization_memberships
for select to authenticated using (private.nama_is_active_member(organization_id));

drop policy if exists "nama_properties_org_select" on public.properties;
create policy "nama_properties_org_select" on public.properties
for select to authenticated using (private.nama_is_active_member(organization_id));

drop policy if exists "nama_properties_org_insert" on public.properties;
create policy "nama_properties_org_insert" on public.properties
for insert to authenticated with check (
  owner_id = auth.uid() and organization_id = private.nama_current_org_id()
);

drop policy if exists "nama_properties_org_update" on public.properties;
create policy "nama_properties_org_update" on public.properties
for update to authenticated using (private.nama_is_active_member(organization_id))
with check (private.nama_is_active_member(organization_id));

drop policy if exists "nama_hotspots_org_read" on public.hotspots;
create policy "nama_hotspots_org_read" on public.hotspots
for select to authenticated using (
  exists (select 1 from public.properties p
    where p.id = hotspots.property_id
      and private.nama_is_active_member(p.organization_id))
);

drop policy if exists "nama_hotspots_org_insert" on public.hotspots;
create policy "nama_hotspots_org_insert" on public.hotspots
for insert to authenticated with check (
  owner_id = auth.uid() and exists (
    select 1 from public.properties p
    where p.id = hotspots.property_id
      and private.nama_is_active_member(p.organization_id)
  )
);

drop policy if exists "nama_hotspots_org_update" on public.hotspots;
create policy "nama_hotspots_org_update" on public.hotspots
for update to authenticated using (
  exists (select 1 from public.properties p
    where p.id = hotspots.property_id
      and private.nama_is_active_member(p.organization_id))
) with check (
  exists (select 1 from public.properties p
    where p.id = hotspots.property_id
      and private.nama_is_active_member(p.organization_id))
);

revoke all on public.organizations, public.organization_subscriptions,
  public.profiles, public.organization_memberships from anon;
grant select on public.organizations, public.organization_subscriptions,
  public.profiles, public.organization_memberships to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Organization members may read media belonging to any property in their organization.
drop policy if exists "nama_org_media_read" on storage.objects;
create policy "nama_org_media_read" on storage.objects
for select to authenticated using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[2] is not null
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}
  'One subscription per organization. Consultant count is intentionally unlimited; access is controlled by status and expiry.';

  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and private.nama_is_active_member(p.organization_id)
  )
);

drop policy if exists "nama_org_media_upload" on storage.objects;
create policy "nama_org_media_upload" on storage.objects
for insert to authenticated with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] is not null
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}
  'One subscription per organization. Consultant count is intentionally unlimited; access is controlled by status and expiry.';

  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}

drop policy if exists "nama_org_media_update" on storage.objects;
create policy "nama_org_media_update" on storage.objects
for update to authenticated using (
  bucket_id = 'property-media'
  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.owner_id = auth.uid()
      and private.nama_is_active_member(p.organization_id)
  )
) with check (
  bucket_id = 'property-media'
  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.owner_id = auth.uid()
      and private.nama_is_active_member(p.organization_id)
  )
);

drop policy if exists "nama_org_media_delete" on storage.objects;
create policy "nama_org_media_delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'property-media'
  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.owner_id = auth.uid()
      and private.nama_is_active_member(p.organization_id)
  )
);

comment on table public.organization_subscriptions is
  'One subscription per organization. Consultant count is intentionally unlimited; access is controlled by status and expiry.';

  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.owner_id = auth.uid()
      and private.nama_is_active_member(p.organization_id)
  )
);

drop policy if exists "nama_org_media_update" on storage.objects;
create policy "nama_org_media_update" on storage.objects
for update to authenticated using (
  bucket_id = 'property-media'
  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.owner_id = auth.uid()
      and private.nama_is_active_member(p.organization_id)
  )
) with check (
  bucket_id = 'property-media'
  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.owner_id = auth.uid()
      and private.nama_is_active_member(p.organization_id)
  )
);

drop policy if exists "nama_org_media_delete" on storage.objects;
create policy "nama_org_media_delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'property-media'
  and exists (
    select 1 from public.properties p
    where p.id = ((storage.foldername(name))[2])::uuid
      and p.owner_id = auth.uid()
      and private.nama_is_active_member(p.organization_id)
  )
);

comment on table public.organization_subscriptions is
  'One subscription per organization. Consultant count is intentionally unlimited; access is controlled by status and expiry.';
