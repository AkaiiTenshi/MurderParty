import path from 'node:path';

// Docker injects .env through env_file; for local runs load it ourselves.
try {
  process.loadEnvFile();
} catch {
  // no .env file: rely on the environment
}

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'SUSPECT_ROLE_ID', 'GM_ROLE_ID'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  suspectRoleId: process.env.SUSPECT_ROLE_ID,
  gmRoleId: process.env.GM_ROLE_ID,
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
};
