import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRoleAssignmentAllowed, normaliseRoleCodes } from '../src/services/roleAssignmentPolicy.js';

test('only a system owner can grant the protected owner role', () => {
  assert.throws(
    () => assertRoleAssignmentAllowed({ actorRoles: ['ADMIN'], targetRoles: ['MEMBER'], nextRoles: ['SYSTEM_OWNER'], actorId: 1, targetUserId: 2 }),
    { status: 403 },
  );
  assert.doesNotThrow(() => assertRoleAssignmentAllowed({
    actorRoles: ['SYSTEM_OWNER'], targetRoles: ['MEMBER'], nextRoles: ['SYSTEM_OWNER'], actorId: 1, targetUserId: 2,
  }));
});

test('an ordinary administrator cannot change another administrator authority', () => {
  assert.throws(
    () => assertRoleAssignmentAllowed({ actorRoles: ['ADMIN'], targetRoles: ['ADMIN'], nextRoles: ['MEMBER'], actorId: 1, targetUserId: 2 }),
    { status: 403 },
  );
});

test('role input is normalized and duplicate role codes are removed', () => {
  assert.deepEqual(normaliseRoleCodes([' MEMBER ', 'MEMBER', 'LEADER']), ['MEMBER', 'LEADER']);
  assert.throws(() => normaliseRoleCodes(['member']), { status: 400 });
});
