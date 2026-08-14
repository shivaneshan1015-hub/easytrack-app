-- EasyTrack: gate dashboard sections behind public.has_permission() (see 016).
-- Reconnaissance (scripts/recon-rls.js, 2026-08-15) confirmed live policy state
-- before writing this — several policies below replace ones that existed live
-- but were never captured in an earlier migration file.
--
-- NOT touched here (intentionally permissive / out of scope, per plan):
--   shops, products, employees, transaction_items (RLS off, shared operational data)
--   transactions (already blanket-permissive to any authenticated user)
--   profiles SELECT (already blanket-readable by any authenticated user — tightening
--     this risks breaking agent/employee dropdowns elsewhere; not required to gate
--     the 7 dashboard sections, since invite/delete/permission-editing already run
--     through owner-only service-role API routes regardless of this policy)
--   van_loads, app_settings, form_settings (RLS on, zero policies — pre-existing gap,
--     unrelated to this feature)
--   shop_visits (table does not exist in the live DB at all — pages/api/agent/check-in.js
--     is writing to a nonexistent table; separate pre-existing bug, not fixed here)

-- ── agent_expenses (finance) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "agent_expenses_select_authenticated" ON agent_expenses;
DROP POLICY IF EXISTS "agent_expenses_update_authenticated" ON agent_expenses;

CREATE POLICY "agent_expenses_select_permission" ON agent_expenses
  FOR SELECT TO authenticated USING (public.has_permission('finance'));

CREATE POLICY "agent_expenses_update_permission" ON agent_expenses
  FOR UPDATE TO authenticated USING (public.has_permission('finance')) WITH CHECK (public.has_permission('finance'));
-- INSERT policy (agent_expenses_insert_authenticated, WITH CHECK true) is unchanged —
-- agents must still be able to submit expenses regardless of permission.

-- ── returns / return_items (finance) ────────────────────────────────────────
-- Dedupe: two overlapping INSERT/SELECT policies existed live on `returns`
-- (returns_insert/returns_select from 011, plus later duplicates never tracked
-- in a migration) doing the same thing — collapse to one canonical set.
DROP POLICY IF EXISTS "returns_select" ON returns;
DROP POLICY IF EXISTS "authenticated can select returns" ON returns;
DROP POLICY IF EXISTS "returns_update" ON returns;
DROP POLICY IF EXISTS "returns_delete" ON returns;
DROP POLICY IF EXISTS "authenticated can insert returns" ON returns;

CREATE POLICY "returns_select_permission" ON returns
  FOR SELECT TO authenticated USING (public.has_permission('finance'));
CREATE POLICY "returns_update_permission" ON returns
  FOR UPDATE TO authenticated USING (public.has_permission('finance')) WITH CHECK (public.has_permission('finance'));
CREATE POLICY "returns_delete_permission" ON returns
  FOR DELETE TO authenticated USING (public.has_permission('finance'));
-- returns_insert (WITH CHECK true) stays — agents submit returns freely.

DROP POLICY IF EXISTS "authenticated can select return_items" ON return_items;

CREATE POLICY "return_items_select_permission" ON return_items
  FOR SELECT TO authenticated USING (public.has_permission('finance'));
-- authenticated can insert return_items (WITH CHECK true) stays.

-- ── agent_targets (finance) — currently RLS-on with zero policies, i.e. fully
-- blocked for both dashboard and agent.js today; this is its first real policy set.
CREATE POLICY "agent_targets_all_permission" ON agent_targets
  FOR ALL TO authenticated USING (public.has_permission('finance')) WITH CHECK (public.has_permission('finance'));

-- ── bill_payments (dispatch) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "bill_payments_select" ON bill_payments;
DROP POLICY IF EXISTS "bill_payments_update" ON bill_payments;
DROP POLICY IF EXISTS "bill_payments_delete" ON bill_payments;

