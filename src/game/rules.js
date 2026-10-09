// Game rules as pure functions over player rows:
// { id, tickets, pending_tickets, points, wins, state, coma_day, immune_until,
//   protected_day, impeded_day, is_killer }

export const ACTIVE = 'ACTIVE';
export const COMATOSE = 'COMATOSE';

// Cured on day D -> immune through D+2 (comable again on D+3).
export const CURE_IMMUNITY_DAYS = 2;
// Coma on day D -> automatic wake-up at 00:00 of day D+3.
export const COMA_WAKE_AFTER_DAYS = 3;

export const isComatose = (p) => p.state === COMATOSE;
export const isProtected = (p, day) => p.protected_day === day;

export function canBeComa(p, day) {
  return !isComatose(p) && !isProtected(p, day) && day > (p.immune_until ?? 0);
}

// Already impeded today is fine (silent no-op); impeded yesterday is not.
export function canBeImpeded(p, day) {
  return !isComatose(p) && !isProtected(p, day) && p.impeded_day !== day - 1;
}

// First eligible target in priority order, or null.
export function resolveTarget(targets, isEligible) {
  return targets.find((t) => t && isEligible(t)) ?? null;
}

// A protect issued after the 23:42 lock applies to the next day.
export const protectionDay = (day, locked) => (locked ? day + 1 : day);

export const shouldWake = (p, newDay) =>
  isComatose(p) && p.coma_day != null && newDay >= p.coma_day + COMA_WAKE_AFTER_DAYS;

export function displayState(p, day) {
  if (isComatose(p)) return COMATOSE;
  return isProtected(p, day) ? 'ACTIVE & PROTECTED' : ACTIVE;
}

// Ticket commands. lockedOk = allowed during 23:42-00:00, comatoseOk = usable while COMATOSE.
export const TICKET_COMMANDS = {
  query: { killerOnly: false, lockedOk: false, comatoseOk: false },
  verify: { killerOnly: false, lockedOk: false, comatoseOk: false },
  protect: { killerOnly: false, lockedOk: true, comatoseOk: false },
  cure: { killerOnly: false, lockedOk: false, comatoseOk: true }, // comatose: self only
  impede: { killerOnly: false, lockedOk: false, comatoseOk: false },
  coma: { killerOnly: true, lockedOk: false, comatoseOk: false },
  corrupt: { killerOnly: true, lockedOk: false, comatoseOk: false },
};

// Returns null when allowed, otherwise a reason key (see messages.js REFUSALS).
export function checkUse(command, p, { locked }) {
  const rule = TICKET_COMMANDS[command];
  if (rule.killerOnly && !p.is_killer) return 'unavailable';
  if (isComatose(p) && !rule.comatoseOk) return 'comatose';
  if (locked && !rule.lockedOk) return 'locked';
  if (p.tickets < 1) return 'noTicket';
  return null;
}

// Commands this player personally has access to (ignores ticket count and lock).
export function availableCommands(p) {
  if (isComatose(p)) return ['status', 'cure (sur vous-même uniquement)', 'channel create'];
  const list = ['man', 'status', 'query', 'verify', 'protect', 'cure', 'impede'];
  if (p.is_killer) list.push('coma', 'corrupt');
  list.push('channel create');
  return list;
}
