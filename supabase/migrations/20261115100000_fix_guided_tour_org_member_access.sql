drop policy if exists "Owners manage property tour scenes" on public.property_tour_scenes;
drop policy if exists "Owners manage property tour links" on public.property_tour_links;

create policy "Organization members read property tour scenes"
on public.property_tour_scenes for select to authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_scenes.property_id and private.nama_is_active_member(p.organization_id)));

create policy "Organization members insert property tour scenes"
on public.property_tour_scenes for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (select 1 from public.properties p where p.id = property_tour_scenes.property_id and private.nama_is_active_member(p.organization_id)));

create policy "Organization members update property tour scenes"
on public.property_tour_scenes for update to authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_scenes.property_id and private.nama_is_active_member(p.organization_id)))
with check (exists (select 1 from public.properties p where p.id = property_tour_scenes.property_id and private.nama_is_active_member(p.organization_id)));

create policy "Organization members delete property tour scenes"
on public.property_tour_scenes for delete to authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_scenes.property_id and private.nama_is_active_member(p.organization_id)));

create policy "Organization members read property tour links"
on public.property_tour_links for select to authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_links.property_id and private.nama_is_active_member(p.organization_id)));

create policy "Organization members insert property tour links"
on public.property_tour_links for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.properties p where p.id = property_tour_links.property_id and private.nama_is_active_member(p.organization_id))
  and exists (select 1 from public.property_tour_scenes s where s.id = property_tour_links.from_scene_id and s.property_id = property_tour_links.property_id)
  and exists (select 1 from public.property_tour_scenes s where s.id = property_tour_links.to_scene_id and s.property_id = property_tour_links.property_id)
);

create policy "Organization members update property tour links"
on public.property_tour_links for update to authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_links.property_id and private.nama_is_active_member(p.organization_id)))
with check (
  exists (select 1 from public.properties p where p.id = property_tour_links.property_id and private.nama_is_active_member(p.organization_id))
  and exists (select 1 from public.property_tour_scenes s where s.id = property_tour_links.from_scene_id and s.property_id = property_tour_links.property_id)
  and exists (select 1 from public.property_tour_scenes s where s.id = property_tour_links.to_scene_id and s.property_id = property_tour_links.property_id)
);

create policy "Organization members delete property tour links"
on public.property_tour_links for delete to authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_links.property_id and private.nama_is_active_member(p.organization_id)));

drop policy if exists "Owners upload tour scene panoramas" on storage.objects;
drop policy if exists "Owners update tour scene panoramas" on storage.objects;
drop policy if exists "Owners delete tour scene panoramas" on storage.objects;

create policy "Organization members upload tour scene panoramas"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-media' and (storage.foldername(name))[3] = 'scenes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2] and private.nama_is_active_member(p.organization_id))
);

create policy "Organization members update tour scene panoramas"
on storage.objects for update to authenticated
using (
  bucket_id = 'property-media' and (storage.foldername(name))[3] = 'scenes'
  and exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2] and private.nama_is_active_member(p.organization_id))
)
with check (
  bucket_id = 'property-media' and (storage.foldername(name))[3] = 'scenes'
  and exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2] and private.nama_is_active_member(p.organization_id))
);

create policy "Organization members delete tour scene panoramas"
on storage.objects for delete to authenticated
using (
  bucket_id = 'property-media' and (storage.foldername(name))[3] = 'scenes'
  and exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2] and private.nama_is_active_member(p.organization_id))
);