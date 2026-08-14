-- EasyTrack: granular, owner-editable dashboard permissions
-- Applied automatically by scripts/run-migrations.js on next deploy.
--
-- Replaces the fixed 'dispatcher' permission bundle with a per-user permission
-- set the owner assigns at invite time and can edit anytime. 'owner' and 'agent'
-- roles are unaffected — has_permission() always returns true for them, matching
-- their existing (unrestricted / self-service) access exactly.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'agent') THEN true
    ELSE perm = ANY(COALESCE((SELECT permissions FROM profiles WHERE id = auth.uid()), '{}'))
  END;
$$;
