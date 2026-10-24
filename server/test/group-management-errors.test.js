import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { updateManagedGroup } from '../src/controllers/groupAdminController.js';
import { createGroupPost, createGroupProgram, groupManagementOverview, updateGroupSettings } from '../src/controllers/groupSocialController.js';

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('creates a department post only in its department feed', async (context) => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql, values) => {
    statements.push({ sql, values });
    if (sql.includes('FROM departments d LEFT JOIN department_members')) {
      return { rowCount: 1, rows: [{ id: 5, name: 'Community Service', isActive: true }] };
    }
    if (sql.includes('INSERT INTO group_posts')) {
      return {
        rowCount: 1,
        rows: [{ id: 61, groupId: 5, groupType: 'department', title: 'Saturday cleanup', status: 'PUBLISHED' }],
      };
    }
    return { rowCount: 0, rows: [] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await createGroupPost({
    params: { id: '5' },
    query: { type: 'department' },
    body: {
      title: 'Saturday cleanup',
      body: 'Meet at the church entrance.',
      category: 'UPDATE',
      status: 'PUBLISHED',
      idempotencyKey: 'post-request-61',
    },
    user: { id: 12, permissions: ['group.posts.manage'] },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.groupId, 5);
  assert.equal(response.body.data.groupType, 'department');
  const insert = statements.find(({ sql }) => sql.includes('INSERT INTO group_posts'));
  assert.ok(insert);
  assert.match(insert.sql, /CASE WHEN \$8::varchar='PUBLISHED'/);
  assert.deepEqual(insert.values.slice(0, 3), [5, 'department', 'Saturday cleanup']);
  assert.equal(statements.some(({ sql }) => /INSERT INTO (events|programs|announcements)/.test(sql)), false);
});

test('refuses group posts from users who are not assigned to the group', async (context) => {
  const originalQuery = pool.query;
  pool.query = async (sql) => {
    assert.match(sql, /leader_user_id=\$2/);
    return { rowCount: 0, rows: [] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await createGroupPost({
    params: { id: '5' },
    query: { type: 'department' },
    body: {
      title: 'Unauthorized post',
      body: 'This must not be saved.',
      idempotencyKey: 'post-request-62',
    },
    user: { id: 13, permissions: [] },
  }, response);

  assert.equal(response.statusCode, 403);
  assert.match(response.body.error, /assigned to your account/i);
});

test('allows an assigned department leader to publish without global management permissions', async (context) => {
  const originalQuery = pool.query;
  pool.query = async (sql) => {
    if (sql.includes('FROM departments d LEFT JOIN department_members')) {
      return { rowCount: 1, rows: [{ id: 5, name: 'Community Service', isActive: true }] };
    }
    if (sql.includes('INSERT INTO group_posts')) {
      return { rowCount: 1, rows: [{ id: 62, groupId: 5, groupType: 'department', title: 'Leader update', body: 'Hello', status: 'PUBLISHED' }] };
    }
    return { rowCount: 0, rows: [] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await createGroupPost({
    params: { id: '5' },
    query: { type: 'department' },
    body: { title: 'Leader update', body: 'Hello', idempotencyKey: 'leader-post-62' },
    user: { id: 12, permissions: [] },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.title, 'Leader update');
});

test('creates a group program and its feed post in one idempotent transaction', async (context) => {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const statements = [];
  pool.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('INSERT INTO events')) {
        return {
          rowCount: 1,
          rows: [{
            id: 300,
            title: 'Sunday gathering',
            description: 'Worship together',
            locationText: 'Church hall',
            startsAt: '2026-08-01T09:00:00.000Z',
            imageUrl: null,
          }],
        };
      }
      if (sql.includes('INSERT INTO group_posts')) {
        return {
          rowCount: 1,
          rows: [{ id: 301, groupId: 5, groupType: 'department', title: 'Sunday gathering', body: 'Worship together' }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  });
  pool.query = async (sql) => {
    if (sql.includes('FROM departments d LEFT JOIN department_members')) {
      return { rowCount: 1, rows: [{ id: 5, name: 'Worship', isActive: true }] };
    }
    return { rowCount: 0, rows: [] };
  };
  context.after(() => {
    pool.connect = originalConnect;
    pool.query = originalQuery;
  });

  const response = responseMock();
  await createGroupProgram({
    params: { id: '5' },
    query: { type: 'department' },
    body: {
      title: 'Sunday gathering',
      description: 'Worship together',
      startsAt: '2026-08-01T09:00:00.000Z',
      idempotencyKey: 'program-request-300',
    },
    user: { id: 12, permissions: [] },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(statements.map(({ sql }) => sql).filter((sql) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)), ['BEGIN', 'COMMIT']);
  const eventInsert = statements.find(({ sql }) => sql.includes('INSERT INTO events'));
  assert.match(eventInsert.sql, /ON CONFLICT/);
  assert.equal(eventInsert.values.at(-1), 'program-request-300');
  assert.ok(statements.some(({ sql }) => sql.includes('INSERT INTO group_posts')));
});

test('returns real membership and recent-post summaries for the assigned group type', async (context) => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql, values) => {
    statements.push({ sql, values });
    if (sql.includes('FROM bible_study_groups g LEFT JOIN bible_study_memberships')) {
      return { rowCount: 1, rows: [{ id: 5, name: 'Wednesday Study', meetingSchedule: 'Wednesday evening' }] };
    }
    return {
      rowCount: 1,
      rows: [{ followers: 8, members: 6, posts: 3, drafts: 1, comments: 2, recentPosts: [{ id: 9, title: 'This week', status: 'PUBLISHED' }] }],
    };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await groupManagementOverview({
    params: { id: '5' },
    query: { type: 'bible_study_group' },
    user: { id: 12, permissions: ['group.posts.manage'] },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.members, 6);
  assert.equal(response.body.data.recentPosts[0].title, 'This week');
  const summary = statements.find(({ sql }) => sql.includes('AS "recentPosts"'));
  assert.ok(summary.sql.includes('FROM bible_study_memberships'));
  assert.ok(summary.sql.includes('bible_study_group_id=$1 AND status=\'ACTIVE\''));
});

test('persists Bible study management fields and validates invalid map URLs', async (context) => {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const statements = [];
  pool.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('SELECT id,leader_user_id AS "leaderUserId" FROM bible_study_groups')) {
        return { rowCount: 1, rows: [{ id: 1, leaderUserId: null }] };
      }
      if (sql.includes('UPDATE bible_study_groups SET')) {
        return {
          rowCount: 1,
          rows: [{ id: 1, name: 'Wednesday Study', googleMapsLink: 'https://maps.google.com/maps?q=church' }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  });
  pool.query = async () => ({ rowCount: 1, rows: [] });
  context.after(() => {
    pool.connect = originalConnect;
    pool.query = originalQuery;
  });

  const response = responseMock();
  await updateManagedGroup({
    path: '/admin/bible-study-groups/1',
    params: { id: '1' },
    body: {
      name: 'Wednesday Study',
      description: 'Weekly study group',
      locationText: 'Church hall',
      meetingSchedule: 'Every Wednesday at 18:30',
      currentStudy: 'Romans',
      groupEmail: 'study@example.org',
      googleMapsLink: 'https://maps.google.com/maps?q=church',
      groupProfileImage: 'https://images.example.org/study.png',
      bannerImage: 'https://images.example.org/banner.png',
      isPublic: true,
      isActive: true,
      telegramType: 'none',
      communityLinks: [],
    },
    user: { id: 4 },
  }, response);

  assert.equal(response.statusCode, 200);
  const update = statements.find(({ sql }) => sql.includes('UPDATE bible_study_groups SET'));
  assert.ok(update);
  assert.equal(update.values[2], 'Weekly study group');
  assert.equal(update.values[6], 'study@example.org');
  assert.equal(update.values[7], 'https://maps.google.com/maps?q=church');
  assert.equal(update.values[9], 'https://images.example.org/study.png');
  assert.equal(update.values[10], 'https://images.example.org/banner.png');
  assert.ok(statements.some(({ sql }) => sql === 'COMMIT'));

  const invalidResponse = responseMock();
  await updateManagedGroup({
    path: '/admin/bible-study-groups/1',
    params: { id: '1' },
    body: { name: 'Wednesday Study', googleMapsLink: 'https://evil.example/redirect' },
    user: { id: 4 },
  }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.match(invalidResponse.body.error, /approved HTTPS address/i);
});

test('group workspace saves a public Telegram destination and resets its verification state only when changed', async (context) => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql, values = []) => {
    statements.push({ sql, values });
    if (sql.includes('FROM departments d LEFT JOIN department_members')) {
      return { rowCount: 1, rows: [{ id: 5, name: 'Youth', telegramType: 'none' }] };
    }
    if (sql.includes('UPDATE departments SET')) {
      return { rowCount: 1, rows: [{ id: 5, telegramType: 'group', telegramUsername: 'yeka_youth' }] };
    }
    return { rowCount: 0, rows: [] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await updateGroupSettings({
    params: { id: '5' },
    query: { type: 'department' },
    body: { telegramType: 'group', telegramUsername: '@yeka_youth' },
    user: { id: 12, permissions: [] },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.telegramType, 'group');
  const update = statements.find(({ sql }) => sql.includes('UPDATE departments SET'));
  assert.ok(update.sql.includes('telegram_verified_at=CASE'));
  assert.deepEqual(update.values.slice(-4), ['yeka_youth', '', '', 'group']);
});
