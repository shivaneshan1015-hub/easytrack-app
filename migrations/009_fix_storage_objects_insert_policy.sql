-- EasyTrack: Fix file uploads blocked by RLS on storage.objects
-- Run once in Supabase SQL Editor.
--
-- storage.objects has RLS enabled with zero policies, so every authenticated
-- upload (agent expense receipts, owner invoice logo/letterhead) was silently
-- rejected with "new row violates row-level security policy". This adds a
-- permissive INSERT policy for the two app-owned buckets, matching the
-- existing convention for agent_expenses (see 008_fix_agent_expenses_insert_policy.sql).

CREATE POLICY "app_buckets_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('invoice-assets', 'expense-receipts'));