CREATE POLICY "bill_payments_select_permission" ON bill_payments
  FOR SELECT TO authenticated USING (public.has_permission('dispatch'));
CREATE POLICY "bill_payments_update_permission" ON bill_payments
  FOR UPDATE TO authenticated USING (public.has_permission('dispatch')) WITH CHECK (public.has_permission('dispatch'));
CREATE POLICY "bill_payments_delete_permission" ON bill_payments
  FOR DELETE TO authenticated USING (public.has_permission('dispatch'));
-- bill_payments_insert (WITH CHECK true) stays — also written by the
-- sync_queued_delivery_payment SECURITY DEFINER function, unaffected either way.

-- ── shop_product_prices (shops_pricing for edits; stays open for read/first-set) ──
DROP POLICY IF EXISTS "shop_product_prices_update" ON shop_product_prices;
DROP POLICY IF EXISTS "shop_product_prices_delete" ON shop_product_prices;

CREATE POLICY "shop_product_prices_update_permission" ON shop_product_prices
  FOR UPDATE TO authenticated USING (public.has_permission('shops_pricing')) WITH CHECK (public.has_permission('shops_pricing'));
CREATE POLICY "shop_product_prices_delete_permission" ON shop_product_prices
  FOR DELETE TO authenticated USING (public.has_permission('shops_pricing'));
-- SELECT and INSERT stay permissive — agent.js reads prices and sets the first
-- negotiated price at order time; only re-editing a locked price is gated.

-- ── beat_plans (routes for edits; stays open for read) ──────────────────────
DROP POLICY IF EXISTS "beat_plans_insert" ON beat_plans;
DROP POLICY IF EXISTS "beat_plans_update" ON beat_plans;
DROP POLICY IF EXISTS "beat_plans_delete" ON beat_plans;

CREATE POLICY "beat_plans_insert_permission" ON beat_plans
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('routes'));
CREATE POLICY "beat_plans_update_permission" ON beat_plans
  FOR UPDATE TO authenticated USING (public.has_permission('routes')) WITH CHECK (public.has_permission('routes'));
CREATE POLICY "beat_plans_delete_permission" ON beat_plans
  FOR DELETE TO authenticated USING (public.has_permission('routes'));
-- beat_plans_select stays permissive — agents need to see their own assigned plan.

-- ── leaves (settings for approve/reject; agent self-service untouched) ──────
-- "Agents can manage own leaves" (auth.uid() = agent_id) and "Owners can view all
-- leaves" (role = 'owner') are pre-existing live policies, left as-is. Only the
-- blanket "leaves_update_authenticated" (USING true — added by migration 006 to
-- unblock owner approvals, but too broad: let ANY authenticated user approve/reject
-- ANY leave) is replaced with a properly scoped one.
DROP POLICY IF EXISTS "leaves_update_authenticated" ON leaves;

CREATE POLICY "leaves_update_permission" ON leaves
  FOR UPDATE TO authenticated
  USING (public.has_permission('settings') OR auth.uid() = agent_id)
  WITH CHECK (public.has_permission('settings') OR auth.uid() = agent_id);

-- ── attendance (settings) — currently RLS-on with zero policies, i.e. fully
-- blocked today outside the service-role write path in mark-present.js; first
-- real policy set (SELECT gated, INSERT permissive so any direct agent.js write
-- keeps working the same way it does today).
CREATE POLICY "attendance_select_permission" ON attendance
  FOR SELECT TO authenticated USING (public.has_permission('settings'));
CREATE POLICY "attendance_insert_authenticated" ON attendance
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── invoice_settings (settings) — existing "Owners manage own settings" (owner_id
-- scoped) stays; add a supplementary policy so settings-permission holders can
-- also manage it, without narrowing the owner's own existing access.
CREATE POLICY "invoice_settings_permission" ON invoice_settings
  FOR ALL TO authenticated USING (public.has_permission('settings')) WITH CHECK (public.has_permission('settings'));
