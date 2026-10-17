-- ============================================================================
-- Church Website — Migration 010: permission-catalog alignment (ADDITIVE)
--
-- Aligns the seeded permission catalog with the granular permission keys the
-- church platform specification defines, WITHOUT renaming any code that is
-- already wired into routes (users.read, users.manage, events.manage,
-- finance.manage, audit.read, ...).  Every statement is additive and
-- idempotent (ON CONFLICT DO NOTHING), so existing grants keep working and no
-- deployed authorization breaks.
--
-- New/aliased canonical keys introduced here:
--   users.view           canonical roster-view key (parallels users.read)
--   users.create         granular create-account key
--   users.edit           granular edit-account key
--   users.roles.assign   canonical role-assignment key (parallels users.assign_role)
--   events.publish       canonical publish key (parallels events.manage)
--   audit_logs.view      canonical audit-view key (parallels audit.read)
-- ============================================================================

INSERT INTO permissions (code, name, description)
VALUES
    ('users.view', 'View users', 'View the user roster and account listings.'),
    ('users.create', 'Create users', 'Create staff and member accounts.'),
    ('users.edit', 'Edit users', 'Edit account details and profile information.'),
    ('users.roles.assign', 'Assign user roles', 'Assign supported roles to users.'),
    ('events.publish', 'Publish events', 'Publish or unpublish church events and programs.'),
    ('audit_logs.view', 'View audit logs', 'Review audit and security logs.')
ON CONFLICT (code) DO NOTHING;

-- Grant the aligned keys alongside their existing equivalents so every role that
-- previously held the legacy key continues to satisfy both the legacy route
-- checks and the new canonical checks.  Future admin/staff endpoints can use the
-- canonical names; nothing that works today changes.

-- ADMIN: full roster + role assignment + publishing + audit visibility.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'users.view', 'users.create', 'users.edit', 'users.roles.assign',
    'events.publish', 'audit_logs.view'
])
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- PASTOR / leaders: roster view, create/edit within scope, publish, audit view.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'users.view', 'users.create', 'users.edit', 'events.publish', 'audit_logs.view'
])
WHERE r.code = 'PASTOR'
ON CONFLICT DO NOTHING;

-- REGISTRAR: roster view + account create/edit (no role assignment, no audit).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'users.view', 'users.create', 'users.edit'
])
WHERE r.code = 'REGISTRAR'
ON CONFLICT DO NOTHING;

-- FINANCE: audit visibility for financial audit trails (no user roster access).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'audit_logs.view'
])
WHERE r.code = 'FINANCE'
ON CONFLICT DO NOTHING;

-- LEADER: publish their department events and view relevant audit records.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'events.publish', 'audit_logs.view'
])
WHERE r.code = 'LEADER'
ON CONFLICT DO NOTHING;

-- STAFF: publish their department events.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'events.publish'
])
WHERE r.code = 'STAFF'
ON CONFLICT DO NOTHING;
