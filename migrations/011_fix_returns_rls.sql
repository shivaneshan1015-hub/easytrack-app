-- EasyTrack: Fix RLS gap — returns/return_items created without RLS (Supabase security alert)
-- Run once in Supabase SQL Editor

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "returns_select" ON returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "returns_insert" ON returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "returns_update" ON returns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "returns_delete" ON returns FOR DELETE TO authenticated USING (true);

CREATE POLICY "return_items_select" ON return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "return_items_insert" ON return_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "return_items_update" ON return_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "return_items_delete" ON return_items FOR DELETE TO authenticated USING (true);
