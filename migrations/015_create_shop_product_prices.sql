-- EasyTrack: Shop-specific negotiated product prices (falls back to products.unit_price when absent)
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS shop_product_prices (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price      NUMERIC     NOT NULL CHECK (price > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_product_prices_shop ON shop_product_prices(shop_id);

ALTER TABLE shop_product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_product_prices_select" ON shop_product_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "shop_product_prices_insert" ON shop_product_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shop_product_prices_update" ON shop_product_prices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "shop_product_prices_delete" ON shop_product_prices FOR DELETE TO authenticated USING (true);
