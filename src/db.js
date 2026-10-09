import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new Database(path.join(config.dataDir, 'root.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    tickets INTEGER NOT NULL DEFAULT 0,
    pending_tickets INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'ACTIVE',
    coma_day INTEGER,
    immune_until INTEGER NOT NULL DEFAULT 0,
    protected_day INTEGER NOT NULL DEFAULT 0,
    impeded_day INTEGER NOT NULL DEFAULT 0,
    is_killer INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS daily_scores (
    day INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    impeded INTEGER NOT NULL,
    winner INTEGER NOT NULL,
    PRIMARY KEY (day, player_id)
  );
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    day INTEGER,
    author_id TEXT,
    type TEXT NOT NULL,
    targets TEXT,
    result TEXT
  );
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    owner_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    text TEXT NOT NULL
  );
`);

// --- settings -------------------------------------------------------------

export function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? null : String(value));
}

export function getGame() {
  const startDate = getSetting('start_date');
  return {
    started: startDate != null,
    startDate,
    day: Number(getSetting('day') ?? 0),
    locked: getSetting('locked') === '1',
    lastEndDay: Number(getSetting('last_endday_day') ?? 0),
  };
}

// --- players --------------------------------------------------------------

export function getPlayer(id) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id) ?? null;
}

export function ensurePlayer(id) {
  db.prepare('INSERT OR IGNORE INTO players (id) VALUES (?)').run(id);
  return getPlayer(id);
}

export function allPlayers() {
  return db.prepare('SELECT * FROM players').all();
}

const UPDATABLE = new Set([
  'tickets', 'pending_tickets', 'points', 'wins', 'state', 'coma_day',
  'immune_until', 'protected_day', 'impeded_day', 'is_killer',
]);

export function updatePlayer(id, fields) {
  const keys = Object.keys(fields);
  for (const k of keys) if (!UPDATABLE.has(k)) throw new Error(`Champ inconnu : ${k}`);
  if (!keys.length) return;
  db.prepare(`UPDATE players SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`)
    .run({ ...fields, id });
}

// Atomic: returns false when the player has no ticket left.
export function spendTicket(id) {
  return db.prepare('UPDATE players SET tickets = tickets - 1 WHERE id = ? AND tickets > 0').run(id).changes === 1;
}

export function addCounter(id, column, delta) {
  if (!['tickets', 'points'].includes(column)) throw new Error(`Compteur inconnu : ${column}`);
  db.prepare(`UPDATE players SET ${column} = MAX(0, ${column} + ?) WHERE id = ?`).run(delta, id);
}

// --- history --------------------------------------------------------------

export function logAction({ day, authorId, type, targets = [], result = '' }) {
  db.prepare('INSERT INTO actions (day, author_id, type, targets, result) VALUES (?, ?, ?, ?, ?)')
    .run(day, authorId, type, targets.join(','), result);
}

export function saveDailyScore(row) {
  db.prepare(`INSERT OR REPLACE INTO daily_scores (day, player_id, points, impeded, winner)
              VALUES (@day, @player_id, @points, @impeded, @winner)`).run(row);
}

export function dailyScores() {
  return db.prepare('SELECT * FROM daily_scores ORDER BY day, points DESC').all();
}

// --- channels -------------------------------------------------------------

export function addChannel(id, kind, ownerId) {
  db.prepare('INSERT OR REPLACE INTO channels (id, kind, owner_id) VALUES (?, ?, ?)').run(id, kind, ownerId);
}

export function getChannel(id) {
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(id) ?? null;
}

export function removeChannel(id) {
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
}

// --- GM info lines shown in /root status -------------------------------------

export function addInfo(playerId, text) {
  db.prepare('INSERT INTO player_info (player_id, text) VALUES (?, ?)').run(playerId, text);
}

export function playerInfo(playerId) {
  return db.prepare('SELECT id, text FROM player_info WHERE player_id = ? ORDER BY id').all(playerId);
}

export function allInfo() {
  return db.prepare('SELECT id, player_id, text FROM player_info ORDER BY player_id, id').all();
}

export function clearInfo(playerId) {
  return db.prepare('DELETE FROM player_info WHERE player_id = ?').run(playerId).changes;
}

// --- game reset -----------------------------------------------------------

export const startGame = db.transaction((startDate, playerIds) => {
  db.exec('DELETE FROM players; DELETE FROM daily_scores; DELETE FROM actions; DELETE FROM player_info;');
  const insert = db.prepare('INSERT INTO players (id) VALUES (?)');
  for (const id of playerIds) insert.run(id);
  setSetting('start_date', startDate);
  setSetting('day', 1);
  setSetting('locked', 0);
  setSetting('last_endday_day', 0);
});
