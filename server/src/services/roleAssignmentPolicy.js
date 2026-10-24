const ROLE_CODE = /^[A-Z_]{2,32}$/;

export const SYSTEM_OWNER = 'SYSTEM_OWNER';
export const ADMIN = 'ADMIN';

export function normaliseRoleCodes(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw Object.assign(new Error('roles must be a non-empty list of valid role codes.'), { status: 400 });
  }
  const codes = [...new Set(value.map((code) => typeof code === 'string' ? code.trim() : ''))];
  if (codes.some((code) => !ROLE_CODE.test(code))) {
    throw Object.assign(new Error('roles must be a non-empty list of valid role codes.'), { status: 400 });
  }
  return codes;
}

/**
 * Enforces the privileged-role invariants before database mutation.  Database
 * checks below still protect the last active owner from concurrent changes.
 */
export function assertRoleAssignmentAllowed({ actorRoles = [], actorPermissions = [], targetRoles = [], nextRoles = [], actorId, targetUserId }) {
  const actor = new Set(actorRoles.map((role) => String(role).toUpperCase()));
  const permissions = new Set(actorPermissions);
  const target = new Set(targetRoles.map((role) => String(role).toUpperCase()));
  const next = new Set(nextRoles.map((role) => String(role).toUpperCase()));
  const actorIsOwner = actor.has(SYSTEM_OWNER);
  const actorIsAdmin = actor.has(ADMIN);
  const targetIsOwner = target.has(SYSTEM_OWNER);
  const targetIsAdmin = target.has(ADMIN);

  if (next.has(SYSTEM_OWNER) && !actorIsOwner) {
    throw Object.assign(new Error('Only a system owner can grant the SYSTEM_OWNER role.'), { status: 403 });
  }
  if (targetIsOwner && !actorIsOwner) {
    throw Object.assign(new Error('Only a system owner can modify a system owner.'), { status: 403 });
  }
  if (targetIsOwner && !next.has(SYSTEM_OWNER)) {
    throw Object.assign(new Error('A system owner cannot be demoted through role assignment. Use the protected owner transfer process.'), { status: 403 });
  }
  if (!actorIsOwner && targetIsAdmin) {
    throw Object.assign(new Error('Only a system owner can modify an existing administrator account.'), { status: 403 });
  }
  if (!actorIsOwner && next.has(ADMIN) && !(actorIsAdmin && permissions.has('roles.manage'))) {
    throw Object.assign(new Error('Only a system owner or an administrator with role-management permission can grant the ADMIN role.'), { status: 403 });
  }
  if (String(actorId) === String(targetUserId) && !actorIsOwner && (next.has(ADMIN) || target.has(ADMIN))) {
    throw Object.assign(new Error('You cannot change your own administrator authority.'), { status: 403 });
  }
}

export function primaryRole(codes) {
  if (codes.includes(SYSTEM_OWNER)) return SYSTEM_OWNER;
  if (codes.includes(ADMIN)) return ADMIN;
  return codes[0];
}
