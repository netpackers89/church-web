import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import {
  createTelegramAutoReply,
  createTelegramMenuItem,
} from '../src/controllers/telegramAdminController.js';

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const languages = { en: 'Service times', am: 'የአገልግሎት ሰዓት', om: 'Yeroo tajaajilaa' };

test('creates a localized Telegram menu item and audits the configuration change', async (context) => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql, values) => {
    statements.push({ sql, values });
    if (sql.includes('INSERT INTO telegram_menu_items')) {
      return { rowCount: 1, rows: [{ id: '14', key: 'service_times', labels: languages }] };
    }
    return { rowCount: 1, rows: [] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await createTelegramMenuItem({
    user: { id: '7' },
    body: {
      key: 'service_times',
      labels: languages,
      responses: { en: 'Sunday at 9', am: 'እሁድ 3 ሰዓት', om: 'Dilbata 9' },
      actionType: 'TEXT',
      visibility: 'EVERYONE',
      sortOrder: 2,
      isActive: true,
    },
    ip: '127.0.0.1',
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.id, '14');
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /INSERT INTO telegram_menu_items/);
  assert.equal(JSON.parse(statements[0].values[1]).am, languages.am);
  assert.match(statements[1].sql, /INSERT INTO audit_logs/);
});

test('rejects invalid auto-reply rules without writing to the database', async (context) => {
  const originalQuery = pool.query;
  let queryCount = 0;
  pool.query = async () => { queryCount += 1; return { rowCount: 0, rows: [] }; };
  context.after(() => { pool.query = originalQuery; });

  const response = responseMock();
  await createTelegramAutoReply({
    user: { id: '7' },
    body: {
      name: 'Incomplete translations',
      keywords: ['help'],
      matchType: 'CONTAINS',
      responses: { en: 'How can we help?' },
      priority: 1,
      isActive: true,
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /am text/i);
  assert.equal(queryCount, 0);
});
