-- EasyTrack: Fix agent expenses invisible to both agents and owner
-- Run once in Supabase SQL Editor.
--
-- Migration 008 added an INSERT policy for agent_expenses but left SELECT and
-- UPDATE ungoverned. With RLS enabled and no SELECT policy, every read
-- (agent's own expense history in agent.js, owner's approval queue in
-- dashboard.js) silently returns zero rows instead of erroring. No UPDATE
-- policy means the owner's approve/reject buttons silently no-op. This adds
-- permissive SELECT/UPDATE policies matching the existing INSERT convention.

CREATE POLICY "agent_expenses_select_authenticated" ON agent_expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "agent_expenses_update_authenticated" ON agent_expenses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
