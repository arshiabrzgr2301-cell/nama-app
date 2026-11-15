-- Allow active members of a property's organization to manage scenes and links.
-- The uploader remains the owner_id so storage paths stay scoped to the uploading user.

drop policy if exists "Owners manage property tour scenes" on public.property_tour_scenes;
create policy "Owners manage property tour scenes"
on public.property_tour_scenes for all to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.properties p
    where p.id = property_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.organization_memberships m
          where m.organization_id = p.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.properties p
    where p.id = property_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.organization_memberships m
          where m.organization_id = p.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
  )
);

drop policy if exists "Owners manage property tour links" on public.property_tour_links;
create policy "Owners manage property tour links"
on public.property_tour_links for all to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.properties p
    where p.id = property_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.organization_memberships m
          where m.organization_id = p.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.properties p
    where p.id = property_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.organization_memberships m
          where m.organization_id = p.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
      and exists (
        select 1 from public.property_tour_scenes source_scene
        where source_scene.id = from_scene_id
          and source_scene.property_id = p.id
      )
      and exists (
        select 1 from public.property_tour_scenes target_scene
        where target_scene.id = to_scene_id
          and target_scene.property_id = p.id
      )
  )
);
