-- EasyTrack: Per-bill payment history (individual payment events with date/mode)
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bill_payments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount         NUMERIC     NOT NULL CHECK (amount > 0),
  payment_mode   TEXT        NOT NULL DEFAULT 'Cash',
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_transaction ON bill_payments(transaction_id);

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_payments_select" ON bill_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "bill_payments_insert" ON bill_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bill_payments_update" ON bill_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "bill_payments_delete" ON bill_payments FOR DELETE TO authenticated USING (true);
