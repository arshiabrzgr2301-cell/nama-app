drop policy if exists "Organization members read property tour scenes" on public.property_tour_scenes;
drop policy if exists "Public can read scenes for published properties" on public.property_tour_scenes;
create policy "Read published tours or organization members"
on public.property_tour_scenes for select to anon, authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_scenes.property_id and (p.status = 'published' or private.nama_is_active_member(p.organization_id))));

drop policy if exists "Organization members read property tour links" on public.property_tour_links;
drop policy if exists "Public can read links for published properties" on public.property_tour_links;
create policy "Read published tours or organization members"
on public.property_tour_links for select to anon, authenticated
using (exists (select 1 from public.properties p where p.id = property_tour_links.property_id and (p.status = 'published' or private.nama_is_active_member(p.organization_id))));

create index if not exists property_tour_links_property_idx on public.property_tour_links(property_id);
create index if not exists property_tour_links_to_scene_idx on public.property_tour_links(to_scene_id);
create index if not exists property_tour_links_owner_idx on public.property_tour_links(owner_id);
create index if not exists property_tour_scenes_owner_idx on public.property_tour_scenes(owner_id);
