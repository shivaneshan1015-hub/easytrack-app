-- EasyTrack: Fix leave approval/rejection being silently blocked by RLS
-- Run once in Supabase SQL Editor.
--
-- Leave requests used to auto-approve themselves (the agent updating their
-- own row), so the existing UPDATE policy on `leaves` only allows a user to
-- update rows where they are the agent. Since leave requests now start as
-- 'pending' and require the owner to approve/reject someone else's request,
-- that update is silently blocked by RLS (Postgrest still returns 204, but
-- 0 rows actually change).
--
-- This adds a permissive policy allowing any authenticated user to update
-- any row in `leaves`, matching the existing convention for beat_plans
-- (see 005_beat_plan.sql).

ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaves_update_authenticated" ON leaves
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
