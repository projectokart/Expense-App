

## Problem

The screenshot shows: **"new row violates row-level security policy for table 'missions'"** when clicking FINISH.

## Root Cause

All RLS policies on the `missions` table are **RESTRICTIVE** (`Permissive: No`). In PostgreSQL:
- PERMISSIVE policies = OR logic (any one passing is enough)
- RESTRICTIVE policies = AND logic (ALL must pass)

The user UPDATE policy has:
```sql
USING ((user_id = auth.uid()) AND (status = ANY (ARRAY['pending', 'active'])))
```

When no explicit `WITH CHECK` is set, PostgreSQL reuses `USING` as `WITH CHECK`. After the update sets `status = 'completed'`, the NEW row fails this check because `'completed'` is not in `['pending', 'active']`.

Even for admins: since both UPDATE policies are restrictive, BOTH must pass -- the admin policy passes but the user policy fails on the new row.

## Fix

Drop the two restrictive UPDATE policies on `missions` and recreate them as **PERMISSIVE** with a proper `WITH CHECK` clause:

1. **Users can update own missions** (PERMISSIVE): `USING` checks ownership + active/pending status, `WITH CHECK (user_id = auth.uid())` allows the status change.
2. **Admins can update any mission** (PERMISSIVE): unchanged logic, just permissive.

Same issue exists on other tables (expenses, settlements, etc.) but those aren't causing errors right now. We'll fix missions first.

### SQL Migration

```sql
DROP POLICY IF EXISTS "Users can update own missions" ON public.missions;
DROP POLICY IF EXISTS "Admins can update any mission" ON public.missions;

CREATE POLICY "Users can update own missions" ON public.missions
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'active'::text])))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update any mission" ON public.missions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

No code changes needed -- only the database policies.

