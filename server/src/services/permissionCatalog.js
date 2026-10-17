export const DEFAULT_PERMISSION_CATALOG = [
  { code: 'users.read', description: 'View the user roster' },
  { code: 'users.manage', description: 'Manage user accounts and status' },
  { code: 'users.assign_role', description: 'Assign supported roles to users' },
  { code: 'users.deactivate', description: 'Deactivate or suspend user accounts' },
  { code: 'roles.manage', description: 'Manage roles and role assignment' },
  { code: 'roles.create', description: 'Create custom roles' },
  { code: 'roles.edit', description: 'Edit custom roles' },
  { code: 'roles.permissions.manage', description: 'Manage role-to-permission mappings' },
  { code: 'departments.view', description: 'View departments' },
  { code: 'departments.create', description: 'Create new departments' },
  { code: 'departments.edit', description: 'Edit department details' },
  { code: 'departments.members.manage', description: 'Manage department membership and approval workflows' },
  { code: 'events.create', description: 'Create events and programs' },
  { code: 'events.manage', description: 'Manage event visibility and scheduling' },
  { code: 'programs.manage', description: 'Manage church programs and schedules' },
  { code: 'notifications.read', description: 'View in-app notifications' },
  { code: 'notifications.create', description: 'Create notification content' },
  { code: 'notifications.edit', description: 'Edit notification templates or messages' },
  { code: 'notifications.publish', description: 'Publish notifications to audiences' },
  { code: 'notifications.delete', description: 'Delete unauthorized or outdated notifications' },
  { code: 'notifications.send', description: 'Dispatch notifications through supported channels' },
  { code: 'notifications.test', description: 'Send test notifications' },
  { code: 'notifications.manage', description: 'Manage the notification system broadly' },
  { code: 'finance.manage', description: 'Manage finance-related workflows' },
  { code: 'finance.records.view', description: 'View giving and finance records' },
  { code: 'finance.records.create', description: 'Create finance records or transfer submissions' },
  { code: 'finance.records.reconcile', description: 'Reconcile finance records' },
  { code: 'finance.records.approve', description: 'Approve or reject financial records' },
  { code: 'finance.reports.view', description: 'View giving and finance reports' },
  { code: 'finance.reports.export', description: 'Export finance reports and records' },
  { code: 'prayer_requests.view', description: 'View prayer requests within a permitted scope' },
  { code: 'prayer_requests.respond', description: 'Respond to or follow up on prayer requests' },
  { code: 'audit.read', description: 'Read audit and security records' },
  { code: 'settings.manage', description: 'Manage church settings and platform configuration' },
  { code: 'media.manage', description: 'Manage banners, content, and media assets' },
  { code: 'telegram.manage', description: 'Manage Telegram outreach and channel settings' },
  { code: 'announcements.manage', description: 'Manage public announcements and staff notices' },
  { code: 'bible.publish', description: 'Publish and manage Bible verse content' },
  { code: 'reports.read', description: 'Read operational and administrative reports' },
  { code: 'staff.manage', description: 'Manage staff and department leadership assignments' },
  { code: 'membership.manage', description: 'Manage memberships and member administration workflows' },
  { code: 'system.owner.manage', description: 'Manage protected system-owner authority' },
  // --- Granular aliases requested by the platform specification. These are
  // ADDITIVE companions to the coarse codes above; the coarse codes stay in
  // place so existing route guards keep working. The alias map below grants
  // them automatically wherever the coarse capability already exists.
  { code: 'users.view', description: 'View the user roster (alias of users.read)' },
  { code: 'users.create', description: 'Create new user accounts (granular users.manage)' },
  { code: 'users.edit', description: 'Edit user account details (granular users.manage)' },
  { code: 'users.roles.assign', description: 'Assign roles to users (alias of users.assign_role)' },
  { code: 'events.publish', description: 'Publish or unpublish events (granular events.manage)' },
  { code: 'audit_logs.view', description: 'View audit and security logs (alias of audit.read)' },
  { code: 'departments.eligibility.manage', description: 'Configure department eligibility, age ranges, and recruitment rules' },
];

