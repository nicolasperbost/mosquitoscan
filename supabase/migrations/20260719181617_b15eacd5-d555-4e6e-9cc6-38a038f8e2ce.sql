
ALTER TABLE public.analysis_calls
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "authenticated insert analysis_calls" ON public.analysis_calls;

CREATE POLICY "owner insert analysis_calls" ON public.analysis_calls
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
