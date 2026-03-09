
-- Fund entries table: tracks money received by admin from company
CREATE TABLE public.fund_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fund_entries ENABLE ROW LEVEL SECURITY;

-- Only admins can manage fund entries
CREATE POLICY "Admins can do everything on fund_entries" ON public.fund_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_fund_entries_updated_at
  BEFORE UPDATE ON public.fund_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
