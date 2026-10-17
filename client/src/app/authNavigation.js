const ADMIN_AREA_PERMISSIONS = [
  'users.read', 'users.manage', 'roles.manage', 'staff.manage', 'membership.manage',
  'programs.manage', 'events.manage', 'bible.publish', 'telegram.manage',
  'announcements.manage', 'finance.manage', 'media.manage', 'settings.manage',
  'audit.read', 'reports.read', 'notifications.manage', 'notifications.test',
];

const GLOBAL_ADMIN_PERMISSIONS = [
  'system.owner.manage', 'roles.manage', 'staff.manage', 'users.manage',
  'finance.manage', 'settings.manage', 'audit.read',
];

const ADMIN_PATH_PERMISSIONS = [
  [/^\/admin\/(roles|permissions)(\/|$)/, ['roles.manage']],
  [/^\/admin\/(members|staff)(\/|$)/, ['users.read', 'users.manage']],
  [/^\/admin\/departments\/register$/, ['staff.manage']],
  [/^\/admin\/bible-study-groups\/register$/, ['programs.manage']],
  [/^\/admin\/(departments|organizations)(\/|$)/, ['staff.manage', 'departments.view']],
  [/^\/admin\/(events|bible-study)(\/|$)/, ['events.manage', 'programs.manage']],
  [/^\/admin\/(verse)(\/|$)/, ['bible.publish']],
  [/^\/admin\/(giving)(\/|$)/, ['finance.manage']],
  [/^\/admin\/(reports)(\/|$)/, ['reports.read']],
  [/^\/admin\/(audit)(\/|$)/, ['audit.read']],
  [/^\/admin\/(settings)(\/|$)/, ['settings.manage']],
  [/^\/admin\/(message-templates|announcements|notifications)(\/|$)/, ['announcements.manage', 'notifications.manage']],
  [/^\/admin\/communications-test(\/|$)/, ['notifications.test', 'system.owner.manage']],
  [/^\/admin\/(banners|flyers)(\/|$)/, ['announcements.manage', 'media.manage']],
  [/^\/admin\/(new-christians)(\/|$)/, ['membership.manage']],
  [/^\/admin\/(telegram-inbox)(\/|$)/, ['telegram.manage']],
  [/^\/admin\/registrations(\/|$)/, ['users.create', 'staff.manage', 'programs.manage']],
];

function permissionsOf(user) {
  return new Set(Array.isArray(user?.permissions) ? user.permissions : []);
}

function rolesOf(user) {
  const roles = Array.isArray(user?.roles) ? [...user.roles] : [];
  if (user?.role) roles.push(user.role);
  return new Set(roles.map((role) => String(role).toUpperCase()));
}

function hasAnyPermission(user, codes) {
  const permissions = permissionsOf(user);
  return codes.some((code) => permissions.has(code));
}

export function isGlobalAdministrator(user) {
  const roles = rolesOf(user);
  return ['SYSTEM_OWNER', 'ADMIN', 'PASTOR'].some((role) => roles.has(role))
    || hasAnyPermission(user, GLOBAL_ADMIN_PERMISSIONS);
}

export function canAccessAdminArea(user) {
  if (isGlobalAdministrator(user)) return true;
  const roles = rolesOf(user);
  const memberOnly = roles.size > 0 && [...roles].every((role) => ['MEMBER', 'PARTNER'].includes(role));
  const hasManagedScope = Boolean(user?.managedDepartments?.length || user?.managedBibleStudyGroups?.length);
  if (memberOnly || hasManagedScope || roles.has('LEADER')) return false;
  return hasAnyPermission(user, ADMIN_AREA_PERMISSIONS);
}

function hasManagedResource(user, kind, id) {
  const collection = kind === 'department' ? user?.managedDepartments
    : kind === 'bible-study' ? user?.managedBibleStudyGroups
      : user?.managedOrganizations;
  return Array.isArray(collection) && collection.some((resource) => String(resource.id) === String(id));
}

export function canAccessWorkspace(user, kind, id) {
  if (!id) return false;
  return isGlobalAdministrator(user) || hasManagedResource(user, kind, id);
}

function scopedWorkspace(user) {
  if (isGlobalAdministrator(user)) return null;
  const department = user?.managedDepartments?.[0];
  if (department?.id != null) return `/departments/${encodeURIComponent(department.id)}/workspace`;
  const group = user?.managedBibleStudyGroups?.[0];
  if (group?.id != null) return `/bible-study/groups/${encodeURIComponent(group.id)}/workspace`;
  return null;
}

function canAccessAdminPath(user, path) {
  if (!canAccessAdminArea(user)) return false;
  const route = ADMIN_PATH_PERMISSIONS.find(([pattern]) => pattern.test(path));
  if (route) return hasAnyPermission(user, route[1]);
  if (path === '/admin' || path === '/admin/') return hasAnyPermission(user, ADMIN_AREA_PERMISSIONS);
  return ADMIN_AREA_PERMISSIONS.some((permission) => path.startsWith('/admin/') && permissionsOf(user).has(permission));
}

function safeInternalPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  try {
    const parsed = new URL(path, 'https://church.invalid');
    return parsed.origin === 'https://church.invalid' ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

function canAccessRequestedPath(user, requestedPath) {
  const path = safeInternalPath(requestedPath);
  if (!path || /^\/(login|register|forgot-password)(\/|$)/.test(path)) return null;
  if (path === '/me' || path.startsWith('/me/')) return path;
  if (path === '/admin' || path.startsWith('/admin/')) return canAccessAdminPath(user, path) ? path : null;

  const departmentMatch = path.match(/^\/departments\/([^/]+)\/workspace\/?$/);
  if (departmentMatch) return canAccessWorkspace(user, 'department', decodeResourceId(departmentMatch[1])) ? path : null;
  const groupMatch = path.match(/^\/bible-study\/groups\/([^/]+)\/workspace\/?$/);
  if (groupMatch) return canAccessWorkspace(user, 'bible-study', decodeResourceId(groupMatch[1])) ? path : null;
  const organizationMatch = path.match(/^\/organizations\/([^/]+)\/workspace\/?$/);
  if (organizationMatch) return canAccessWorkspace(user, 'organization', decodeResourceId(organizationMatch[1])) ? path : null;
  return null;
}

function decodeResourceId(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function getPostLoginPath(user, requestedPath = null) {
  const requested = canAccessRequestedPath(user, requestedPath);
  if (requested) return requested;
  if (isGlobalAdministrator(user)) return '/admin';
  const workspace = scopedWorkspace(user);
  if (workspace) return workspace;
  if (canAccessAdminArea(user)) return '/admin';
  return '/me';
}