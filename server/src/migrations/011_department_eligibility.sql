-- ============================================================================
-- Church Website — Migration 011: department eligibility & recruitment rules
-- ============================================================================
-- Phase 2 — purely additive. Existing departments keep working exactly as they
-- do today: every new column defaults to behaviour-preserving values (age rules
-- disabled, PUBLIC visibility, enrollment open, no join approval), so no current
-- department becomes restricted or hidden by this migration.
--
-- Members supply a birth date (Ethiopian + Gregorian); the application derives
-- age via src/utils/ethiopianCalendar.js. Departments may configure an optional
-- inclusive age range. Backend services (Phase 3/4) enforce these rules — the
-- React UI never trusts itself. Existing memberships are preserved and flagged
-- for review when a member ages out; nobody is auto-removed.

ALTER TABLE departments ADD COLUMN IF NOT EXISTS min_age SMALLINT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS max_age SMALLINT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS eligibility_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE departments ADD COLUMN IF NOT EXISTS enrollment_open BOOLEAN NOT NULL DEFAULT TRUE;

-- Guarded CHECK constraints: added only when absent so the migration converges
-- cleanly on fresh installs and legacy deployments alike.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_min_age_range') THEN
        ALTER TABLE departments ADD CONSTRAINT departments_min_age_range
            CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 120));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_max_age_range') THEN
        ALTER TABLE departments ADD CONSTRAINT departments_max_age_range
            CHECK (max_age IS NULL OR (max_age >= 0 AND max_age <= 120));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_age_order') THEN
        ALTER TABLE departments ADD CONSTRAINT departments_age_order
            CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_visibility') THEN
        ALTER TABLE departments ADD CONSTRAINT departments_visibility
            CHECK (visibility IN ('PUBLIC', 'PRIVATE'));
    END IF;
END $$;

-- Preserve memberships when someone ages out; the application flags the row for
-- staff review instead of removing it. Additive with a safe default.
ALTER TABLE department_members ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_department_members_review
    ON department_members(flagged_for_review) WHERE flagged_for_review = TRUE;

-- The eligibility permission is declared in the application catalog but must
-- also exist as a real, immutable identifier so custom roles can reference it
-- without running the seed script first.
INSERT INTO permissions (code, name, description) VALUES
    ('departments.eligibility.manage', 'Manage department eligibility', 'Configure department eligibility, age ranges, and recruitment rules.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'departments.eligibility.manage'
WHERE r.code IN ('SYSTEM_OWNER', 'ADMIN', 'PASTOR', 'LEADER')
ON CONFLICT DO NOTHING;
