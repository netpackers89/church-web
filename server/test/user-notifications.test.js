import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import {
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from '../src/controllers/userController.js';

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('lists only the authenticated member notifications and returns an unread total', async (context) => {
  const originalQuery = pool.query;
  pool.query = async (sql, values) => {
    assert.deepEqual(values, [7]);
    assert.match(sql, /user_id=\$1/);
    if (sql.includes('count(*)')) return { rowCount: 1, rows: [{ count: 2 }] };
    return { rowCount: 1, rows: [{ id: '12', title: 'Sunday service', status: 'PENDING' }] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await listMyNotifications({ user: { id: 7 } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data[0].id, '12');
  assert.equal(response.body.meta.unreadCount, 2);
  assert.equal(response.body.data[0].status, 'PENDING');
});

test('mark-all-read is scoped to the authenticated member and does not rewrite already-read rows', async (context) => {
  const originalQuery = pool.query;
  let statement;
  pool.query = async (sql, values) => {
    statement = { sql, values };
    return { rowCount: 2, rows: [{ id: '12' }, { id: '13' }] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await markAllMyNotificationsRead({ user: { id: 7 } }, response);

  assert.equal(response.body.data.markedRead, 2);
  assert.deepEqual(statement.values, [7]);
  assert.match(statement.sql, /user_id=\$1/);
  assert.match(statement.sql, /read_at IS NULL/);
  assert.match(statement.sql, /notification_status NOT IN \('READ','SKIPPED'\)/);
});

test('a member cannot mark another member notification as read', async (context) => {
  const originalQuery = pool.query;
  let values;
  pool.query = async (_sql, parameters) => {
    values = parameters;
    return { rowCount: 0, rows: [] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await markMyNotificationRead({ params: { id: '19' }, user: { id: 7 } }, response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(values, [19, 7]);
});
