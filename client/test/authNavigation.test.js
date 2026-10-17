import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessWorkspace, getPostLoginPath } from '../src/app/authNavigation.js';

test('global administrators and broad staff enter the admin dashboard', () => {
  assert.equal(getPostLoginPath({ roles: ['ADMIN'], permissions: [] }), '/admin');
  assert.equal(getPostLoginPath({ role: 'FINANCE', permissions: ['finance.manage'] }), '/admin');
  assert.equal(getPostLoginPath({ permissions: ['announcements.manage'] }), '/admin');
});

test('ordinary and incomplete identities enter the member portal', () => {
  assert.equal(getPostLoginPath({ role: 'MEMBER', permissions: ['notifications.read'] }), '/me');
  assert.equal(getPostLoginPath({ role: 'MEMBER', permissions: ['events.manage'] }), '/me');
  assert.equal(getPostLoginPath({}), '/me');
  assert.equal(getPostLoginPath(null), '/me');
});

test('assigned group leaders enter only their assigned workspace', () => {
  const departmentLeader = {
    role: 'LEADER',
    permissions: ['events.manage', 'membership.manage', 'reports.read'],
    managedDepartments: [{ id: '12', organizationId: '4' }],
  };
  const bibleStudyLeader = {
    permissions: ['programs.manage'],
    managedBibleStudyGroups: [{ id: '27' }],
  };

  assert.equal(getPostLoginPath(departmentLeader), '/departments/12/workspace');
  assert.equal(getPostLoginPath(bibleStudyLeader), '/bible-study/groups/27/workspace');
  assert.equal(canAccessWorkspace(departmentLeader, 'department', '12'), true);
  assert.equal(canAccessWorkspace(departmentLeader, 'department', '13'), false);
  assert.equal(canAccessWorkspace(bibleStudyLeader, 'bible-study', '26'), false);
  assert.equal(getPostLoginPath({ role: 'LEADER', permissions: ['events.manage'] }), '/me');
});

test('global administrators retain global priority over group assignments', () => {
  assert.equal(getPostLoginPath({
    role: 'ADMIN',
    managedDepartments: [{ id: '12' }],
  }), '/admin');
});

test('safe intended destinations are preserved only when authorized', () => {
  const member = { role: 'MEMBER', permissions: [] };
  const leader = { managedBibleStudyGroups: [{ id: '27' }] };

  assert.equal(getPostLoginPath(member, '/me/giving'), '/me/giving');
  assert.equal(getPostLoginPath(member, '/admin/giving'), '/me');
  assert.equal(getPostLoginPath(leader, '/bible-study/groups/27/workspace'), '/bible-study/groups/27/workspace');
  assert.equal(getPostLoginPath(leader, '/bible-study/groups/28/workspace'), '/bible-study/groups/27/workspace');
  assert.equal(getPostLoginPath(leader, '/bible-study/groups/%E0%A4%A/workspace'), '/bible-study/groups/27/workspace');
  assert.equal(getPostLoginPath(member, '//evil.example/path'), '/me');
  assert.equal(getPostLoginPath(member, '/login'), '/me');
});