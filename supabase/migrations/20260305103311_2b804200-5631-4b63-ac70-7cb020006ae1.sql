
-- Fix: Change all RESTRICTIVE policies to PERMISSIVE for missions table
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can update own pending missions" ON public.missions;
DROP POLICY IF EXISTS "Admins can update any mission" ON public.missions;
DROP POLICY IF EXISTS "Users can create own missions" ON public.missions;
DROP POLICY IF EXISTS "Admins can view all missions" ON public.missions;
DROP POLICY IF EXISTS "Users can create their own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can view their own missions" ON public.missions;

-- Recreate as PERMISSIVE
CREATE POLICY "Users can view own missions" ON public.missions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all missions" ON public.missions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own missions" ON public.missions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own missions" ON public.missions FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status IN ('pending', 'active'));
CREATE POLICY "Admins can update any mission" ON public.missions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix: Change all RESTRICTIVE policies to PERMISSIVE for expenses table + add admin delete
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update any expense" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;

CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all expenses" ON public.expenses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own pending expenses" ON public.expenses FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Admins can update any expense" ON public.expenses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own pending expenses" ON public.expenses FOR DELETE TO authenticated USING (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Admins can delete any expense" ON public.expenses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix profiles policies to PERMISSIVE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix user_roles policies to PERMISSIVE
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix category_limits policies to PERMISSIVE
DROP POLICY IF EXISTS "Anyone authenticated can view limits" ON public.category_limits;
DROP POLICY IF EXISTS "Admins can manage limits" ON public.category_limits;

CREATE POLICY "Anyone authenticated can view limits" ON public.category_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage limits" ON public.category_limits FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix settlements policies to PERMISSIVE
DROP POLICY IF EXISTS "Users can view own settlements" ON public.settlements;
DROP POLICY IF EXISTS "Admins can view all settlements" ON public.settlements;
DROP POLICY IF EXISTS "Admins can insert settlements" ON public.settlements;
DROP POLICY IF EXISTS "Admins can update settlements" ON public.settlements;
DROP POLICY IF EXISTS "Admins can delete settlements" ON public.settlements;
DROP POLICY IF EXISTS "Users can update own settlement acknowledgment" ON public.settlements;

CREATE POLICY "Users can view own settlements" ON public.settlements FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all settlements" ON public.settlements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert settlements" ON public.settlements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settlements" ON public.settlements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete settlements" ON public.settlements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own settlement acknowledgment" ON public.settlements FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Fix mission_photos policies to PERMISSIVE
DROP POLICY IF EXISTS "Users can view own mission photos" ON public.mission_photos;
DROP POLICY IF EXISTS "Admins can view all mission photos" ON public.mission_photos;
DROP POLICY IF EXISTS "Users can insert own mission photos" ON public.mission_photos;
DROP POLICY IF EXISTS "Users can delete own mission photos" ON public.mission_photos;

CREATE POLICY "Users can view own mission photos" ON public.mission_photos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all mission photos" ON public.mission_photos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own mission photos" ON public.mission_photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own mission photos" ON public.mission_photos FOR DELETE TO authenticated USING (user_id = auth.uid());
