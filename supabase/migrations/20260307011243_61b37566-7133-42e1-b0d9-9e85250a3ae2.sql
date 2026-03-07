
-- Add number_of_people column to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS number_of_people integer NOT NULL DEFAULT 1;

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update own notifications (mark read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can insert notifications
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
