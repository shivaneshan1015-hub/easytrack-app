-- EasyTrack: Add receipt photo support to agent_expenses
-- Run once in Supabase SQL Editor.

ALTER TABLE agent_expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
