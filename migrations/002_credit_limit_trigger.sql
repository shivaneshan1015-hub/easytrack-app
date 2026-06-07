-- ============================================================
-- EasyTrack: Database-level credit limit enforcement
-- Run in Supabase SQL Editor (once).
-- ============================================================

-- 1. Trigger function ----------------------------------------
CREATE OR REPLACE FUNCTION enforce_shop_credit_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_credit_limit  NUMERIC;
  v_credit_used   NUMERIC;
  v_shop_name     TEXT;
  v_available     NUMERIC;
BEGIN
  -- Nothing to check if bill_amount is absent or zero
  IF NEW.bill_amount IS NULL OR NEW.bill_amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Fetch the shop's credit limit and display name
  SELECT credit_limit, name
    INTO v_credit_limit, v_shop_name
    FROM shops
   WHERE id = NEW.shop_id;

  -- credit_limit = 0 (or NULL) means no cap → allow
  IF v_credit_limit IS NULL OR v_credit_limit <= 0 THEN
    RETURN NEW;
  END IF;

  -- Sum bill_amount of every open (non-delivered) order for this shop.
  -- This runs inside the same transaction as the INSERT, so it is
  -- perfectly consistent — no race condition is possible.
  SELECT COALESCE(SUM(bill_amount), 0)
    INTO v_credit_used
    FROM transactions
   WHERE shop_id = NEW.shop_id
     AND status <> 'delivered';

  v_available := GREATEST(0, v_credit_limit - v_credit_used);

  -- Block the INSERT if the new order would breach the cap
  IF v_credit_used + NEW.bill_amount > v_credit_limit THEN
    RAISE EXCEPTION 'credit_limit_exceeded'
      USING HINT = format(
        '%s has a credit limit of ₹%s. '
        'Outstanding: ₹%s. '
        'This order: ₹%s. '
        'Available: ₹%s.',
        v_shop_name,
        v_credit_limit::BIGINT,
        v_credit_used::BIGINT,
        NEW.bill_amount::BIGINT,
        v_available::BIGINT
      );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger to transactions table -------------------
-- Drop first so re-running this file is idempotent.
DROP TRIGGER IF EXISTS trg_enforce_credit_limit ON transactions;

CREATE TRIGGER trg_enforce_credit_limit
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_shop_credit_limit();

-- ============================================================
-- How to verify after running:
--
--   SELECT trigger_name, event_manipulation, action_timing
--     FROM information_schema.triggers
--    WHERE event_object_table = 'transactions';
--
-- Expected row:
--   trg_enforce_credit_limit | INSERT | BEFORE
-- ============================================================
