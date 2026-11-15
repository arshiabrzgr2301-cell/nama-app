drop policy if exists "nama_profile_update_self" on public.profiles;
create policy "nama_profile_update_self" on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "nama_properties_org_insert" on public.properties;
create policy "nama_properties_org_insert" on public.properties
for insert to authenticated
with check (owner_id = (select auth.uid()) and organization_id = private.nama_current_org_id());

drop policy if exists "nama_hotspots_org_insert" on public.hotspots;
create policy "nama_hotspots_org_insert" on public.hotspots
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.properties p where p.id = hotspots.property_id and private.nama_is_active_member(p.organization_id))
);

drop policy if exists "nama_video_jobs_insert_org" on public.video_processing_jobs;
create policy "nama_video_jobs_insert_org" on public.video_processing_jobs
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.nama_is_active_member(organization_id)
  and exists (
    select 1 from public.properties p
    where p.id = video_processing_jobs.property_id
      and p.organization_id = video_processing_jobs.organization_id
      and p.video_path = video_processing_jobs.input_video_path
  )
);

create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists video_processing_jobs_created_by_idx on public.video_processing_jobs(created_by);
create index if not exists video_processing_jobs_property_idx on public.video_processing_jobs(property_id);
