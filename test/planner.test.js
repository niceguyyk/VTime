import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAvailability, isValidDate, isValidTimeZone } from '../src/planner.js';

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
