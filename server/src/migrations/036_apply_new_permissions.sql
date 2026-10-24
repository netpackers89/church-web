-- Permission catalog additions for public group discovery, joining, leaders, and New Believers
-- ============================================================================

INSERT INTO permissions (code, name, description)
VALUES
  ('group.join', 'Join a public group', 'Allow an authenticated member to join a public department or Bible study group through the website.'),
  ('group.join.approve', 'Approve or reject group join requests', 'Allow a leader to approve or reject pending member join requests for their assigned groups.'),
  ('new_christian.register', 'Register new believers', 'Allow authorized staff to register a new believer and send an invitation with a one-time temporary credential.'),
  ('new_christian.manage', 'Manage the New Believer workflow', 'Allow staff to update follow-up status, assign a follow-up worker, and manage the onboarding pipeline.'),
  ('telegram.group.link', 'Link a group to a Telegram destination', 'Allow authorized users to configure a group Telegram channel or group destination.'),
  ('telegram.user.link', 'Link a user to the official Telegram bot', 'Allow authorized staff to configure website-to-Telegram linking for a member account.'),
  ('groups.manage', 'Manage group public profiles', 'Allow authorized administrators and leaders to update a group name, description, logo, banner, schedule, visibility, and join settings.'),
  ('group.posts.manage', 'Create and manage group posts', 'Allow authorized leaders to publish and manage posts for their assigned groups.'),
  ('group.communication.manage', 'Send communication to an assigned group', 'Allow authorized leaders and staff to send in-app, website, Telegram, or email messages to an assigned group audience.'),
  ('followup.assign', 'Assign follow-up workers', 'Allow authorized staff to assign and reassign follow-up workers for new believers.'),
  ('followup.view', 'View pastoral follow-up records', 'Allow authorized staff to view pastoral notes and follow-up details.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Grant scopes based on role.
-- Global administration and pastoral staff receive the broadest onboarding and joining authority.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('group.join', 'group.join.approve', 'new_christian.register', 'new_christian.manage', 'followup.assign', 'followup.view', 'groups.manage', 'group.posts.manage', 'group.communication.manage', 'telegram.group.link', 'telegram.user.link', 'media.manage', 'announcements.manage', 'bible.publish', 'departments.members.manage', 'staff.manage', 'notifications.create', 'notifications.send', 'notifications.manage', 'telegram.manage', 'reports.read')
WHERE r.code IN ('ADMIN', 'PASTOR', 'LEADER', 'STAFF', 'REGISTRAR', 'FINANCE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Members can join publicly visible groups. Partners are treated the same as members for public joining.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('MEMBER', 'PARTNER')
  AND p.code = 'group.join'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE permissions IS 'Catalog of fine-grained authorization permissions used by the RBAC system.';
