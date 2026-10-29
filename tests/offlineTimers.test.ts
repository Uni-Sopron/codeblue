import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOfflineDeadlines, remainingOfflineSeconds, pruneOfflineDeadlines } from '../src/utils/offlineTimers.ts';

test('room snapshots hydrate individual offline countdowns without restarting an existing deadline', () => {
  const initial = mergeOfflineDeadlines({}, { p1: 30, p2: 12 }, 1000);
  assert.deepEqual(initial, { p1: 31000, p2: 13000 });
  const refreshed = mergeOfflineDeadlines(initial, { p1: 30, p2: 12 }, 3000);
  assert.deepEqual(refreshed, initial);
  assert.deepEqual(remainingOfflineSeconds(refreshed, 3500), { p1: 28, p2: 10 });
});

test('a server snapshot can shorten the remaining limit and clears players who reconnected', () => {
  const previous = { p1: 31000, p2: 25000 };
  assert.deepEqual(mergeOfflineDeadlines(previous, { p1: 4 }, 10000), { p1: 14000 });
  assert.deepEqual(mergeOfflineDeadlines(previous, {}, 10000), {});
});

test('countdowns use elapsed wall-clock time after a background tab pauses callbacks', () => {
  const deadlines = mergeOfflineDeadlines({}, { p1: 30, p2: 15 }, 1000);
  assert.deepEqual(remainingOfflineSeconds(deadlines, 24500), { p1: 7 });
  assert.deepEqual(remainingOfflineSeconds(deadlines, 31000), {});
  assert.deepEqual(pruneOfflineDeadlines(deadlines, 24500), { p1: 31000 });
  assert.equal(pruneOfflineDeadlines(deadlines, 5000), deadlines);
});

test('a second disconnection receives a fresh deadline after the player returned', () => {
  const first = mergeOfflineDeadlines({}, { p1: 30 }, 1000);
  const returned = mergeOfflineDeadlines(first, {}, 5000);
  const second = mergeOfflineDeadlines(returned, { p1: 30 }, 7000);
  assert.equal(second.p1, 37000);
});

test('invalid or expired timers never display negative seconds or persist in the active set', () => {
  assert.deepEqual(mergeOfflineDeadlines({}, { p1: 0, p2: -1, p3: NaN, p4: Infinity }, 1000), {});
  assert.deepEqual(remainingOfflineSeconds({ p1: 0, p2: -100, p3: NaN, p4: 1001 }, 1000), { p4: 1 });
  assert.deepEqual(pruneOfflineDeadlines({ p1: NaN, p2: 1000 }, 1000), {});
});
