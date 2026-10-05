import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { db } from './db.js';
import { parisNow } from './game/clock.js';

const BACKUP_DIR = path.join(config.dataDir, 'backups');
const KEEP = 72;

// Consistent snapshot of the live database (safe while the bot is running).
export async function backupNow() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const now = parisNow();
  const stamp = `${now.date}_${String(now.hour).padStart(2, '0')}h${String(now.minute).padStart(2, '0')}`;
  const file = path.join(BACKUP_DIR, `root-${stamp}.db`);
  await db.backup(file);
  fs.copyFileSync(file, path.join(BACKUP_DIR, 'latest.db'));

  const old = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('root-')).sort().slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f));
  return file;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Sauvegarde créée : ${await backupNow()}`);
}
