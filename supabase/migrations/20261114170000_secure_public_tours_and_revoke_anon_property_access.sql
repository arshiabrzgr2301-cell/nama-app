-- NAMA public-tour hardening
DROP POLICY IF EXISTS "Public can read published properties" ON public.properties;
DROP POLICY IF EXISTS "Public can increment published views" ON public.properties;
DROP POLICY IF EXISTS "Public can read published hotspots" ON public.hotspots;
REVOKE ALL PRIVILEGES ON TABLE public.properties FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.hotspots FROM anon;
DROP POLICY IF EXISTS "Public can read published tour panoramas" ON storage.objects;
REVOKE ALL PRIVILEGES ON TABLE public.organizations FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.organization_subscriptions FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.organization_memberships FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon;
