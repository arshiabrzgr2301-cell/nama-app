-- Public storage policy uses only columns granted to anon and only exposes a published property's exact panorama path.
drop policy if exists "Public can read published tour panoramas" on storage.objects;
create policy "Public can read published tour panoramas"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1 from public.properties p
    where p.id::text = (storage.foldername(name))[2]
      and p.status = 'published'
      and p.panorama_path = name
  )
);
