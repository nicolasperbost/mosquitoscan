
-- site_maps: add ownership + scope all access to owner
ALTER TABLE public.site_maps
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "public read site_maps" ON public.site_maps;
DROP POLICY IF EXISTS "authenticated insert site_maps" ON public.site_maps;
DROP POLICY IF EXISTS "authenticated update site_maps" ON public.site_maps;
DROP POLICY IF EXISTS "authenticated delete site_maps" ON public.site_maps;

REVOKE SELECT ON public.site_maps FROM anon;

CREATE POLICY "owner select site_maps" ON public.site_maps
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner insert site_maps" ON public.site_maps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update site_maps" ON public.site_maps
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete site_maps" ON public.site_maps
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- analysis_calls: restrict inserts to authenticated users
DROP POLICY IF EXISTS "public insert analysis_calls" ON public.analysis_calls;
REVOKE INSERT ON public.analysis_calls FROM anon;
GRANT INSERT ON public.analysis_calls TO authenticated;

CREATE POLICY "authenticated insert analysis_calls" ON public.analysis_calls
  FOR INSERT TO authenticated WITH CHECK (true);
