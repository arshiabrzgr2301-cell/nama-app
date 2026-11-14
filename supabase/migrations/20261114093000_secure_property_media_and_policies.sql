-- Keep uploaded media private and consolidate row-level security policies.
drop policy if exists "Owners can read their properties" on public.properties;
drop policy if exists "Owners can create properties" on public.properties;
drop policy if exists "Owners can update their properties" on public.properties;
drop policy if exists "Owners can delete their properties" on public.properties;
drop policy if exists "Owners can read hotspots" on public.hotspots;
drop policy if exists "Owners can create hotspots" on public.hotspots;
drop policy if exists "Owners can update hotspots" on public.hotspots;
drop policy if exists "Owners can delete hotspots" on public.hotspots;

drop policy if exists "Authenticated users upload into own folder" on storage.objects;
drop policy if exists "Users read own property media" on storage.objects;
drop policy if exists "Users update own property media" on storage.objects;
drop policy if exists "Users delete own property media" on storage.objects;
drop policy if exists "Users upload own property media" on storage.objects;
drop policy if exists "Public read property media" on storage.objects;

create policy "Owners manage property media" on storage.objects
for all to authenticated
using (bucket_id = 'property-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

update storage.buckets set public = false where id = 'property-media';
revoke execute on function public.increment_property_views(uuid) from anon;
grant execute on function public.increment_property_views(uuid) to authenticated;
create index if not exists hotspots_owner_idx on public.hotspots(owner_id);
