do $$
begin
  if not exists (select 1 from pg_constraint where conname='property_tour_links_yaw_range') then
    alter table public.property_tour_links add constraint property_tour_links_yaw_range check (yaw >= -180 and yaw <= 180);
  end if;
  if not exists (select 1 from pg_constraint where conname='property_tour_links_pitch_range') then
    alter table public.property_tour_links add constraint property_tour_links_pitch_range check (pitch >= -90 and pitch <= 90);
  end if;
  if not exists (select 1 from pg_constraint where conname='property_tour_links_label_length') then
    alter table public.property_tour_links add constraint property_tour_links_label_length check (char_length(label) between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='property_tour_links_from_property_fk') then
    alter table public.property_tour_links add constraint property_tour_links_from_property_fk
      foreign key (property_id, from_scene_id)
      references public.property_tour_scenes(property_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='property_tour_links_to_property_fk') then
    alter table public.property_tour_links add constraint property_tour_links_to_property_fk
      foreign key (property_id, to_scene_id)
      references public.property_tour_scenes(property_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='property_tour_scenes_sort_order_nonnegative') then
    alter table public.property_tour_scenes add constraint property_tour_scenes_sort_order_nonnegative check (sort_order >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='property_tour_scenes_title_length') then
    alter table public.property_tour_scenes add constraint property_tour_scenes_title_length check (char_length(title) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname='property_tour_scenes_media_path_owner') then
    alter table public.property_tour_scenes add constraint property_tour_scenes_media_path_owner
      check (panorama_path = 'pending' or panorama_path like owner_id::text || '/' || property_id::text || '/scenes/%');
  end if;
end $$;