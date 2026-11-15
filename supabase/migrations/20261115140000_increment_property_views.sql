create or replace function public.increment_property_views(property_uuid uuid)
returns void
language sql
security invoker
set search_path = ''
as $function$
  update public.properties
  set views = views + 1,
      updated_at = now()
  where id = property_uuid
    and status = 'published';
$function$;

revoke all on function public.increment_property_views(uuid) from public, anon;
grant execute on function public.increment_property_views(uuid) to authenticated, service_role;
