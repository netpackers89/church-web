import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERMISSION_CATALOG, getRolePermissions } from '../src/services/permissionCatalog.js';

test('default permission catalog includes the core church admin and finance checks', () => {
  const codes = new Set(DEFAULT_PERMISSION_CATALOG.map((permission) => permission.code));

  assert.ok(codes.has('users.read'));
  assert.ok(codes.has('users.manage'));
  assert.ok(codes.has('roles.manage'));
  assert.ok(codes.has('finance.manage'));
  assert.ok(codes.has('settings.manage'));
  assert.ok(codes.has('audit.read'));
  assert.ok(codes.has('announcements.manage'));
});

test('standard roles receive the expected baseline permission sets', () => {
  assert.ok(getRolePermissions('SYSTEM_OWNER').includes('system.owner.manage'));
  assert.ok(getRolePermissions('ADMIN').includes('roles.manage'));
  assert.ok(getRolePermissions('FINANCE').includes('finance.manage'));
  assert.ok(getRolePermissions('MEMBER').includes('notifications.read'));
  assert.ok(!getRolePermissions('MEMBER').includes('events.manage'));
  assert.ok(!getRolePermissions('PARTNER').includes('events.manage'));
});
