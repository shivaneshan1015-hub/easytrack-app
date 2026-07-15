-- EasyTrack: Add SELECT policy on storage.objects for app-owned buckets
-- Run once in Supabase SQL Editor.
--
-- 009_fix_storage_objects_insert_policy.sql added INSERT only, so uploads work
-- but there was never a SELECT policy — viewing/downloading a file (e.g. the
-- owner dashboard's expense receipt "View" link) only works today if the
-- bucket happens to be marked public. Add SELECT so it works either way.

CREATE POLICY "app_buckets_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('invoice-assets', 'expense-receipts'));
