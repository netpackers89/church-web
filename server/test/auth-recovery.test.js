import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { keepCurrentPassword } from '../src/controllers/authController.js';

test('keeping the current password consumes the verified reset token only', async (context) => {
  const originalConnect = pool.connect;
  const statements = [];
  const client = {
    async query(text, values = []) {
      statements.push({ text, values });
      if (/SELECT id FROM password_reset_requests/.test(text)) {
        return { rowCount: 1, rows: [{ id: '7' }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  pool.connect = async () => client;
  context.after(() => {
    pool.connect = originalConnect;
  });

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await keepCurrentPassword({ body: { resetToken: 'a'.repeat(43) } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, 'Your current password has not been changed.');
  assert.ok(statements.some(({ text }) => /UPDATE password_reset_requests SET used_at=NOW\(\),reset_token_hash=NULL/.test(text)));
  assert.ok(!statements.some(({ text }) => /UPDATE users/.test(text)));
  assert.ok(statements.some(({ text }) => text === 'COMMIT'));
});