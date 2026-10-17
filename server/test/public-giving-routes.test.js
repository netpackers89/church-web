import test from 'node:test';
import assert from 'node:assert/strict';
import publicRoutes from '../src/routes/publicRoutes.js';

test('public routes expose the bank account endpoint used by the giving page', () => {
  const hasBankRoute = publicRoutes.stack.some((layer) => layer.route && layer.route.path === '/bank-account');
  assert.equal(hasBankRoute, true);
});
