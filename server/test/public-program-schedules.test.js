import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { calendarEvents, listEvents, schedules } from '../src/controllers/publicController.js';

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
  assert.match(queryText, /p\.name AS program_name/);
  assert.match(queryText, /program_name AS name/);
  assert.match(queryText, /s\.status IN \('ACTIVE','SCHEDULED'\)/);
  assert.match(queryText, /COALESCE\(s\.timezone,\$1\)/);
  assert.match(queryText, /AS "nextAt"/);
  assert.match(queryText, /recurrence_start_date IS NULL OR recurrence_start_date<=next_date/);
  assert.match(queryText, /recurrence_end_date IS NULL OR recurrence_end_date>=next_date/);
  assert.match(queryText, /ORDER BY "nextAt" NULLS LAST,name,id/);
  assert.deepEqual(queryValues, [config.churchTimezone]);
});

test('public event listing uses valid SQL for recurring occurrences and keeps database failures visible', async (context) => {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (text, values) => {
    queries.push({ text, values });
    return { rows: [] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await listEvents({ query: { upcoming: 'true', page: '1', limit: '5' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 2);
  assert.match(queries[0].text, /e\.audience_group_id IS NULL AND e\.audience_group_type IS NULL/);
  assert.match(queries[1].text, /WITH RECURSIVE anchors AS/);
  assert.match(queries[1].text, /occurrence_seeds AS/);
  assert.match(queries[1].text, /scheduled AS/);
  assert.match(queries[1].text, /AT TIME ZONE o\.timezone\) AS occurrence_start/);
  assert.match(queries[1].text, /AT TIME ZONE o\.timezone\) AS occurrence_end/);
  assert.doesNotMatch(queries[1].text, /AT TIME ZONE COALESCE\([^)]+\) AS occurrence_/);
  assert.deepEqual(queries[1].values, [config.churchTimezone]);
});

test('calendar endpoint returns one-time and recurring database events for a bounded date range', async (context) => {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (text, values) => {
    queries.push({ text, values });
    if (text.includes('FROM events e')) {
      return { rows: [{ id: '19', title: 'Church anniversary', startAt: '2026-10-24T08:00:00.000Z', timezone: config.churchTimezone }] };
    }
    return { rows: [{ id: 'program-3-2026-10-25', title: 'Sunday Worship', startAt: '2026-10-25T07:00:00.000Z', programType: 'RECURRING' }] };
  };
  context.after(() => { pool.query = originalQuery; });

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await calendarEvents({ query: { from: '2026-10-01', to: '2026-10-31' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.map((event) => event.id), ['19', 'program-3-2026-10-25']);
  assert.equal(response.body.timezone, config.churchTimezone);
  assert.deepEqual(queries.map(({ values }) => values), [
    ['2026-10-01', '2026-10-31', config.churchTimezone],
    ['2026-10-01', '2026-10-31', config.churchTimezone],
  ]);
  assert.match(queries[0].text, /e\.audience_group_id IS NULL AND e\.audience_group_type IS NULL/);
  assert.match(queries[1].text, /recurrence_start_date IS NULL OR s\.recurrence_start_date <= \$2::date/);
  assert.match(queries[1].text, /recurrence_end_date IS NULL OR s\.recurrence_end_date >= \$1::date/);
});

test('calendar endpoint rejects invalid and excessively large ranges before querying', async (context) => {
  const originalQuery = pool.query;
  let queryCount = 0;
  pool.query = async () => { queryCount += 1; throw new Error('should not query'); };
  context.after(() => { pool.query = originalQuery; });

  for (const query of [
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '2026-01-01', to: '2027-02-02' },
  ]) {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await calendarEvents({ query }, response);
    assert.equal(response.statusCode, 400);
  }
  assert.equal(queryCount, 0);
});