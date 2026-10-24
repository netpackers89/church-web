import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { config } from '../src/config/env.js';
import { sendTelegramNotification } from '../src/telegram/services/messaging.js';

test('plain Telegram text is not parsed as HTML unless the caller explicitly requests it', async (context) => {
  const originalPost = axios.post;
  const originalToken = config.telegram.token;
  const requests = [];
  config.telegram.token = 'test-token';
  axios.post = async (_url, payload) => {
    requests.push(payload);
    return { data: { ok: true, result: { message_id: 3 } } };
  };
  context.after(() => {
    axios.post = originalPost;
    config.telegram.token = originalToken;
  });

  await sendTelegramNotification({ chatId: '123', text: 'Plain text' });
  await sendTelegramNotification({ chatId: '123', text: '<b>Formatted</b>', parseMode: 'HTML' });

  assert.equal(requests[0].parse_mode, undefined);
  assert.equal(requests[1].parse_mode, 'HTML');
});
