import test from 'node:test';
import assert from 'node:assert/strict';
import { adminNav } from '../src/app/navConfig.js';

const registeredAdminPaths = new Set([
  '/admin',
  '/admin/members',
  '/admin/new-christians',
  '/admin/events',
  '/admin/campaigns',
  '/admin/departments',
  '/admin/bible-study',
  '/admin/verse',
  '/admin/announcements',
  '/admin/message-templates',
  '/admin/telegram-inbox',
  '/admin/notifications',
  '/admin/communications-test',
  '/admin/giving',
  '/admin/reports',
  '/admin/audit',
  '/admin/roles',
  '/admin/settings',
]);

function nestedLinks(groups) {
  return groups.flatMap((section) => section.items.flatMap((item) => item.children ? item.children : [item]));
}

test('admin navigation accepts the permissions object returned by usePermissions', () => {
  const nav = adminNav({ permissions: ['users.read', 'events.manage', 'roles.manage'] });
  const links = nestedLinks(nav).map((item) => item.to);

  assert.ok(links.includes('/admin/members'));
  assert.ok(links.includes('/admin/events'));
  assert.ok(links.includes('/admin/roles'));
});

test('admin navigation accepts permission arrays and ignores malformed values safely', () => {
  assert.ok(adminNav(['finance.manage']).some((section) => section.items.some((item) => item.to === '/admin/giving')));
  assert.doesNotThrow(() => adminNav({ permissions: { 'users.read': true } }));
  assert.deepEqual(adminNav(null).map((section) => section.label), ['Dashboard']);
});

test('admin navigation sections are organized into the six primary sections', () => {
  const permissions = [
    'users.read', 'users.manage', 'users.create', 'staff.manage', 'membership.manage',
    'roles.manage', 'events.manage', 'programs.manage', 'finance.manage',
    'fundraising_campaigns.view', 'announcements.manage', 'telegram.manage', 'notifications.manage',
    'notifications.test', 'media.manage', 'bible.publish', 'reports.read', 'audit.read', 'settings.manage',
  ];
  const nav = adminNav({ permissions });
  const labels = nav.map((section) => section.label);
  const links = nestedLinks(nav).map((item) => item.to);

  assert.deepEqual(labels, ['Dashboard', 'Members', 'Programs', 'Communications', 'Finance', 'System']);
  assert.equal(new Set(links).size, links.length, 'navigation links must be unique');
  assert.ok(links.every((path) => registeredAdminPaths.has(path)), 'every link must point to a registered route');
  assert.ok(nav[1].items.some((item) => item.label === 'Members & Staff'));
  assert.ok(!links.includes('/admin/flyers'), 'no flyers sidebar entry');
  assert.ok(!links.includes('/admin/banners'), 'no banners sidebar entry');
  assert.ok(!links.includes('/admin/permissions'), 'permissions folded into the roles workspace');
  assert.ok(!links.includes('/admin/staff'), 'staff folded into the members directory');
});

test('redundant standalone entries are removed and combined workspaces are present', () => {
  const permissions = ['roles.manage', 'staff.manage', 'fundraising_campaigns.view', 'finance.manage', 'reports.read'];
  const nav = adminNav({ permissions });
  const programs = nav.find((section) => section.label === 'Programs');
  const system = nav.find((section) => section.label === 'System');
  const finance = nav.find((section) => section.label === 'Finance');

  assert.ok(programs.items.some((item) => item.label === 'Departments & Organizations'));
  assert.ok(system.items.some((item) => item.label === 'Roles & Permissions' && item.to === '/admin/roles'));
  assert.ok(finance.items.some((item) => item.label === 'Reports' && item.to === '/admin/reports'));
  assert.ok(!finance.items.some((item) => item.label === 'Campaigns' && item.to === '/admin/campaigns'), 'campaigns live under Programs, not Finance');
});
