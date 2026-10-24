import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, createUser, disconnectTelegram, createTelegramLinkToken, connectTelegramByToken } from '../src/config/db.js';
import { disconnectMyTelegram } from '../src/controllers/userController.js';

function mockResponse() {
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

function mockRequest(userId, body = {}) {
  return { user: { id: String(userId) }, body };
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function createMember({ email, phone, password = 'SecurePass123!', preferredLanguage = 'en' }) {
  const passwordHash = await hashPassword(password);
  return createUser({
    name: 'Telegram Test Member',
    firstName: 'Telegram',
    fatherName: 'Test',
    grandfatherName: 'Member',
    email,
    phone,
    passwordHash,
    location: 'Tafo Adebabaye',
    maritalStatus: 'Rather not say',
    notifyEmail: true,
    preferredLanguage,
  });
}

async function linkTelegram(client, userId, telegramUserId, chatId) {
  await client.query(
    `INSERT INTO telegram_accounts (telegram_user_id, chat_id, username, display_name, user_id, linked_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [telegramUserId, String(chatId), `tg_${telegramUserId}`, 'TG Member', userId],
  );
  await client.query(
    `UPDATE users SET telegram_chat_id = $1, notify_telegram = TRUE WHERE id = $2`,
    [String(chatId), userId],
  );
}

const testUsers = [];
const testTelegramUsers = [];

test.after(async () => {
  for (const userId of testUsers) {
    await pool.query('DELETE FROM telegram_link_tokens WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM telegram_recovery_tokens WHERE telegram_user_id = $1', [userId]);
  }
  for (const telegramUserId of testTelegramUsers) {
    await pool.query('DELETE FROM telegram_accounts WHERE telegram_user_id = $1', [telegramUserId]);
  }
  for (const userId of testUsers) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});
test('disconnect removes the Telegram link for an authenticated member only', async (context) => {
  const member = await createMember({
    email: `tg-disconnect-member-${Date.now()}@example.com`,
    phone: `+2519${Date.now().toString().slice(-8)}`,
  });
  testUsers.push(member.id);
  const telegramUserId = 9000000001 + Date.now() % 100000;
  testTelegramUsers.push(telegramUserId);

  const client = await pool.connect();
  try {
    await linkTelegram(client, member.id, telegramUserId, String(telegramUserId));
  } finally {
    client.release();
  }

  const request = mockRequest(member.id, { password: 'SecurePass123!' });
  const response = mockResponse();
  await disconnectMyTelegram(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.connected, false);
  assert.equal(response.body.message, 'Telegram disconnected successfully.');

  const user = await pool.query('SELECT telegram_chat_id, notify_telegram FROM users WHERE id = $1', [member.id]);
  assert.equal(user.rows[0].telegram_chat_id, null);
  assert.equal(user.rows[0].notify_telegram, false);

  const account = await pool.query('SELECT user_id FROM telegram_accounts WHERE telegram_user_id = $1', [telegramUserId]);
  assert.equal(account.rows[0].user_id, null);
});

test('disconnect is idempotent when no connection exists', async (context) => {
  const member = await createMember({
    email: `tg-disconnect-idempotent-${Date.now()}@example.com`,
    phone: `+2519${Date.now().toString().slice(-8)}`,
  });
  testUsers.push(member.id);

  const request = mockRequest(member.id, { password: 'SecurePass123!' });
  const response = mockResponse();
  await disconnectMyTelegram(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.connected, false);

  const second = mockResponse();
  await disconnectMyTelegram(mockRequest(member.id, { password: 'SecurePass123!' }), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.success, true);
  assert.equal(second.body.connected, false);
});

test('disconnect rejects a wrong password', async (context) => {
  const member = await createMember({
    email: `tg-disconnect-wrong-pw-${Date.now()}@example.com`,
    phone: `+2519${Date.now().toString().slice(-8)}`,
  });
  testUsers.push(member.id);

  const response = mockResponse();
  await disconnectMyTelegram(mockRequest(member.id, { password: 'WrongPassword!' }), response);
  assert.equal(response.statusCode, 401);
});

test('disconnect does not detach a Telegram account claimed by another profile', async (context) => {
  const owner = await createMember({
    email: `tg-disconnect-owner-${Date.now()}@example.com`,
    phone: `+2519${Date.now().toString().slice(-8)}`,
  });
  const claimer = await createMember({
    email: `tg-disconnect-claimer-${Date.now()}@example.com`,
    phone: `+2519${Date.now().toString().slice(-8)}`,
  });
  testUsers.push(owner.id, claimer.id);
  const telegramUserId = 9000000002 + Date.now() % 100000;
  testTelegramUsers.push(telegramUserId);

  const client = await pool.connect();
  try {
    await linkTelegram(client, owner.id, telegramUserId, String(telegramUserId));
    await client.query(`UPDATE users SET telegram_chat_id = $1 WHERE id = $2`, [String(telegramUserId), claimer.id]);
  } finally {
    client.release();
  }

  const response = mockResponse();
  await disconnectMyTelegram(mockRequest(claimer.id, { password: 'SecurePass123!' }), response);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.connected, true);

  const account = await pool.query('SELECT user_id FROM telegram_accounts WHERE telegram_user_id = $1', [telegramUserId]);
  assert.equal(account.rows[0].user_id, owner.id);
  const ownerUser = await pool.query('SELECT telegram_chat_id FROM users WHERE id = $1', [owner.id]);
  assert.equal(ownerUser.rows[0].telegram_chat_id, String(telegramUserId));
});

test('disconnected member can reconnect the same Telegram account through the linking flow', async (context) => {
  const member = await createMember({
    email: `tg-disconnect-reconnect-${Date.now()}@example.com`,
    phone: `+2519${Date.now().toString().slice(-8)}`,
  });
  testUsers.push(member.id);
  const telegramUserId = 9000000003 + Date.now() % 100000;
  testTelegramUsers.push(telegramUserId);

  const client = await pool.connect();
  try {
    await linkTelegram(client, member.id, telegramUserId, String(telegramUserId));
  } finally {
    client.release();
  }

  await disconnectMyTelegram(mockRequest(member.id, { password: 'SecurePass123!' }), mockResponse());

  const token = `reconnect-test-token-${Date.now()}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await createTelegramLinkToken(member.id, tokenHash);

  await connectTelegramByToken(tokenHash, {
    telegramUserId,
    chatId: String(telegramUserId),
    username: 'reconnect_handle',
    displayName: 'Reconnect Member',
  });

  const user = await pool.query('SELECT telegram_chat_id FROM users WHERE id = $1', [member.id]);
  assert.equal(user.rows[0].telegram_chat_id, String(telegramUserId));

  const account = await pool.query('SELECT user_id FROM telegram_accounts WHERE telegram_user_id = $1', [telegramUserId]);
  assert.equal(account.rows[0].user_id, member.id);
});

