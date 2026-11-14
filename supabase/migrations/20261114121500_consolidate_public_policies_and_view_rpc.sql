-- Remove duplicate public policies, optimize owner RLS predicates and restrict view-count RPC to anonymous public tours.
drop policy if exists "Anyone can view published properties" on public.properties;
drop policy if exists "Anyone can view hotspots for published properties" on public.hotspots;

drop policy if exists "Public can read published properties" on public.properties;
create policy "Public can read published properties"
on public.properties for select to anon
using (status = 'published');

drop policy if exists "Public can read published hotspots" on public.hotspots;
create policy "Public can read published hotspots"
on public.hotspots for select to anon
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id and p.status = 'published'
  )
);

drop policy if exists "Owners manage their properties" on public.properties;
create policy "Owners manage their properties" on public.properties
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Owners manage their hotspots" on public.hotspots;
create policy "Owners manage their hotspots" on public.hotspots
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on function public.increment_property_views(uuid) from public;
revoke execute on function public.increment_property_views(uuid) from authenticated;
grant execute on function public.increment_property_views(uuid) to anon;
