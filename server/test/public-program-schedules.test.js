import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { schedules } from '../src/controllers/publicController.js';

test('public schedules return active programs with next occurrences in church timezone', async (context) => {
  const originalQuery = pool.query;
  let queryText = '';
  let queryValues = [];
  pool.query = async (text, values) => {
    queryText = text;
    queryValues = values;
    return { rows: [{ id: '12', name: 'Sunday Worship', nextAt: '2026-10-18T07:00:00.000Z' }] };
  };
  context.after(() => {
    pool.query = originalQuery;
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

  await schedules({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.timezone, config.churchTimezone);
  assert.equal(response.body.data[0].name, 'Sunday Worship');
  assert.match(queryText, /s\.status IN \('ACTIVE','SCHEDULED'\)/);
  assert.match(queryText, /COALESCE\(s\.timezone,\$1\)/);
  assert.match(queryText, /AS "nextAt"/);
  assert.match(queryText, /ORDER BY "nextAt" NULLS LAST,p\.name,s\.id/);
  assert.deepEqual(queryValues, [config.churchTimezone]);
});