import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findAutoReplyRule,
  localizedValue,
  normalizeTelegramText,
  validateLocalized,
} from '../src/telegram/services/configuration.js';

test('normalizes Unicode and punctuation consistently for Telegram auto replies', () => {
  assert.equal(normalizeTelegramText('  ሰላም, Church! '), 'ሰላም church');
});

test('auto-reply matching uses priority and whole-phrase boundaries', () => {
  const rules = [
    { id: 1, priority: 20, matchType: 'CONTAINS', keywords: ['service'], responses: { en: 'later' } },
    { id: 2, priority: 10, matchType: 'CONTAINS', keywords: ['service time'], responses: { en: 'schedule' } },
    { id: 3, priority: 1, matchType: 'CONTAINS', keywords: ['vice'], responses: { en: 'not this' } },
  ];

  assert.equal(findAutoReplyRule(rules, 'What is the service time?')?.id, 2);
  assert.equal(findAutoReplyRule(rules, 'advice please'), null);
});

test('exact auto-reply matching and localized response fallback are deterministic', () => {
  const rule = { id: 1, priority: 1, matchType: 'EXACT', keywords: ['ሰላም'], responses: { en: 'Hello', am: 'ሰላም' } };
  assert.equal(findAutoReplyRule([rule], 'ሰላም!')?.id, 1);
  assert.equal(localizedValue(rule.responses, 'om'), 'Hello');
});

test('localized configuration requires all supported languages', () => {
  assert.deepEqual(
    validateLocalized({ en: 'Welcome', am: 'እንኳን ደህና መጡ', om: 'Baga nagaan dhuftan' }, 'Response', 200),
    { en: 'Welcome', am: 'እንኳን ደህና መጡ', om: 'Baga nagaan dhuftan' },
  );
  assert.throws(() => validateLocalized({ en: 'Welcome' }, 'Response', 200), { status: 400 });
});
