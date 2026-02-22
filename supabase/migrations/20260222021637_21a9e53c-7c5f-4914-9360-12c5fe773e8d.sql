-- Make expense-receipts bucket private
UPDATE storage.buckets SET public = false WHERE id = 'expense-receipts';

-- Make settlement-proofs bucket private  
UPDATE storage.buckets SET public = false WHERE id = 'settlement-proofs';

-- Drop overly permissive policies if they exist
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

-- Create proper authenticated viewing policies for expense-receipts
CREATE POLICY "Users can view own receipts" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'expense-receipts' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all receipts" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'expense-receipts' AND public.has_role(auth.uid(), 'admin')
);

-- Create proper policies for settlement-proofs
CREATE POLICY "Admins can view all settlement proofs" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'settlement-proofs' AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view own settlement proofs" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'settlement-proofs' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Fix overly permissive RLS policies on expenses table
DROP POLICY IF EXISTS "Enable all for admins" ON public.expenses;
DROP POLICY IF EXISTS "Public Select Expenses" ON public.expenses;
DROP POLICY IF EXISTS "Public Insert Expenses" ON public.expenses;
DROP POLICY IF EXISTS "Public Update Expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admin Full Access" ON public.expenses;

-- Fix overly permissive RLS policies on profiles table
DROP POLICY IF EXISTS "Enable read for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public Select Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public Update Profiles" ON public.profiles;

-- Fix overly permissive RLS policies on missions table
DROP POLICY IF EXISTS "Admins can do everything on missions" ON public.missions;

-- Fix overly permissive RLS policies on settlements table
DROP POLICY IF EXISTS "Settlements full access" ON public.settlements;
DROP POLICY IF EXISTS "Public All Settlements" ON public.settlements;

-- Fix overly permissive RLS policies on user_roles table
DROP POLICY IF EXISTS "Public Select Roles" ON public.user_roles;