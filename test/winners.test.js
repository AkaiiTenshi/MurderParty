import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickK, selectWinners } from '../src/game/winners.js';

const p = (id, points, wins = 0, impeded = false) => ({ id, points, wins, impeded });
const ids = (list) => list.map((x) => x.id).sort();
// Deterministic rngs: always first / always last element after shuffle.
const rngLow = () => 0;
const rngHigh = () => 0.999;

test('pickK takes lowest-wins tiers then draws in the overflowing tier', () => {
  const group = [p('A', 5, 0), p('B', 5, 0), p('C', 5, 1), p('D', 5, 1), p('E', 5, 2)];
  for (const rng of [rngLow, rngHigh, Math.random]) {
    const picked = ids(pickK(group, 3, rng));
    assert.equal(picked.length, 3);
    assert.ok(picked.includes('A') && picked.includes('B'));
    assert.ok(picked.includes('C') !== picked.includes('D'));
  }
});

test('pickK with k=1 follows the original examples', () => {
  // A1 B0 C2 D0 E1 -> random between B and D
  const g1 = [p('A', 1, 1), p('B', 1, 0), p('C', 1, 2), p('D', 1, 0), p('E', 1, 1)];
  for (let i = 0; i < 20; i++) assert.ok(['B', 'D'].includes(pickK(g1, 1)[0].id));
  // A1 B2 C0 -> C
  assert.equal(pickK([p('A', 1, 1), p('B', 1, 2), p('C', 1, 0)], 1)[0].id, 'C');
  // A1 B2 C1 D1 -> random between A, C, D
  const g3 = [p('A', 1, 1), p('B', 1, 2), p('C', 1, 1), p('D', 1, 1)];
  for (let i = 0; i < 20; i++) assert.ok(['A', 'C', 'D'].includes(pickK(g3, 1)[0].id));
});

test('day 1: exactly 3 winners filled place by place', () => {
  // 1 first, 3 tied second -> first + 2 random of second
  const players = [p('A', 10), p('B', 8), p('C', 8), p('D', 8), p('E', 2)];
  const w = ids(selectWinners(players, 1));
  assert.equal(w.length, 3);
  assert.ok(w.includes('A'));
  assert.ok(!w.includes('E'));

  // 2 tied first, 1 second, 1 third -> first two + second
  assert.deepEqual(ids(selectWinners([p('A', 9), p('B', 9), p('C', 5), p('D', 1)], 1)), ['A', 'B', 'C']);

  // 5 tied first -> 3 among them
  const five = ['A', 'B', 'C', 'D', 'E'].map((id) => p(id, 4));
  assert.equal(selectWinners([...five, p('F', 1)], 1).length, 3);
  assert.ok(!ids(selectWinners([...five, p('F', 1)], 1)).includes('F'));

  // 1, 1, 1 distinct places
  assert.deepEqual(ids(selectWinners([p('A', 3), p('B', 2), p('C', 1), p('D', 0)], 1)), ['A', 'B', 'C']);
});

test('players with 0 points never win', () => {
  assert.deepEqual(selectWinners([p('A', 0), p('B', 0)], 2), []);
  assert.deepEqual(ids(selectWinners([p('A', 4), p('B', 0), p('C', 0)], 1)), ['A']);
});

test('days 2+: single winner or all first-place ties up to 3', () => {
  assert.deepEqual(ids(selectWinners([p('A', 9), p('B', 8)], 2)), ['A']);
  assert.deepEqual(ids(selectWinners([p('A', 9), p('B', 9), p('C', 1)], 3)), ['A', 'B']);
  assert.deepEqual(ids(selectWinners([p('A', 9), p('B', 9), p('C', 9), p('D', 1)], 3)), ['A', 'B', 'C']);
  // >3 tied -> lowest weekly wins first: A0 B0 + one of C1/D1, never E2
  const tied = [p('A', 9, 0), p('B', 9, 0), p('C', 9, 1), p('D', 9, 1), p('E', 9, 2)];
  for (let i = 0; i < 20; i++) {
    const w = ids(selectWinners(tied, 4));
    assert.equal(w.length, 3);
    assert.ok(w.includes('A') && w.includes('B') && !w.includes('E'));
  }
});

test('impeded players are removed from the ranking', () => {
  assert.deepEqual(ids(selectWinners([p('A', 9, 0, true), p('B', 5)], 2)), ['B']);
  // day 1: impeded second place lets third move up
  const w = ids(selectWinners([p('A', 9), p('B', 7, 0, true), p('C', 5), p('D', 3), p('E', 1)], 1));
  assert.deepEqual(w, ['A', 'C', 'D']);
});
