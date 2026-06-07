-- EasyTrack: Returns & Damage tracking
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS returns (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        NOT NULL REFERENCES transactions(id),
  shop_id        UUID        NOT NULL REFERENCES shops(id),
  agent_name     TEXT        NOT NULL,
  return_type    TEXT        NOT NULL CHECK (return_type IN ('return', 'damage')),
  reason         TEXT,
  total_credit   NUMERIC     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_items (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    UUID    NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id   UUID    REFERENCES products(id),
  product_name TEXT    NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_returns_transaction ON returns(transaction_id);
CREATE INDEX IF NOT EXISTS idx_returns_shop        ON returns(shop_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
