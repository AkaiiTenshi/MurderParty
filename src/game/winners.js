// Daily winner selection. Pure functions; `rng` is injectable for tests.

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupBy(list, key) {
  const groups = new Map();
  for (const item of list) {
    const k = key(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }
  return groups;
}

// Pick k players from a group: lowest weekly wins first, whole tiers while they fit,
// random draw inside the tier that overflows.
export function pickK(group, k, rng = Math.random) {
  if (group.length <= k) return [...group];
  const tiers = [...groupBy(group, (p) => p.wins).entries()]
    .sort(([a], [b]) => a - b)
    .map(([, players]) => players);
  const picked = [];
  for (const tier of tiers) {
    const room = k - picked.length;
    if (room <= 0) break;
    if (tier.length <= room) picked.push(...tier);
    else picked.push(...shuffle(tier, rng).slice(0, room));
  }
  return picked;
}

// Players grouped by equal points, best first.
export function places(players) {
  return [...groupBy(players, (p) => p.points).entries()]
    .sort(([a], [b]) => b - a)
    .map(([, group]) => group);
}

// players: [{ id, points, wins, impeded }]. Players without points can't win.
export function selectWinners(players, day, rng = Math.random) {
  const ranked = places(players.filter((p) => !p.impeded && p.points > 0));
  if (ranked.length === 0) return [];

  if (day === 1) {
    const winners = [];
    for (const place of ranked) {
      const room = 3 - winners.length;
      if (room <= 0) break;
      winners.push(...pickK(place, room, rng));
    }
    return winners;
  }

  return pickK(ranked[0], 3, rng);
}
