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
export function assertRoleAssignmentAllowed({ actorRoles = [], targetRoles = [], nextRoles = [], actorId, targetUserId }) {
  const actor = new Set(actorRoles);
  const target = new Set(targetRoles);
  const next = new Set(nextRoles);
  const actorIsOwner = actor.has(SYSTEM_OWNER);
  const targetIsOwner = target.has(SYSTEM_OWNER);

  if (next.has(SYSTEM_OWNER) && !actorIsOwner) {
    throw Object.assign(new Error('Only a system owner can grant the SYSTEM_OWNER role.'), { status: 403 });
  }
  if (targetIsOwner && !actorIsOwner) {
    throw Object.assign(new Error('Only a system owner can modify a system owner.'), { status: 403 });
  }
  if (targetIsOwner && !next.has(SYSTEM_OWNER)) {
    throw Object.assign(new Error('A system owner cannot be demoted through role assignment. Use the protected owner transfer process.'), { status: 403 });
  }
  if (!actorIsOwner && (next.has(ADMIN) || target.has(ADMIN))) {
    throw Object.assign(new Error('Only a system owner can grant, revoke, or modify administrator roles.'), { status: 403 });
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
