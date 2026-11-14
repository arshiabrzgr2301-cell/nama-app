DROP POLICY IF EXISTS "nama_profile_read_self_or_org" ON public.profiles;

CREATE POLICY "nama_profile_read_self_or_active_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships mine
    JOIN public.organization_memberships theirs
      ON theirs.organization_id = mine.organization_id
    WHERE mine.user_id = (SELECT auth.uid())
      AND theirs.user_id = profiles.user_id
      AND private.nama_is_active_member(mine.organization_id)
      AND theirs.status = 'active'
  )
);
