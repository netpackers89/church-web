-- Privileged-role hardening.  This is additive: existing role assignments
-- remain in user_roles, while this table preserves their grant/revocation
-- history for audit and recovery.

CREATE TABLE IF NOT EXISTS user_role_assignment_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    reason VARCHAR(500),
    scope_type VARCHAR(40),
    scope_id BIGINT,
    CONSTRAINT user_role_assignment_history_reason_length
        CHECK (reason IS NULL OR length(btrim(reason)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignment_history_active_unique
    ON user_role_assignment_history(user_id, role_id)
    WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS user_role_assignment_history_user_idx
    ON user_role_assignment_history(user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS user_role_assignment_history_role_idx
    ON user_role_assignment_history(role_id, granted_at DESC);

-- Backfill currently active grants exactly once.  Older source migrations
-- called the timestamp assigned_at while production uses created_at, so select
-- the existing column dynamically rather than assuming either spelling.
DO $$
DECLARE assignment_timestamp_column TEXT;
BEGIN
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'created_at') THEN 'created_at'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'assigned_at') THEN 'assigned_at'
    END INTO assignment_timestamp_column;

    EXECUTE format(
        'INSERT INTO user_role_assignment_history (user_id, role_id, granted_by, granted_at, reason)
         SELECT ur.user_id, ur.role_id, ur.assigned_by, COALESCE(ur.%I, NOW()), ''Historic assignment imported''
         FROM user_roles ur
         ON CONFLICT (user_id, role_id) WHERE revoked_at IS NULL DO NOTHING',
        assignment_timestamp_column
    );
END $$;

INSERT INTO roles (code, name, description, is_system)
VALUES ('SYSTEM_OWNER', 'System owner', 'Protected highest-privilege application owner', TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;

INSERT INTO permissions (code, name, description) VALUES
    ('users.assign_role', 'Assign user roles', 'Assign supported roles to users'),
    ('system.owner.manage', 'Manage system owner', 'Manage protected system-owner authority')
ON CONFLICT (code) DO NOTHING;

-- An owner has all currently defined capabilities.  Future permissions must
-- explicitly be assigned by the migration that introduces them.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'SYSTEM_OWNER'
ON CONFLICT DO NOTHING;

-- Older deployments use a CHECK constraint that does not know SYSTEM_OWNER.
-- Replace it only when that named constraint is present.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
            role IN ('SYSTEM_OWNER', 'ADMIN', 'PASTOR', 'FINANCE', 'LEADER',
                     'REGISTRAR', 'STAFF', 'MEMBER', 'PARTNER')
        );
    END IF;
END $$;
