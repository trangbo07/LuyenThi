-- OPTIONAL: run if admins cannot close/reopen rooms (RLS blocks UPDATE on competitions).
-- Requires public.profiles with a role column.

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitions_select_authenticated" ON public.competitions;
CREATE POLICY "competitions_select_authenticated" ON public.competitions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "competitions_insert_admin" ON public.competitions;
CREATE POLICY "competitions_insert_admin" ON public.competitions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "competitions_update_admin" ON public.competitions;
CREATE POLICY "competitions_update_admin" ON public.competitions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
