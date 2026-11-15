drop policy if exists "Organization members insert property tour scenes" on public.property_tour_scenes;
create policy "Organization members insert property tour scenes"
on public.property_tour_scenes for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    panorama_path = 'pending'
    or panorama_path like owner_id::text || '/' || property_id::text || '/scenes/%'
  )
  and exists (
    select 1 from public.properties p
    where p.id = property_tour_scenes.property_id
      and private.nama_is_active_member(p.organization_id)
  )
);

drop policy if exists "Organization members update property tour scenes" on public.property_tour_scenes;
create policy "Organization members update property tour scenes"
on public.property_tour_scenes for update to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_tour_scenes.property_id
      and private.nama_is_active_member(p.organization_id)
  )
)
with check (
  panorama_path = 'pending'
  or panorama_path like owner_id::text || '/' || property_id::text || '/scenes/%'
);

drop policy if exists "Public read published tour scene panoramas" on storage.objects;
create policy "Public read published tour scene panoramas"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[3] = 'scenes'
  and exists (
    select 1
    from public.property_tour_scenes s
    join public.properties p on p.id = s.property_id
    where s.panorama_path = name
      and s.owner_id::text = (storage.foldername(name))[1]
      and s.property_id::text = (storage.foldername(name))[2]
      and p.status = 'published'
  )
);