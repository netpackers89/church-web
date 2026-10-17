import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePaymentMethods, validatePaymentReference } from '../src/services/paymentMethods.js';

test('only explicitly configured public payment methods are returned', () => {
  const methods = normalizePaymentMethods([
    { id: 'bank-main', name: 'Verified bank', type: 'BANK', accountHolder: 'Church', accountNumber: '1234567', currency: 'ETB', isPublic: true },
    { id: 'hidden', name: 'Hidden', type: 'BANK', accountNumber: '111', isPublic: false },
    { id: 'bad-logo', name: 'Telebirr', type: 'TELEBIRR', phoneNumber: '+251911111111', logoUrl: 'javascript:alert(1)' },
  ]);
  assert.equal(methods.length, 2);
  assert.equal(methods[0].id, 'bank-main');
  assert.equal(methods[1].logoUrl, null);
});

test('legacy bank settings remain readable without fabricating additional providers', () => {
  const methods = normalizePaymentMethods(undefined, { bankName: 'Actual bank', accountHolder: 'Church', accountNumber: '987654' });
  assert.equal(methods.length, 1);
  assert.equal(methods[0].id, 'legacy-bank-account');
  assert.equal(methods[0].name, 'Actual bank');
});

test('transaction references preserve ordinary punctuation and reject malformed values', () => {
  assert.equal(validatePaymentReference('TXN-123 / #4'), 'TXN-123 / #4');
  assert.throws(() => validatePaymentReference('!@'), /valid transaction reference/);
  assert.throws(() => validatePaymentReference('x'.repeat(201)), /valid transaction reference/);
});
