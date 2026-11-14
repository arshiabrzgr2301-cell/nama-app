-- Expose only published tour metadata, hotspots and the panorama asset.
drop policy if exists "Public can read published properties" on public.properties;
create policy "Public can read published properties"
on public.properties for select to anon, authenticated
using (status = 'published');

drop policy if exists "Public can read published hotspots" on public.hotspots;
create policy "Public can read published hotspots"
on public.hotspots for select to anon, authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id and p.status = 'published'
  )
);

drop policy if exists "Public can read published tour panoramas" on storage.objects;
create policy "Public can read published tour panoramas"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1 from public.properties p
    where p.id::text = (storage.foldername(name))[2]
      and p.owner_id::text = (storage.foldername(name))[1]
      and p.status = 'published'
      and p.panorama_path = name
  )
);
