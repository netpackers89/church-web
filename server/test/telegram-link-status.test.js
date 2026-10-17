import test from 'node:test';
import assert from 'node:assert/strict';
import { pool, getTelegramLinkStatus } from '../src/config/db.js';

test('Telegram link status is scoped to the authenticated member and hashed token', async (context) => {
  const originalQuery = pool.query;
  let values;
  pool.query = async (_query, queryValues) => {
    values = queryValues;
    return {
      rowCount: 1,
      rows: [{ tokenActive: true, tokenConsumed: true, connected: true, telegramUsername: 'member_handle', telegramLinkedAt: '2026-10-16T10:00:00.000Z' }],
    };
  };
  context.after(() => { pool.query = originalQuery; });

  const status = await getTelegramLinkStatus('73', 'token-hash-only');

  assert.deepEqual(values, ['73', 'token-hash-only']);
  assert.deepEqual(status, {
    status: 'CONNECTED',
    username: 'member_handle',
    linkedAt: '2026-10-16T10:00:00.000Z',
  });
  assert.equal('chatId' in status, false);
  assert.equal('telegramUserId' in status, false);
});

test('Telegram link status distinguishes a pending token from an expired token', async (context) => {
  const originalQuery = pool.query;
  let row = { tokenActive: true, tokenConsumed: false, connected: false };
  pool.query = async () => ({ rowCount: 1, rows: [row] });
  context.after(() => { pool.query = originalQuery; });

  assert.deepEqual(await getTelegramLinkStatus('73', 'pending-hash'), { status: 'PENDING' });
  row = { tokenActive: false, tokenConsumed: false, connected: false };
  assert.deepEqual(await getTelegramLinkStatus('73', 'expired-hash'), { status: 'EXPIRED' });
});
