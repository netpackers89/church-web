import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewChristianSubmission, getNewChristianStatusLabel } from '../src/controllers/publicController.js';

test('new-christian submissions distinguish between accepted and not-yet decisions', () => {
  const accepted = normalizeNewChristianSubmission({
    fullName: 'Aster Bekele',
    phone: '+251912345678',
    email: 'aster@example.com',
    location: 'Yeka Abado Kela',
    preferredContactMethod: 'telegram',
    preferredLanguage: 'en',
    acceptedJesus: 'yes',
    consentToContact: true,
    prayerRequest: 'Please pray for my family.',
  });

  assert.equal(accepted.status, 'NEW_BELIEVER');
  assert.equal(accepted.acceptedJesus, true);
  assert.equal(accepted.fullName, 'Aster Bekele');

  const notYet = normalizeNewChristianSubmission({
    fullName: 'Dawit Alemu',
    phone: '+251934567890',
    email: 'dawit@example.com',
    location: 'G7',
    preferredContactMethod: 'phone',
    acceptedJesus: 'not-yet',
    consentToContact: true,
    prayerRequest: 'I want to learn more about Jesus.',
  });

  assert.equal(notYet.status, 'NEWCOMER');
  assert.equal(notYet.acceptedJesus, false);
  assert.equal(getNewChristianStatusLabel('NEW_BELIEVER'), 'New believer');
});

test('new-christian submission rejects unclear faith answers and missing contact consent', () => {
  const base = {
    fullName: 'Mimi Tesfaye',
    phone: '+251912345678',
    location: 'Ayat',
    preferredContactMethod: 'phone',
    acceptedJesus: 'not-yet',
    consentToContact: true,
  };

  assert.throws(() => normalizeNewChristianSubmission({ ...base, acceptedJesus: 'maybe' }), /Please confirm whether/);
  assert.throws(() => normalizeNewChristianSubmission({ ...base, consentToContact: false }), /give consent/);
  assert.throws(() => normalizeNewChristianSubmission({ ...base, preferredContactMethod: 'email' }), /email address/);
});
