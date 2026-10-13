import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAvailability, isValidDate, isValidTimeZone, localParts } from '../src/planner.js';

const person = (time_zone, available_from = '13:00:00', available_until = '21:00:00') => ({ time_zone, available_from, available_until });

test('finds the full-team window in the viewer time zone', () => {
  const plan = calculateAvailability([
    person('Europe/Berlin'), person('America/New_York')
  ], '2026-10-13', 'Europe/Berlin');
  assert.equal(plan.total, 2);
  assert.deepEqual(plan.windows.map(({ start, end }) => [start, end]), [['19:00', '21:00']]);
  assert.equal(plan.recommended.start, '19:00');
});

test('handles half-hour offsets and a partial fallback', () => {
  const plan = calculateAvailability([
    person('Europe/Berlin'), person('Asia/Kolkata')
  ], '2026-10-13', 'Europe/Berlin');
  assert.deepEqual(plan.windows.map(({ start, end }) => [start, end]), [['13:00', '17:30']]);

  const noOverlap = calculateAvailability([
    person('Europe/Berlin'), person('Australia/Sydney')
  ], '2026-10-13', 'Europe/Berlin');
  assert.equal(noOverlap.windows.length, 0);
  assert.equal(noOverlap.bestPartial.count, 1);
});

test('rejects invalid dates and zones', () => {
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidTimeZone('Not/A_Zone'), false);
  assert.throws(() => calculateAvailability([], '2026-02-30', 'UTC'));
});

test('EDT and UTC offsets stay fixed across daylight saving changes', () => {
  assert.equal(isValidTimeZone('EDT'), true);
  assert.equal(isValidTimeZone('MDT'), true);
  assert.equal(isValidTimeZone('BST'), true);
  assert.equal(isValidTimeZone('UTC+5:30'), true);
  assert.equal(isValidTimeZone('UTC+15'), false);
  const winter = calculateAvailability([
    person('Europe/Berlin'), person('EDT')
  ], '2026-01-13', 'UTC+1');
  assert.deepEqual(winter.windows.map(({ start, end }) => [start, end]), [['18:00', '21:00']]);
  const instant = Date.parse('2026-01-13T17:00:00Z');
  assert.deepEqual(localParts(instant, 'EDT'), { date: '2026-01-13', hour: 13, minute: 0 });
  assert.deepEqual(localParts(instant, 'MDT'), { date: '2026-01-13', hour: 11, minute: 0 });
  assert.deepEqual(localParts(instant, 'BST'), { date: '2026-01-13', hour: 18, minute: 0 });
  assert.deepEqual(localParts(instant, 'UTC+5:30'), { date: '2026-01-13', hour: 22, minute: 30 });
});
