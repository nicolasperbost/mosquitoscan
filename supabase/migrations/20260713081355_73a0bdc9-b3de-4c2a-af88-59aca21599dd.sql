-- analysis_calls: journal des appels à l'analyse visuelle
CREATE TABLE public.analysis_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.analysis_calls TO anon, authenticated;
GRANT ALL ON public.analysis_calls TO service_role;
ALTER TABLE public.analysis_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read analysis_calls" ON public.analysis_calls FOR SELECT USING (true);
CREATE POLICY "public insert analysis_calls" ON public.analysis_calls FOR INSERT WITH CHECK (true);

-- site_maps: plans de site partagés
CREATE TABLE public.site_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('indoor_plan','outdoor_geo')),
  background_image_url TEXT,
  sensors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_maps TO anon, authenticated;
GRANT ALL ON public.site_maps TO service_role;
ALTER TABLE public.site_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read site_maps" ON public.site_maps FOR SELECT USING (true);
CREATE POLICY "public insert site_maps" ON public.site_maps FOR INSERT WITH CHECK (true);
CREATE POLICY "public update site_maps" ON public.site_maps FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete site_maps" ON public.site_maps FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_site_maps_updated_at BEFORE UPDATE ON public.site_maps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();