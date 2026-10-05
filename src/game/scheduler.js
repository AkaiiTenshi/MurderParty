import cron from 'node-cron';
import { db, getGame, allPlayers, setSetting, saveDailyScore, updatePlayer } from '../db.js';
import { announce, dm, gmLog } from '../guards.js';
import { dailyReport, winnerDM, wakeAlert, CURED_DM } from '../messages.js';
import { expectedDay, isAfterEndOfDay, TIMEZONE } from './clock.js';
import { selectWinners } from './winners.js';
import { shouldWake, CURE_IMMUNITY_DAYS, ACTIVE } from './rules.js';

// 23:42 — rank the day, pick winners, give pending tickets, lock ticket commands.
export async function endDay(client) {
  const game = getGame();
  if (!game.started || game.lastEndDay >= game.day) return null;
  const day = game.day;

  const players = allPlayers().map((p) => ({ ...p, impeded: p.impeded_day === day }));
  const winners = selectWinners(players, day);
  const winnerIds = new Set(winners.map((w) => w.id));

  db.transaction(() => {
    for (const p of players) {
      saveDailyScore({
        day, player_id: p.id, points: p.points, impeded: p.impeded ? 1 : 0, winner: winnerIds.has(p.id) ? 1 : 0,
      });
      if (winnerIds.has(p.id)) {
        updatePlayer(p.id, { wins: p.wins + 1, pending_tickets: p.pending_tickets + 1 });
      }
    }
    setSetting('locked', 1);
    setSetting('last_endday_day', day);
  })();

  if (winners.length) await announce(client, dailyReport());
  const names = winners.length ? winners.map((w) => `<@${w.id}> (${w.points} pts)`).join(', ') : 'aucun';
  await gmLog(client, `📊 **Fin du jour ${day}** — gagnant(s) : ${names}`);
  for (const w of winners) await dm(client, w.id, winnerDM);
  return winners;
}

// 00:00 — activate tickets, reset daily points, wake comas, next day.
export async function midnight(client) {
  let game = getGame();
  if (!game.started) return;
  if (game.lastEndDay < game.day) await endDay(client);
  game = getGame();
  const newDay = game.day + 1;

  const woken = [];
  db.transaction(() => {
    for (const p of allPlayers()) {
      const fields = { tickets: p.tickets + p.pending_tickets, pending_tickets: 0, points: 0 };
      if (shouldWake(p, newDay)) {
        Object.assign(fields, { state: ACTIVE, coma_day: null, immune_until: newDay + CURE_IMMUNITY_DAYS });
        woken.push(p.id);
      }
      updatePlayer(p.id, fields);
    }
    setSetting('day', newDay);
    setSetting('locked', 0);
  })();

  await gmLog(client, `🌙 **Jour ${newDay}** — tickets activés, points remis à zéro.`);
  for (const id of woken) {
    await announce(client, wakeAlert(id), [id]);
    await dm(client, id, CURED_DM);
    await gmLog(client, `⏰ Réveil automatique de <@${id}>.`);
  }
}

// Brings the game in line with the clock: replays missed midnights and the 23:42 lock.
// Safe to call any time; runs every minute and at boot.
let running = false;
export async function catchUp(client) {
  if (running) return;
  running = true;
  try {
    let game = getGame();
    if (!game.started) return;
    while (game.day < expectedDay(game.startDate)) {
      await midnight(client);
      game = getGame();
    }
    if (isAfterEndOfDay() && game.lastEndDay < game.day) await endDay(client);
  } catch (err) {
    console.error('Scheduler error:', err);
  } finally {
    running = false;
  }
}

export function startScheduler(client) {
  cron.schedule('* * * * *', () => catchUp(client), { timezone: TIMEZONE });
  return catchUp(client);
}
