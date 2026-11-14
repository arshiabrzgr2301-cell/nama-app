-- Count public views through a column-scoped update; no exposed SECURITY DEFINER RPC.
drop function if exists public.increment_property_views(uuid);
drop function if exists public.bump_property_view_count() cascade;

create or replace function public.bump_property_view_count()
returns trigger
language plpgsql
as $$
begin
  new.views := old.views + 1;
  return new;
end;
$$;

drop trigger if exists bump_property_views on public.properties;
create trigger bump_property_views
before update of views on public.properties
for each row execute function public.bump_property_view_count();

revoke update on table public.properties from anon;
grant update (views) on table public.properties to anon;

drop policy if exists "Public can increment published views" on public.properties;
create policy "Public can increment published views"
on public.properties for update to anon
using (status = 'published')
with check (status = 'published');
