-- Keep public tour access column-scoped; never expose account ownership metadata.
revoke select on table public.properties from anon;
grant select (id, title, city, address, description, panorama_path, status) on table public.properties to anon;

revoke select on table public.hotspots from anon;
grant select (id, property_id, yaw, pitch, title, description) on table public.hotspots to anon;
