-- Run in Supabase SQL Editor

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 10;

COMMENT ON COLUMN products.low_stock_threshold IS 'Show alert when inventory_stock drops to or below this value (0 = no alert)';
