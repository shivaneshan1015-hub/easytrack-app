-- EasyTrack Migration 018: Add Batch & Expiry tracking, POD signature, and Van Load reconciliation

-- 1. Add Batch & Expiry tracking columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- 2. Add POD Signature URL to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pod_signature_url TEXT;

-- 3. Create van_loads table for delivery van stock tracking & reconciliation
CREATE TABLE IF NOT EXISTS van_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  loaded_qty INT NOT NULL DEFAULT 0,
  sold_qty INT NOT NULL DEFAULT 0,
  returned_qty INT NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active', -- 'active' | 'reconciled'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for van_loads
ALTER TABLE van_loads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "van_loads_all_authenticated" ON van_loads FOR ALL TO authenticated USING (true) WITH CHECK (true);
