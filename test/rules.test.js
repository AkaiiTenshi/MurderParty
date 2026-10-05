import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canBeComa, canBeImpeded, resolveTarget, protectionDay, shouldWake, checkUse, CURE_IMMUNITY_DAYS,
} from '../src/game/rules.js';
import { daysBetween, parisNow, isAfterEndOfDay } from '../src/game/clock.js';

const player = (over = {}) => ({
  id: 'x', tickets: 1, pending_tickets: 0, points: 0, wins: 0, state: 'ACTIVE',
  coma_day: null, immune_until: 0, protected_day: 0, impeded_day: 0, is_killer: 0, ...over,
});

test('hostile actions fall through to the first eligible target', () => {
  const day = 4;
  const protectedP = player({ id: 'a', protected_day: 4 });
  const comatose = player({ id: 'b', state: 'COMATOSE', coma_day: 3 });
  const free = player({ id: 'c' });
  assert.equal(resolveTarget([protectedP, comatose, free], (t) => canBeComa(t, day)).id, 'c');
  assert.equal(resolveTarget([protectedP, comatose], (t) => canBeComa(t, day)), null);
  assert.equal(resolveTarget([free, protectedP], (t) => canBeComa(t, day)).id, 'c');
});

test('cure immunity: cured day 3 -> comable day 6', () => {
  const cured = player({ immune_until: 3 + CURE_IMMUNITY_DAYS });
  assert.equal(canBeComa(cured, 3), false);
  assert.equal(canBeComa(cured, 5), false);
  assert.equal(canBeComa(cured, 6), true);
});

test('impede: not two days in a row (global), re-impede same day ok', () => {
  assert.equal(canBeImpeded(player({ impeded_day: 2 }), 2), true);
  assert.equal(canBeImpeded(player({ impeded_day: 2 }), 3), false);
  assert.equal(canBeImpeded(player({ impeded_day: 2 }), 4), true);
  assert.equal(canBeImpeded(player({ state: 'COMATOSE' }), 4), false);
  assert.equal(canBeImpeded(player({ protected_day: 4 }), 4), false);
});

test('protect after 23:42 applies to the next day', () => {
  assert.equal(protectionDay(3, false), 3);
  assert.equal(protectionDay(3, true), 4);
});

test('coma on day 2 wakes at 00:00 of day 5', () => {
  const p = player({ state: 'COMATOSE', coma_day: 2 });
  assert.equal(shouldWake(p, 4), false);
  assert.equal(shouldWake(p, 5), true);
});

test('command access checks', () => {
  assert.equal(checkUse('coma', player(), { locked: false }), 'unavailable');
  assert.equal(checkUse('coma', player({ is_killer: 1 }), { locked: false }), null);
  assert.equal(checkUse('coma', player({ is_killer: 1, state: 'COMATOSE' }), { locked: false }), 'comatose');
  assert.equal(checkUse('cure', player({ state: 'COMATOSE' }), { locked: false }), null);
  assert.equal(checkUse('query', player(), { locked: true }), 'locked');
  assert.equal(checkUse('protect', player(), { locked: true }), null);
  assert.equal(checkUse('query', player({ tickets: 0 }), { locked: false }), 'noTicket');
});

test('Paris clock helpers', () => {
  assert.equal(daysBetween('2026-10-30', '2026-11-02'), 3);
  // 21:42 UTC in October (CEST, UTC+2) = 23:42 Paris
  assert.equal(isAfterEndOfDay(new Date('2026-10-05T21:42:00Z')), true);
  assert.equal(isAfterEndOfDay(new Date('2026-10-05T21:41:00Z')), false);
  assert.equal(parisNow(new Date('2026-10-05T22:30:00Z')).date, '2026-10-06');
});
