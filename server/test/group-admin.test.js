import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { deleteManagedGroup, listGroupLeaderCandidates, setManagedDepartmentStatus, updateManagedGroup } from '../src/controllers/groupAdminController.js';
import { createBibleStudyGroup, createDepartment } from '../src/controllers/programController.js';

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function installDatabase({ failOn } = {}) {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const statements = [];
  pool.connect = async () => ({
    async query(sql) {
      statements.push(sql);
      if (failOn && sql.includes(failOn)) throw Object.assign(new Error('protected dependency'), { code: '23503' });
      if (sql.includes('SELECT id,name FROM departments')) return { rowCount: 1, rows: [{ id: 8, name: 'Prayer' }] };
      return { rowCount: 0, rows: [] };
    },
    release() {},
  });
  pool.query = async (sql) => {
    statements.push(sql);
    return { rowCount: 1, rows: [] };
  };
  return {
    statements,
    restore() {
      pool.connect = originalConnect;
      pool.query = originalQuery;
    },
  };
}

test('permanently deletes department data in a transaction and preserves shared records', async (context) => {
  const database = installDatabase();
  context.after(database.restore);
  const response = responseMock();

  await deleteManagedGroup({
    path: '/departments/8',
    params: { id: '8' },
    user: { id: 1 },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.ok(database.statements.includes('BEGIN'));
  assert.ok(database.statements.includes('COMMIT'));
  assert.ok(database.statements.some((sql) => sql.includes('DELETE FROM group_posts')));
  assert.ok(database.statements.some((sql) => sql.includes('audience_department_id=$1 AND audience_group_id IS NULL')));
  assert.ok(database.statements.some((sql) => sql.includes('UPDATE events SET audience_department_id=NULL')));
  assert.ok(database.statements.some((sql) => sql.includes('UPDATE announcements SET department_id=NULL')));
  assert.ok(database.statements.some((sql) => sql.includes('UPDATE events SET program_id=NULL')));
  assert.ok(database.statements.some((sql) => sql.includes('group_notification_deliveries WHERE group_id=$1 AND group_type=$2')));
  assert.ok(database.statements.some((sql) => sql.includes('group_telegram_test_deliveries WHERE group_id=$1 AND group_type=$2')));
});

test('rolls back the entire group deletion when a protected dependency blocks it', async (context) => {
  const database = installDatabase({ failOn: 'DELETE FROM programs' });
  context.after(database.restore);
  const response = responseMock();

  await deleteManagedGroup({
    path: '/departments/8',
    params: { id: '8' },
    user: { id: 1 },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.body.error, /No data was deleted/);
  assert.ok(database.statements.includes('ROLLBACK'));
  assert.ok(!database.statements.includes('COMMIT'));
});

test('searches active registered member and staff candidates by name', async (context) => {
  const originalQuery = pool.query;
  let query;
  pool.query = async (sql, values) => {
    query = { sql, values };
    return { rowCount: 1, rows: [{ id: '14', name: 'Registered Member', role: 'MEMBER' }] };
  };
  context.after(() => {
    pool.query = originalQuery;
  });
  const response = responseMock();

  await listGroupLeaderCandidates({ query: { search: '  Registered Member  ' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, [{ id: '14', name: 'Registered Member', role: 'MEMBER' }]);
  assert.match(query.sql, /account_status='ACTIVE' AND deleted_at IS NULL/);
  assert.match(query.sql, /ILIKE '%' \|\| \$1 \|\| '%'/);
  assert.match(query.sql, /LIMIT 100/);
  assert.deepEqual(query.values, ['Registered Member']);
});

test('returns default active candidates when the search value is empty', async (context) => {
  const originalQuery = pool.query;
  let query;
  pool.query = async (sql, values) => {
    query = { sql, values };
    return { rowCount: 0, rows: [] };
  };
  context.after(() => {
    pool.query = originalQuery;
  });
  const response = responseMock();

  await listGroupLeaderCandidates({ query: { search: '' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, []);
  assert.match(query.sql, /account_status='ACTIVE' AND deleted_at IS NULL/);
  assert.deepEqual(query.values, ['']);
});

test('updates a department active status without rewriting its other settings', async (context) => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith('UPDATE departments')) {
      return { rowCount: 1, rows: [{ id: 8, name: 'Prayer', isActive: false }] };
    }
    return { rowCount: 1, rows: [] };
  };
  context.after(() => {
    pool.query = originalQuery;
  });
  const response = responseMock();

  await setManagedDepartmentStatus({
    params: { id: '8' },
    body: { isActive: false },
    user: { id: 1 },
    ip: '127.0.0.1',
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, { id: 8, name: 'Prayer', isActive: false });
  assert.deepEqual(statements[0].values, [8, false]);
  assert.ok(statements[0].sql.includes('SET is_active=$2'));
  assert.ok(!statements[0].sql.includes('DELETE'));
  assert.ok(statements.some(({ sql }) => sql.includes('INSERT INTO audit_logs')));
});

test('PATCHes a Bible study group through the shared management handler', async (context) => {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const statements = [];
  pool.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('SELECT id,leader_user_id')) {
        return { rowCount: 1, rows: [{ id: 1, leaderUserId: null }] };
      }
      if (sql.includes('SELECT id, name FROM users')) {
        return { rowCount: 1, rows: [{ id: 14, name: 'Registered Leader' }] };
      }
      if (sql.includes('UPDATE bible_study_memberships')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('INSERT INTO bible_study_memberships')) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('UPDATE bible_study_groups')) {
        return { rowCount: 1, rows: [{ id: 1, name: 'Evening Study' }] };
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
    path: '/bible-study-groups/1',
    params: { id: '1' },
    body: {
      name: 'Evening Study',
      telegramType: 'none',
      communityLinks: [],
      isActive: true,
      isPublic: true,
      leaderUserId: '14',
    },
    user: { id: 1 },
    ip: '127.0.0.1',
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.name, 'Evening Study');
  const update = statements.find(({ sql }) => sql.includes('UPDATE bible_study_groups'));
  assert.ok(update);
  assert.deepEqual(update.values.slice(0, 4), [1, 'Evening Study', null, null]);
  assert.ok(statements.some(({ sql, values }) => (
    sql.includes('UPDATE bible_study_memberships')
    && values[0] === 1
    && values[1] === 14
  )));
  const insertMembership = statements.find(({ sql }) => sql.includes('INSERT INTO bible_study_memberships'));
  assert.ok(insertMembership);
  assert.match(insertMembership.sql, /VALUES\(\$1,\$2,'LEADER','ACTIVE'\)/);
  assert.doesNotMatch(insertMembership.sql, /ON CONFLICT/i);
  assert.ok(statements.some(({ sql }) => sql === 'COMMIT'));
});

test('assigns a registered active leader and group membership atomically at department creation', async (context) => {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const statements = [];
  pool.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('SELECT id,name FROM users')) return { rowCount: 1, rows: [{ id: 14, name: 'Registered Member' }] };
      if (sql.includes('INSERT INTO departments')) return { rowCount: 1, rows: [{ id: 26, name: 'Prayer', leaderUserId: 14 }] };
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

  await createDepartment({
    body: { name: 'Prayer', leaderUserId: '14' },
    user: { id: 1 },
    ip: '127.0.0.1',
  }, response);

  assert.equal(response.statusCode, 201);
  assert.ok(statements.some(({ sql }) => sql === 'BEGIN'));
  assert.ok(statements.some(({ sql }) => sql.includes('INSERT INTO department_members')));
  assert.ok(statements.some(({ sql, values }) => sql.includes('INSERT INTO department_members') && values[0] === 14));
  assert.ok(statements.some(({ sql }) => sql === 'COMMIT'));
});

test('commits a Bible study group and its audit record together', async (context) => {
  const originalConnect = pool.connect;
  const statements = [];
  pool.connect = async () => ({
    async query(sql) {
      statements.push(sql);
      if (sql.includes('INSERT INTO bible_study_groups')) {
        return { rowCount: 1, rows: [{ id: 27, name: 'Prayer Study' }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  });
  context.after(() => { pool.connect = originalConnect; });
  const response = responseMock();

  await createBibleStudyGroup({
    body: { name: 'Prayer Study' },
    user: { id: 1 },
    ip: '127.0.0.1',
  }, response);

  assert.equal(response.statusCode, 201);
  const auditIndex = statements.findIndex((sql) => sql.includes('INSERT INTO audit_logs'));
  const commitIndex = statements.indexOf('COMMIT');
  assert.ok(auditIndex >= 0);
  assert.ok(commitIndex > auditIndex);
});

test('does not report a Bible study group saved when its audit insert fails', async (context) => {
  const originalConnect = pool.connect;
  const statements = [];
  pool.connect = async () => ({
    async query(sql) {
      statements.push(sql);
      if (sql.includes('INSERT INTO bible_study_groups')) {
        return { rowCount: 1, rows: [{ id: 28, name: 'Uncommitted Study' }] };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        throw Object.assign(new Error('Audit schema mismatch'), { code: '42703' });
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  });
  context.after(() => { pool.connect = originalConnect; });
  const response = responseMock();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await createBibleStudyGroup({
      body: { name: 'Uncommitted Study' },
      user: { id: 1 },
      ip: '127.0.0.1',
    }, response);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.includes('COMMIT'));
});

test('returns a database-unavailable response when a department cannot acquire a connection', async (context) => {
  const originalConnect = pool.connect;
  pool.connect = async () => {
    throw Object.assign(new Error('Connection terminated due to connection timeout'), { code: 'ETIMEDOUT' });
  };
  context.after(() => { pool.connect = originalConnect; });
  const response = responseMock();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await createDepartment({
      body: { name: 'Prayer' },
      user: { id: 1 },
      ip: '127.0.0.1',
    }, response);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'The database is temporarily unavailable.' });
});
