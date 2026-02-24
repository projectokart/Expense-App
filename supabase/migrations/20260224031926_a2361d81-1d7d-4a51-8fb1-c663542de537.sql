-- Drop the overly permissive delete policy on expenses
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.expenses;