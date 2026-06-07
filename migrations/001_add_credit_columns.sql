-- Run this in the Supabase SQL editor to add credit tracking to shops

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_used  NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN shops.credit_limit IS 'Maximum outstanding credit allowed (0 = no limit)';
COMMENT ON COLUMN shops.credit_used  IS 'Cached outstanding balance — kept in sync by the app';
