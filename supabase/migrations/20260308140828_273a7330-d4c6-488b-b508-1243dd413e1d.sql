
DROP POLICY IF EXISTS "Users can update own missions" ON public.missions;
DROP POLICY IF EXISTS "Admins can update any mission" ON public.missions;

CREATE POLICY "Users can update own missions" ON public.missions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'active'::text])))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update any mission" ON public.missions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
