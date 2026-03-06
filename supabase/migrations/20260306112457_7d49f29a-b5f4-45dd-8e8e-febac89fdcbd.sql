-- Allow admins to delete missions
CREATE POLICY "Admins can delete any mission" ON public.missions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));