// Europe/Paris time helpers. All game logic works on Paris calendar dates.
export const TIMEZONE = 'Europe/Paris';
export const END_OF_DAY = { hour: 23, minute: 42 };

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Returns { date: 'YYYY-MM-DD', hour, minute } in Paris time.
export function parisNow(now = new Date()) {
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

// Whole calendar days between two 'YYYY-MM-DD' strings.
export function daysBetween(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

// Game day expected by the calendar (start date = day 1).
export function expectedDay(startDate, now = new Date()) {
  return daysBetween(startDate, parisNow(now).date) + 1;
}

export function isAfterEndOfDay(now = new Date()) {
  const { hour, minute } = parisNow(now);
  return hour > END_OF_DAY.hour || (hour === END_OF_DAY.hour && minute >= END_OF_DAY.minute);
}
