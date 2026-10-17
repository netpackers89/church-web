import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTelegramReply } from '../src/controllers/adminController.js';

test('Telegram inbox replies preserve multiline text, punctuation, and surrounding internal whitespace', () => {
  assert.equal(normalizeTelegramReply('  Hello, pastor!\nI can meet at 7:30.  '), 'Hello, pastor!\nI can meet at 7:30.');
});

test('Telegram inbox replies reject empty text and messages over the provider limit', () => {
  assert.throws(() => normalizeTelegramReply('   '), /Write a message/);
  assert.throws(() => normalizeTelegramReply('x'.repeat(4001)), /4,000 characters/);
});
