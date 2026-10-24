import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { followGroup, getGroup, groupFollowStatus, listGroups } from '../src/controllers/groupController.js';

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function installGroupDatabase(groups, follows) {
  const originalQuery = pool.query;
  pool.query = async (query, values = []) => {
    if (query.includes('FROM users u WHERE u.id=$1')) {
      return { rowCount: 0, rows: [] };
    }
    if (query.includes('SELECT EXISTS(SELECT 1 FROM telegram_accounts')) {
      return { rowCount: 1, rows: [{ connected: false }] };
    }
    if (query.includes('FROM group_notification_preferences')) return { rowCount: 0, rows: [] };
    if (query.includes('FROM departments d WHERE d.id')) {
      return { rowCount: groups.department ? 1 : 0, rows: groups.department ? [{ ...groups.department, id: values[0] }] : [] };
    }
    if (query.includes('FROM bible_study_groups g WHERE g.id')) {
      return { rowCount: groups.bible_study_group ? 1 : 0, rows: groups.bible_study_group ? [{ ...groups.bible_study_group, id: values[0] }] : [] };
    }
    if (query.includes('WITH followed AS')) {
      const [userId, groupId, groupType] = values;
      const key = `${userId}:${groupType}:${groupId}`;
      const inserted = !follows.has(key);
      follows.add(key);
      return { rowCount: inserted ? 1 : 0, rows: inserted ? [{ id: follows.size }] : [] };
    }
    if (query.includes('SELECT id FROM group_follows')) {
      const [userId, groupId, groupType] = values;
      return { rowCount: follows.has(`${userId}:${groupType}:${groupId}`) ? 1 : 0, rows: [] };
    }
    throw new Error(`Unexpected SQL in group follow test: ${query}`);
  };
  return () => { pool.query = originalQuery; };
}

test('public group listing counts active department memberships without soft-delete fields', async (context) => {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (query) => {
    queries.push(query);
    if (query.includes('FROM departments d')) {
      return { rowCount: 1, rows: [{ id: '12', name: 'Youth', communityLinks: [], memberCount: '3' }] };
    }
    if (query.includes('FROM bible_study_groups g')) return { rowCount: 0, rows: [] };
    throw new Error(`Unexpected SQL in group listing test: ${query}`);
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await listGroups({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data[0].type, 'department');
  assert.equal(response.body.data[0].memberCount, 3);
  assert.ok(queries[0].includes("dm.status = 'ACTIVE'"));
  assert.ok(!queries[0].includes('dm.deleted_at'));
});

test('department and Bible study follows remain distinct and duplicate requests are idempotent', async (context) => {
  const follows = new Set();
  const restore = installGroupDatabase({
    department: { name: 'Youth Department', description: '', isPublic: true, isActive: true, communityLinks: [] },
    bible_study_group: { name: 'Youth Bible Study', description: '', isPublic: true, isActive: true, communityLinks: [] },
  }, follows);
  context.after(restore);

  const departmentResponse = responseMock();
  await followGroup({ query: { type: 'department' }, params: { id: '12' }, user: { id: 7 } }, departmentResponse);
  assert.equal(departmentResponse.statusCode, 201);
  assert.equal(departmentResponse.body.data.group.type, 'department');

  const bibleStudyResponse = responseMock();
  await followGroup({ query: { type: 'bible_study_group' }, params: { id: '12' }, user: { id: 7 } }, bibleStudyResponse);
  assert.equal(bibleStudyResponse.statusCode, 201);
  assert.equal(bibleStudyResponse.body.data.group.type, 'bible_study_group');
  assert.equal(follows.size, 2);

  const duplicateResponse = responseMock();
  await followGroup({ query: { type: 'department' }, params: { id: '12' }, user: { id: 7 } }, duplicateResponse);
  assert.equal(duplicateResponse.statusCode, 200);
  assert.equal(duplicateResponse.body.data.status, 'already_following');
  assert.equal(follows.size, 2);
});

test('follow status validates type and reports the matching group type only', async (context) => {
  const follows = new Set(['7:department:12']);
  const restore = installGroupDatabase({
    department: { name: 'Youth Department', description: '', isPublic: true, isActive: true, communityLinks: [] },
    bible_study_group: { name: 'Youth Bible Study', description: '', isPublic: true, isActive: true, communityLinks: [] },
  }, follows);
  context.after(restore);

  const departmentResponse = responseMock();
  await groupFollowStatus({ query: { type: 'department' }, params: { id: '12' }, user: { id: 7 } }, departmentResponse);
  assert.equal(departmentResponse.body.data.isFollowing, true);

  const bibleStudyResponse = responseMock();
  await groupFollowStatus({ query: { type: 'bible_study_group' }, params: { id: '12' }, user: { id: 7 } }, bibleStudyResponse);
  assert.equal(bibleStudyResponse.body.data.isFollowing, false);

  const invalidResponse = responseMock();
  await groupFollowStatus({ query: { type: 'department; DROP TABLE group_follows' }, params: { id: '12' }, user: { id: 7 } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
});

test('group details expose only enabled supported links for the requested group type', async (context) => {
  const restore = installGroupDatabase({
    department: {
      name: 'Department',
      description: '',
      isPublic: true,
      isActive: true,
      communityLinks: [
        { platform: 'whatsapp', label: 'Department WhatsApp', url: 'https://chat.whatsapp.com/department', enabled: true },
        { platform: 'telegram', label: 'Disabled link', url: 'https://t.me/disabled', enabled: false },
        { platform: 'other', label: 'Unsafe link', url: 'javascript:alert(1)', enabled: true },
      ],
    },
    bible_study_group: {
      name: 'Bible Study',
      description: '',
      isPublic: true,
      isActive: true,
      communityLinks: [{ platform: 'telegram', label: 'Study Telegram', url: 'https://t.me/study', enabled: true }],
    },
  }, new Set());
  context.after(restore);

  const response = responseMock();
  await getGroup({ query: { type: 'department' }, params: { id: '12' } }, response);
  assert.deepEqual(response.body.data.communityLinks, []);
  assert.equal(response.body.data.type, 'department');
});
