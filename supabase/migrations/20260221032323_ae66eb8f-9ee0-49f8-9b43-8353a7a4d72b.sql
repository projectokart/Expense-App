
-- Fix ALL RLS policies: they're currently RESTRICTIVE which blocks all access.
-- Need to drop and recreate as PERMISSIVE.

-- ========== MISSIONS ==========
DROP POLICY IF EXISTS "Users can create own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can view own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can update own pending missions" ON public.missions;
DROP POLICY IF EXISTS "Admins can view all missions" ON public.missions;
DROP POLICY IF EXISTS "Admins can update any mission" ON public.missions;

CREATE POLICY "Users can create own missions" ON public.missions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own missions" ON public.missions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own pending missions" ON public.missions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('pending', 'active'));

CREATE POLICY "Admins can view all missions" ON public.missions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any mission" ON public.missions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== EXPENSES ==========
DROP POLICY IF EXISTS "Users can create own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update any expense" ON public.expenses;

CREATE POLICY "Users can create own expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own expenses" ON public.expenses
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own pending expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Users can delete own pending expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can view all expenses" ON public.expenses
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any expense" ON public.expenses
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== PROFILES ==========
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== USER_ROLES ==========
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== CATEGORY_LIMITS ==========
DROP POLICY IF EXISTS "Anyone authenticated can view limits" ON public.category_limits;
DROP POLICY IF EXISTS "Admins can manage limits" ON public.category_limits;

CREATE POLICY "Anyone authenticated can view limits" ON public.category_limits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage limits" ON public.category_limits
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
