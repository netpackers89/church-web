import assert from 'node:assert/strict';
import test from 'node:test';
import { telegramGroupDestination } from '../src/controllers/groupSocialController.js';

test('resolves public Telegram usernames as Bot API destinations', () => {
  assert.deepEqual(
    telegramGroupDestination({ telegramPublicLink: 'https://t.me/mulu_youth' }),
    { chatId: '@mulu_youth', url: 'https://t.me/mulu_youth' },
  );
  assert.equal(
    telegramGroupDestination({ communityLinks: [{ platform: 'telegram', enabled: true, url: 'https://t.me/s/mulu_study' }] }).chatId,
    '@mulu_study',
  );
});

test('does not treat invite links, disabled links, or unrelated hosts as sendable destinations', () => {
  assert.equal(telegramGroupDestination({ telegramInviteLink: 'https://t.me/+privateInviteHash' }), null);
  assert.equal(telegramGroupDestination({ telegramType: 'none', telegramUsername: 'mulu_youth' }), null);
  assert.equal(telegramGroupDestination({ communityLinks: [{ platform: 'telegram', enabled: false, url: 'https://t.me/mulu_youth' }] }), null);
  assert.equal(telegramGroupDestination({ communityLinks: [{ platform: 'telegram', enabled: true, url: 'https://example.com/mulu_youth' }] }), null);
});
