-- ============================================================================
-- Church Website — Migration 010: granular permission keys + privilege-safe grants
-- ============================================================================
-- Phase 2 RBAC hardening. The platform specification requires first-class,
-- individually grantable permission keys. Several (users.view, users.create,
-- users.edit, users.roles.assign, audit_logs.view, events.publish) were defined
-- only as implied companions in PERMISSION_ALIASES and were never inserted into
-- the permissions table, so custom roles could not reference them and the alias
-- expansion was never applied. This migration seeds them as real, immutable
-- identifiers and backfills the grants the alias map already implies for the
-- roles that exist today. It is purely additive.

ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name VARCHAR(100);
UPDATE permissions SET name = COALESCE(NULLIF(btrim(name), ''), code)
WHERE name IS NULL OR btrim(name) = '';

INSERT INTO permissions (code, name, description) VALUES
    ('users.view', 'View users', 'View the user roster and account listings.'),
    ('users.create', 'Create users', 'Create new user or staff accounts.'),
    ('users.edit', 'Edit users', 'Edit existing user account details.'),
    ('users.roles.assign', 'Assign user roles', 'Assign authorized roles to users.'),
    ('audit_logs.view', 'View audit logs', 'Read audit and security records.'),
    ('events.publish', 'Publish events', 'Publish or hide event listings.')
ON CONFLICT (code) DO NOTHING;

-- Backfill alias grants: any role that already holds a source permission also
-- receives the granular companion implied by PERMISSION_ALIASES. Using a VALUES
-- map keeps this in lockstep with services/permissionCatalog.js.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id
JOIN (VALUES
    ('users.read', 'users.view'),
    ('users.assign_role', 'users.roles.assign'),
    ('audit.read', 'audit_logs.view'),
    ('users.manage', 'users.create'),
    ('users.manage', 'users.edit'),
    ('events.manage', 'events.publish')
) AS alias_map(source_code, target_code) ON alias_map.source_code = source.code
JOIN permissions target ON target.code = alias_map.target_code
ON CONFLICT DO NOTHING;