const LEGACY_ROLE_PERMISSIONS = {
  SYSTEM_OWNER: [
    ...DEFAULT_PERMISSION_CATALOG.map((permission) => permission.code),
  ],
  ADMIN: [
    'users.read', 'users.manage', 'users.assign_role', 'users.deactivate',
    'roles.manage', 'roles.create', 'roles.edit', 'roles.permissions.manage',
    'departments.view', 'departments.create', 'departments.edit', 'departments.members.manage',
    'departments.eligibility.manage',
    'events.create', 'events.manage', 'programs.manage', 'notifications.read',
    'notifications.create', 'notifications.edit', 'notifications.publish', 'notifications.delete',
    'notifications.send', 'notifications.test', 'notifications.manage',
    'finance.manage', 'finance.records.view', 'finance.records.create', 'finance.records.reconcile',
    'finance.records.approve', 'finance.reports.view', 'finance.reports.export',
    'prayer_requests.view', 'prayer_requests.respond', 'audit.read', 'settings.manage', 'media.manage',
    'telegram.manage', 'announcements.manage', 'bible.publish', 'reports.read', 'staff.manage',
    'membership.manage', 'system.owner.manage',
  ],
  PASTOR: [
    'users.read', 'users.manage', 'departments.view', 'departments.create', 'departments.edit',
    'departments.members.manage', 'departments.eligibility.manage', 'events.create', 'events.manage', 'programs.manage',
    'notifications.create', 'notifications.publish', 'notifications.send', 'notifications.manage',
    'finance.records.view', 'finance.reports.view', 'prayer_requests.view', 'prayer_requests.respond',
    'audit.read', 'settings.manage', 'announcements.manage', 'bible.publish', 'staff.manage',
    'membership.manage', 'reports.read',
  ],
  FINANCE: [
    'finance.manage', 'finance.records.view', 'finance.records.create', 'finance.records.reconcile',
    'finance.records.approve', 'finance.reports.view', 'finance.reports.export', 'audit.read',
  ],
  LEADER: [
    'departments.view', 'departments.edit', 'departments.members.manage', 'departments.eligibility.manage', 'events.create', 'events.manage',
    'notifications.create', 'notifications.publish', 'notifications.send', 'notifications.read',
    'prayer_requests.view', 'membership.manage', 'reports.read',
  ],
  STAFF: [
    'departments.view', 'notifications.read', 'notifications.create', 'notifications.send', 'events.create',
    'events.manage', 'staff.manage', 'announcements.manage',
  ],
  MEMBER: [
    'notifications.read', 'notifications.create', 'finance.records.view', 'prayer_requests.view',
    'departments.view',
  ],
  PARTNER: [
    'notifications.read', 'departments.view',
  ],
  REGISTRAR: [
    'users.read', 'users.manage', 'departments.view', 'events.create', 'events.manage', 'notifications.send',
    'prayer_requests.view', 'membership.manage',
  ],
};

export const ROLE_PERMISSION_MAP = LEGACY_ROLE_PERMISSIONS;

export function getRolePermissions(roleCode) {
  const permissions = ROLE_PERMISSION_MAP[roleCode];
  if (!permissions) return [];
  return [...new Set(permissions)];
}

// Coarse capability -> granular companion codes it implies. This keeps the
// additive granular keys in lockstep with the legacy codes that route guards
// actually check, so a role that can "manage users" is also recognised as able
// to view/create/edit users without a second manual grant.
export const PERMISSION_ALIASES = {
  'users.read': ['users.view'],
  'users.assign_role': ['users.roles.assign'],
  'audit.read': ['audit_logs.view'],
  'users.manage': ['users.create', 'users.edit'],
  'events.manage': ['events.publish'],
};

// Expand a permission list with any implied granular companions. Used by the
// migration and seed so DB grants mirror this map exactly.
export function expandPermissionAliases(permissions) {
  const expanded = new Set();
  const queue = [...(permissions ?? [])];

  while (queue.length > 0) {
    const permission = queue.shift();
    if (!permission || expanded.has(permission)) continue;

    expanded.add(permission);
    for (const alias of PERMISSION_ALIASES[permission] ?? []) {
      if (!expanded.has(alias)) {
        queue.push(alias);
      }
    }
  }

  return [...expanded];
}
