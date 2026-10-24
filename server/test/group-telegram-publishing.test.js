import assert from 'node:assert/strict';
import axios from 'axios';
import test from 'node:test';
import { config } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import { publishGroupPostToTelegram } from '../src/services/groupTelegramPublishing.js';

test('retry skips Telegram message parts already confirmed as sent', async (context) => {
  const originalQuery = pool.query;
  const originalAxiosPost = axios.post;
  const originalToken = config.telegram.token;
  const deliveries = new Map();
  const parts = new Map();
  let telegramCalls = 0;

  config.telegram.token = 'test-token';
  axios.post = async (_url, payload) => {
    telegramCalls += 1;
    if (telegramCalls === 2) throw new Error('temporary Telegram failure');
    return { data: { ok: true, result: { message_id: telegramCalls } } };
  };
  pool.query = async (sql, values = []) => {
    if (sql.includes('INSERT INTO group_telegram_deliveries')) {
      deliveries.set(values[0], { status: 'PENDING', messageIds: [] });
      return { rowCount: 1, rows: [{ messageIds: [] }] };
    }
    if (sql.includes('UPDATE group_telegram_deliveries') && sql.includes("SET status='PENDING'")) {
      const record = deliveries.get(values[0]);
      if (record?.status !== 'FAILED') return { rowCount: 0, rows: [] };
      record.status = 'PENDING';
      return { rowCount: 1, rows: [{ messageIds: record.messageIds }] };
    }
    if (sql.includes('SELECT status,telegram_message_ids')) {
      const record = deliveries.get(values[0]);
      return { rowCount: record ? 1 : 0, rows: record ? [{ status: record.status, messageIds: record.messageIds }] : [] };
    }
    if (sql.includes('INSERT INTO group_telegram_delivery_parts')) {
      const key = `${values[0]}:${values[1]}`;
      if (!parts.has(key)) parts.set(key, { status: 'PENDING', messageId: null });
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes('SELECT status,telegram_message_id AS "messageId"')) {
      const part = parts.get(`${values[0]}:${values[1]}`);
      return { rowCount: part ? 1 : 0, rows: part ? [{ ...part, messageId: part.messageId }] : [] };
    }
    if (sql.includes('UPDATE group_telegram_delivery_parts SET status')) {
      const part = parts.get(`${values[0]}:${values[1]}`);
      part.status = 'SENT';
      part.messageId = values[2];
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes('SELECT telegram_message_id AS "messageId" FROM group_telegram_delivery_parts')) {
      return {
        rowCount: 1,
        rows: [...parts.entries()]
          .filter(([key, part]) => key.startsWith(`${values[0]}:`) && part.status === 'SENT')
          .sort(([left], [right]) => Number(left.split(':')[1]) - Number(right.split(':')[1]))
          .map(([, part]) => ({ messageId: part.messageId })),
      };
    }
    if (sql.includes('UPDATE group_telegram_deliveries SET telegram_message_ids')) {
      deliveries.get(values[0]).messageIds = JSON.parse(values[1]);
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes("UPDATE group_telegram_deliveries") && sql.includes("SET status='FAILED'")) {
      deliveries.get(values[0]).status = 'FAILED';
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes("UPDATE group_telegram_deliveries") && sql.includes("SET status='SENT'")) {
      deliveries.get(values[0]).status = 'SENT';
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes('UPDATE departments')) return { rowCount: 1, rows: [] };
    throw new Error(`Unexpected SQL in Telegram publishing test: ${sql}`);
  };
  context.after(() => {
    pool.query = originalQuery;
    axios.post = originalAxiosPost;
    config.telegram.token = originalToken;
  });

  const post = { id: 81, title: 'A group update', body: 'A'.repeat(5000) };
  const group = { id: 11, name: 'Youth', telegramUsername: 'mulu_youth' };
  const first = await publishGroupPostToTelegram({ post, group, groupType: 'department' });

  assert.equal(first.status, 'FAILED');
  assert.equal(parts.get('81:0').status, 'SENT');
  assert.equal(parts.get('81:1').status, 'PENDING');

  const retry = await publishGroupPostToTelegram({ post, group, groupType: 'department', retry: true });

  assert.equal(retry.status, 'SENT');
  assert.equal(telegramCalls, 3);
  assert.deepEqual(deliveries.get(81).messageIds, [1, 3]);
});
