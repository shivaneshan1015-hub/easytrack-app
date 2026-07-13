-- EasyTrack: Fix agent expense submission blocked by RLS
-- Run once in Supabase SQL Editor.
--
-- agent_expenses has no agent_id/user_id column tying rows to auth.uid(),
-- so any RLS INSERT policy scoped to auth.uid() is impossible to satisfy —
-- agents got "new row violates row-level security policy" on every submit.
-- This adds a permissive policy allowing any authenticated user to insert,
-- matching the existing convention for beat_plans (see 005_beat_plan.sql).

ALTER TABLE agent_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_expenses_insert_authenticated" ON agent_expenses
  FOR INSERT TO authenticated WITH CHECK (true);
