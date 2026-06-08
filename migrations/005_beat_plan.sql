-- EasyTrack: Daily Beat Plan + Shop Address
-- Run once in Supabase SQL Editor

ALTER TABLE shops ADD COLUMN IF NOT EXISTS address TEXT;

CREATE TABLE IF NOT EXISTS beat_plans (
  id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID     NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  employee_name TEXT     NOT NULL,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_beat_plans_employee ON beat_plans(employee_name);
CREATE INDEX IF NOT EXISTS idx_beat_plans_day      ON beat_plans(day_of_week);

ALTER TABLE beat_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beat_plans_select" ON beat_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "beat_plans_insert" ON beat_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "beat_plans_delete" ON beat_plans FOR DELETE TO authenticated USING (true);
CREATE POLICY "beat_plans_update" ON beat_plans FOR UPDATE TO authenticated USING (true);
