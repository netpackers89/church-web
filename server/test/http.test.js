import assert from 'node:assert/strict';
import test from 'node:test';
import { requestError } from '../src/utils/http.js';

test('database connection failures return a generic 503 without exposing details', () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
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

    requestError(Object.assign(new Error('Connection terminated due to connection timeout'), { code: 'ETIMEDOUT' }), response);

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { error: 'The database is temporarily unavailable.' });
  } finally {
    console.error = originalConsoleError;
  }
});
