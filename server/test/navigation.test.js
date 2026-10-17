import test from 'node:test';
import assert from 'node:assert/strict';
import { punctuality } from '../src/utils/navigation.js';

const schedule = { programStart: '2026-10-11T07:00:00.000Z', programEnd: '2026-10-11T09:00:00.000Z' };
test('marks an arrival before a future program as on time', () => {
  assert.equal(punctuality({ ...schedule, now: '2026-10-11T06:00:00.000Z', travelMinutes: 30 }).state, 'ON_TIME');
});
test('marks an arrival after a future start as late', () => {
  assert.equal(punctuality({ ...schedule, now: '2026-10-11T06:45:00.000Z', travelMinutes: 30 }).state, 'LATE');
});
test('does not call someone late after a program has begun or ended', () => {
  assert.equal(punctuality({ ...schedule, now: '2026-10-11T07:30:00.000Z', travelMinutes: 20 }).state, 'DURING_PROGRAM');
  assert.equal(punctuality({ ...schedule, now: '2026-10-11T08:50:00.000Z', travelMinutes: 20 }).state, 'AFTER_PROGRAM');
  assert.equal(punctuality({ ...schedule, now: '2026-10-11T09:01:00.000Z', travelMinutes: 1 }).state, 'FINISHED');
});
