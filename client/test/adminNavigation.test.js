import test from 'node:test';
import assert from 'node:assert/strict';
import { adminNav } from '../src/app/navConfig.js';

const registeredAdminPaths = new Set([
  '/admin',
  '/admin/programs',
  '/admin/finance',
  '/admin/members',
  '/admin/staff',
  '/admin/departments',
  '/admin/bible-study',
  '/admin/registrations',
  '/admin/new-christians',
  '/admin/program-library',
  '/admin/events',
  '/admin/announcements',
  '/admin/campaigns',
  '/admin/message-templates',
  '/admin/telegram-inbox',
  '/admin/telegram',
  '/admin/telegram/menu',
  '/admin/telegram/auto-replies',
  '/admin/notifications',
  '/admin/communications-test',
  '/admin/giving',
  '/admin/verse',
  '/admin/reports',
  '/admin/audit',
  '/admin/roles',
  '/admin/settings',
]);

function nestedLinks(groups) {
  return groups.flatMap((section) => section.items.flatMap((item) => item.children?.length ? item.children : [item]));
}

test('admin navigation accepts the permissions object returned by usePermissions', () => {
  const nav = adminNav({ permissions: ['users.read', 'events.manage', 'roles.manage'] });
  const links = nestedLinks(nav).map((item) => item.to);

  assert.ok(links.includes('/admin/members'));
  assert.ok(links.includes('/admin/programs'));
  assert.ok(links.includes('/admin/roles'));
});

test('admin navigation accepts permission arrays and ignores malformed values safely', () => {
  assert.ok(adminNav(['finance.manage']).some((section) => section.items.some((item) => item.to === '/admin/finance')));
  assert.doesNotThrow(() => adminNav({ permissions: { 'users.read': true } }));
  assert.deepEqual(adminNav(null).map((section) => section.label), ['WORKSPACE']);
});

test('Telegram management navigation is visible only to users with Telegram management permission', () => {
  const telegramOnlyNav = adminNav(['telegram.manage']);
  const withoutTelegramPermission = adminNav(['notifications.manage']);

  const telegramWorkspace = telegramOnlyNav[0].items.find((item) => item.label === 'Telegram Management');
  assert.ok(telegramWorkspace);
  assert.ok(telegramWorkspace.children.some((item) => item.label === 'Inbox' && item.to === '/admin/telegram-inbox'));
  assert.ok(!withoutTelegramPermission[0].items.some((item) => item.to === '/admin/telegram-inbox'));
});

test('admin navigation exposes the requested workspace destinations', () => {
  const permissions = [
    'users.read', 'users.manage', 'users.create', 'staff.manage', 'membership.manage',
    'roles.manage', 'events.manage', 'programs.manage', 'finance.manage',
    'fundraising_campaigns.view', 'announcements.manage', 'telegram.manage', 'notifications.manage',
    'notifications.test', 'media.manage', 'bible.publish', 'reports.read', 'audit.read', 'settings.manage',
  ];
  const nav = adminNav({ permissions });
  const labels = nav.map((section) => section.label);
  const links = nestedLinks(nav).map((item) => item.to);

  assert.deepEqual(labels, ['WORKSPACE']);
  assert.equal(new Set(links).size, links.length, 'navigation links must be unique');
  assert.ok(links.every((path) => registeredAdminPaths.has(path)), 'every link must point to a registered route');
  const itemLabels = nav[0].items.flatMap((item) => item.children ? [item.label, ...item.children.map((child) => child.label)] : [item.label]);
  assert.ok(itemLabels.includes('Members'));
  assert.ok(itemLabels.includes('Departments'));
  assert.ok(itemLabels.includes('Bible Study'));
  assert.ok(itemLabels.includes('Programs & Events'));
  assert.ok(itemLabels.includes('Finance'));
  assert.ok(itemLabels.includes('Telegram Management'));
  assert.ok(itemLabels.includes('Menu builder'));
  assert.ok(itemLabels.includes('Auto-reply rules'));
  assert.ok(itemLabels.includes('Roles & Permissions'));
  assert.ok(itemLabels.includes('Settings'));
  assert.ok(!links.includes('/admin/flyers'), 'no flyers sidebar entry');
  assert.ok(!links.includes('/admin/banners'), 'no banners sidebar entry');
  assert.ok(!links.includes('/admin/permissions'), 'permissions folded into the roles workspace');
  assert.ok(!links.includes('/admin/staff'));
  assert.ok(!itemLabels.includes('Communications'));
});

test('workspace entries keep existing tools without duplicate navigation', () => {
  const permissions = ['roles.manage', 'staff.manage', 'fundraising_campaigns.view', 'finance.manage', 'reports.read', 'settings.manage', 'programs.manage'];
  const nav = adminNav({ permissions });
  const items = nav[0].items;
  const groups = items.find((item) => item.label === 'Departments');
  const account = items.find((item) => item.label === 'Settings');
  const programs = items.find((item) => item.label === 'Programs & Events');
  const finance = items.find((item) => item.label === 'Finance');

  assert.ok(groups && account && programs && finance);
  assert.ok(!linksContainOrganization(nav), 'Organizations must not appear in admin navigation');
  assert.ok(items.some((item) => item.label === 'Roles & Permissions'));
  assert.equal(finance.to, '/admin/finance');
  assert.equal(programs.to, '/admin/programs');
});

function linksContainOrganization(nav) {
  return nav.some((section) => section.label.toLowerCase().includes('organization')
    || section.items.some((item) => item.label.toLowerCase().includes('organization')));
}
