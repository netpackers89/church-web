import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { createMemberWelcomeNotification } from '../src/services/memberWelcomeService.js';

test('member welcome notification is personalized and persisted once', async (context) => {
  const originalQuery = pool.query;
  let queryText = '';
  let queryValues = [];
  pool.query = async (text, values) => {
    queryText = text;
    queryValues = values;
    return { rowCount: 1 };
  };
  context.after(() => {
    pool.query = originalQuery;
  });

  const result = await createMemberWelcomeNotification({ id: '42', name: 'Amanuel Desta' });

  assert.equal(result.status, 'created');
  assert.match(queryText, /ON CONFLICT \(user_id,type\)/);
  assert.deepEqual(queryValues.slice(0, 2), ['42', 'Welcome, Amanuel!']);
  assert.match(queryValues[2], /church community/);
});

test('member welcome notification reports an existing inbox record without duplicating it', async (context) => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rowCount: 0 });
  context.after(() => {
    pool.query = originalQuery;
  });

  const result = await createMemberWelcomeNotification({ id: '42', name: 'Amanuel Desta' });

  assert.deepEqual(result, { status: 'already_exists' });
});