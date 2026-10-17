import test from 'node:test';
import assert from 'node:assert/strict';
import { ethiopianDateToGregorian, gregorianDateToEthiopian } from '../src/utils/ethiopianCalendar.js';

test('Gregorian and Ethiopian calendar conversions round-trip at new year and Pagume boundaries', () => {
  const dates = [
    [{ year: 2017, month: 1, day: 1 }, '2024-09-11'],
    [{ year: 2016, month: 13, day: 5 }, '2024-09-10'],
    [{ year: 2015, month: 13, day: 6 }, '2023-09-11'],
  ];

  for (const [ethiopian, gregorian] of dates) {
    assert.equal(ethiopianDateToGregorian(ethiopian), gregorian);
    assert.deepEqual(gregorianDateToEthiopian(gregorian), ethiopian);
  }
});

test('Gregorian conversion rejects impossible dates', () => {
  assert.throws(() => gregorianDateToEthiopian('2024-02-30'), RangeError);
});