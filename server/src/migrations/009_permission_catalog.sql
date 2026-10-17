-- Standardized church permission catalog used by the app and seeded into RBAC roles.
-- Some deployments have older permission tables without a `name` column, so add it
-- before seeding the canonical catalog.
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name VARCHAR(100);
UPDATE permissions SET name = COALESCE(NULLIF(btrim(name), ''), code)
WHERE name IS NULL OR btrim(name) = '';

INSERT INTO permissions (code, name, description)
VALUES
    ('users.read', 'View users', 'View the user roster and account listings.'),
    ('users.manage', 'Manage users', 'Manage user records and account status.'),
    ('users.assign_role', 'Assign user roles', 'Assign supported roles to users.'),
    ('users.deactivate', 'Deactivate users', 'Suspend or reactivate accounts.'),
    ('roles.manage', 'Manage roles', 'Manage role assignment and access control.'),
    ('roles.create', 'Create roles', 'Create new custom roles.'),
    ('roles.edit', 'Edit roles', 'Edit role details.'),
    ('roles.permissions.manage', 'Manage role permissions', 'Update the permission set attached to a role.'),
    ('departments.view', 'View departments', 'View department information.'),
    ('departments.create', 'Create departments', 'Create new departments.'),
    ('departments.edit', 'Edit departments', 'Edit department details and settings.'),
    ('departments.members.manage', 'Manage department membership', 'Review and manage membership requests and attendance.'),
    ('events.create', 'Create events', 'Create events and church programs.'),
    ('events.manage', 'Manage events', 'Edit, publish, or hide event listings.'),
    ('programs.manage', 'Manage programs', 'Manage church programs and schedules.'),
    ('notifications.read', 'Read notifications', 'View in-app notification messages.'),
    ('notifications.create', 'Create notifications', 'Create new message content.'),
    ('notifications.edit', 'Edit notifications', 'Edit templates or messages.'),
    ('notifications.publish', 'Publish notifications', 'Publish notifications to selected audiences.'),
    ('notifications.delete', 'Delete notifications', 'Delete outdated or unauthorized notifications.'),
    ('notifications.send', 'Send notifications', 'Dispatch notifications through a channel.'),
    ('notifications.test', 'Test notifications', 'Send previews or test dispatches.'),
    ('notifications.manage', 'Manage notifications', 'Manage the notification system broadly.'),
    ('finance.manage', 'Manage finance', 'Manage finance-related workflows and policies.'),
    ('finance.records.view', 'View finance records', 'View donations and giving records.'),
    ('finance.records.create', 'Create finance records', 'Create new giving or donation records.'),
    ('finance.records.reconcile', 'Reconcile finance records', 'Reconcile and review financial submissions.'),
    ('finance.records.approve', 'Approve finance records', 'Approve or reject submitted giving records.'),
    ('finance.reports.view', 'View finance reports', 'View financial summaries and reports.'),
    ('finance.reports.export', 'Export finance reports', 'Export finance reports and CSV data.'),
    ('prayer_requests.view', 'View prayer requests', 'View prayer requests within scope.'),
    ('prayer_requests.respond', 'Respond to prayer requests', 'Record pastoral follow-up or prayer responses.'),
    ('audit.read', 'Read audit logs', 'Review audit and security logs.'),
    ('settings.manage', 'Manage settings', 'Manage platform configuration and church settings.'),
    ('media.manage', 'Manage media', 'Manage banners, logos, and media assets.'),
    ('telegram.manage', 'Manage Telegram', 'Manage Telegram outreach and delivery settings.'),
    ('announcements.manage', 'Manage announcements', 'Manage church announcements and public notices.'),
    ('bible.publish', 'Publish Bible verses', 'Publish and manage Bible verse content.'),
    ('reports.read', 'Read reports', 'Read operational and administrative reports.'),
    ('staff.manage', 'Manage staff', 'Manage staff and leadership assignments.'),
    ('membership.manage', 'Manage memberships', 'Manage member administration workflows.'),
    ('system.owner.manage', 'Manage system owner', 'Manage protected system-owner authority.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'users.read', 'users.manage', 'users.assign_role', 'users.deactivate',
    'roles.manage', 'roles.create', 'roles.edit', 'roles.permissions.manage',
    'departments.view', 'departments.create', 'departments.edit', 'departments.members.manage',
    'events.create', 'events.manage', 'programs.manage', 'notifications.read',
    'notifications.create', 'notifications.edit', 'notifications.publish', 'notifications.delete',
    'notifications.send', 'notifications.test', 'notifications.manage', 'finance.manage',
    'finance.records.view', 'finance.records.create', 'finance.records.reconcile',
    'finance.records.approve', 'finance.reports.view', 'finance.reports.export',
    'prayer_requests.view', 'prayer_requests.respond', 'audit.read', 'settings.manage',
    'media.manage', 'telegram.manage', 'announcements.manage', 'bible.publish', 'reports.read',
    'staff.manage', 'membership.manage', 'system.owner.manage'
])
WHERE r.code = 'SYSTEM_OWNER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'users.read', 'users.manage', 'users.assign_role', 'users.deactivate',
    'roles.manage', 'roles.create', 'roles.edit', 'roles.permissions.manage',
    'departments.view', 'departments.create', 'departments.edit', 'departments.members.manage',
    'events.create', 'events.manage', 'programs.manage', 'notifications.read',
    'notifications.create', 'notifications.edit', 'notifications.publish', 'notifications.delete',
    'notifications.send', 'notifications.test', 'notifications.manage',
    'finance.manage', 'finance.records.view', 'finance.records.create', 'finance.records.reconcile',
    'finance.records.approve', 'finance.reports.view', 'finance.reports.export',
    'prayer_requests.view', 'prayer_requests.respond', 'audit.read', 'settings.manage', 'media.manage',
    'telegram.manage', 'announcements.manage', 'bible.publish', 'reports.read', 'staff.manage',
    'membership.manage', 'system.owner.manage'
])
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'users.read', 'users.manage', 'departments.view', 'departments.create', 'departments.edit',
    'departments.members.manage', 'events.create', 'events.manage', 'programs.manage',
    'notifications.create', 'notifications.publish', 'notifications.send', 'notifications.manage',
    'finance.records.view', 'finance.reports.view', 'prayer_requests.view', 'prayer_requests.respond',
    'audit.read', 'settings.manage', 'announcements.manage', 'bible.publish', 'staff.manage',
    'membership.manage', 'reports.read'
])
WHERE r.code = 'PASTOR'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'finance.manage', 'finance.records.view', 'finance.records.create', 'finance.records.reconcile',
    'finance.records.approve', 'finance.reports.view', 'finance.reports.export', 'audit.read'
])
WHERE r.code = 'FINANCE'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'departments.view', 'departments.edit', 'departments.members.manage', 'events.create', 'events.manage',
    'notifications.create', 'notifications.publish', 'notifications.send', 'notifications.read',
    'prayer_requests.view', 'membership.manage', 'reports.read'
])
WHERE r.code = 'LEADER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'departments.view', 'notifications.read', 'notifications.create', 'notifications.send', 'events.create',
    'events.manage', 'staff.manage', 'announcements.manage'
])
WHERE r.code = 'STAFF'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'notifications.read', 'finance.records.view', 'prayer_requests.view', 'departments.view', 'events.manage'
])
WHERE r.code = 'MEMBER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'notifications.read', 'departments.view', 'events.manage'
])
WHERE r.code = 'PARTNER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
    'users.read', 'users.manage', 'departments.view', 'events.create', 'events.manage',
    'notifications.send', 'prayer_requests.view', 'membership.manage'
])
WHERE r.code = 'REGISTRAR'
ON CONFLICT DO NOTHING;
