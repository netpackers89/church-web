import test from 'node:test';
import assert from 'node:assert/strict';

import { requirePermission } from '../src/middleware/requirePermission.js';
import { expandPermissionAliases } from '../src/services/permissionCatalog.js';

test('permission aliases expand to the canonical granular keys', () => {
  const expanded = new Set(expandPermissionAliases(['users.read', 'users.manage', 'events.manage', 'audit.read']));
  assert.deepEqual(
    expanded,
    new Set(['users.read', 'users.view', 'users.manage', 'users.create', 'users.edit', 'events.manage', 'events.publish', 'audit.read', 'audit_logs.view']),
  );
});

test('legacy role permissions satisfy granular checks through alias expansion', () => {
  const request = { user: { permissions: ['users.read', 'users.manage', 'events.manage', 'audit.read'] } };
  const response = {
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  let nextCalled = false;
  requirePermission('users.view', 'users.create', 'events.publish', 'audit_logs.view')(request, response, () => {
    nextCalled = true;
  });

  assert.equal(response.code, undefined);
  assert.equal(nextCalled, true);
});

test('scoped group leaders cannot use global management endpoints with broad legacy permissions', () => {
  const request = { user: { roles: ['LEADER'], permissions: ['events.manage'], hasManagedScope: true } };
  const response = {
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;

  requirePermission('events.manage')(request, response, () => { nextCalled = true; });

  assert.equal(response.code, 403);
  assert.equal(nextCalled, false);
});

test('global administrators retain global API access when assigned to a group', () => {
  const request = { user: { roles: ['ADMIN'], permissions: ['events.manage'], hasManagedScope: true } };
  let nextCalled = false;

  requirePermission('events.manage')(request, { status() { return this; }, json() {} }, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
});
