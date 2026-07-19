
DROP POLICY IF EXISTS "public insert site_maps" ON public.site_maps;
DROP POLICY IF EXISTS "public update site_maps" ON public.site_maps;
DROP POLICY IF EXISTS "public delete site_maps" ON public.site_maps;

REVOKE INSERT, UPDATE, DELETE ON public.site_maps FROM anon;
GRANT INSERT, UPDATE, DELETE ON public.site_maps TO authenticated;

CREATE POLICY "authenticated insert site_maps" ON public.site_maps
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update site_maps" ON public.site_maps
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated delete site_maps" ON public.site_maps
  FOR DELETE TO authenticated USING (true);
