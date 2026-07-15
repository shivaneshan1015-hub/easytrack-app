-- EasyTrack: Idempotent sync for offline-queued delivery/payment confirmations
-- Run once in Supabase SQL Editor

ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS client_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_payments_client_ref
  ON bill_payments(client_ref) WHERE client_ref IS NOT NULL;

-- Applies one queued "confirm delivery" action atomically: if client_ref was
-- already applied (a prior sync attempt got interrupted after writing but
-- before the client marked it done), this is a no-op that just returns the
-- current state. Otherwise it locks the transaction row, adds the queued cash
-- amount to whatever the row's CURRENT amount_received is (not a stale
-- client-held value), and inserts the bill_payments audit row — all in one
-- transaction, so a crash mid-sync can never leave the two writes half-applied.
CREATE OR REPLACE FUNCTION sync_queued_delivery_payment(
  p_transaction_id UUID,
  p_client_ref TEXT,
  p_cash_amount NUMERIC,
  p_payment_mode TEXT,
  p_collected_at TIMESTAMPTZ
) RETURNS TABLE(amount_received NUMERIC, pending_amount NUMERIC) AS $$
DECLARE
  v_bill_amount NUMERIC;
  v_current_received NUMERIC;
  v_new_received NUMERIC;
  v_new_pending NUMERIC;
BEGIN
  IF EXISTS (SELECT 1 FROM bill_payments WHERE client_ref = p_client_ref) THEN
    RETURN QUERY
      SELECT t.amount_received, t.pending_amount FROM transactions t WHERE t.id = p_transaction_id;
    RETURN;
  END IF;

  SELECT bill_amount, amount_received INTO v_bill_amount, v_current_received
  FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction % not found', p_transaction_id;
  END IF;

  v_new_received := COALESCE(v_current_received, 0) + p_cash_amount;
  v_new_pending := GREATEST(0, v_bill_amount - v_new_received);

  UPDATE transactions
  SET status = 'delivered',
      amount_received = v_new_received,
      pending_amount = v_new_pending,
      payment_mode = p_payment_mode,
      delivered_at = p_collected_at
  WHERE id = p_transaction_id;

  IF p_cash_amount > 0 THEN
    INSERT INTO bill_payments (transaction_id, amount, payment_mode, paid_at, client_ref)
    VALUES (p_transaction_id, p_cash_amount, p_payment_mode, p_collected_at, p_client_ref);
  END IF;

  RETURN QUERY SELECT v_new_received, v_new_pending;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sync_queued_delivery_payment TO authenticated;
