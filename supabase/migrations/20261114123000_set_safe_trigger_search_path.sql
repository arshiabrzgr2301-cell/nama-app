create or replace function public.bump_property_view_count()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.views := old.views + 1;
  return new;
end;
$$;
